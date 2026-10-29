/**
 * Postgres implementation of the SBF Project Hub repository (production on Vercel → Neon).
 * Same contract and return shapes as sqliteRepository.cjs (see ./index.cjs).
 */
const crypto = require('crypto');
const { getDriver } = require('./pg/driver.cjs');
const { migrate } = require('./pg/schema.cjs');

const uid = () => crypto.randomUUID();
const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);

let ready = null;
async function db() {
  const driver = await getDriver();
  if (!ready) ready = migrate(driver).catch((e) => { ready = null; throw e; });
  await ready;
  return driver;
}

const PROJECT_SELECT = `
  SELECT p.id, p.title, p.description, p.owner, p.functional_area, p.ops_manager, p.status, p.link, p.created_at, p.updated_at,
    COALESCE(c.status, 'Not Started') AS charter_status, c.updated_at AS charter_updated_at, c.completeness AS charter_completeness,
    (SELECT COUNT(*)::int FROM timeline_activities t WHERE t.project_id = p.id) AS timeline_total,
    (SELECT COUNT(*)::int FROM timeline_activities t WHERE t.project_id = p.id AND t.status = 'Completed') AS timeline_completed
  FROM projects p LEFT JOIN charters c ON c.project_id = p.id`;

const mapProject = (r) => ({ ...r, created_at: iso(r.created_at), updated_at: iso(r.updated_at), charter_updated_at: iso(r.charter_updated_at) });
const mapCharter = (c) => c && ({ project_id: c.project_id, data: c.data, status: c.status, completeness: c.completeness, created_at: iso(c.created_at), updated_at: iso(c.updated_at) });
const mapHistory = (h) => ({ ...h, changed_at: iso(h.changed_at) });
const mapActivity = (a) => ({
  ...a,
  start_date: a.start_date ?? '',
  end_date: a.end_date ?? '',
  progress: a.progress === null || a.progress === undefined ? null : Number(a.progress),
  created_at: iso(a.created_at),
  updated_at: iso(a.updated_at),
});

async function init() { await db(); }

async function listProjects() {
  return (await (await db()).query(`${PROJECT_SELECT} ORDER BY p.updated_at DESC`)).map(mapProject);
}

async function getProjectRow(id) {
  const rows = await (await db()).query('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ? mapProject(rows[0]) : null;
}

async function getProject(id) {
  const d = await db();
  const [project] = await d.query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  if (!project) return null;
  const [charter] = await d.query('SELECT * FROM charters WHERE project_id = $1', [id]);
  return { ...mapProject(project), charter: mapCharter(charter) ?? null, timeline: await listTimeline(id), status_history: await listHistory(id) };
}

async function createProject(p, user = '') {
  const id = uid();
  await (await db()).tx(async (q) => {
    const [{ ts }] = await q('SELECT now() AS ts');
    await q(`INSERT INTO projects (id, title, description, owner, functional_area, ops_manager, status, link, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, p.title, p.description ?? '', p.owner ?? '', p.functional_area ?? '', p.ops_manager ?? '', p.status, p.link ?? '', ts]);
    await q('INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES ($1, $2, NULL, $3, $4, $5, $6)',
      [uid(), id, p.status, ts, user, 'Project created']);
  });
  return getProject(id);
}

/** Saves project fields. A status history row is written only when the project status actually changes. */
async function updateProject(id, p, previousStatus, user = '') {
  await (await db()).tx(async (q) => {
    const [{ ts }] = await q('SELECT now() AS ts');
    await q(`UPDATE projects SET title = $1, description = $2, owner = $3, functional_area = $4, ops_manager = $5, status = $6, link = $7, updated_at = $8
             WHERE id = $9`, [p.title, p.description, p.owner, p.functional_area, p.ops_manager, p.status, p.link, ts, id]);
    if (p.status !== previousStatus) {
      await q('INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uid(), id, previousStatus, p.status, ts, user, '']);
    }
  });
  return getProject(id);
}

async function deleteProject(id) {
  const rows = await (await db()).query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]); // children cascade
  return rows.length > 0;
}

async function getCharter(projectId) {
  const [c] = await (await db()).query('SELECT * FROM charters WHERE project_id = $1', [projectId]);
  return mapCharter(c) ?? null;
}

/** Saves the charter (+ queryable RACI / key-metric rows). Deliberately does NOT touch the project status. */
async function saveCharter(projectId, data, status, completeness = null) {
  await (await db()).tx(async (q) => {
    await q(`INSERT INTO charters (project_id, data, status, completeness, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $4, now(), now())
             ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data, status = EXCLUDED.status, completeness = EXCLUDED.completeness, updated_at = now()`,
      [projectId, JSON.stringify(data), status, completeness]);
    const r = data.raci ?? {};
    await q(`INSERT INTO charter_raci (project_id, responsible, accountable, consulted, informed) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (project_id) DO UPDATE SET responsible = EXCLUDED.responsible, accountable = EXCLUDED.accountable,
               consulted = EXCLUDED.consulted, informed = EXCLUDED.informed`,
      [projectId, String(r.responsible ?? ''), String(r.accountable ?? ''), String(r.consulted ?? ''), String(r.informed ?? '')]);
    await q('DELETE FROM charter_key_metrics WHERE project_id = $1', [projectId]);
    const metrics = (Array.isArray(data.keyMetrics) ? data.keyMetrics : [])
      .filter((m) => m && ['metric', 'definition', 'target', 'baseline', 'impact'].some((k) => String(m[k] ?? '').trim()));
    for (const [i, m] of metrics.entries()) {
      await q(`INSERT INTO charter_key_metrics (id, project_id, position, metric, definition, target, baseline, impact) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uid(), projectId, i, String(m.metric ?? ''), String(m.definition ?? ''), String(m.target ?? ''), String(m.baseline ?? ''), String(m.impact ?? '')]);
    }
    await q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
  });
  return getProject(projectId);
}

