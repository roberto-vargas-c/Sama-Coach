// Sama Help — the support chat behind Profile → Help.
//   {mode:'ask',  messages:[{role,content}], lang}  → an answer about the app from the AI model: {reply, needs_human}
//   {mode:'send', message, email, transcript, info}  → emails the Sama team: {ok:true}
// The team's address lives only in the SUPPORT_EMAIL environment variable, never in the page or the repository.
// Email goes through Resend when RESEND_API_KEY is set (SUPPORT_FROM optional), otherwise through FormSubmit
// (no account: the first message asks the inbox to confirm once).

const KNOWLEDGE = require('./_support-knowledge.js');
const MODEL = process.env.SUPPORT_MODEL || process.env.OPENAI_MODEL || 'gpt-6.1-sol';
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const isReasoning = m => /^(gpt-5|gpt-6|o\d)/.test(m);
const LANGS = {en: 'English', es: 'Spanish (tú)', de: 'German (du)'};

// a light brake per address (per server instance): enough to stop a loop or a bored script
const hits = new Map();
function limited(ip, kind, max){
  const now = Date.now(), k = kind + ':' + ip, list = (hits.get(k) || []).filter(t => now - t < 3600e3);
  list.push(now); hits.set(k, list); if (hits.size > 5000) hits.clear();
  return list.length > max;
}

async function readJson(req){
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = []; let size = 0;
  for await (const c of req){ size += c.length; if (size > 60_000) throw new Error('too_large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
const clip = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').slice(0, n);

function system(lang){
  return `You are Sama Help, the support assistant inside Sama, a free yoga app. Help people use the app and solve problems with it.
Answer in ${LANGS[lang] || 'English'}. Be warm, short and concrete: at most about 120 words, plain text, short numbered steps when there are steps, no markdown headings or bold.
Use only the facts below about the app. Never invent buttons, settings or features; if the facts don't cover something, say you are not sure.
Only help with Sama itself. For yoga, health or pose questions, suggest the Coach tab (and a doctor or teacher for pain or injury). Politely decline anything unrelated.
Never ask for passwords or payment details.
Set needs_human to true when the problem looks like a bug, data or account loss, a payment or donation question, a request for a feature, a complaint, a privacy or deletion request you can't solve with the app's own buttons, or when the person asks for a human or says the answer did not help. Then say in one sentence that they can send the conversation to the Sama team with the button below.
Reply as JSON: {"reply": "...", "needs_human": true|false}.

FACTS ABOUT SAMA:
${KNOWLEDGE}`;
}

async function ask(body, res){
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({error: 'no_key'});
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  if (!msgs.length || msgs.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) return res.status(400).json({error: 'bad_request'});
  const messages = [{role: 'system', content: system(body.lang)}, ...msgs.map(m => ({role: m.role, content: clip(m.content, 2000)}))];
  const build = m => { const p = {model: m, messages, response_format: {type: 'json_object'}};
    if (isReasoning(m)){ p.reasoning_effort = 'low'; p.max_completion_tokens = 6000; } else { p.temperature = 0.3; p.max_tokens = 600; } return p; };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45_000);
  const call = m => fetch(BASE_URL + '/chat/completions', {method: 'POST', signal: ctl.signal, headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, body: JSON.stringify(build(m))});
  try {
    let r = await call(MODEL), data = await r.json().catch(() => ({}));
    if (!r.ok && [400, 403, 404].includes(r.status) && FALLBACK_MODEL !== MODEL){ r = await call(FALLBACK_MODEL); data = await r.json().catch(() => ({})); }
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({error: r.status === 429 ? 'rate_limited' : 'upstream'});
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    let out; try { out = JSON.parse(text); } catch { out = {reply: text, needs_human: false}; }
    const reply = clip(out.reply, 3000).trim();
    if (!reply) return res.status(502).json({error: 'empty'});
    return res.status(200).json({reply, needs_human: !!out.needs_human});
  } catch (e){
    return res.status(e && e.name === 'AbortError' ? 504 : 502).json({error: 'upstream'});
  } finally { clearTimeout(timer); }
}

async function mail({subject, text, replyTo}){
  const to = process.env.SUPPORT_EMAIL;
  if (!to) throw Object.assign(new Error('SUPPORT_EMAIL is not set'), {code: 'no_destination'});
  if (process.env.RESEND_API_KEY){
    const r = await fetch('https://api.resend.com/emails', {method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY},
      body: JSON.stringify({from: process.env.SUPPORT_FROM || 'Sama Help <onboarding@resend.dev>', to: [to], subject, text, reply_to: replyTo || undefined})});
    if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return;
  }
  const site = process.env.SITE_URL || 'https://sama.rest';
  const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': site, 'Referer': site + '/'},
    body: JSON.stringify({_subject: subject, _template: 'basic', _captcha: 'false', name: 'Sama Help', email: replyTo || undefined, message: text})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || String(j.success) !== 'true') throw new Error('formsubmit ' + r.status + ' ' + clip(j.message, 200));
}

async function send(body, res){
  if (body.website) return res.status(200).json({ok: true}); // a form-filling bot took the bait
  const message = clip(body.message, 4000).trim(), transcript = clip(body.transcript, 12000).trim();
  if (message.length < 3 && transcript.length < 3) return res.status(400).json({error: 'empty'});
  const email = clip(body.email, 200).trim();
  const replyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '';
  const info = body.info && typeof body.info === 'object' ? body.info : {};
  const infoText = Object.entries(info).slice(0, 15).map(([k, v]) => `${clip(k, 30)}: ${clip(v, 300)}`).join('\n');
  const first = (message || transcript).split('\n')[0].slice(0, 70);
  const text = [`From: ${replyTo || 'no email given'}`, '', message ? 'Message:\n' + message : '', transcript ? 'Conversation with Sama Help:\n' + transcript : '', infoText ? 'Device:\n' + infoText : ''].filter(Boolean).join('\n\n');
  try { await mail({subject: 'Sama help: ' + first, text, replyTo}); return res.status(200).json({ok: true}); }
  catch (e){ console.warn('support mail', e.message); return res.status(502).json({error: e.code || 'mail_failed'}); }
}

module.exports = async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'method_not_allowed'});
  let body; try { body = await readJson(req); } catch { return res.status(400).json({error: 'bad_request'}); }
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  if (body.mode === 'send'){ if (limited(ip, 'send', 6)) return res.status(429).json({error: 'rate_limited'}); return send(body, res); }
  if (limited(ip, 'ask', 60)) return res.status(429).json({error: 'rate_limited'});
  return ask(body, res);
};
