/**
 * Copies data from the local SQLite file into Postgres. Non-destructive and idempotent:
 * rows that already exist in Postgres (same id) are left untouched; nothing is deleted.
 *
 *   Direct:  DATABASE_URL=postgres://...  node scripts/migrate-sqlite-to-postgres.cjs [sqlite-file]
 *   Export:  node scripts/migrate-sqlite-to-postgres.cjs [sqlite-file] --export out.json
 *            (then POST it to /api/admin/import while signed in — used when the DB password
 *             is a Vercel "sensitive" variable that cannot be read locally)
 */
const fs = require('fs');
const path = require('path');
for (const f of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}
const initSqlJs = require('sql.js');

const args = process.argv.slice(2);
const exportIdx = args.indexOf('--export');
const exportPath = exportIdx > -1 ? args[exportIdx + 1] : null;
const SRC = args.find((a, i) => !a.startsWith('--') && i !== exportIdx + 1) || path.join(__dirname, '..', 'server', 'data', 'sbf_tower.sqlite');

async function readSqlite(file) {
  if (!fs.existsSync(file)) throw new Error(`SQLite file not found: ${file}`);
  const SQL = await initSqlJs();
  const lite = new SQL.Database(fs.readFileSync(file));
  const rows = (sql) => {
    try {
      const r = lite.exec(sql)[0];
      return r ? r.values.map((v) => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : [];
    } catch { return []; }
  };
  return {
    projects: rows('SELECT * FROM projects'),
    charters: rows('SELECT * FROM charters'),
    status_history: rows('SELECT * FROM status_history'),
    timeline_activities: rows('SELECT * FROM timeline_activities'),
  };
}

(async () => {
  const data = await readSqlite(SRC);
  if (exportPath) {
    fs.writeFileSync(exportPath, JSON.stringify(data));
    console.log(`Exported ${data.projects.length} projects, ${data.charters.length} charters, ${data.status_history.length} history rows, ${data.timeline_activities.length} activities → ${exportPath}`);
    return;
  }
  const { getDriver } = require('../server/repositories/pg/driver.cjs');
  const { migrate } = require('../server/repositories/pg/schema.cjs');
  const { importLegacy } = require('../server/repositories/pg/importLegacy.cjs');
  const pg = await getDriver();
  await migrate(pg);
  const count = await pg.tx((q) => importLegacy(q, data));
  console.log(`Migrated from ${SRC}:`, count);
  process.exit(0);
})().catch((e) => { console.error('Migration failed — nothing was committed:', e.message); process.exit(1); });
