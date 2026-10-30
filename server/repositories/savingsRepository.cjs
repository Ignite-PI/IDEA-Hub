/**
 * Senior Manager savings module data access (Postgres).
 * Initiatives are linked to existing projects through savings_initiatives.project_id (FK, unique),
 * never by duplicating project records. Calculated columns are recomputed on every save with the
 * shared workbook formulas (shared/savingsCalc.js) so stored values always match the inputs.
 */
const crypto = require('crypto');
const { db } = require('./postgresRepository.cjs');

const calcModule = import('../../shared/savingsCalc.js');
const uid = () => crypto.randomUUID();
const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);

const TEXT_FIELDS = ['ops_manager', 'area', 'functional_area', 'process', 'initiative_name', 'savings_track', 'savings_lever', 'savings_outcome',
  'status', 'executive_story', 'evidence', 'timeline_text', 'fte_text', 'raci_r', 'raci_a', 'raci_c', 'raci_i'];
const NUM_FIELDS = ['baseline_volume', 'baseline_aht', 'future_volume', 'future_aht', 'productive_hours', 'current_hourly_rate', 'future_hourly_rate',
  'current_annual_rate', 'future_annual_rate', 'confidence', 'realization'];
const DATE_FIELDS = ['target_start', 'expected_completion', 'last_updated'];
const ENUM_FIELDS = ['owner_signoff', 'finance_validated', 'project_charter_manual'];
const CALC_FIELDS = ['baseline_workload_fte', 'future_workload_fte', 'capacity_fte_released', 'hc_reduction_fte', 'extra_capacity_fte',
  'rate_card_savings', 'gross_annual_savings', 'risk_adjusted_savings'];
const INPUT_FIELDS = [...TEXT_FIELDS, ...NUM_FIELDS, ...DATE_FIELDS, ...ENUM_FIELDS];

