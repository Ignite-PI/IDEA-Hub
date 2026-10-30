/**
 * Express app shared by the local server (server/server.cjs) and the Vercel Function (api/index.js).
 * No filesystem writes and no listen() here, so it runs unchanged in serverless functions.
 */
const express = require('express');
const repo = require('./repositories/index.cjs');
const auth = require('./auth.cjs');
const aiStatus = require('./ai/azureOpenAI.cjs').status;

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  // Public endpoints
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth.cjs'));

  // Everything else requires the shared IGNITE session
  app.use('/api', auth.requireAuth);
  app.get('/api/diagnostics', async (_req, res) => {
    let database = 'ok';
    try { await repo.init(); } catch (e) { database = `error: ${e.message}`; }
    res.json({ storage: repo.providerKey, database, ai: aiStatus().configured, auth: auth.config().configured, vercel: !!process.env.VERCEL });
  });
  // Senior Manager savings module — MANAGERS account only
  app.use('/api/savings', auth.requireRole('managers'), require('./routes/savings.cjs'));
  app.use('/api/ai', require('./routes/ai.cjs'));
  // MANAGERS may read project data (linked project details / charter / Gantt) but never change it
  app.use('/api', (req, res, next) =>
    req.session.role === 'managers' && req.method !== 'GET'
      ? res.status(403).json({ error: 'The MANAGERS account has read-only access to projects.', code: 'read_only' })
      : next());
  // Non-destructive import of data exported from the legacy local SQLite database (IGNITE only)
  app.post('/api/admin/import', auth.requireRole('ignite'), async (req, res, next) => {
    try {
      if (!repo.importLegacyData) return res.status(400).json({ error: 'Import is only available on the Postgres database.' });
      const d = req.body ?? {};
      if (!Array.isArray(d.projects)) return res.status(400).json({ error: 'Expected an export file with a "projects" list.' });
      res.json({ imported: await repo.importLegacyData(d) });
    } catch (e) { next(e); }
  });
  app.use('/api', require('./routes/projects.cjs'));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    const dbDown = /DATABASE_URL|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated|timeout exceeded when trying to connect/i.test(err.message || '') || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code);
    res.status(dbDown ? 503 : 500).json({
      error: dbDown ? 'The database is not reachable right now. Your changes were not saved — please try again shortly.' : 'Something went wrong on the server. Please try again.',
      code: dbDown ? 'database_unavailable' : 'internal',
    });
  });
  return app;
}

module.exports = { createApp };
