/** Postgres schema — additive, idempotent migrations tracked in schema_migrations. Never drops data. */
const MIGRATIONS = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id              text PRIMARY KEY,
        title           text NOT NULL,
        description     text NOT NULL DEFAULT '',
        owner           text NOT NULL DEFAULT '',
        functional_area text NOT NULL DEFAULT '',
        ops_manager     text NOT NULL DEFAULT '',
        status          text NOT NULL DEFAULT 'Idea'
                        CHECK (status IN ('Idea','Assessing','Validated','Approved','In Delivery','Implemented','On Hold','Cancelled')),
        link            text NOT NULL DEFAULT '',
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS charters (
        project_id   text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        data         jsonb NOT NULL,
        status       text NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress','Completed')),
        completeness integer CHECK (completeness BETWEEN 0 AND 100),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );

      -- Queryable copies of charter sections, written with every charter save (charters.data is the source of truth)
      CREATE TABLE IF NOT EXISTS charter_raci (
        project_id  text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        responsible text NOT NULL DEFAULT '',
        accountable text NOT NULL DEFAULT '',
        consulted   text NOT NULL DEFAULT '',
        informed    text NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS charter_key_metrics (
        id          text PRIMARY KEY,
        project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        position    integer NOT NULL DEFAULT 0,
        metric      text NOT NULL DEFAULT '',
        definition  text NOT NULL DEFAULT '',
        target      text NOT NULL DEFAULT '',
        baseline    text NOT NULL DEFAULT '',
        impact      text NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_metrics_project ON charter_key_metrics(project_id, position);

      CREATE TABLE IF NOT EXISTS status_history (
        id          text PRIMARY KEY,
        project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_status text,
        to_status   text NOT NULL,
        changed_at  timestamptz NOT NULL DEFAULT now(),
        changed_by  text NOT NULL DEFAULT '',
        note        text NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_history_project ON status_history(project_id, changed_at DESC);

      CREATE TABLE IF NOT EXISTS timeline_activities (
        id          text PRIMARY KEY,
        project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase       text NOT NULL CHECK (phase IN ('Collaborate','Understand','Redesign','Execute','Sustain')),
        task        text NOT NULL DEFAULT '',
        start_date  date,
        end_date    date,
        status      text NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed','On Hold','Delayed')),
        progress    integer CHECK (progress BETWEEN 0 AND 100),
        depends_on  text NOT NULL DEFAULT '',
        sort_order  integer NOT NULL DEFAULT 0,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
      );
      CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_activities(project_id, sort_order);

      CREATE TABLE IF NOT EXISTS login_attempts (
        key             text PRIMARY KEY,
        failures        integer NOT NULL DEFAULT 0,
        first_failed_at timestamptz NOT NULL DEFAULT now(),
        locked_until    timestamptz
      );
    `,
  },
];

async function migrate(driver) {
  await driver.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await driver.query('SELECT version FROM schema_migrations')).map((r) => Number(r.version)));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    await driver.tx(async (q) => {
      for (const stmt of m.sql.split(';').map((s) => s.trim()).filter(Boolean)) await q(stmt);
      await q('INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [m.version, m.name]);
    });
  }
}

module.exports = { migrate };
