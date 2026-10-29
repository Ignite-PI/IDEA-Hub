/**
 * Single shared application account (no registration, no roles).
 *
 * Server-side configuration only (Vercel → Project → Settings → Environment Variables, or local .env):
 *   AUTH_USERNAME        account name (default "IGNITE")
 *   AUTH_PASSWORD_HASH   scrypt hash created with:  node scripts/hash-password.cjs
 *   AUTH_SECRET          long random string used to sign session cookies (rotate it to sign everyone out)
 *   AUTH_SESSION_HOURS   optional, default 12
 *
 * The plain password is never stored anywhere in the code, the repository or the browser bundle.
 */
const crypto = require('crypto');

const COOKIE = 'sbf_session';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function config() {
  const username = (process.env.AUTH_USERNAME || 'IGNITE').trim();
  const passwordHash = (process.env.AUTH_PASSWORD_HASH || '').trim();
  const secret = process.env.AUTH_SECRET || '';
  const hours = Number(process.env.AUTH_SESSION_HOURS) || 12;
  return { username, passwordHash, secret, hours, configured: !!passwordHash && secret.length >= 32 };
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

function createSessionToken(username) {
  const { secret, hours } = config();
  const now = Date.now();
  const payload = b64url(JSON.stringify({ u: username, iat: now, exp: now + hours * 3600_000 }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: new Date(now + hours * 3600_000).toISOString(), maxAge: hours * 3600 };
}

function verifySessionToken(token) {
  const { secret, username, configured } = config();
  if (!configured || !token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.u !== username || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { username: data.u, expiresAt: new Date(data.exp).toISOString() };
  } catch {
    return null;
  }
}

function readCookie(req, name = COOKIE) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const isSecure = (req) => req.secure || req.get('x-forwarded-proto') === 'https' || !!process.env.VERCEL;

function setSessionCookie(req, res, token, maxAge) {
  res.append('Set-Cookie', [
    `${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(isSecure(req) ? ['Secure'] : []),
  ].join('; '));
}

function clearSessionCookie(req, res) {
  res.append('Set-Cookie', [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(isSecure(req) ? ['Secure'] : [])].join('; '));
}

const sessionOf = (req) => verifySessionToken(readCookie(req));

/** Protects every /api route except sign-in endpoints and the minimal health check. */
function requireAuth(req, res, next) {
  const session = sessionOf(req);
  if (!session) return res.status(401).json({ error: 'Please sign in to continue.', code: 'unauthenticated' });
  // Mutating requests must come from the app itself (custom header forces a CORS preflight for other sites)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-sbf-client') !== '1') {
    return res.status(403).json({ error: 'Request blocked.', code: 'forbidden' });
  }
  req.session = session;
  next();
}

module.exports = {
  COOKIE, hashPassword, verifyPassword, config, createSessionToken, verifySessionToken,
  setSessionCookie, clearSessionCookie, sessionOf, requireAuth,
};
