// Sama sign-in check for the AI endpoints: only people signed in to Sama (Firebase Auth) may use them.
// The page sends the Firebase ID token as "Authorization: Bearer <token>"; this verifies it the way the
// Firebase docs describe (RS256 signature against Google's published keys, then the claims), with no dependency.

const crypto = require('crypto');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sama-coach-ef83b';
const KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let keys = null, keysUntil = 0; // kid → public key, cached for as long as Google says (Cache-Control max-age)
async function publicKeys(){
  if (keys && Date.now() < keysUntil) return keys;
  const r = await fetch(KEYS_URL);
  if (!r.ok) throw new Error('keys ' + r.status);
  const certs = await r.json(), out = {};
  for (const [kid, pem] of Object.entries(certs)) out[kid] = crypto.createPublicKey(pem);
  const age = +((r.headers.get('cache-control') || '').match(/max-age=(\d+)/) || [])[1] || 3600;
  keys = out; keysUntil = Date.now() + age * 1000;
  return keys;
}
const b64json = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// the signed-in user's uid, or null when the token is missing, expired, forged or for another project
async function verifyIdToken(token){
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let head, claims;
  try { head = b64json(parts[0]); claims = b64json(parts[1]); } catch { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  let key = (await publicKeys())[head.kid];
  if (!key){ keysUntil = 0; key = (await publicKeys())[head.kid]; } // Google rotated its keys since the last fetch
  if (!key) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000), skew = 60;
  if (claims.aud !== PROJECT_ID || claims.iss !== 'https://securetoken.google.com/' + PROJECT_ID) return null;
  if (!(claims.exp > now - skew) || !(claims.iat <= now + skew) || !(claims.auth_time <= now + skew)) return null;
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null;
  return claims.sub;
}

// answers 401 and returns null when the request is not from a signed-in person; otherwise returns their uid
async function requireUser(req, res){
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  let uid = null;
  try { uid = m ? await verifyIdToken(m[1].trim()) : null; }
  catch (e){ console.warn('auth', e.message); res.status(503).json({error: 'auth_unavailable', message: 'Sign-in could not be checked right now. Try again in a moment.'}); return null; }
  if (!uid){ res.status(401).json({error: 'signin', message: 'Sign in to use the coach.'}); return null; }
  return uid;
}

module.exports = {requireUser, verifyIdToken};
