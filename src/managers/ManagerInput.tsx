import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Link2, Plus } from 'lucide-react';
import { fte, money, useSavings, type Enriched } from './SavingsContext';
import { CharterYN, ExportButton, RecordStatus, SavingsFilterBar, YesNoPill } from './ui';

type SortKey = 'no' | 'name' | 'risk' | 'fte' | 'issues';
const sorters: Record<SortKey, (a: Enriched, b: Enriched) => number> = {
  no: (a, b) => a.row.initiative_no - b.row.initiative_no,
  name: (a, b) => a.resolved.initiative_name.value.localeCompare(b.resolved.initiative_name.value),
  risk: (a, b) => a.calc.risk_adjusted_savings - b.calc.risk_adjusted_savings,
  fte: (a, b) => a.calc.capacity_fte_released - b.calc.capacity_fte_released,
  issues: (a, b) => a.issues.filter((i) => i.kind === 'missing').length - b.issues.filter((i) => i.kind === 'missing').length,
};

export function ManagerInput() {
  const { filtered, summary } = useSavings();
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'no', dir: 1 });
  const rows = useMemo(() => [...filtered].sort((a, b) => sorters[sort.key](a, b) * sort.dir), [filtered, sort]);
  const th = (key: SortKey, label: string, right = false) => (
    <th className="sortable" style={right ? { textAlign: 'right' } : undefined} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'risk' || key === 'fte' || key === 'issues' ? -1 : 1 }))}>
      {label} {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </th>
  );

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Manager Input</div>
          <h1>Initiatives</h1>
          <p>One record per initiative. Open a record to enter assumptions — calculated values update instantly.</p>
        </div>
        <div className="row wrap">
          <ExportButton className="btn btn-secondary" />
          <button className="btn btn-primary" onClick={() => navigate('/managers/input/new')}><Plus size={16} /> New initiative</button>
        </div>
      </div>
      <SavingsFilterBar />
      <section className="card">
        <div className="table-wrap">
          <table className="table mi-table">
            <thead>
              <tr>
                {th('no', '#')}
                {th('name', 'Initiative')}
                <th>Operations Manager</th>
                <th>Functional Area</th>
                <th>Track · Outcome</th>
                <th>Status</th>
                {th('fte', 'FTE Released', true)}
                {th('risk', 'Risk-Adjusted', true)}
                <th>Owner Sign-off</th>
                <th>Finance Validated</th>
                <th>Project Charter</th>
                {th('issues', 'Record')}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.row.id} onClick={() => navigate(`/managers/input/${e.row.id}`)} tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && navigate(`/managers/input/${e.row.id}`)}
                  className={e.incomplete ? 'row-incomplete' : undefined}>
                  <td><b>{e.row.initiative_no}</b></td>
                  <td style={{ minWidth: 200 }}>
                    <span className="cell-title">{e.resolved.initiative_name.value || <em className="muted">Untitled</em>}</span>
                    <span className="cell-desc">
                      {e.project ? <><Link2 size={11} style={{ verticalAlign: -1 }} /> Linked: {e.project.title}</> : <span className="muted">Not linked to an SBF project</span>}
                    </span>
                  </td>
                  <td>{e.resolved.ops_manager.value || <span className="miss-text">Missing</span>}</td>
                  <td>{e.resolved.functional_area.value || <span className="miss-text">Missing</span>}</td>
                  <td><span className="small">{e.row.savings_track || <span className="miss-text">No track</span>}</span><br /><span className="small muted">{e.row.savings_outcome || <span className="miss-text">No outcome</span>}</span></td>
                  <td>{e.resolved.status.value || <span className="miss-text">Missing</span>}</td>
                  <td style={{ textAlign: 'right' }}>{fte(e.calc.capacity_fte_released)}</td>
                  <td style={{ textAlign: 'right' }}><b>{money(e.calc.risk_adjusted_savings)}</b></td>
                  <td><YesNoPill value={e.row.owner_signoff} label="Owner Sign-off" /></td>
                  <td><YesNoPill value={e.row.finance_validated} label="Finance Validated" /></td>
                  <td><CharterYN value={e.resolved.project_charter.value} source={e.resolved.project_charter.source} /></td>
                  <td><RecordStatus incomplete={e.incomplete} needsValidation={e.needsValidation} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={12} className="muted" style={{ padding: 24, textAlign: 'center' }}>No initiatives match these filters.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={6}><b>Total ({summary.initiatives_entered} initiatives)</b></td>
                  <td style={{ textAlign: 'right' }}><b>{fte(summary.capacity_fte_released)}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{money(summary.risk_adjusted_value)}</b></td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}

