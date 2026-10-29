/**
 * SBF Tower Portfolio Hub — Express REST API + static host for the built app.
 * Start: node server/server.cjs   (PORT defaults to 3002)
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { getDb, all, get, run, DB_PATH } = require('./db.cjs');

const PORT = Number(process.env.PORT) || 3002;
const STATUSES = ['Idea', 'Assessing', 'Validated', 'Approved', 'In Delivery', 'Implemented', 'On Hold', 'Cancelled'];
const CHARTER_STATUSES = ['In Progress', 'Completed'];
const PROJECT_FIELDS = ['title', 'description', 'owner', 'functional_area', 'ops_manager', 'status', 'link'];

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const now = () => new Date().toISOString();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function cleanProject(body, existing = {}) {
  const p = { ...existing };
  for (const f of PROJECT_FIELDS) if (body[f] !== undefined) p[f] = String(body[f] ?? '').trim();
  if (!p.title) return { error: 'Project Title is required.' };
  if (!p.status) p.status = 'Idea';
  if (!STATUSES.includes(p.status)) return { error: `Status must be one of: ${STATUSES.join(', ')}` };
  return { project: p };
}

const PROJECT_SELECT = `
  SELECT p.*, COALESCE(c.status, 'Not Started') AS charter_status, c.updated_at AS charter_updated_at
  FROM projects p LEFT JOIN charters c ON c.project_id = p.id`;

async function loadProject(id) {
  const project = await get(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
  if (!project) return null;
  const charter = await get('SELECT * FROM charters WHERE project_id = ?', [id]);
  return { ...project, charter: charter ? { ...charter, data: JSON.parse(charter.data) } : null };
}

// ─── Projects ────────────────────────────────────────────────────────────────
app.get('/api/projects', wrap(async (_req, res) => {
  res.json(await all(`${PROJECT_SELECT} ORDER BY p.updated_at DESC`));
}));

app.get('/api/projects/:id', wrap(async (req, res) => {
  const project = await loadProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
}));

app.post('/api/projects', wrap(async (req, res) => {
  const { project, error } = cleanProject(req.body);
  if (error) return res.status(400).json({ error });
  const id = crypto.randomUUID();
  const ts = now();
  await run(
    `INSERT INTO projects (id, title, description, owner, functional_area, ops_manager, status, link, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, project.title, project.description ?? '', project.owner ?? '', project.functional_area ?? '',
      project.ops_manager ?? '', project.status, project.link ?? '', ts, ts],
  );
  res.status(201).json(await loadProject(id));
}));

async function updateProject(req, res) {
  const existing = await get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const { project, error } = cleanProject(req.body, existing);
  if (error) return res.status(400).json({ error });
  await run(
    `UPDATE projects SET title = ?, description = ?, owner = ?, functional_area = ?, ops_manager = ?,
       status = ?, link = ?, updated_at = ? WHERE id = ?`,
    [project.title, project.description, project.owner, project.functional_area, project.ops_manager,
      project.status, project.link, now(), req.params.id],
  );
  res.json(await loadProject(req.params.id));
}
app.put('/api/projects/:id', wrap(updateProject));
app.patch('/api/projects/:id', wrap(updateProject));

app.delete('/api/projects/:id', wrap(async (req, res) => {
  await run('DELETE FROM charters WHERE project_id = ?', [req.params.id]);
  const { changes } = await run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
}));

// ─── Charters (one per project) ──────────────────────────────────────────────
app.get('/api/projects/:id/charter', wrap(async (req, res) => {
  const charter = await get('SELECT * FROM charters WHERE project_id = ?', [req.params.id]);
  if (!charter) return res.status(404).json({ error: 'Charter not started' });
  res.json({ ...charter, data: JSON.parse(charter.data) });
}));

app.put('/api/projects/:id/charter', wrap(async (req, res) => {
  const project = await get('SELECT id FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { data, status = 'In Progress' } = req.body ?? {};
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Charter data is required.' });
  if (!CHARTER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid charter status.' });
  const ts = now();
  await run(
    `INSERT INTO charters (project_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET data = excluded.data, status = excluded.status, updated_at = excluded.updated_at`,
    [req.params.id, JSON.stringify(data), status, ts, ts],
  );
  await run('UPDATE projects SET updated_at = ? WHERE id = ?', [ts, req.params.id]);
  res.json(await loadProject(req.params.id));
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: now() }));

// ─── Static app (production build) ───────────────────────────────────────────
const DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(DIST));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

(async () => {
  await getDb();
  app.listen(PORT, () => {
    console.log(`\n✓ SBF Tower Portfolio Hub running at http://localhost:${PORT}`);
    console.log(`  Database: ${DB_PATH}\n`);
  });
})();
