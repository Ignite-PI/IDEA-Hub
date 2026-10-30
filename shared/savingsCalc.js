/**
 * 30% Savings calculations — a faithful port of the "30% Savings Calculation Template File_SBF for edit.xlsx"
 * formulas (table OpsInput on "Manager Input", plus "Savings Summary" and "Storyboard").
 * Shared by the browser (live recalculation) and the server (persisted values + Excel export).
 *
 * Excel semantics preserved on purpose:
 *  - blank numeric inputs behave as 0 in arithmetic; any division error (e.g. blank Productive Hours) becomes 0 (IFERROR).
 *  - Baseline Workload FTE: for "Additional Work / Capacity" when Future Volume > Baseline Volume the workbook uses
 *    Future Volume × Baseline AHT (T column formula), otherwise Baseline Volume × Baseline AHT.
 *  - Gross Annual Savings uses Released FTE × Current Annual Rate for every outcome except "Rate Card Reduction"
 *    (including when no outcome is selected), exactly like =IF(I="Rate Card Reduction",Y,V*P).
 */

export const OUTCOME = {
  HC: 'Billable Headcount Reduction',
  CAPACITY: 'Additional Work / Capacity',
  RATE: 'Rate Card Reduction',
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const safeDiv = (a, b) => { const r = a / b; return Number.isFinite(r) ? r : 0; };

/** Annual rate per FTE: hourly rate × productive hours when an hourly rate is entered for this initiative, else the manually entered annual rate. */
export function annualRates(i) {
  const hours = num(i.productive_hours);
  const curFromHourly = !isBlank(i.current_hourly_rate);
  const futFromHourly = !isBlank(i.future_hourly_rate);
  return {
    current: curFromHourly ? num(i.current_hourly_rate) * hours : (isBlank(i.current_annual_rate) ? null : num(i.current_annual_rate)),
    future: futFromHourly ? num(i.future_hourly_rate) * hours : (isBlank(i.future_annual_rate) ? null : num(i.future_annual_rate)),
    currentSource: curFromHourly ? 'hourly' : isBlank(i.current_annual_rate) ? 'missing' : 'manual',
    futureSource: futFromHourly ? 'hourly' : isBlank(i.future_annual_rate) ? 'missing' : 'manual',
  };
}

/** Columns T..AA of OpsInput. */
export function calcInitiative(i) {
  const K = num(i.baseline_volume), L = num(i.baseline_aht), M = num(i.future_volume), N = num(i.future_aht), O = num(i.productive_hours);
  const rates = annualRates(i);
  const P = num(rates.current), Q = num(rates.future);
  const R = num(i.confidence), S = num(i.realization);
  const outcome = i.savings_outcome || '';

  const baselineFte = outcome === OUTCOME.CAPACITY && M > K ? safeDiv(M * L / 60, O) : safeDiv(K * L / 60, O); // T
  const futureFte = safeDiv(M * N / 60, O);                                                                  // U
  const capacityReleased = Math.max(baselineFte - futureFte, 0);                                            // V
  const hcReduction = outcome === OUTCOME.HC ? capacityReleased : 0;                                         // W
  const extraCapacity = outcome === OUTCOME.CAPACITY ? capacityReleased : 0;                                 // X
  const rateCardSavings = outcome === OUTCOME.RATE ? Math.max(futureFte * (P - Q), 0) : 0;                   // Y
  const grossAnnualSavings = outcome === OUTCOME.RATE ? rateCardSavings : capacityReleased * P;              // Z
  const riskAdjustedSavings = grossAnnualSavings * R * S;                                                    // AA

  return {
    current_annual_rate_effective: rates.current,
    future_annual_rate_effective: rates.future,
    current_rate_source: rates.currentSource,
    future_rate_source: rates.futureSource,
    baseline_workload_fte: baselineFte,
    future_workload_fte: futureFte,
    capacity_fte_released: capacityReleased,
    hc_reduction_fte: hcReduction,
    extra_capacity_fte: extraCapacity,
    rate_card_savings: rateCardSavings,
    gross_annual_savings: grossAnnualSavings,
    risk_adjusted_savings: riskAdjustedSavings,
  };
}

const sum = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
const named = (rows) => rows.filter((r) => !isBlank(r.initiative_name));

/** "Savings Summary" sheet (E4:E10, H4:H8, A12:D16, A19:D23). `rows` must already contain calcInitiative() results. */
export function summarize(rows, settings) {
  const target = num(settings.target_revenue);
  const riskAdjusted = sum(rows, 'risk_adjusted_savings');
  const attainment = target ? riskAdjusted / target : 0;
  const tracks = ['Process', 'People', 'Technology'].map((t) => {
    const rs = rows.filter((r) => r.savings_track === t);
    return { label: t, risk_adjusted_savings: sum(rs, 'risk_adjusted_savings'), fte_released: sum(rs, 'capacity_fte_released'), initiatives: named(rs).length };
  });
  // Outcome table: FTE column uses HC Reduction FTE / Extra Capacity FTE / Capacity FTE Released respectively (as in C20:C22)
  const outcomeFteKey = { [OUTCOME.HC]: 'hc_reduction_fte', [OUTCOME.CAPACITY]: 'extra_capacity_fte', [OUTCOME.RATE]: 'capacity_fte_released' };
  const outcomes = [OUTCOME.HC, OUTCOME.CAPACITY, OUTCOME.RATE].map((o) => {
    const rs = rows.filter((r) => r.savings_outcome === o);
    return { label: o, risk_adjusted_savings: sum(rs, 'risk_adjusted_savings'), fte: sum(rs, outcomeFteKey[o]), initiatives: named(rs).length };
  });
  const total = (list, k) => list.reduce((s, x) => s + x[k], 0);
  return {
    initiatives_entered: named(rows).length,                         // E4
    capacity_fte_released: sum(rows, 'capacity_fte_released'),      // E5
    hc_reduction_fte: sum(rows, 'hc_reduction_fte'),                // E6
    extra_capacity_fte: sum(rows, 'extra_capacity_fte'),            // E7
    gross_annual_value: sum(rows, 'gross_annual_savings'),          // E8
    risk_adjusted_value: riskAdjusted,                              // E9
    target_achievement: attainment,                                 // E10 (= H7)
    target,                                                         // H4
    remaining_gap: riskAdjusted - target,                           // H6 (negative = gap, positive = surplus)
    status: riskAdjusted >= target ? 'TARGET MET' : 'BELOW TARGET', // H8
    tracks,
    tracks_total: { risk_adjusted_savings: total(tracks, 'risk_adjusted_savings'), fte_released: total(tracks, 'fte_released'), initiatives: total(tracks, 'initiatives') },
    outcomes,
    outcomes_total: { risk_adjusted_savings: total(outcomes, 'risk_adjusted_savings'), fte: total(outcomes, 'fte'), initiatives: total(outcomes, 'initiatives') },
    max_risk_adjusted: rows.length ? Math.max(...rows.map((r) => num(r.risk_adjusted_savings))) : 0, // Storyboard D9
  };
}

/** Workbook "Savings Summary" source-deck benchmark constants (B4:B8) + pool FTE from the Instructions tab. */
export const DEFAULT_SETTINGS = {
  projected_exit_hc: 1117,
  projected_exit_revenue: 39267995.75,
  target_fte: 335.1,
  target_revenue: 11780398.725,
  potential_pool_revenue: 12936071.28,
  potential_pool_fte: 427,
  target_percent: 0.3,
};
