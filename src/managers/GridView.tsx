import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ExternalLink, Lock } from 'lucide-react';
import { api, type SavingsInitiative } from '../api';
import { useToast } from '../components/Toast';
import { COLUMNS, type ColumnDef } from '../../shared/savingsContent';
import { fte, money, numFmt, pct, useSavings, type Enriched } from './SavingsContext';
import { ExportButton, RecordStatus, SavingsFilterBar } from './ui';
import { ViewToggle } from './ViewToggle';

/**
 * Grid / Excel-style view of the SAME Manager Input records (no copy of the data).
 * Input cells are editable in place and save to the database; calculated, system and project-linked cells are read-only.
 */
type GridCol = ColumnDef & { width: number };
const HOURLY: GridCol[] = [
  { col: 'P*', header: 'Current Hourly Rate', key: 'current_hourly_rate', kind: 'input', type: 'currency', help: 'Hourly rate for this initiative; annual rate = hourly × productive hours.', width: 120 },
  { col: 'Q*', header: 'Future Hourly Rate', key: 'future_hourly_rate', kind: 'input', type: 'currency', help: 'Future hourly rate for this initiative.', width: 120 },
];
const WIDE: Record<string, number> = { initiative_name: 220, executive_story: 320, evidence: 260, ops_manager: 170, functional_area: 190, savings_lever: 180, savings_outcome: 190, process: 140 };
const GRID_COLS: GridCol[] = COLUMNS.flatMap((c) => {
  const g = { ...c, width: WIDE[c.key] ?? (c.kind === 'raci' ? 170 : c.type === 'date' ? 130 : 120) };
  return c.key === 'current_annual_rate' ? [...HOURLY, g] : [g];
});
// issue.field → grid column key (for missing-data highlighting)
const ISSUE_TO_COL: Record<string, string> = { current_hourly_rate: 'current_annual_rate', future_hourly_rate: 'future_annual_rate', project_charter: 'project_charter' };
const LINKED = new Set(['initiative_name', 'ops_manager', 'functional_area', 'status']);

