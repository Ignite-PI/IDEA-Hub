/**
 * SBF Project Hub — local server: API (server/app.cjs) + static host for the built app.
 * Start: node server/server.cjs   (PORT defaults to 3002)
 * In production on Vercel the same app runs as a Vercel Function (api/index.js).
 * Secrets are read from environment variables or a local .env / .env.local file.
 */
const fs = require('fs');
const path = require('path');

for (const f of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const express = require('express');
const { createApp } = require('./app.cjs');
const repo = require('./repositories/index.cjs');
const aiStatus = require('./ai/azureOpenAI.cjs').status;
const auth = require('./auth.cjs');

const PORT = Number(process.env.PORT) || 3002;
const app = createApp();

// Static app (production build) — registered after the API so /api is never shadowed
const DIST = path.join(__dirname, '..', 'dist');
const root = express();
root.use(app);
root.use(express.static(DIST));
root.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

(async () => {
  await repo.init();
  root.listen(PORT, () => {
    const ai = aiStatus();
    console.log(`\n✓ SBF Project Hub running at http://localhost:${PORT}`);
    console.log(`  Storage:  ${repo.providerKey}`);
    console.log(`  Sign-in:  ${auth.config().configured ? `configured (user ${auth.config().username})` : 'NOT configured — set AUTH_PASSWORD_HASH and AUTH_SECRET (see .env.example)'}`);
    console.log(`  AI:       ${ai.configured ? `Azure OpenAI (${ai.deployment})` : 'not configured (optional)'}\n`);
  });
})();
