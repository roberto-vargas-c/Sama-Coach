// Local development server: serves the static files and runs api/coach.js at /api/coach,
// the same way Vercel does. Usage:  OPENAI_API_KEY=sk-... node dev.js   (or put the key in .env)
const http = require('http'), fs = require('fs'), path = require('path');
try { // minimal .env loader, no dependency
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')){
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const coach = require('./api/coach.js');
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.wasm':'application/wasm', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json'};
const port = +process.env.PORT || 3000;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/coach'){
    // a tiny shim of Vercel's response helpers
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    return coach(req, res);
  }
  let file = path.join(__dirname, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(__dirname)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err){ res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(data);
  });
}).listen(port, () => console.log(`Sama running at http://localhost:${port}  (coach proxy at /api/coach, key ${process.env.OPENAI_API_KEY ? 'set' : 'MISSING'})`));
