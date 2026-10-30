export declare const OUTCOME: { HC: string; CAPACITY: string; RATE: string };

export interface SavingsCalc {
  current_annual_rate_effective: number | null;
  future_annual_rate_effective: number | null;
  current_rate_source: 'hourly' | 'manual' | 'missing';
  future_rate_source: 'hourly' | 'manual' | 'missing';
  baseline_workload_fte: number;
  future_workload_fte: number;
  capacity_fte_released: number;
  hc_reduction_fte: number;
  extra_capacity_fte: number;
  rate_card_savings: number;
  gross_annual_savings: number;
  risk_adjusted_savings: number;
}

export interface SavingsCalcInput {
  baseline_volume?: number | string | null;
  baseline_aht?: number | string | null;
  future_volume?: number | string | null;
  future_aht?: number | string | null;
  productive_hours?: number | string | null;
  current_hourly_rate?: number | string | null;
  future_hourly_rate?: number | string | null;
  current_annual_rate?: number | string | null;
  future_annual_rate?: number | string | null;
  confidence?: number | string | null;
  realization?: number | string | null;
  savings_outcome?: string | null;
}

export interface SummaryRow { label: string; risk_adjusted_savings: number; initiatives: number }
export interface SavingsSummary {
  initiatives_entered: number;
  capacity_fte_released: number;
  hc_reduction_fte: number;
  extra_capacity_fte: number;
  gross_annual_value: number;
  risk_adjusted_value: number;
  target_achievement: number;
  target: number;
  remaining_gap: number;
  status: 'TARGET MET' | 'BELOW TARGET';
  tracks: (SummaryRow & { fte_released: number })[];
  tracks_total: { risk_adjusted_savings: number; fte_released: number; initiatives: number };
  outcomes: (SummaryRow & { fte: number })[];
  outcomes_total: { risk_adjusted_savings: number; fte: number; initiatives: number };
  max_risk_adjusted: number;
}

export interface SavingsSettings {
  projected_exit_hc: number;
  projected_exit_revenue: number;
  target_fte: number;
  target_revenue: number;
  potential_pool_revenue: number;
  potential_pool_fte: number;
  target_percent: number;
}

export declare function annualRates(i: SavingsCalcInput): { current: number | null; future: number | null; currentSource: string; futureSource: string };
export declare function calcInitiative(i: SavingsCalcInput): SavingsCalc;
export declare function summarize(rows: (Partial<SavingsCalc> & { savings_track?: string | null; savings_outcome?: string | null; initiative_name?: string | null })[], settings: Partial<SavingsSettings>): SavingsSummary;
export declare const DEFAULT_SETTINGS: SavingsSettings;
