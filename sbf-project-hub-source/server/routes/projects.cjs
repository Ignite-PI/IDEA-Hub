const express = require('express');
const repo = require('../repositories/index.cjs');

const STATUSES = ['Idea', 'Assessing', 'Validated', 'Approved', 'In Delivery', 'Implemented', 'On Hold', 'Cancelled'];
const CHARTER_STATUSES = ['In Progress', 'Completed'];
const PHASES = ['Collaborate', 'Understand', 'Redesign', 'Execute', 'Sustain'];
const ACTIVITY_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'];
const PROJECT_FIELDS = ['title', 'description', 'owner', 'functional_area', 'ops_manager', 'status', 'link'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
/** Optional display name typed by the person using the shared account, else the signed-in account name. */
const userOf = (req) => {
  let name = '';
  try { name = decodeURIComponent(String(req.get('x-user-name') || '')).trim().slice(0, 100); } catch { /* ignore malformed header */ }
  const account = req.session?.username || '';
  return name ? (account ? `${name} (${account})` : name) : account;
};

function cleanProject(body, existing = {}) {
  const p = { ...existing };
  for (const f of PROJECT_FIELDS) if (body[f] !== undefined) p[f] = String(body[f] ?? '').trim();
  if (!p.title) return { error: 'Project Title is required.' };
  if (!p.status) p.status = 'Idea';
  if (!STATUSES.includes(p.status)) return { error: `Status must be one of: ${STATUSES.join(', ')}` };
  return { project: p };
}

function cleanActivities(list) {
  if (!Array.isArray(list)) return { error: 'activities must be a list.' };
  if (list.length > 300) return { error: 'Too many timeline activities (max 300).' };
  const ids = new Set(list.map((a) => a?.id).filter(Boolean));
  const out = [];
  for (const [i, a] of list.entries()) {
    const row = `Activity ${i + 1}`;
    const act = {
      id: typeof a?.id === 'string' ? a.id.slice(0, 64) : '',
      phase: String(a?.phase ?? ''),
      task: String(a?.task ?? '').trim().slice(0, 500),
      start_date: String(a?.start_date ?? '').trim(),
      end_date: String(a?.end_date ?? '').trim(),
      status: String(a?.status || 'Not Started'),
      progress: a?.progress === '' || a?.progress === null || a?.progress === undefined ? null : Number(a.progress),
      depends_on: String(a?.depends_on ?? '').trim(),
    };
    if (!PHASES.includes(act.phase)) return { error: `${row}: phase must be one of ${PHASES.join(', ')}.` };
    if (!ACTIVITY_STATUSES.includes(act.status)) return { error: `${row}: status must be one of ${ACTIVITY_STATUSES.join(', ')}.` };
    if (act.start_date && !DATE_RE.test(act.start_date)) return { error: `${row}: start date must be YYYY-MM-DD.` };
    if (act.end_date && !DATE_RE.test(act.end_date)) return { error: `${row}: end date must be YYYY-MM-DD.` };
    if (act.start_date && act.end_date && act.end_date < act.start_date) return { error: `${row}: end date is before start date.` };
    if (act.progress !== null && (!Number.isFinite(act.progress) || act.progress < 0 || act.progress > 100)) return { error: `${row}: progress must be 0–100.` };
    if (act.progress !== null) act.progress = Math.round(act.progress);
    if (act.depends_on && (act.depends_on === act.id || !ids.has(act.depends_on))) act.depends_on = '';
    out.push(act);
  }
  return { activities: out };
}

// ─── Projects ────────────────────────────────────────────────────────────────
router.get('/projects', wrap(async (_req, res) => res.json(await repo.listProjects())));

router.get('/projects/:id', wrap(async (req, res) => {
  const project = await repo.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
}));

router.post('/projects', wrap(async (req, res) => {
  const { project, error } = cleanProject(req.body ?? {});
  if (error) return res.status(400).json({ error });
  res.status(201).json(await repo.createProject(project, userOf(req)));
}));

async function updateProject(req, res) {
  const existing = await repo.getProjectRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const { project, error } = cleanProject(req.body ?? {}, existing);
  if (error) return res.status(400).json({ error });
  res.json(await repo.updateProject(req.params.id, project, existing.status, userOf(req)));
}
router.put('/projects/:id', wrap(updateProject));
router.patch('/projects/:id', wrap(updateProject));

router.delete('/projects/:id', wrap(async (req, res) => {
  if (!(await repo.deleteProject(req.params.id))) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
}));

router.get('/projects/:id/history', wrap(async (req, res) => res.json(await repo.listHistory(req.params.id))));

// ─── Charter (one per project; never changes the project status) ─────────────
router.get('/projects/:id/charter', wrap(async (req, res) => {
  const charter = await repo.getCharter(req.params.id);
  if (!charter) return res.status(404).json({ error: 'Charter not started' });
  res.json(charter);
}));

router.put('/projects/:id/charter', wrap(async (req, res) => {
  if (!(await repo.getProjectRow(req.params.id))) return res.status(404).json({ error: 'Project not found' });
  const { data, status = 'In Progress', completeness = null } = req.body ?? {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Charter data is required.' });
  if (!CHARTER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid charter status.' });
  const pct = completeness === null ? null : Math.round(Number(completeness));
  if (pct !== null && !(pct >= 0 && pct <= 100)) return res.status(400).json({ error: 'Charter completeness must be 0–100.' });
  if (status === 'Completed' && !String(data.projectTitle ?? '').trim()) return res.status(400).json({ error: 'A completed charter needs a Project Title.' });
  res.json(await repo.saveCharter(req.params.id, data, status, pct));
}));

// ─── CURES timeline activities (Gantt source data) ───────────────────────────
router.get('/projects/:id/timeline', wrap(async (req, res) => res.json(await repo.listTimeline(req.params.id))));

router.put('/projects/:id/timeline', wrap(async (req, res) => {
  if (!(await repo.getProjectRow(req.params.id))) return res.status(404).json({ error: 'Project not found' });
  const { activities, error } = cleanActivities(req.body?.activities);
  if (error) return res.status(400).json({ error });
  res.json(await repo.replaceTimeline(req.params.id, activities));
}));

router.patch('/timeline/:activityId', wrap(async (req, res) => {
  const patch = {};
  if (req.body?.status !== undefined) {
    if (!ACTIVITY_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid activity status.' });
    patch.status = req.body.status;
  }
  if (req.body?.progress !== undefined) {
    const p = req.body.progress === null || req.body.progress === '' ? null : Number(req.body.progress);
    if (p !== null && (!Number.isFinite(p) || p < 0 || p > 100)) return res.status(400).json({ error: 'Progress must be 0–100.' });
    patch.progress = p === null ? null : Math.round(p);
  }
  const updated = await repo.updateActivity(req.params.activityId, patch);
  if (!updated) return res.status(404).json({ error: 'Activity not found' });
  res.json(updated);
}));

module.exports = router;
