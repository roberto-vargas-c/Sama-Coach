// Sama Coach — serverless proxy for the OpenAI API.
// The page posts {messages, json, model} here; this function adds the secret key (from the
// OPENAI_API_KEY environment variable) and forwards the request, so no key ever ships in the page.

const MAX_BODY = 200_000;          // bytes of JSON per request
const MAX_MESSAGES = 60;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''); // any OpenAI-compatible endpoint
const ALLOWED_MODELS = (process.env.OPENAI_ALLOWED_MODELS || 'gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1').split(',').map(s => s.trim());

function cors(res){
  // Same-origin calls need none of this; it only matters for local tooling and previews.
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJson(req){
  if (req.body && typeof req.body === 'object') return req.body;     // Vercel parses JSON bodies
  const chunks = []; let size = 0;
  for await (const c of req){ size += c.length; if (size > MAX_BODY) throw new Error('too_large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({error:'no_key', message:'OPENAI_API_KEY is not set on the server.'});

  let body;
  try { body = await readJson(req); } catch (e){ return res.status(400).json({error:'bad_request', message:String(e.message || e)}); }
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || !messages.length || messages.length > MAX_MESSAGES) return res.status(400).json({error:'bad_request', message:'messages must be a non-empty array'});
  for (const m of messages){
    if (!m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string') return res.status(400).json({error:'bad_request', message:'each message needs a role and string content'});
  }
  const total = messages.reduce((a, m) => a + m.content.length, 0);
  if (total > MAX_BODY) return res.status(413).json({error:'too_large'});

  const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const payload = {model, messages, temperature: typeof body.temperature === 'number' ? Math.max(0, Math.min(1.5, body.temperature)) : 0.7, max_tokens: Math.min(4000, +body.max_tokens || 1800)};
  if (body.json) payload.response_format = {type:'json_object'};

  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 55_000);
  try {
    const r = await fetch(BASE_URL + '/chat/completions', {
      method:'POST', signal: ctl.signal,
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + key},
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok){
      const msg = data && data.error && data.error.message ? data.error.message : 'OpenAI returned ' + r.status;
      return res.status(r.status === 429 ? 429 : 502).json({error: r.status === 429 ? 'rate_limited' : 'upstream', message: msg});
    }
    const choice = data.choices && data.choices[0];
    const text = choice && choice.message && choice.message.content || '';
    if (!text) return res.status(502).json({error:'empty', message:'The model returned no text.'});
    return res.status(200).json({text, model: data.model || model, truncated: choice.finish_reason === 'length', usage: data.usage || null});
  } catch (e){
    const aborted = e && e.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({error: aborted ? 'timeout' : 'upstream', message: aborted ? 'The model took too long.' : String(e.message || e)});
  } finally { clearTimeout(timer); }
};