const toNum = (v) => (v === null || v === undefined ? null : Number(v));
const mapRow = (r) => {
  const o = { ...r, created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
  for (const f of [...NUM_FIELDS, ...CALC_FIELDS]) o[f] = toNum(r[f]);
  for (const f of DATE_FIELDS) o[f] = r[f] ?? '';
  return o;
};

const SELECT = `SELECT ${['id', 'initiative_no', 'project_id', ...TEXT_FIELDS, ...NUM_FIELDS, ...CALC_FIELDS, ...ENUM_FIELDS,
  'source_key', 'import_notes', 'created_at', 'updated_at', 'updated_by'].join(', ')},
  ${DATE_FIELDS.map((f) => `${f}::text AS ${f}`).join(', ')} FROM savings_initiatives`;

async function getLists() {
  const rows = await (await db()).query('SELECT list_key, value FROM savings_lists WHERE active ORDER BY list_key, sort_order, value');
  const out = {};
  for (const r of rows) (out[r.list_key] ||= []).push(r.value);
  return out;
}

async function addListValue(listKey, value) {
  const d = await db();
  const [{ n }] = await d.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM savings_lists WHERE list_key = $1', [listKey]);
  await d.query(`INSERT INTO savings_lists (list_key, value, sort_order, active) VALUES ($1, $2, $3, true)
                 ON CONFLICT (list_key, value) DO UPDATE SET active = true`, [listKey, value, n]);
  return getLists();
}

async function getSettings() {
  const rows = await (await db()).query('SELECT key, value FROM savings_settings');
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
}

async function updateSettings(patch) {
  await (await db()).tx(async (q) => {
    for (const [k, v] of Object.entries(patch)) {
      await q(`INSERT INTO savings_settings (key, value, updated_at) VALUES ($1, $2, now())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [k, v]);
    }
  });
  return getSettings();
}

/** Project facts needed by the savings module, keyed by project id (title, owner, status, charter, RACI, timeline). */
async function linkedProjects(ids = null) {
  const d = await db();
  const rows = await d.query(`
    SELECT p.id, p.title, p.owner, p.functional_area, p.ops_manager, p.status,
      COALESCE(c.status, 'Not Started') AS charter_status, c.data -> 'raci' AS raci,
      (SELECT COUNT(*)::int FROM timeline_activities t WHERE t.project_id = p.id) AS timeline_total,
      (SELECT COUNT(*)::int FROM timeline_activities t WHERE t.project_id = p.id AND t.start_date IS NOT NULL AND t.end_date IS NOT NULL) AS timeline_dated
    FROM projects p LEFT JOIN charters c ON c.project_id = p.id
    ${ids ? 'WHERE p.id = ANY($1::text[])' : ''} ORDER BY p.title`, ids ? [ids] : []);
  return rows;
}

async function listInitiatives() {
  return (await (await db()).query(`${SELECT} ORDER BY initiative_no`)).map(mapRow);
}

async function getInitiative(id) {
  const [r] = await (await db()).query(`${SELECT} WHERE id = $1`, [id]);
  return r ? mapRow(r) : null;
}

/** Normalises client input: trims text, numbers or null, YYYY-MM-DD dates or null, enum values or null. */
function clean(input) {
  const o = {};
  for (const f of TEXT_FIELDS) if (input[f] !== undefined) o[f] = String(input[f] ?? '').trim().slice(0, f === 'executive_story' || f === 'evidence' ? 8000 : 500);
  for (const f of NUM_FIELDS) {
    if (input[f] === undefined) continue;
    if (input[f] === null || input[f] === '') { o[f] = null; continue; }
    const n = Number(input[f]);
    if (!Number.isFinite(n)) throw Object.assign(new Error(`${f} must be a number.`), { status: 400 });
    if (n < 0) throw Object.assign(new Error(`${f} cannot be negative.`), { status: 400 });
    if ((f === 'confidence' || f === 'realization') && n > 1) throw Object.assign(new Error(`${f} must be between 0% and 100%.`), { status: 400 });
    o[f] = n;
  }
  for (const f of DATE_FIELDS) {
    if (input[f] === undefined) continue;
    const v = String(input[f] ?? '').trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Object.assign(new Error(`${f} must be a date (YYYY-MM-DD).`), { status: 400 });
    o[f] = v || null;
  }
  for (const f of ENUM_FIELDS) {
    if (input[f] === undefined) continue;
    const v = input[f] === '' || input[f] === null ? null : String(input[f]);
    const allowed = f === 'project_charter_manual' ? ['Y', 'N'] : ['Yes', 'No'];
    if (v !== null && !allowed.includes(v)) throw Object.assign(new Error(`${f} must be one of ${allowed.join('/')}.`), { status: 400 });
    o[f] = v;
  }
  if (input.project_id !== undefined) o.project_id = input.project_id ? String(input.project_id) : null;
  return o;
}

async function withCalc(row) {
  const { calcInitiative } = await calcModule;
  const c = calcInitiative(row);
  return Object.fromEntries(CALC_FIELDS.map((f) => [f, c[f]]));
}

async function saveInitiative(id, input, user = '') {
  const d = await db();
  const fields = clean(input);
  return d.tx(async (q) => {
    let existing = null;
    if (id) {
      [existing] = await q(`${SELECT} WHERE id = $1 FOR UPDATE`, [id]);
      if (!existing) return null;
      existing = mapRow(existing);
    }
    if (fields.project_id) {
      const [p] = await q('SELECT id FROM projects WHERE id = $1', [fields.project_id]);
      if (!p) throw Object.assign(new Error('The selected project no longer exists.'), { status: 400 });
      const [other] = await q('SELECT initiative_no FROM savings_initiatives WHERE project_id = $1 AND id <> $2', [fields.project_id, id || '']);
      if (other) throw Object.assign(new Error(`That project is already linked to initiative #${other.initiative_no}.`), { status: 409 });
    }
    const merged = { ...(existing || {}), ...fields };
    // "Last Updated": recorded automatically on every save unless the caller supplies it (e.g. workbook import)
    if (input.last_updated === undefined) merged.last_updated = new Date().toISOString().slice(0, 10);
    const calc = await withCalc(merged);
    const cols = [...INPUT_FIELDS, ...CALC_FIELDS, 'project_id'];
    const vals = cols.map((c) => (c in calc ? calc[c] : merged[c] === '' && (DATE_FIELDS.includes(c) || ENUM_FIELDS.includes(c)) ? null : merged[c] ?? (TEXT_FIELDS.includes(c) ? '' : null)));
    let newId = id;
    if (existing) {
      await q(`UPDATE savings_initiatives SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now(), updated_by = $${cols.length + 1}
               WHERE id = $${cols.length + 2}`, [...vals, user, id]);
    } else {
      newId = uid();
      await q('LOCK TABLE savings_initiatives IN SHARE ROW EXCLUSIVE MODE');
      const [{ n }] = await q('SELECT COALESCE(MAX(initiative_no), 0) + 1 AS n FROM savings_initiatives');
      await q(`INSERT INTO savings_initiatives (id, initiative_no, ${cols.join(', ')}, source_key, import_notes, updated_by)
               VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}, $${cols.length + 3}, $${cols.length + 4}, $${cols.length + 5})`,
        [newId, input.initiative_no ?? n, ...vals, input.source_key ?? null, input.import_notes ?? '', user]);
    }
    const [row] = await q(`${SELECT} WHERE id = $1`, [newId]);
    return mapRow(row);
  });
}

async function deleteInitiative(id) {
  const rows = await (await db()).query('DELETE FROM savings_initiatives WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

/** Idempotent import of workbook rows (source_key = "workbook:row:N"); existing keys are skipped, never overwritten. */
async function importWorkbookRows(rows, user) {
  const result = { imported: 0, skipped: 0 };
  for (const r of rows) {
    const [exists] = await (await db()).query('SELECT 1 FROM savings_initiatives WHERE source_key = $1', [r.source_key]);
    if (exists) { result.skipped++; continue; }
    await saveInitiative(null, r, user);
    result.imported++;
  }
  return result;
}

module.exports = {
  CALC_FIELDS, INPUT_FIELDS,
  getLists, addListValue, getSettings, updateSettings, linkedProjects,
  listInitiatives, getInitiative, saveInitiative, deleteInitiative, importWorkbookRows,
};
