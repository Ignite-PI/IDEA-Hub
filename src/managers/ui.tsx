/** Small shared UI pieces for the Senior Manager module. */
import { AlertTriangle, Calculator, Database, FileText, Link2, PenLine, ShieldAlert, X } from 'lucide-react';
import { api } from '../api';
import type { ValueSource } from '../../shared/savingsResolve';
import { EMPTY_FILTERS, useSavings, type SavingsFilters } from './SavingsContext';

export type FieldKind = 'enter' | 'calc' | ValueSource;

const TAGS: Record<FieldKind, { label: string; cls: string; icon: typeof PenLine }> = {
  enter: { label: 'Enter', cls: 'tag-enter', icon: PenLine },
  manual: { label: 'Entered manually', cls: 'tag-manual', icon: PenLine },
  calc: { label: 'Calculated', cls: 'tag-calc', icon: Calculator },
  project: { label: 'From project', cls: 'tag-project', icon: Link2 },
  charter: { label: 'From Project Charter', cls: 'tag-project', icon: FileText },
  missing: { label: 'Needs information', cls: 'tag-missing', icon: AlertTriangle },
};

/** Labels where a value comes from: entered, calculated, project, charter, or missing. */
export function SourceTag({ kind, label }: { kind: FieldKind; label?: string }) {
  const t = TAGS[kind];
  return <span className={`src-tag ${t.cls}`}><t.icon size={11} aria-hidden /> {label ?? t.label}</span>;
}

/** Record-level status pill (never color-only: icon + text). */
export function RecordStatus({ incomplete, needsValidation }: { incomplete: boolean; needsValidation: boolean }) {
  if (incomplete) return <span className="rec-pill rec-missing"><AlertTriangle size={12} aria-hidden /> Needs information</span>;
  if (needsValidation) return <span className="rec-pill rec-validate"><ShieldAlert size={12} aria-hidden /> Needs validation</span>;
  return <span className="rec-pill rec-ok"><Database size={12} aria-hidden /> Complete</span>;
}

export function YesNoPill({ value, label }: { value: string | null; label: string }) {
  if (!value) return <span className="rec-pill rec-missing" title={`${label} not recorded`}><AlertTriangle size={12} aria-hidden /> Not recorded</span>;
  return value === 'Yes'
    ? <span className="rec-pill rec-ok">Yes</span>
    : <span className="rec-pill rec-validate" title={`${label}: No`}><ShieldAlert size={12} aria-hidden /> No</span>;
}

export function CharterYN({ value, source }: { value: string; source: ValueSource }) {
  if (value === 'Y') return <span className="rec-pill rec-ok" title={source === 'project' ? 'Linked project has a Project Charter' : 'Recorded manually (not linked)'}>Y{source === 'manual' ? ' · manual' : ''}</span>;
  if (value === 'N') return <span className="rec-pill rec-missing"><AlertTriangle size={12} aria-hidden /> N{source === 'manual' ? ' · manual' : ''}</span>;
  return <span className="rec-pill rec-unknown"><AlertTriangle size={12} aria-hidden /> Missing Information</span>;
}

const distinct = (vals: (string | null | undefined)[]) => [...new Set(vals.filter((v): v is string => !!v && v.trim() !== ''))].sort((a, b) => a.localeCompare(b));

/** Filter bar shared by the dashboard and the Manager Input list (filters persist while moving between pages). */
export function SavingsFilterBar({ compact = false }: { compact?: boolean }) {
  const { all, data, filters, setFilters, resetFilters, activeFilterCount, filtered } = useSavings();
  const lists = data?.lists ?? {};
  const opt = (key: keyof SavingsFilters, label: string, values: string[]) => (
    <label className="sf-field" key={key}>
      <span>{label}</span>
      <select className="select" value={filters[key] as string} onChange={(e) => setFilters({ [key]: e.target.value } as Partial<SavingsFilters>)}>
        <option value="">All</option>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
  const fromData = (fn: (e: (typeof all)[number]) => string | null | undefined) => distinct(all.map(fn));
  return (
    <div className={`savings-filters${compact ? ' compact' : ''}`}>
      <div className="sf-top">
        <input className="input" placeholder="Search initiatives, managers, process, story…" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} aria-label="Search initiatives" />
        <div className="sf-quick" role="group" aria-label="Completeness">
          {([['', 'All records'], ['incomplete', 'Incomplete / Missing Information'], ['needs_validation', 'Needs validation'], ['complete', 'Complete']] as const).map(([v, l]) => (
            <button key={v} type="button" className={`chip-btn${filters.completeness === v ? ' on' : ''}${v === 'incomplete' ? ' warn' : ''}`} onClick={() => setFilters({ completeness: v })}>
              {v === 'incomplete' && <AlertTriangle size={13} aria-hidden />} {l}
              {v === 'incomplete' && <b>{all.filter((e) => e.incomplete).length}</b>}
              {v === 'needs_validation' && <b>{all.filter((e) => e.needsValidation).length}</b>}
            </button>
          ))}
        </div>
      </div>
      <div className="sf-grid">
        {opt('ops_manager', 'Operations Manager', fromData((e) => e.resolved.ops_manager.value))}
        {opt('area', 'Area', distinct([...(lists.area ?? []), ...all.map((e) => e.row.area)]))}
        {opt('functional_area', 'Functional Area', distinct([...(lists.functional_area ?? []), ...all.map((e) => e.resolved.functional_area.value)]))}
        {opt('process', 'Process', fromData((e) => e.row.process))}
        {opt('savings_track', 'Savings Track', lists.savings_track ?? [])}
        {opt('savings_lever', 'Savings Lever', lists.savings_lever ?? [])}
        {opt('savings_outcome', 'Savings Outcome', lists.savings_outcome ?? [])}
        {opt('status', 'Status', lists.status ?? [])}
        {opt('owner_signoff', 'Owner Sign-off', [...(lists.yes_no ?? ['Yes', 'No']), '(blank)'])}
        {opt('finance_validated', 'Finance Validated', [...(lists.yes_no ?? ['Yes', 'No']), '(blank)'])}
        {opt('project_charter', 'Project Charter (Y/N)', ['Y', 'N', 'Missing Information'])}
      </div>
      <div className="sf-foot">
        <span className="small muted">Showing <b>{filtered.length}</b> of {all.length} initiatives</span>
        {activeFilterCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><X size={14} /> Clear filters ({activeFilterCount})</button>}
      </div>
    </div>
  );
}

export const filtersEqualEmpty = (f: SavingsFilters) => JSON.stringify(f) === JSON.stringify(EMPTY_FILTERS);

/** Downloads the full Excel workbook (all saved records, independent of filters). */
export function ExportButton({ className = 'btn btn-accent' }: { className?: string }) {
  return (
    <a className={className} href={api.savings.exportUrl()} download>
      <FileText size={16} /> EXPORT TO EXCEL
    </a>
  );
}