async function listHistory(projectId) {
  return (await (await db()).query('SELECT * FROM status_history WHERE project_id = $1 ORDER BY changed_at DESC, id DESC', [projectId])).map(mapHistory);
}

const ACTIVITY_COLS = 'id, project_id, phase, task, start_date::text AS start_date, end_date::text AS end_date, status, progress, depends_on, sort_order, created_at, updated_at';

async function listTimeline(projectId) {
  return (await (await db()).query(`SELECT ${ACTIVITY_COLS} FROM timeline_activities WHERE project_id = $1 ORDER BY sort_order, created_at`, [projectId])).map(mapActivity);
}

/** Replaces the project's CURES activities with the given list (upsert by id, removes missing ones). */
async function replaceTimeline(projectId, activities) {
  await (await db()).tx(async (q) => {
    const existing = new Set((await q('SELECT id FROM timeline_activities WHERE project_id = $1', [projectId])).map((r) => r.id));
    // Unknown ids (new rows, or ids from another project) always get a fresh server id; dependencies are remapped.
    const idMap = new Map(activities.map((a) => [a.id, existing.has(a.id) ? a.id : uid()]));
    const keep = [];
    for (const [i, act] of activities.entries()) {
      const id = act.id ? idMap.get(act.id) : uid();
      keep.push(id);
      await q(`INSERT INTO timeline_activities (id, project_id, phase, task, start_date, end_date, status, progress, depends_on, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO UPDATE SET phase = EXCLUDED.phase, task = EXCLUDED.task, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
                 status = EXCLUDED.status, progress = EXCLUDED.progress, depends_on = EXCLUDED.depends_on, sort_order = EXCLUDED.sort_order, updated_at = now()`,
        [id, projectId, act.phase, act.task, nullIfEmpty(act.start_date), nullIfEmpty(act.end_date), act.status, act.progress,
          act.depends_on ? idMap.get(act.depends_on) ?? '' : '', i]);
    }
    await q('DELETE FROM timeline_activities WHERE project_id = $1 AND NOT (id = ANY($2::text[]))', [projectId, keep]);
    await q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
  });
  return listTimeline(projectId);
}

async function getActivity(activityId) {
  const [a] = await (await db()).query(`SELECT ${ACTIVITY_COLS} FROM timeline_activities WHERE id = $1`, [activityId]);
  return a ? mapActivity(a) : null;
}

async function updateActivity(activityId, patch) {
  const a = await getActivity(activityId);
  if (!a) return null;
  const next = { ...a, ...patch };
  await (await db()).tx(async (q) => {
    await q('UPDATE timeline_activities SET status = $1, progress = $2, updated_at = now() WHERE id = $3', [next.status, next.progress, activityId]);
    await q('UPDATE projects SET updated_at = now() WHERE id = $1', [a.project_id]);
  });
  return getActivity(activityId);
}

// ─── Sign-in throttling (stored in the DB so it works across serverless instances) ───
async function getLoginState(key) {
  const [r] = await (await db()).query('SELECT failures, first_failed_at, locked_until FROM login_attempts WHERE key = $1', [key]);
  return r ? { failures: r.failures, firstFailedAt: iso(r.first_failed_at), lockedUntil: iso(r.locked_until) } : null;
}
async function recordLoginFailure(key, { windowMinutes, maxFailures, lockMinutes }) {
  const [r] = await (await db()).query(`
    INSERT INTO login_attempts (key, failures, first_failed_at) VALUES ($1, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE WHEN login_attempts.first_failed_at < now() - make_interval(mins => $2) THEN 1 ELSE login_attempts.failures + 1 END,
      first_failed_at = CASE WHEN login_attempts.first_failed_at < now() - make_interval(mins => $2) THEN now() ELSE login_attempts.first_failed_at END
    RETURNING failures`, [key, windowMinutes]);
  if (r.failures >= maxFailures) {
    await (await db()).query('UPDATE login_attempts SET locked_until = now() + make_interval(mins => $2) WHERE key = $1', [key, lockMinutes]);
  }
  return getLoginState(key);
}
async function clearLoginFailures(key) {
  await (await db()).query('DELETE FROM login_attempts WHERE key = $1', [key]);
}

/** One-off, non-destructive import of legacy SQLite rows (see pg/importLegacy.cjs). */
async function importLegacyData(data) {
  const { importLegacy } = require('./pg/importLegacy.cjs');
  return (await db()).tx((q) => importLegacy(q, data));
}

module.exports = {
  name: 'postgres',
  init,
  importLegacyData,
  listProjects, getProject, getProjectRow, createProject, updateProject, deleteProject,
  getCharter, saveCharter,
  listHistory,
  listTimeline, replaceTimeline, getActivity, updateActivity,
  getLoginState, recordLoginFailure, clearLoginFailures,
};
