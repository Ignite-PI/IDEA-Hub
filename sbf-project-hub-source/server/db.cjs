/**
 * db.cjs — SQLite persistence via sql.js (pure JS, no native build), mirroring
 * the SME Dashboard backend. The DB is written to disk after every change.
 * Override the file location with SBF_DB_PATH.
 *
 * Only the repository layer (server/repositories) should use this module, so the
 * storage engine can be swapped (e.g. Azure SQL / PostgreSQL) without touching routes.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SBF_DB_PATH || path.join(__dirname, 'data', 'sbf_tower.sqlite');

let _db = null;

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  _db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  migrate(_db);
  return _db;
}

function saveDb() {
  if (!_db) return;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(_db.export()));
  fs.renameSync(tmp, DB_PATH);
}

const PHASES = ['Collaborate', 'Understand', 'Redesign', 'Execute', 'Sustain'];

/** Additive, idempotent migrations — never drops or rewrites existing data. */
function migrate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT DEFAULT '',
      owner           TEXT DEFAULT '',
      functional_area TEXT DEFAULT '',
      ops_manager     TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'Idea',
      link            TEXT DEFAULT '',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS charters (
      project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      data        TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'In Progress',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status   TEXT NOT NULL,
      changed_at  TEXT NOT NULL,
      changed_by  TEXT DEFAULT '',
      note        TEXT DEFAULT ''
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_history_project ON status_history(project_id, changed_at)');
  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_activities (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase       TEXT NOT NULL,
      task        TEXT NOT NULL DEFAULT '',
      start_date  TEXT DEFAULT '',
      end_date    TEXT DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'Not Started',
      progress    INTEGER,
      depends_on  TEXT DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_activities(project_id, sort_order)');
  db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');

  const done = (key) => {
    const s = db.prepare('SELECT value FROM meta WHERE key = ?');
    s.bind([key]);
    const has = s.step();
    s.free();
    return has;
  };
  const now = new Date().toISOString();
  const uid = () => require('crypto').randomUUID();

  // v2: seed status history for projects that pre-date history tracking
  if (!done('history_backfill_v2')) {
    const rows = db.exec(`SELECT id, status, created_at FROM projects WHERE id NOT IN (SELECT project_id FROM status_history)`);
    for (const [id, status, createdAt] of rows[0]?.values ?? []) {
      db.run('INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, NULL, ?, ?, ?, ?)',
        [uid(), id, status, createdAt, '', 'Status when history tracking started']);
    }
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['history_backfill_v2', now]);
  }

  // v2: copy legacy single-task-per-phase charter timeline into CURES activities (charter JSON is left untouched)
  if (!done('timeline_from_charter_v2')) {
    const rows = db.exec(`SELECT project_id, data FROM charters WHERE project_id NOT IN (SELECT project_id FROM timeline_activities)`);
    for (const [projectId, json] of rows[0]?.values ?? []) {
      let tl = {};
      try { tl = JSON.parse(json).timeline ?? {}; } catch { /* ignore malformed legacy data */ }
      PHASES.forEach((phase, i) => {
        const t = tl[phase];
        if (!t || !(t.task || t.start || t.end)) return;
        db.run(`INSERT INTO timeline_activities (id, project_id, phase, task, start_date, end_date, status, progress, depends_on, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'Not Started', NULL, '', ?, ?, ?)`,
          [uid(), projectId, phase, t.task || '', t.start || '', t.end || '', i, now, now]);
      });
    }
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['timeline_from_charter_v2', now]);
  }
  saveDb();
}

function allSync(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function all(sql, params = []) {
  await getDb();
  return allSync(sql, params);
}

async function get(sql, params = []) {
  return (await all(sql, params))[0] ?? null;
}

async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveDb();
  return { changes };
}

/** Runs several writes atomically and persists once. `fn` receives sync helpers. */
async function transaction(fn) {
  const db = await getDb();
  db.run('BEGIN');
  try {
    const result = fn({ run: (sql, params = []) => db.run(sql, params), all: allSync });
    db.run('COMMIT');
    saveDb();
    return result;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

module.exports = { getDb, all, get, run, transaction, DB_PATH };
