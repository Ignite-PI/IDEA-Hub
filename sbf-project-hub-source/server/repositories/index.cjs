/**
 * Repository selector. Routes depend only on this contract, never on a database driver:
 *
 *   init()                                    -> Promise<void>
 *   listProjects()                            -> Project[] (with charter_status, timeline_total, timeline_completed)
 *   getProject(id)                            -> ProjectDetail | null (adds charter, timeline, status_history)
 *   getProjectRow(id)                         -> raw project row | null
 *   createProject(fields, user)               -> ProjectDetail
 *   updateProject(id, fields, prevStatus, user) -> ProjectDetail (writes status history only if status changed)
 *   deleteProject(id)                         -> boolean
 *   getCharter(projectId) / saveCharter(projectId, data, status, completeness)
 *   listHistory(projectId)
 *   listTimeline(projectId) / replaceTimeline(projectId, activities) / getActivity(id) / updateActivity(id, patch)
 *   getLoginState(key) / recordLoginFailure(key, opts) / clearLoginFailures(key)
 *
 * Providers:
 *   postgres — production (Vercel + Neon). Selected automatically when DATABASE_URL / POSTGRES_URL is set,
 *              and always on Vercel (the Vercel filesystem is read-only/ephemeral, so SQLite files cannot persist there).
 *   pglite   — the same Postgres repository on an embedded Postgres (local dev / tests).
 *   sqlite   — legacy local file database (sql.js). Kept for local use and as the migration source.
 */
const providers = {
  postgres: () => require('./postgresRepository.cjs'),
  pglite: () => require('./postgresRepository.cjs'),
  sqlite: () => require('./sqliteRepository.cjs'),
};

function pick() {
  const explicit = (process.env.DATA_PROVIDER || '').toLowerCase();
  if (explicit) return explicit;
  if (process.env.VERCEL || require('./pg/driver.cjs').connectionString()) return 'postgres';
  return 'sqlite';
}

const key = pick();
if (!providers[key]) throw new Error(`Unknown DATA_PROVIDER "${key}". Available: ${Object.keys(providers).join(', ')}`);

module.exports = providers[key]();
module.exports.providerKey = key;
