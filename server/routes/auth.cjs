const express = require('express');
const repo = require('../repositories/index.cjs');
const auth = require('../auth.cjs');

const router = express.Router();
const LIMITS = { windowMinutes: 15, maxFailures: 8, lockMinutes: 15 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clientKey = (req) => `ip:${String(req.get('x-forwarded-for') || req.ip || 'unknown').split(',')[0].trim()}`;

router.get('/session', (req, res) => {
  const s = auth.sessionOf(req);
  res.set('Cache-Control', 'no-store');
  res.json(s ? { authenticated: true, username: s.username, expiresAt: s.expiresAt } : { authenticated: false });
});

router.post('/login', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const cfg = auth.config();
    if (!cfg.configured) {
      return res.status(503).json({ error: 'Sign-in has not been configured on the server yet. Ask the administrator to set the AUTH environment variables.', code: 'auth_not_configured' });
    }
    const key = clientKey(req);
    const state = await repo.getLoginState(key);
    if (state?.lockedUntil && Date.parse(state.lockedUntil) > Date.now()) {
      const mins = Math.ceil((Date.parse(state.lockedUntil) - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many unsuccessful attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`, code: 'locked' });
    }

    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const userOk = username.length === cfg.username.length && username.toUpperCase() === cfg.username.toUpperCase();
    const passOk = auth.verifyPassword(password, cfg.passwordHash); // always evaluated (no timing shortcut)
    if (!userOk || !passOk || !password) {
      await repo.recordLoginFailure(key, LIMITS);
      await sleep(400);
      return res.status(401).json({ error: 'Incorrect username or password.', code: 'invalid_credentials' });
    }

    await repo.clearLoginFailures(key);
    const { token, expiresAt, maxAge } = auth.createSessionToken(cfg.username);
    auth.setSessionCookie(req, res, token, maxAge);
    res.json({ authenticated: true, username: cfg.username, expiresAt });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req, res) => {
  auth.clearSessionCookie(req, res);
  res.json({ authenticated: false });
});

module.exports = router;
