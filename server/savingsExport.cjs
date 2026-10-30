/**
 * Builds the "30% Savings" Excel workbook from the database (all saved initiatives, not just what is on screen).
 * Mirrors the template tabs: Instructions, Savings Summary, Manager Input, Storyboard, Lists.
 * Calculated columns and summary cells are written as live Excel formulas (same as the template) with cached results,
 * so the file shows values immediately and keeps recalculating if a value is edited in Excel.
 */
const ExcelJS = require('exceljs');

const mods = Promise.all([import('../shared/savingsCalc.js'), import('../shared/savingsResolve.js'), import('../shared/savingsContent.js')]);

const C = { purple: 'FF5009B5', dark: 'FF2B1B49', pale: 'FFEBE4FF', turq: 'FF00B8BA', paleTurq: 'FFD9F5F5', grey: 'FFF5F5F5', calc: 'FFE1ECFF', amber: 'FFFFF3DF', red: 'FFFCE8EE', white: 'FFFFFFFF' };
const FMT = { currency: '$#,##0;[Red]-$#,##0', currency2: '$#,##0.00', fte: '#,##0.00', number: '#,##0', percent: '0%', percent1: '0.0%', date: 'mmm d, yyyy' };

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: 'FFD9D4E6' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const dateVal = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function headerRow(ws, rowNo, values, color = C.purple) {
  const row = ws.getRow(rowNo);
  values.forEach((v, i) => {
    const c = row.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: C.white } };
    c.fill = fill(color);
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = box;
  });
  row.height = 32;
}

