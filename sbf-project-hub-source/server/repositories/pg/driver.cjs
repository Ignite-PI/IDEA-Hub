/**
 * Minimal Postgres driver adapter used by postgresRepository.
 *
 *   DATA_PROVIDER=postgres (default when DATABASE_URL/POSTGRES_URL is set)
 *     → node-postgres Pool against the managed database (Neon via Vercel Marketplace).
 *   DATA_PROVIDER=pglite
 *     → PGlite (real Postgres compiled to WASM) for local development / tests.
 *       PGLITE_DIR=<folder> persists to disk; omit for in-memory.
 *
 * Exposes: query(text, params) -> rows   and   tx(async (q) => ...) for atomic writes.
 */
let driverPromise = null;

/**
 * Pooled connection string. Vercel's Neon integration may add a custom prefix
 * (e.g. SBF_PROJECT_HUB_DATABASE_URL), so any *_DATABASE_URL / *_POSTGRES_URL is accepted.
 */
function connectionString() {
  const env = process.env;
  if (env.DATABASE_URL || env.POSTGRES_URL) return env.DATABASE_URL || env.POSTGRES_URL;
  const key = Object.keys(env).sort().find((k) => /(^|_)DATABASE_URL$/.test(k) && !/UNPOOLED/.test(k))
    || Object.keys(env).sort().find((k) => /(^|_)POSTGRES_URL$/.test(k));
  return key ? env[key] : '';
}

async function createPg() {
  const { Pool, types } = require('pg');
  // Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
  types.setTypeParser(1082, (v) => v);
  const pool = new Pool({
    connectionString: connectionString(),
    max: Number(process.env.PG_POOL_MAX) || 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString()) ? undefined : { rejectUnauthorized: true },
  });
  return {
    name: 'postgres',
    query: async (text, params = []) => (await pool.query(text, params)).rows,
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(async (text, params = []) => (await client.query(text, params)).rows);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite() {
  const pkg = '@electric-sql/pglite'; // non-literal so the Vercel bundler does not ship this dev-only engine
  const { PGlite, types } = await import(pkg);
  const db = await PGlite.create(process.env.PGLITE_DIR || undefined, {
    parsers: { [types.DATE]: (v) => v },
  });
  return {
    name: `pglite${process.env.PGLITE_DIR ? ` (${process.env.PGLITE_DIR})` : ' (in-memory)'}`,
    query: async (text, params = []) => (await db.query(text, params)).rows,
    tx: (fn) => db.transaction(async (t) => fn(async (text, params = []) => (await t.query(text, params)).rows)),
  };
}

function getDriver() {
  if (!driverPromise) {
    const kind = (process.env.DATA_PROVIDER || '').toLowerCase() === 'pglite' ? 'pglite' : 'postgres';
    if (kind === 'postgres' && !connectionString()) {
      throw new Error('DATABASE_URL is not set. Connect a Postgres database (e.g. Neon via Vercel Storage) or set DATA_PROVIDER=pglite for local use.');
    }
    driverPromise = (kind === 'pglite' ? createPglite() : createPg()).catch((e) => { driverPromise = null; throw e; });
  }
  return driverPromise;
}

module.exports = { getDriver, connectionString };
