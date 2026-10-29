/**
 * Creates the AUTH_PASSWORD_HASH value for the shared sign-in account.
 *   node scripts/hash-password.cjs            → generates a strong password + its hash
 *   node scripts/hash-password.cjs "<pass>"   → hashes the given password
 * Put only the HASH (never the password) in Vercel env vars / .env.
 */
const crypto = require('crypto');
const { hashPassword } = require('../server/auth.cjs');

function generate(len = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_+=?';
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#%*-_+=?'];
  for (;;) {
    const pw = Array.from({ length: len }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    if (sets.every((s) => [...pw].some((c) => s.includes(c)))) return pw;
  }
}

const password = process.argv[2] || generate();
console.log(JSON.stringify({ password: process.argv[2] ? '(as given)' : password, AUTH_PASSWORD_HASH: hashPassword(password), AUTH_SECRET: crypto.randomBytes(48).toString('base64url') }, null, 2));