async function buildSavingsWorkbook({ lists, settings, initiatives, projects }) {
  const [{ calcInitiative, summarize }, { resolveInitiative, initiativeIssues, isIncomplete }, { INSTRUCTIONS, STORYBOARD, COLUMNS }] = await mods;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const rows = initiatives.map((r) => {
    const project = r.project_id ? byId.get(r.project_id) || null : null;
    const resolved = resolveInitiative(r, project);
    const calc = calcInitiative(r);
    const issues = initiativeIssues(r, resolved);
    return { r, project, resolved, calc, issues };
  });
  const summary = summarize(rows.map(({ r, resolved, calc }) => ({ ...r, ...calc, initiative_name: resolved.initiative_name.value })), settings);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SBF Project Hub';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  // Tabs in the same order as the template
  const wi = wb.addWorksheet('Instructions', { properties: { tabColor: { argb: C.purple } } });
  const ws = wb.addWorksheet('Savings Summary', { properties: { tabColor: { argb: C.purple } } });
  const wm = wb.addWorksheet('Manager Input', { views: [{ state: 'frozen', xSplit: 6, ySplit: 1 }], properties: { tabColor: { argb: C.turq } } });
  const wsb = wb.addWorksheet('Storyboard', { properties: { tabColor: { argb: C.dark } } });
  const wl = wb.addWorksheet('Lists', { properties: { tabColor: { argb: 'FF8C9AB9' } } });

  // ── Instructions ──────────────────────────────────────────────────────────
  wi.columns = [{ width: 30 }, { width: 120 }];
  const put = (a, b, style = {}) => { const row = wi.addRow([a, b]); row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; Object.assign(row.getCell(1), style); return row; };
  const t = wi.addRow([INSTRUCTIONS.title]); t.font = { bold: true, size: 16, color: { argb: C.purple } };
  put('Purpose', INSTRUCTIONS.purpose).getCell(1).font = { bold: true };
  put('Target from source deck', INSTRUCTIONS.target).getCell(1).font = { bold: true };
  put('How to complete', '').getCell(1).font = { bold: true, color: { argb: C.purple } };
  INSTRUCTIONS.steps.forEach((s, i) => put(i + 1, s));
  put('Calculation logic', '').getCell(1).font = { bold: true, color: { argb: C.purple } };
  INSTRUCTIONS.logic.forEach(([a, b]) => put(a, b));
  put('Guardrails', '').getCell(1).font = { bold: true, color: { argb: C.purple } };
  INSTRUCTIONS.guardrails.forEach((g) => put('', g));
  put('Source deck reference', INSTRUCTIONS.source).getCell(1).font = { bold: true };
  put('Workbook formula notes', '').getCell(1).font = { bold: true, color: { argb: C.purple } };
  INSTRUCTIONS.workbookNotes.forEach((g) => put('', g));
  put('Exported from', `SBF Project Hub on ${new Date().toISOString().slice(0, 10)} — ${initiatives.length} initiative(s). The application database is the live source; this file is a soft copy.`);

  // ── Manager Input (columns A..AO exactly as the template, then app-only columns) ──
  const extra = [
    { header: 'Current Hourly Rate', key: 'current_hourly_rate', type: 'currency2' },
    { header: 'Future Hourly Rate', key: 'future_hourly_rate', type: 'currency2' },
    { header: 'Linked SBF Project', key: 'project' },
    { header: 'Project Owner (from project)', key: 'owner' },
    { header: 'Record Status', key: 'record_status' },
    { header: 'Missing / Needs Attention', key: 'issues' },
  ];
  const headers = [...COLUMNS.map((c) => c.header), ...extra.map((e) => e.header)];
  headerRow(wm, 1, headers);
  COLUMNS.forEach((c, i) => {
    const cell = wm.getRow(1).getCell(i + 1);
    if (c.kind === 'calc') cell.fill = fill(C.dark);
    cell.note = { texts: [{ text: `${c.header}\n${c.help}` }] };
  });
  const widths = { AD: 60, AE: 45, F: 30, B: 24, D: 30, E: 18, H: 26, I: 28 };
  COLUMNS.forEach((c, i) => { wm.getColumn(i + 1).width = widths[c.col] || (c.kind === 'raci' ? 22 : 16); });
  extra.forEach((_, i) => { wm.getColumn(COLUMNS.length + i + 1).width = i === 5 ? 60 : 22; });
  const colIdx = Object.fromEntries(COLUMNS.map((c, i) => [c.col, i + 1]));
  const hourlyCur = COLUMNS.length + 1;
  const hourlyFut = COLUMNS.length + 2;
  const L = (k) => wm.getColumn(k).letter;

  rows.forEach(({ r, project, resolved, calc, issues }, idx) => {
    const rowNo = idx + 2;
    const row = wm.getRow(rowNo);
    const set = (col, value, numFmt) => { const c = row.getCell(colIdx[col]); c.value = value; if (numFmt) c.numFmt = numFmt; return c; };
    set('A', r.initiative_no);
    set('B', resolved.ops_manager.value);
    set('C', r.area);
    set('D', resolved.functional_area.value);
    set('E', r.process);
    set('F', resolved.initiative_name.value);
    set('G', r.savings_track); set('H', r.savings_lever); set('I', r.savings_outcome);
    set('J', resolved.status.value);
    set('K', n(r.baseline_volume), FMT.number); set('L', n(r.baseline_aht), FMT.fte);
    set('M', n(r.future_volume), FMT.number); set('N', n(r.future_aht), FMT.fte);
    set('O', n(r.productive_hours), FMT.number);
    // P/Q: =hourly × productive hours when an hourly rate is recorded for this initiative, else the entered annual rate
    const pq = (col, hourlyKey, hourlyCol, effective) => {
      if (r[hourlyKey] !== null && r[hourlyKey] !== undefined) set(col, { formula: `${L(hourlyCol)}${rowNo}*O${rowNo}`, result: effective }, FMT.currency);
      else set(col, effective, FMT.currency);
    };
    pq('P', 'current_hourly_rate', hourlyCur, calc.current_annual_rate_effective);
    pq('Q', 'future_hourly_rate', hourlyFut, calc.future_annual_rate_effective);
    set('R', n(r.confidence), FMT.percent); set('S', n(r.realization), FMT.percent);
    const R = rowNo;
    // Workbook formulas (OpsInput table), written per row
    set('T', { formula: `IFERROR(IF(AND($I${R}="Additional Work / Capacity",$M${R}>$K${R}),$M${R}*$L${R}/60/$O${R},$K${R}*$L${R}/60/$O${R}),0)`, result: calc.baseline_workload_fte }, FMT.fte);
    set('U', { formula: `IFERROR(M${R}*N${R}/60/O${R},0)`, result: calc.future_workload_fte }, FMT.fte);
    set('V', { formula: `MAX(T${R}-U${R},0)`, result: calc.capacity_fte_released }, FMT.fte);
    set('W', { formula: `IF(I${R}="Billable Headcount Reduction",V${R},0)`, result: calc.hc_reduction_fte }, FMT.fte);
    set('X', { formula: `IF(I${R}="Additional Work / Capacity",V${R},0)`, result: calc.extra_capacity_fte }, FMT.fte);
    set('Y', { formula: `IF(I${R}="Rate Card Reduction",MAX(U${R}*(P${R}-Q${R}),0),0)`, result: calc.rate_card_savings }, FMT.currency);
    set('Z', { formula: `IF(I${R}="Rate Card Reduction",Y${R},V${R}*P${R})`, result: calc.gross_annual_savings }, FMT.currency);
    set('AA', { formula: `Z${R}*R${R}*S${R}`, result: calc.risk_adjusted_savings }, FMT.currency);
    set('AB', dateVal(r.target_start), FMT.date); set('AC', dateVal(r.expected_completion), FMT.date);
    set('AD', r.executive_story).alignment = { wrapText: true, vertical: 'top' };
    set('AE', r.evidence).alignment = { wrapText: true, vertical: 'top' };
    set('AF', r.owner_signoff || ''); set('AG', r.finance_validated || '');
    set('AH', dateVal(r.last_updated), FMT.date);
    set('AI', resolved.project_charter.value);
    set('AJ', r.timeline_text); set('AK', r.fte_text);
    ['R', 'A', 'C', 'I'].forEach((letter, i) => set(['AL', 'AM', 'AN', 'AO'][i], resolved.raci[letter].value));
    row.getCell(hourlyCur).value = n(r.current_hourly_rate); row.getCell(hourlyCur).numFmt = FMT.currency2;
    row.getCell(hourlyFut).value = n(r.future_hourly_rate); row.getCell(hourlyFut).numFmt = FMT.currency2;
    row.getCell(hourlyFut + 1).value = project ? project.title : 'Not linked';
    row.getCell(hourlyFut + 2).value = project ? project.owner : '';
    row.getCell(hourlyFut + 3).value = isIncomplete(issues) ? 'Incomplete' : 'Complete';
    row.getCell(hourlyFut + 4).value = issues.filter((i) => i.kind !== 'notice').map((i) => i.label).join('; ');
    row.getCell(hourlyFut + 4).alignment = { wrapText: true, vertical: 'top' };
    for (let c = 1; c <= headers.length; c++) {
      const cell = row.getCell(c);
      cell.border = box;
      if (!cell.alignment) cell.alignment = { vertical: 'top' };
    }
    for (const c of COLUMNS.filter((x) => x.kind === 'calc')) row.getCell(colIdx[c.col]).fill = fill(C.calc);
    // highlight missing required cells (same rules as the app)
    const missingCols = { ops_manager: 'B', area: 'C', functional_area: 'D', process: 'E', initiative_name: 'F', savings_track: 'G', savings_lever: 'H', savings_outcome: 'I', status: 'J',
      baseline_volume: 'K', baseline_aht: 'L', future_volume: 'M', future_aht: 'N', productive_hours: 'O', current_hourly_rate: 'P', future_hourly_rate: 'Q', confidence: 'R', realization: 'S',
      target_start: 'AB', expected_completion: 'AC', executive_story: 'AD', evidence: 'AE', owner_signoff: 'AF', finance_validated: 'AG', project_charter: 'AI', raci_r: 'AL', raci_a: 'AM', raci_c: 'AN', raci_i: 'AO' };
    for (const iss of issues) {
      const col = missingCols[iss.field];
      if (col) row.getCell(colIdx[col]).fill = fill(iss.kind === 'validation' ? C.amber : C.red);
    }
    if (isIncomplete(issues)) row.getCell(hourlyFut + 3).fill = fill(C.red);
  });
  const last = Math.max(rows.length + 1, 2);
  wm.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  // ── Lists ─────────────────────────────────────────────────────────────────
  const listCols = [['Savings Track', 'savings_track'], ['Savings Lever', 'savings_lever'], ['Savings Outcome', 'savings_outcome'], ['Status', 'status'], ['Yes / No', 'yes_no'], ['Area', 'area'], ['Functional Area', 'functional_area']];
  headerRow(wl, 1, listCols.map(([h]) => h), C.dark);
  listCols.forEach(([, key], ci) => {
    wl.getColumn(ci + 1).width = key === 'functional_area' || key === 'savings_lever' || key === 'savings_outcome' ? 40 : 18;
    (lists[key] || []).forEach((v, ri) => { wl.getRow(ri + 2).getCell(ci + 1).value = v; });
  });
  const listRef = (key) => {
    const ci = listCols.findIndex(([, k]) => k === key) + 1;
    const letter = wl.getColumn(ci).letter;
    return `Lists!$${letter}$2:$${letter}$${Math.max((lists[key] || []).length + 1, 2)}`;
  };
  // Data validations (dropdowns) like the template, extended 200 rows below the data for new entries
  const dvLast = last + 200;
  const dv = (col, key) => {
    for (let r = 2; r <= dvLast; r++) {
      wm.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [listRef(key)], showErrorMessage: true, errorTitle: 'Select from the list', error: 'Choose a value from the drop-down list.' };
    }
  };
  dv('C', 'area'); dv('D', 'functional_area'); dv('G', 'savings_track'); dv('H', 'savings_lever'); dv('I', 'savings_outcome'); dv('J', 'status'); dv('AF', 'yes_no'); dv('AG', 'yes_no');
  for (let r = 2; r <= dvLast; r++) {
    for (const col of ['R', 'S']) wm.getCell(`${col}${r}`).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0] };
  }

  // ── Savings Summary ───────────────────────────────────────────────────────
  ws.columns = [{ width: 36 }, { width: 20 }, { width: 16 }, { width: 30 }, { width: 20 }, { width: 26 }, { width: 4 }, { width: 20 }];
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = '30% Clinical Savings - Summary';
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: C.purple } };
  const MI = (col) => `'Manager Input'!$${col}$2:$${col}$${last}`;
  headerRow(ws, 3, ['Source Deck Benchmark', 'Value', '', 'Live Portfolio KPI', 'Value', '30% Revenue Target Status', '', ''], C.purple);
  ws.mergeCells('F3:H3');
  const bench = [
    ['Projected 2027 Exit - Billable HC', settings.projected_exit_hc, FMT.number],
    ['Projected 2027 Exit - Revenue', settings.projected_exit_revenue, FMT.currency],
    ['30% Target - Billable FTE', settings.target_fte, FMT.fte],
    ['30% Target - Revenue Equivalent', settings.target_revenue, FMT.currency],
    ['Potential Savings Pool', settings.potential_pool_revenue, FMT.currency],
  ];
  bench.forEach(([label, v, f], i) => { ws.getCell(`A${4 + i}`).value = label; ws.getCell(`B${4 + i}`).value = v; ws.getCell(`B${4 + i}`).numFmt = f; });
  const kpis = [
    ['Initiatives Entered', `COUNTIF(${MI('F')},"<>")`, summary.initiatives_entered, FMT.number],
    ['Capacity FTE Released', `SUM(${MI('V')})`, summary.capacity_fte_released, FMT.fte],
    ['HC Reduction FTE', `SUM(${MI('W')})`, summary.hc_reduction_fte, FMT.fte],
    ['Extra Capacity FTE', `SUM(${MI('X')})`, summary.extra_capacity_fte, FMT.fte],
    ['Gross Annual Value', `SUM(${MI('Z')})`, summary.gross_annual_value, FMT.currency],
    ['Risk-Adjusted Value', `SUM(${MI('AA')})`, summary.risk_adjusted_value, FMT.currency],
    ['Target Achievement', 'IFERROR(E9/$B$7,0)', summary.target_achievement, FMT.percent1],
  ];
  kpis.forEach(([label, f, result, fmt], i) => { ws.getCell(`D${4 + i}`).value = label; ws.getCell(`E${4 + i}`).value = { formula: f, result }; ws.getCell(`E${4 + i}`).numFmt = fmt; ws.getCell(`E${4 + i}`).fill = fill(C.calc); });
  const status = [
    ['Target', '$B$7', summary.target, FMT.currency],
    ['Risk-Adjusted Savings', '$E$9', summary.risk_adjusted_value, FMT.currency],
    ['Remaining Gap / Surplus', '$E$9-$B$7', summary.remaining_gap, FMT.currency],
    ['Target Attainment', 'IFERROR($E$9/$B$7,0)', summary.target_achievement, FMT.percent1],
    ['Status', 'IF($E$9>=$B$7,"TARGET MET","BELOW TARGET")', summary.status, undefined],
  ];
  status.forEach(([label, f, result, fmt], i) => {
    ws.mergeCells(`F${4 + i}:G${4 + i}`);
    ws.getCell(`F${4 + i}`).value = label;
    ws.getCell(`H${4 + i}`).value = { formula: f, result };
    if (fmt) ws.getCell(`H${4 + i}`).numFmt = fmt;
    ws.getCell(`H${4 + i}`).fill = fill(C.calc);
  });
  ws.getCell('H8').font = { bold: true, color: { argb: summary.status === 'TARGET MET' ? 'FF007476' : 'FFA3204A' } };

  headerRow(ws, 12, ['Savings Track', 'Risk-Adjusted Savings', 'FTE Released', 'Initiatives'], C.dark);
  summary.tracks.forEach((t, i) => {
    const r = 13 + i;
    ws.getCell(`A${r}`).value = t.label;
    ws.getCell(`B${r}`).value = { formula: `SUMIFS(${MI('AA')},${MI('G')},A${r})`, result: t.risk_adjusted_savings }; ws.getCell(`B${r}`).numFmt = FMT.currency;
    ws.getCell(`C${r}`).value = { formula: `SUMIFS(${MI('V')},${MI('G')},A${r})`, result: t.fte_released }; ws.getCell(`C${r}`).numFmt = FMT.fte;
    ws.getCell(`D${r}`).value = { formula: `COUNTIFS(${MI('G')},A${r},${MI('F')},"<>")`, result: t.initiatives };
  });
  ws.getCell('A16').value = 'Total'; ws.getCell('A16').font = { bold: true };
  ws.getCell('B16').value = { formula: 'SUM(B13:B15)', result: summary.tracks_total.risk_adjusted_savings }; ws.getCell('B16').numFmt = FMT.currency;
  ws.getCell('C16').value = { formula: 'SUM(C13:C15)', result: summary.tracks_total.fte_released }; ws.getCell('C16').numFmt = FMT.fte;
  ws.getCell('D16').value = { formula: 'SUM(D13:D15)', result: summary.tracks_total.initiatives };

  headerRow(ws, 19, ['Savings Outcome', 'Risk-Adjusted Savings', 'FTE / Capacity', 'Initiatives'], C.dark);
  const outcomeFteCol = { 'Billable Headcount Reduction': 'W', 'Additional Work / Capacity': 'X', 'Rate Card Reduction': 'V' };
  summary.outcomes.forEach((o, i) => {
    const r = 20 + i;
    ws.getCell(`A${r}`).value = o.label;
    ws.getCell(`B${r}`).value = { formula: `SUMIFS(${MI('AA')},${MI('I')},A${r})`, result: o.risk_adjusted_savings }; ws.getCell(`B${r}`).numFmt = FMT.currency;
    ws.getCell(`C${r}`).value = { formula: `SUMIFS(${MI(outcomeFteCol[o.label])},${MI('I')},A${r})`, result: o.fte }; ws.getCell(`C${r}`).numFmt = FMT.fte;
    ws.getCell(`D${r}`).value = { formula: `COUNTIFS(${MI('I')},A${r},${MI('F')},"<>")`, result: o.initiatives };
  });
  ws.getCell('A23').value = 'Total'; ws.getCell('A23').font = { bold: true };
  ws.getCell('B23').value = { formula: 'SUM(B20:B22)', result: summary.outcomes_total.risk_adjusted_savings }; ws.getCell('B23').numFmt = FMT.currency;
  ws.getCell('C23').value = { formula: 'SUM(C20:C22)', result: summary.outcomes_total.fte }; ws.getCell('C23').numFmt = FMT.fte;
  ws.getCell('D23').value = { formula: 'SUM(D20:D22)', result: summary.outcomes_total.initiatives };
  ws.getCell('A25').value = 'Charts: see the Savings Summary dashboard in SBF Project Hub (Risk-Adjusted Savings by Track and by Outcome).';
  ws.getCell('A25').font = { italic: true, color: { argb: 'FF6B6680' } };

  // ── Storyboard ────────────────────────────────────────────────────────────
  wsb.columns = [{ width: 28 }, { width: 22 }, { width: 52 }, { width: 22 }, { width: 42 }, { width: 38 }];
  wsb.mergeCells('A1:F1');
  wsb.getCell('A1').value = '30% Clinical Savings';
  wsb.getCell('A1').font = { bold: true, size: 16, color: { argb: C.purple } };
  headerRow(wsb, 3, ['Slide', 'Purpose', 'Headline / Key Message', 'Primary Metric', 'Evidence to Show', 'Owner / Action'], C.purple);
  const metricCell = {
    target: ["'Savings Summary'!B7", summary.target, FMT.currency],
    risk_adjusted_value: ["'Savings Summary'!E9", summary.risk_adjusted_value, FMT.currency],
    capacity_fte_released: ["'Savings Summary'!E5", summary.capacity_fte_released, FMT.fte],
    initiatives_entered: ["'Savings Summary'!E4", summary.initiatives_entered, FMT.number],
    target_achievement: ["'Savings Summary'!E10", summary.target_achievement, FMT.percent1],
    max_risk_adjusted: [`MAX(${MI('AA')})`, summary.max_risk_adjusted, FMT.currency],
  };
  STORYBOARD.forEach((s, i) => {
    const r = 4 + i;
    const [f, result, fmt] = metricCell[s.metric];
    wsb.getRow(r).values = [s.slide, s.purpose, s.headline, null, s.evidence, s.owner];
    wsb.getCell(`D${r}`).value = { formula: f, result };
    wsb.getCell(`D${r}`).numFmt = fmt;
    wsb.getRow(r).alignment = { wrapText: true, vertical: 'top' };
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { buildSavingsWorkbook };
