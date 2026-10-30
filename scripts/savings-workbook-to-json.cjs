/**
 * Converts the "Manager Input" rows of the 30% Savings workbook into import payloads for POST /api/savings/import.
 *   node scripts/savings-workbook-to-json.cjs "<path to .xlsx>" out.json
 * - Keeps every input value as typed in the workbook (annual rates are preserved exactly).
 * - When an annual rate is a formula of the form  <hourly>*O<row>  the hourly rate is recorded for that initiative.
 * - Rows whose inputs are formulas of any other shape keep the calculated value and get an import note.
 * - source_key = "workbook:row:<n>" makes the import idempotent (re-running never duplicates or overwrites).
 */
const ExcelJS = require('exceljs');
const fs = require('fs');

const [, , file, out] = process.argv;
if (!file || !out) { console.error('usage: node scripts/savings-workbook-to-json.cjs <xlsx> <out.json>'); process.exit(1); }

const COLS = {
  A: 'initiative_no', B: 'ops_manager', C: 'area', D: 'functional_area', E: 'process', F: 'initiative_name', G: 'savings_track', H: 'savings_lever',
  I: 'savings_outcome', J: 'status', K: 'baseline_volume', L: 'baseline_aht', M: 'future_volume', N: 'future_aht', O: 'productive_hours',
  P: 'current_annual_rate', Q: 'future_annual_rate', R: 'confidence', S: 'realization', AB: 'target_start', AC: 'expected_completion',
  AD: 'executive_story', AE: 'evidence', AF: 'owner_signoff', AG: 'finance_validated', AH: 'last_updated', AI: 'project_charter_manual',
  AJ: 'timeline_text', AK: 'fte_text', AL: 'raci_r', AM: 'raci_a', AN: 'raci_c', AO: 'raci_i',
};
const NUMERIC = new Set(['baseline_volume', 'baseline_aht', 'future_volume', 'future_aht', 'productive_hours', 'current_annual_rate', 'future_annual_rate', 'confidence', 'realization']);
const DATES = new Set(['target_start', 'expected_completion', 'last_updated']);

const excelDate = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  return v ? String(v) : null;
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Manager Input');
  const rows = [];
  ws.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const value = (col) => {
      const v = row.getCell(col).value;
      if (v && typeof v === 'object' && 'result' in v) return v.result;
      if (v && typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join('');
      return v;
    };
    const formula = (col) => { const v = row.getCell(col).value; return v && typeof v === 'object' && v.formula ? v.formula : null; };
    const name = value('F');
    if (name === null || name === undefined || String(name).trim() === '') return;
    const rec = { source_key: `workbook:row:${rowNo}` };
    const notes = [];
    for (const [col, key] of Object.entries(COLS)) {
      let v = value(col);
      if (key === 'initiative_no') { v = Number(v) || rowNo - 1; rec[key] = v; continue; }
      if (DATES.has(key)) { rec[key] = excelDate(v); continue; }
      if (NUMERIC.has(key)) { rec[key] = v === null || v === undefined || v === '' ? null : Number(v); }
      else rec[key] = v === null || v === undefined ? '' : String(v).trim();
      const f = formula(col);
      if (f && (key === 'current_annual_rate' || key === 'future_annual_rate')) {
        const m = f.replace(/\$/g, '').match(/^\s*([\d.]+)\s*\*\s*O(\d+)\s*$/i);
        if (m && Number(m[2]) === rowNo) rec[key === 'current_annual_rate' ? 'current_hourly_rate' : 'future_hourly_rate'] = Number(m[1]);
        else notes.push(`${key} was the formula =${f} in the workbook; imported as its value.`);
      } else if (f) {
        notes.push(`${COLS[col]} was the formula =${f} in the workbook; imported as its value.`);
      }
    }
    if (rec.owner_signoff === '') rec.owner_signoff = null;
    if (rec.finance_validated === '') rec.finance_validated = null;
    if (rec.project_charter_manual === '') rec.project_charter_manual = null;
    rec.import_notes = notes.join(' ');
    rows.push(rec);
  });
  fs.writeFileSync(out, JSON.stringify({ rows }, null, 1));
  console.log(`${rows.length} initiative rows → ${out}`);
  for (const r of rows.filter((x) => x.import_notes)) console.log(`  #${r.initiative_no} ${r.initiative_name}: ${r.import_notes}`);
})().catch((e) => { console.error(e); process.exit(1); });
