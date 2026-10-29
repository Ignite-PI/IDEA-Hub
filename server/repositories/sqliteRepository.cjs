/**
 * SQLite (sql.js) implementation of the SBF Project Hub repository.
 * Every function here is part of the repository contract documented in ./index.cjs.
 * A different engine (Azure SQL, PostgreSQL, Dataverse…) only needs to implement
 * the same functions with the same return shapes.
 */
const crypto = require('crypto');
const { getDb, all, get, transaction } = require('../db.cjs');

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const PROJECT_SELECT = `
  SELECT p.*, COALESCE(c.status, 'Not Started') AS charter_status, c.updated_at AS charter_updated_at,
    (SELECT COUNT(*) FROM timeline_activities t WHERE t.project_id = p.id) AS timeline_total,
    (SELECT COUNT(*) FROM timeline_activities t WHERE t.project_id = p.id AND t.status = 'Completed') AS timeline_completed
  FROM projects p LEFT JOIN charters c ON c.project_id = p.id`;

const mapActivity = (a) => ({ ...a, progress: a.progress === null || a.progress === undefined ? null : Number(a.progress) });

async function listProjects() {
  return all(`${PROJECT_SELECT} ORDER BY p.updated_at DESC`);
}

async function getProject(id) {
  const project = await get(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
  if (!project) return null;
  const charter = await get('SELECT * FROM charters WHERE project_id = ?', [id]);
  return {
    ...project,
    charter: charter ? { ...charter, data: JSON.parse(charter.data) } : null,
    timeline: await listTimeline(id),
    status_history: await listHistory(id),
  };
}

async function getProjectRow(id) {
  return get('SELECT * FROM projects WHERE id = ?', [id]);
}

async function createProject(p, user = '') {
  const id = uid();
  const ts = now();
  await transaction(({ run: r }) => {
    r(`INSERT INTO projects (id, title, description, owner, functional_area, ops_manager, status, link, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, p.title, p.description ?? '', p.owner ?? '', p.functional_area ?? '', p.ops_manager ?? '', p.status, p.link ?? '', ts, ts]);
    r('INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, NULL, ?, ?, ?, ?)',
      [uid(), id, p.status, ts, user, 'Project created']);
  });
  return getProject(id);
}

/** Saves project fields. A status history row is written only when the project status actually changes. */
async function updateProject(id, p, previousStatus, user = '') {
  const ts = now();
  await transaction(({ run: r }) => {
    r(`UPDATE projects SET title = ?, description = ?, owner = ?, functional_area = ?, ops_manager = ?, status = ?, link = ?, updated_at = ?
       WHERE id = ?`,
      [p.title, p.description, p.owner, p.functional_area, p.ops_manager, p.status, p.link, ts, id]);
    if (p.status !== previousStatus) {
      r('INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uid(), id, previousStatus, p.status, ts, user, '']);
    }
  });
  return getProject(id);
}

async function deleteProject(id) {
  return transaction(({ run: r, all: a }) => {
    if (!a('SELECT id FROM projects WHERE id = ?', [id]).length) return false;
    for (const t of ['charters', 'status_history', 'timeline_activities']) r(`DELETE FROM ${t} WHERE project_id = ?`, [id]);
    r('DELETE FROM projects WHERE id = ?', [id]);
    return true;
  });
}

async function getCharter(projectId) {
  const c = await get('SELECT * FROM charters WHERE project_id = ?', [projectId]);
  return c ? { ...c, data: JSON.parse(c.data) } : null;
}

/** Saves the charter. Deliberately does NOT touch the project status. */
async function saveCharter(projectId, data, status) {
  const ts = now();
  await transaction(({ run: r }) => {
    r(`INSERT INTO charters (project_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET data = excluded.data, status = excluded.status, updated_at = excluded.updated_at`,
      [projectId, JSON.stringify(data), status, ts, ts]);
    r('UPDATE projects SET updated_at = ? WHERE id = ?', [ts, projectId]);
  });
  return getProject(projectId);
}

async function listHistory(projectId) {
  return all('SELECT * FROM status_history WHERE project_id = ? ORDER BY changed_at DESC, rowid DESC', [projectId]);
}

async function listTimeline(projectId) {
  return (await all('SELECT * FROM timeline_activities WHERE project_id = ? ORDER BY sort_order, created_at', [projectId])).map(mapActivity);
}

/** Replaces the project's CURES activities with the given list (upsert by id, removes missing ones). */
async function replaceTimeline(projectId, activities) {
  const ts = now();
  await transaction(({ run: r, all: a }) => {
    const existing = new Map(a('SELECT id, created_at FROM timeline_activities WHERE project_id = ?', [projectId]).map((x) => [x.id, x.created_at]));
    // Unknown ids (new rows, or ids from another project) always get a fresh server id; dependencies are remapped.
    const idMap = new Map(activities.map((act) => [act.id, existing.has(act.id) ? act.id : uid()]));
    const keep = new Set();
    activities.forEach((act, i) => {
      const id = act.id ? idMap.get(act.id) : uid();
      act = { ...act, depends_on: act.depends_on ? idMap.get(act.depends_on) ?? '' : '' };
      keep.add(id);
      r(`INSERT INTO timeline_activities (id, project_id, phase, task, start_date, end_date, status, progress, depends_on, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET phase = excluded.phase, task = excluded.task, start_date = excluded.start_date, end_date = excluded.end_date,
           status = excluded.status, progress = excluded.progress, depends_on = excluded.depends_on, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
        [id, projectId, act.phase, act.task, act.start_date, act.end_date, act.status, act.progress, act.depends_on, i, existing.get(id) ?? ts, ts]);
    });
    for (const id of existing.keys()) if (!keep.has(id)) r('DELETE FROM timeline_activities WHERE id = ?', [id]);
    r('UPDATE projects SET updated_at = ? WHERE id = ?', [ts, projectId]);
  });
  return listTimeline(projectId);
}

async function getActivity(activityId) {
  const a = await get('SELECT * FROM timeline_activities WHERE id = ?', [activityId]);
  return a ? mapActivity(a) : null;
}

async function updateActivity(activityId, patch) {
  const ts = now();
  const a = await getActivity(activityId);
  if (!a) return null;
  const next = { ...a, ...patch };
  await transaction(({ run: r }) => {
    r('UPDATE timeline_activities SET status = ?, progress = ?, updated_at = ? WHERE id = ?', [next.status, next.progress, ts, activityId]);
    r('UPDATE projects SET updated_at = ? WHERE id = ?', [ts, a.project_id]);
  });
  return getActivity(activityId);
}

// Sign-in throttling — in memory is fine for a single local process
const attempts = new Map();
async function getLoginState(key) {
  return attempts.get(key) ?? null;
}
async function recordLoginFailure(key, { windowMinutes, maxFailures, lockMinutes }) {
  const t = Date.now();
  let s = attempts.get(key);
  if (!s || t - Date.parse(s.firstFailedAt) > windowMinutes * 60000) s = { failures: 0, firstFailedAt: new Date(t).toISOString(), lockedUntil: null };
  s.failures += 1;
  if (s.failures >= maxFailures) s.lockedUntil = new Date(t + lockMinutes * 60000).toISOString();
  attempts.set(key, s);
  return s;
}
async function clearLoginFailures(key) {
  attempts.delete(key);
}

module.exports = {
  name: 'sqlite (sql.js)',
  getLoginState, recordLoginFailure, clearLoginFailures,
  init: getDb,
  listProjects, getProject, getProjectRow, createProject, updateProject, deleteProject,
  getCharter, saveCharter,
  listHistory,
  listTimeline, replaceTimeline, getActivity, updateActivity,
};
