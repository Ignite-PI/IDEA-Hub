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
  {
    version: 2,
    name: 'senior manager savings module',
    sql: `
      -- Maintainable dropdown values (seeded from the workbook "Lists" tab)
      CREATE TABLE IF NOT EXISTS savings_lists (
        list_key   text NOT NULL,
        value      text NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        active     boolean NOT NULL DEFAULT true,
        PRIMARY KEY (list_key, value)
      );

      -- Source-deck benchmark constants ("Savings Summary" B4:B8)
      CREATE TABLE IF NOT EXISTS savings_settings (
        key        text PRIMARY KEY,
        value      numeric NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- One row per initiative ("Manager Input" / table OpsInput). Calculated columns are stored as computed by the server.
      CREATE TABLE IF NOT EXISTS savings_initiatives (
        id                    text PRIMARY KEY,
        initiative_no         integer NOT NULL UNIQUE,
        project_id            text UNIQUE REFERENCES projects(id) ON DELETE SET NULL,
        ops_manager           text NOT NULL DEFAULT '',
        area                  text NOT NULL DEFAULT '',
        functional_area       text NOT NULL DEFAULT '',
        process               text NOT NULL DEFAULT '',
        initiative_name       text NOT NULL DEFAULT '',
        savings_track         text NOT NULL DEFAULT '',
        savings_lever         text NOT NULL DEFAULT '',
        savings_outcome       text NOT NULL DEFAULT '',
        status                text NOT NULL DEFAULT '',
        baseline_volume       numeric,
        baseline_aht          numeric,
        future_volume         numeric,
        future_aht            numeric,
        productive_hours      numeric,
        current_hourly_rate   numeric,
        future_hourly_rate    numeric,
        current_annual_rate   numeric,
        future_annual_rate    numeric,
        confidence            numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        realization           numeric CHECK (realization IS NULL OR (realization >= 0 AND realization <= 1)),
        baseline_workload_fte numeric NOT NULL DEFAULT 0,
        future_workload_fte   numeric NOT NULL DEFAULT 0,
        capacity_fte_released numeric NOT NULL DEFAULT 0,
        hc_reduction_fte      numeric NOT NULL DEFAULT 0,
        extra_capacity_fte    numeric NOT NULL DEFAULT 0,
        rate_card_savings     numeric NOT NULL DEFAULT 0,
        gross_annual_savings  numeric NOT NULL DEFAULT 0,
        risk_adjusted_savings numeric NOT NULL DEFAULT 0,
        target_start          date,
        expected_completion   date,
        executive_story       text NOT NULL DEFAULT '',
        evidence              text NOT NULL DEFAULT '',
        owner_signoff         text CHECK (owner_signoff IS NULL OR owner_signoff IN ('Yes','No')),
        finance_validated     text CHECK (finance_validated IS NULL OR finance_validated IN ('Yes','No')),
        last_updated          date,
        project_charter_manual text CHECK (project_charter_manual IS NULL OR project_charter_manual IN ('Y','N')),
        timeline_text         text NOT NULL DEFAULT '',
        fte_text              text NOT NULL DEFAULT '',
        raci_r                text NOT NULL DEFAULT '',
        raci_a                text NOT NULL DEFAULT '',
        raci_c                text NOT NULL DEFAULT '',
        raci_i                text NOT NULL DEFAULT '',
        source_key            text UNIQUE,
        import_notes          text NOT NULL DEFAULT '',
        created_at            timestamptz NOT NULL DEFAULT now(),
        updated_at            timestamptz NOT NULL DEFAULT now(),
        updated_by            text NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_savings_project ON savings_initiatives(project_id);

      INSERT INTO savings_lists (list_key, value, sort_order) VALUES
        ('savings_track','Process',1),('savings_track','People',2),('savings_track','Technology',3),
        ('savings_lever','Operational Process Redesign',1),('savings_lever','Handoff Improvement',2),('savings_lever','Rework Reduction',3),
        ('savings_lever','FTE Impact Improvement',4),('savings_lever','Right Skilling',5),('savings_lever','Left-Shifting',6),
        ('savings_lever','Automation',7),('savings_lever','AI',8),('savings_lever','Digital Solutions',9),
        ('savings_outcome','Billable Headcount Reduction',1),('savings_outcome','Additional Work / Capacity',2),('savings_outcome','Rate Card Reduction',3),
        ('status','Idea',1),('status','Assessing',2),('status','Validated',3),('status','Approved',4),
        ('status','In Delivery',5),('status','Implemented',6),('status','On Hold',7),('status','Cancelled',8),
        ('yes_no','Yes',1),('yes_no','No',2),
        ('area','Clinical',1),('area','SBF',2),
        ('functional_area','IPA',1),('functional_area','OPA',2),('functional_area','PSCCR CSBD',3),('functional_area','PSCCR GBD',4),
        ('functional_area','GBD OPA',5),('functional_area','National Inpatient',6),('functional_area','National Outpatient',7),
        ('functional_area','Pharma Reconciliation',8),('functional_area','ER Discharge Outreach',9),('functional_area','Medicare Grievances and Appeals',10),
        ('functional_area','Carelon Post Acute Solutions',11),('functional_area','Cambia Regence',12),('functional_area','Clinical Outcomes Verification',13),
        ('functional_area','CMBM New York Member Outreach',14),('functional_area','Clinical Quality Evaluator Core USRN',15),('functional_area','Ameriben Clinical',16),
        ('functional_area','CMS Appeals SNF Packets',17),('functional_area','ACADEMY',18),('functional_area','Clinical Coding Academy',19),
        ('functional_area','HEDIS',20),('functional_area','CarelonRX CPCC Med Adherence Refill',21),('functional_area','CarelonRX HIX',22),
        ('functional_area','Grievance & Appeals',23),('functional_area','GBD Grievance & Appeals',24),('functional_area','Payment Integrity',25),
        ('functional_area','Payment Integrity eCOB',26),('functional_area','Payment Integrity-Complex & Clinical Audit',27),
        ('functional_area','Payment Integrity Subrogation',28),('functional_area','CarelonRX Business Analyst',29)
      ON CONFLICT DO NOTHING;

      INSERT INTO savings_settings (key, value) VALUES
        ('projected_exit_hc', 1117), ('projected_exit_revenue', 39267995.75), ('target_fte', 335.1),
        ('target_revenue', 11780398.725), ('potential_pool_revenue', 12936071.28), ('potential_pool_fte', 427), ('target_percent', 0.3)
      ON CONFLICT DO NOTHING;
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
