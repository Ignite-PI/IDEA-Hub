import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type SavingsBootstrap, type SavingsInitiative } from '../api';
import { calcInitiative, summarize, DEFAULT_SETTINGS, type SavingsCalc, type SavingsSettings, type SavingsSummary } from '../../shared/savingsCalc';
import { initiativeIssues, isIncomplete, needsValidation, resolveInitiative, type InitiativeIssue, type LinkedProjectInfo, type ResolvedInitiative } from '../../shared/savingsResolve';

/** An initiative with everything the UI needs: stored row + live calculation + project resolution + issues. */
export interface Enriched {
  row: SavingsInitiative;
  calc: SavingsCalc;
  project: LinkedProjectInfo | null;
  resolved: ResolvedInitiative;
  issues: InitiativeIssue[];
  incomplete: boolean;
  needsValidation: boolean;
}

export interface SavingsFilters {
  q: string;
  ops_manager: string;
  area: string;
  functional_area: string;
  process: string;
  savings_track: string;
  savings_lever: string;
  savings_outcome: string;
  status: string;
  owner_signoff: string;
  finance_validated: string;
  project_charter: string;
  completeness: '' | 'incomplete' | 'complete' | 'needs_validation';
}
export const EMPTY_FILTERS: SavingsFilters = {
  q: '', ops_manager: '', area: '', functional_area: '', process: '', savings_track: '', savings_lever: '', savings_outcome: '',
  status: '', owner_signoff: '', finance_validated: '', project_charter: '', completeness: '',
};

interface SavingsState {
  loading: boolean;
  error: string | null;
  data: SavingsBootstrap | null;
  settings: SavingsSettings;
  all: Enriched[];
  filtered: Enriched[];
  summary: SavingsSummary;
  summaryAll: SavingsSummary;
  filters: SavingsFilters;
  setFilters: (f: Partial<SavingsFilters>) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  reload: () => Promise<void>;
  upsertLocal: (row: SavingsInitiative) => void;
  removeLocal: (id: string) => void;
  setSettings: (s: Record<string, number>) => void;
  setLists: (l: Record<string, string[]>) => void;
}

const Ctx = createContext<SavingsState | null>(null);

export function enrich(row: SavingsInitiative, projects: Map<string, LinkedProjectInfo>): Enriched {
  const project = row.project_id ? projects.get(row.project_id) ?? null : null;
  const resolved = resolveInitiative(row as unknown as Record<string, unknown>, project);
  const calc = calcInitiative(row);
  const issues = initiativeIssues(row as unknown as Record<string, unknown>, resolved);
  return { row, calc, project, resolved, issues, incomplete: isIncomplete(issues), needsValidation: needsValidation(issues) };
}

const matches = (e: Enriched, f: SavingsFilters) => {
  const r = e.row;
  const eq = (want: string, have: string | null | undefined) => !want || (want === '(blank)' ? !have : have === want);
  if (!eq(f.ops_manager, e.resolved.ops_manager.value)) return false;
  if (!eq(f.area, r.area)) return false;
  if (!eq(f.functional_area, e.resolved.functional_area.value)) return false;
  if (!eq(f.process, r.process)) return false;
  if (!eq(f.savings_track, r.savings_track)) return false;
  if (!eq(f.savings_lever, r.savings_lever)) return false;
  if (!eq(f.savings_outcome, r.savings_outcome)) return false;
  if (!eq(f.status, e.resolved.status.value)) return false;
  if (!eq(f.owner_signoff, r.owner_signoff)) return false;
  if (!eq(f.finance_validated, r.finance_validated)) return false;
  if (f.project_charter && e.resolved.project_charter.value !== f.project_charter) return false;
  if (f.completeness === 'incomplete' && !e.incomplete) return false;
  if (f.completeness === 'complete' && e.incomplete) return false;
  if (f.completeness === 'needs_validation' && !e.needsValidation) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [e.resolved.initiative_name.value, e.resolved.ops_manager.value, r.process, r.area, e.resolved.functional_area.value, r.executive_story, r.evidence, String(r.initiative_no)]
      .join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
};

export function SavingsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SavingsBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filters survive page refreshes within the browser session (shared by dashboard, list and storyboard)
  const [filters, setFilterState] = useState<SavingsFilters>(() => {
    try { return { ...EMPTY_FILTERS, ...JSON.parse(sessionStorage.getItem('sbf.savingsFilters') || '{}') }; } catch { return EMPTY_FILTERS; }
  });
  useEffect(() => { sessionStorage.setItem('sbf.savingsFilters', JSON.stringify(filters)); }, [filters]);

  const reload = useCallback(async () => {
    try {
      setData(await api.savings.bootstrap());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) }) as SavingsSettings, [data]);
  const all = useMemo(() => {
    if (!data) return [];
    const projects = new Map(data.projects.map((p) => [p.id, p]));
    return data.initiatives.map((r) => enrich(r, projects));
  }, [data]);
  const filtered = useMemo(() => all.filter((e) => matches(e, filters)), [all, filters]);
  const toSummaryRows = (list: Enriched[]) => list.map((e) => ({ ...e.calc, savings_track: e.row.savings_track, savings_outcome: e.row.savings_outcome, initiative_name: e.resolved.initiative_name.value }));
  const summary = useMemo(() => summarize(toSummaryRows(filtered), settings), [filtered, settings]);
  const summaryAll = useMemo(() => summarize(toSummaryRows(all), settings), [all, settings]);

  const value: SavingsState = {
    loading, error, data, settings, all, filtered, summary, summaryAll, filters,
    setFilters: (f) => setFilterState((s) => ({ ...s, ...f })),
    resetFilters: () => setFilterState(EMPTY_FILTERS),
    activeFilterCount: Object.values(filters).filter(Boolean).length,
    reload,
    upsertLocal: (row) => setData((d) => d && ({ ...d, initiatives: d.initiatives.some((x) => x.id === row.id) ? d.initiatives.map((x) => (x.id === row.id ? row : x)) : [...d.initiatives, row].sort((a, b) => a.initiative_no - b.initiative_no) })),
    removeLocal: (id) => setData((d) => d && ({ ...d, initiatives: d.initiatives.filter((x) => x.id !== id) })),
    setSettings: (s) => setData((d) => d && ({ ...d, settings: s })),
    setLists: (l) => setData((d) => d && ({ ...d, lists: l })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSavings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSavings must be used inside SavingsProvider');
  return v;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────
export const money = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits });
export const moneyShort = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
};
export const fte = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }));
export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`);
export const numFmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