export function GridView() {
  const { filtered, data, upsertLocal, summary } = useSavings();
  const toast = useToast();
  const navigate = useNavigate();
  const lists = data?.lists ?? {};
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'initiative_no', dir: 1 });
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const display = (e: Enriched, c: GridCol): string => {
    const r = e.row as unknown as Record<string, unknown>;
    if (c.kind === 'calc') return c.type === 'currency' ? money(e.calc[c.key as keyof typeof e.calc] as number) : fte(e.calc[c.key as keyof typeof e.calc] as number);
    if (c.key === 'current_annual_rate') return money(e.calc.current_annual_rate_effective, 2);
    if (c.key === 'future_annual_rate') return money(e.calc.future_annual_rate_effective, 2);
    if (c.key === 'project_charter') return e.resolved.project_charter.value;
    if (c.kind === 'raci') return e.resolved.raci[c.letter as 'R' | 'A' | 'C' | 'I'].value;
    if (LINKED.has(c.key)) return e.resolved[c.key as 'initiative_name' | 'ops_manager' | 'functional_area' | 'status'].value;
    const v = r[c.key];
    if (v === null || v === undefined || v === '') return '';
    if (c.type === 'percent') return pct(v as number);
    if (c.type === 'currency') return money(v as number, 2);
    if (c.type === 'number') return numFmt(v as number);
    return String(v);
  };
  const sortValue = (e: Enriched, key: string): string | number => {
    const c = GRID_COLS.find((x) => x.key === key)!;
    const r = e.row as unknown as Record<string, unknown>;
    if (c.kind === 'calc') return e.calc[key as keyof typeof e.calc] as number;
    if (key === 'current_annual_rate') return e.calc.current_annual_rate_effective ?? -1;
    if (key === 'future_annual_rate') return e.calc.future_annual_rate_effective ?? -1;
    if (['number', 'currency', 'percent'].includes(c.type ?? '') || key === 'initiative_no') return (r[key] as number | null) ?? -1;
    return display(e, c).toLowerCase();
  };
  const rows = useMemo(() => [...filtered].sort((a, b) => {
    const x = sortValue(a, sort.key); const y = sortValue(b, sort.key);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, sort]);

  /** Why a cell cannot be edited (undefined = editable). */
  const lockReason = (e: Enriched, c: GridCol): string | undefined => {
    if (c.kind === 'calc') return 'Calculated by the workbook formula';
    if (c.kind === 'system') return c.key === 'initiative_no' ? 'Assigned automatically' : 'Set automatically when the record is saved';
    if (LINKED.has(c.key) && e.resolved[c.key as 'initiative_name'].source === 'project') return 'From the linked SBF project';
    if (c.key === 'current_annual_rate' && e.row.current_hourly_rate !== null) return 'Hourly rate × productive hours';
    if (c.key === 'future_annual_rate' && e.row.future_hourly_rate !== null) return 'Hourly rate × productive hours';
    if (c.key === 'project_charter' && e.project) return 'From the linked project';
    if (c.kind === 'raci' && e.resolved.raci[c.letter as 'R'].source === 'charter') return 'From the linked Project Charter';
    return undefined;
  };
  const fieldKey = (c: GridCol) => (c.key === 'project_charter' ? 'project_charter_manual' : c.key);
  const rawValue = (e: Enriched, c: GridCol) => {
    const v = (e.row as unknown as Record<string, unknown>)[fieldKey(c)];
    if (v === null || v === undefined) return '';
    if (c.type === 'percent') return String(+((v as number) * 100).toFixed(6));
    return String(v);
  };

  const start = (e: Enriched, c: GridCol) => {
    if (lockReason(e, c)) return;
    setEditing({ id: e.row.id, key: c.key });
    setDraft(rawValue(e, c));
  };
  const commit = async (e: Enriched, c: GridCol, value = draft) => {
    setEditing(null);
    if (value === rawValue(e, c)) return;
    let v: unknown = value;
    if (['number', 'currency', 'percent'].includes(c.type ?? '')) {
      if (value.trim() === '') v = null;
      else {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) { toast(`${c.header} must be a positive number.`, 'error'); return; }
        if (c.type === 'percent' && n > 100) { toast(`${c.header} must be between 0 and 100.`, 'error'); return; }
        v = c.type === 'percent' ? n / 100 : n;
      }
    } else if (['owner_signoff', 'finance_validated', 'project_charter', 'target_start', 'expected_completion'].includes(c.key)) v = value || null;
    setSaving(`${e.row.id}:${c.key}`);
    try {
      const row = await api.savings.update(e.row.id, { [fieldKey(c)]: v } as Partial<SavingsInitiative>);
      upsertLocal(row); // same record → Manager Input, dashboard and storyboard update immediately
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(null);
    }
  };
  const onKey = (ev: KeyboardEvent, e: Enriched, c: GridCol) => {
    if (ev.key === 'Enter' && !(c.type === 'text' && ev.shiftKey)) { ev.preventDefault(); void commit(e, c); }
    if (ev.key === 'Escape') setEditing(null);
  };

  const editor = (e: Enriched, c: GridCol) => {
    const listKey = c.key === 'project_charter' ? '__yn' : c.list;
    if (listKey) {
      const values = listKey === '__yn' ? ['Y', 'N'] : lists[listKey] ?? [];
      return (
        <select autoFocus className="grid-input" value={draft} onChange={(ev) => { setDraft(ev.target.value); void commit(e, c, ev.target.value); }} onBlur={() => setEditing(null)} onKeyDown={(ev) => onKey(ev, e, c)} aria-label={c.header}>
          <option value="">{c.key === 'project_charter' ? 'Missing Information' : '— blank —'}</option>
          {values.map((v) => <option key={v} value={v}>{v}</option>)}
          {draft && !values.includes(draft) && <option value={draft}>{draft}</option>}
        </select>
      );
    }
    if (c.type === 'text') {
      return <textarea autoFocus className="grid-input area" value={draft} onChange={(ev) => setDraft(ev.target.value)} onBlur={() => void commit(e, c)} onKeyDown={(ev) => onKey(ev, e, c)} aria-label={c.header} />;
    }
    return (
      <input autoFocus className="grid-input" aria-label={c.header}
        type={c.type === 'date' ? 'date' : ['number', 'currency', 'percent'].includes(c.type ?? '') ? 'number' : 'text'} min={0} step="any"
        placeholder={c.kind === 'raci' ? 'Names separated by ;' : undefined}
        value={draft} onChange={(ev) => setDraft(ev.target.value)} onBlur={() => void commit(e, c)} onKeyDown={(ev) => onKey(ev, e, c)} />
    );
  };

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Manager Input</div>
          <h1>Grid View</h1>
          <p>Spreadsheet view of the same initiative records. Click an input cell to edit — changes save immediately. Calculated cells are locked.</p>
        </div>
        <div className="row wrap">
          <ViewToggle current="grid" />
          <ExportButton className="btn btn-secondary" />
        </div>
      </div>
      <SavingsFilterBar />
      <div className="grid-legend small">
        <span><i className="lg-edit" /> Editable input</span>
        <span><i className="lg-calc" /> <Lock size={11} /> Calculated / automatic (locked)</span>
        <span><i className="lg-linked" /> From linked project / charter</span>
        <span><i className="lg-miss" /> Needs information</span>
        <span><i className="lg-val" /> Needs validation</span>
      </div>
      <section className="card grid-card">
        <div className="grid-scroll" role="region" aria-label="Manager Input grid" tabIndex={0}>
          <table className="xgrid">
            <thead>
              <tr>
                <th className="sticky-col c0" style={{ minWidth: 130 }}>Record</th>
                {GRID_COLS.map((c, i) => (
                  <th key={c.key} title={c.help} style={{ minWidth: c.width }} className={`${c.kind === 'calc' ? 'calc' : ''}${i === 0 && c.key === 'initiative_no' ? ' sticky-col c1' : ''}`}
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                    <span className="th-col">{c.col}</span> {c.header} {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const issueCols = new Map<string, 'missing' | 'validation'>();
                for (const i of e.issues) if (i.kind !== 'notice') issueCols.set(ISSUE_TO_COL[i.field] ?? i.field, i.kind as 'missing' | 'validation');
                return (
                  <tr key={e.row.id}>
                    <td className="sticky-col c0">
                      <button type="button" className="grid-open" title="Open record" onClick={() => navigate(`/managers/input/${e.row.id}`)}><ExternalLink size={12} /></button>
                      <RecordStatus incomplete={e.incomplete} needsValidation={e.needsValidation} />
                    </td>
                    {GRID_COLS.map((c) => {
                      const lock = lockReason(e, c);
                      const isEditing = editing?.id === e.row.id && editing.key === c.key;
                      const issue = issueCols.get(c.key === 'project_charter' ? 'project_charter' : c.key);
                      const linked = lock && /linked/i.test(lock);
                      const cls = [
                        lock ? (linked ? 'linked' : 'locked') : 'editable',
                        issue === 'missing' ? 'miss' : issue === 'validation' ? 'val' : '',
                        c.key === 'initiative_no' ? 'sticky-col c1' : '',
                        ['number', 'currency', 'percent', 'fte'].includes(c.type ?? '') || c.kind === 'calc' ? 'num' : '',
                        c.type === 'text' ? 'long' : '',
                        saving === `${e.row.id}:${c.key}` ? 'saving' : '',
                      ].filter(Boolean).join(' ');
                      const text = c.key === 'initiative_no' ? String(e.row.initiative_no) : display(e, c);
                      return (
                        <td key={c.key} className={cls} title={lock ? `${c.header}: ${lock}` : issue === 'missing' ? `${c.header}: needs information` : `${c.header} — click to edit`}
                          onClick={() => !isEditing && start(e, c)} onKeyDown={(ev) => { if (ev.key === 'Enter' && !isEditing) start(e, c); }} tabIndex={lock ? -1 : 0}>
                          {isEditing ? editor(e, c) : (
                            <span className="cell-v">
                              {text || (issue === 'missing' ? <em className="miss-text">Needs info</em> : '')}
                              {lock && c.kind === 'calc' && <Lock size={10} className="lock-i" aria-hidden />}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={GRID_COLS.length + 1} className="muted" style={{ padding: 20 }}>No initiatives match these filters.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td className="sticky-col c0"><b>Total</b></td>
                  {GRID_COLS.map((c) => {
                    const sums: Record<string, string> = {
                      initiative_name: `${summary.initiatives_entered} initiatives`,
                      capacity_fte_released: fte(summary.capacity_fte_released), hc_reduction_fte: fte(summary.hc_reduction_fte),
                      extra_capacity_fte: fte(summary.extra_capacity_fte), gross_annual_savings: money(summary.gross_annual_value),
                      risk_adjusted_savings: money(summary.risk_adjusted_value),
                    };
                    return <td key={c.key} className={`${c.key === 'initiative_no' ? 'sticky-col c1' : ''} num`}><b>{sums[c.key] ?? ''}</b></td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
