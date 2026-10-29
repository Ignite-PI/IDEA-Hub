/**
 * db.cjs — SQLite persistence via sql.js (pure JS, no native build), mirroring
 * the SME Dashboard backend. The DB is written to disk after every change.
 * Override the file location with SBF_DB_PATH.
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
  saveDb();
}

async function all(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
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

module.exports = { getDb, all, get, run, DB_PATH };
