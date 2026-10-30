import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Pencil, Save, ShieldAlert, Target, TrendingUp, Users, Zap } from 'lucide-react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { fte, money, moneyShort, pct, useSavings, type SavingsFilters } from './SavingsContext';
import { RecordStatus, SavingsFilterBar } from './ui';

const TRACK_COLORS: Record<string, string> = { Process: '#5009B5', People: '#00B8BA', Technology: '#44B8F3' };
const OUTCOME_COLORS: Record<string, string> = { 'Billable Headcount Reduction': '#5009B5', 'Additional Work / Capacity': '#00B8BA', 'Rate Card Reduction': '#794CFF' };

export function SavingsDashboard() {
  const { summary, summaryAll, filtered, all, settings, setFilters, activeFilterCount } = useSavings();
  const navigate = useNavigate();
  const drill = (f: Partial<SavingsFilters>) => { setFilters(f); navigate('/managers/input'); };
  const s = summary;
  const attainment = s.target_achievement;
  const surplus = s.remaining_gap >= 0;
  const attention = filtered.filter((e) => e.incomplete || e.needsValidation).sort((a, b) => b.calc.risk_adjusted_savings - a.calc.risk_adjusted_savings);
  const financeYes = filtered.filter((e) => e.row.finance_validated === 'Yes');
  const committed = financeYes.reduce((t, e) => t + e.calc.risk_adjusted_savings, 0);

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">30% Clinical Savings</div>
          <h1>Savings Summary</h1>
          <p>Live portfolio view calculated from every Manager Input record{activeFilterCount ? ' — filtered' : ''}.</p>
        </div>
      </div>

      <SavingsFilterBar compact />
      {activeFilterCount > 0 && (
        <div className="filter-note" role="status">
          Filters applied: figures below reflect {filtered.length} of {all.length} initiatives. Portfolio total (unfiltered): {money(summaryAll.risk_adjusted_value)} risk-adjusted.
        </div>
      )}

      {/* Where are we now / how close to target */}
      <section className="card target-card">
        <div className="target-head">
          <div>
            <span className="k">Risk-Adjusted Savings vs 30% Target</span>
            <div className="target-big">{money(s.risk_adjusted_value)} <span>of {money(s.target)}</span></div>
          </div>
          <div className={`target-status ${s.status === 'TARGET MET' ? 'met' : 'below'}`}>
            {s.status === 'TARGET MET' ? <Target size={18} /> : <AlertTriangle size={18} />} {s.status}
          </div>
        </div>
        <div className="target-bar" role="img" aria-label={`Target attainment ${pct(attainment, 1)}`}>
          <i style={{ width: `${Math.min(attainment, 1) * 100}%` }} />
          <span className="target-mark" style={{ left: '100%' }} />
        </div>
        <div className="target-foot">
          <span><b>{pct(attainment, 1)}</b> Target Attainment</span>
          <span className={surplus ? 'ok' : 'gap'}><b>{money(Math.abs(s.remaining_gap))}</b> {surplus ? 'surplus' : 'remaining gap'}</span>
          <span><b>{money(s.gross_annual_value)}</b> gross annual value (before confidence / realization)</span>
          <span title="Finance Validated = Yes"><b>{money(committed)}</b> Finance-validated ({financeYes.length} initiatives)</span>
        </div>
      </section>

      <div className="kpi-grid">
        <Kpi icon={TrendingUp} label="Risk-Adjusted Savings" value={moneyShort(s.risk_adjusted_value)} sub={money(s.risk_adjusted_value)} />
        <Kpi icon={Zap} label="Capacity FTE Released" value={fte(s.capacity_fte_released)} sub={`Target ${fte(settings.target_fte)} billable FTE`} />
        <Kpi icon={Users} label="HC Reduction FTE" value={fte(s.hc_reduction_fte)} sub="Billable Headcount Reduction" onClick={() => drill({ savings_outcome: 'Billable Headcount Reduction' })} />
        <Kpi icon={Users} label="Additional Capacity FTE" value={fte(s.extra_capacity_fte)} sub="Economic capacity value — not cash" onClick={() => drill({ savings_outcome: 'Additional Work / Capacity' })} />
        <Kpi icon={Target} label="Target Attainment" value={pct(s.target_achievement, 1)} sub={`Target ${moneyShort(s.target)}`} />
        <Kpi icon={TrendingUp} label={surplus ? 'Surplus' : 'Remaining Gap'} value={moneyShort(Math.abs(s.remaining_gap))} sub={money(s.remaining_gap)} tone={surplus ? 'ok' : 'gap'} />
        <Kpi icon={ClipboardIcon} label="Initiatives" value={String(s.initiatives_entered)} sub={`${filtered.filter((e) => e.incomplete).length} need information`} onClick={() => navigate('/managers/input')} />
      </div>

      <div className="grid split">
        <ChartCard title="Risk-Adjusted Savings by Track" subtitle="Which savings tracks contribute the most — click a bar to see its initiatives"
          data={s.tracks.map((t) => ({ name: t.label, value: t.risk_adjusted_savings, fte: t.fte_released, n: t.initiatives, color: TRACK_COLORS[t.label] }))}
          onPick={(name) => drill({ savings_track: name })} fteLabel="FTE released" />
        <ChartCard title="Risk-Adjusted Savings by Outcome" subtitle="Cash (headcount / rate card) vs capacity value"
          data={s.outcomes.map((o) => ({ name: o.label, value: o.risk_adjusted_savings, fte: o.fte, n: o.initiatives, color: OUTCOME_COLORS[o.label] }))}
          onPick={(name) => drill({ savings_outcome: name })} fteLabel="FTE / capacity" />
      </div>

      <div className="grid split">
        <section className="card">
          <div className="card-head"><div><h3>Portfolio by Savings Track</h3><p>Reconciles to the totals above</p></div></div>
          <SummaryTable rows={s.tracks.map((t) => [t.label, t.risk_adjusted_savings, t.fte_released, t.initiatives])} total={[s.tracks_total.risk_adjusted_savings, s.tracks_total.fte_released, s.tracks_total.initiatives]}
            head={['Savings Track', 'Risk-Adjusted Savings', 'FTE Released', 'Initiatives']} onPick={(v) => drill({ savings_track: v })} />
          <div className="card-head" style={{ borderTop: '1px solid var(--border)' }}><div><h3>Portfolio by Savings Outcome</h3><p>FTE column: HC Reduction FTE / Extra Capacity FTE / Capacity FTE Released (as in the workbook)</p></div></div>
          <SummaryTable rows={s.outcomes.map((o) => [o.label, o.risk_adjusted_savings, o.fte, o.initiatives])} total={[s.outcomes_total.risk_adjusted_savings, s.outcomes_total.fte, s.outcomes_total.initiatives]}
            head={['Savings Outcome', 'Risk-Adjusted Savings', 'FTE / Capacity', 'Initiatives']} onPick={(v) => drill({ savings_outcome: v })} />
        </section>

        <section className="card">
          <div className="card-head">
            <div><h3>Needs information or validation</h3><p>{attention.length} of {filtered.length} initiatives, largest value first</p></div>
            <button className="btn btn-soft btn-sm" onClick={() => drill({ completeness: 'incomplete' })}><AlertTriangle size={14} /> Incomplete filter</button>
          </div>
          <div className="attention-list">
            {attention.slice(0, 8).map((e) => (
              <button key={e.row.id} className="attention-row" onClick={() => navigate(`/managers/input/${e.row.id}`)}>
                <span className="an">#{e.row.initiative_no}</span>
                <span className="at">
                  <b>{e.resolved.initiative_name.value || 'Untitled initiative'}</b>
                  <small>{e.issues.filter((i) => i.kind !== 'notice').slice(0, 3).map((i) => i.label).join(' · ')}{e.issues.filter((i) => i.kind !== 'notice').length > 3 ? ' …' : ''}</small>
                </span>
                <RecordStatus incomplete={e.incomplete} needsValidation={e.needsValidation} />
                <span className="av">{moneyShort(e.calc.risk_adjusted_savings)}</span>
              </button>
            ))}
            {attention.length === 0 && <p className="muted small" style={{ padding: 16 }}>Every initiative in view is complete and validated.</p>}
            {attention.length > 8 && <button className="btn btn-ghost btn-sm" style={{ margin: 12 }} onClick={() => drill({ completeness: 'incomplete' })}>View all <ArrowRight size={14} /></button>}
          </div>
          <div className="card-head" style={{ borderTop: '1px solid var(--border)' }}><div><h3><ShieldAlert size={15} style={{ verticalAlign: -2 }} /> Validation status</h3><p>Finance validation should be Yes before a benefit is presented as committed</p></div></div>
          <div className="validation-grid">
            <ValidationStat label="Finance Validated = Yes" n={financeYes.length} total={filtered.length} onClick={() => drill({ finance_validated: 'Yes' })} />
            <ValidationStat label="Finance not validated" n={filtered.filter((e) => e.row.finance_validated !== 'Yes').length} total={filtered.length} warn onClick={() => drill({ finance_validated: 'No' })} />
            <ValidationStat label="Owner Sign-off = Yes" n={filtered.filter((e) => e.row.owner_signoff === 'Yes').length} total={filtered.length} onClick={() => drill({ owner_signoff: 'Yes' })} />
            <ValidationStat label="Project Charter = Y" n={filtered.filter((e) => e.resolved.project_charter.value === 'Y').length} total={filtered.length} onClick={() => drill({ project_charter: 'Y' })} />
          </div>
        </section>
      </div>

      <Benchmarks />
    </div>
  );
}

function ClipboardIcon(p: { size?: number | string }) { return <Pencil {...p} />; }

function Kpi({ icon: Icon, label, value, sub, onClick, tone }: { icon: ComponentType<{ size?: number | string }>; label: string; value: string; sub: string; onClick?: () => void; tone?: 'ok' | 'gap' }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi-card${tone ? ` ${tone}` : ''}${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <span className="kpi-icon"><Icon size={17} /></span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </Tag>
  );
}

function ChartCard({ title, subtitle, data, onPick, fteLabel }: { title: string; subtitle: string; data: { name: string; value: number; fte: number; n: number; color: string }[]; onPick: (name: string) => void; fteLabel: string }) {
  return (
    <section className="card">
      <div className="card-head"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
      <div className="card-body" style={{ height: 270 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 90, left: 10, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12, fill: '#4a4460' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f5f2ff' }} formatter={(v: number) => money(v)} labelFormatter={(l: string) => {
              const d = data.find((x) => x.name === l);
              return d ? `${l} · ${d.n} initiatives · ${fte(d.fte)} ${fteLabel}` : l;
            }} contentStyle={{ borderRadius: 12, border: '1px solid #e9e6f0' }} />
            <Bar dataKey="value" name="Risk-Adjusted Savings" radius={[0, 8, 8, 0]} isAnimationActive={false} style={{ cursor: 'pointer' }}
              onClick={(d: { name?: string }) => d.name && onPick(d.name)}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              <LabelList dataKey="value" position="right" formatter={(v: number) => moneyShort(v)} style={{ fontSize: 12, fontWeight: 700, fill: '#231e33' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SummaryTable({ head, rows, total, onPick }: { head: string[]; rows: [string, number, number, number][]; total: [number, number, number]; onPick: (v: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{head.map((h, i) => <th key={h} style={i ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(([l, a, f, n]) => (
            <tr key={l} onClick={() => onPick(l)}>
              <td><b>{l}</b></td><td style={{ textAlign: 'right' }}>{money(a)}</td><td style={{ textAlign: 'right' }}>{fte(f)}</td><td style={{ textAlign: 'right' }}>{n}</td>
            </tr>
          ))}
          <tr className="total-row" style={{ cursor: 'default' }}>
            <td><b>Total</b></td><td style={{ textAlign: 'right' }}><b>{money(total[0])}</b></td><td style={{ textAlign: 'right' }}><b>{fte(total[1])}</b></td><td style={{ textAlign: 'right' }}><b>{total[2]}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ValidationStat({ label, n, total, warn, onClick }: { label: string; n: number; total: number; warn?: boolean; onClick: () => void }) {
  return (
    <button className={`vstat${warn && n ? ' warn' : ''}`} onClick={onClick}>
      <b>{n}</b><span>{label}</span><small>{total ? pct(n / total) : '—'} of initiatives</small>
    </button>
  );
}

/** Source-deck benchmark values ("Savings Summary" B4:B8) — editable, stored in the database. */
function Benchmarks() {
  const { settings, setSettings } = useSavings();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fields: [keyof typeof settings, string, 'money' | 'num'][] = [
    ['projected_exit_hc', 'Projected 2027 Exit - Billable HC', 'num'],
    ['projected_exit_revenue', 'Projected 2027 Exit - Revenue', 'money'],
    ['target_fte', '30% Target - Billable FTE', 'num'],
    ['target_revenue', '30% Target - Revenue Equivalent', 'money'],
    ['potential_pool_revenue', 'Potential Savings Pool', 'money'],
    ['potential_pool_fte', 'Potential Savings Pool - FTE', 'num'],
  ];
  const start = () => { setDraft(Object.fromEntries(fields.map(([k]) => [k, String(settings[k])]))); setEditing(true); };
  const save = async () => {
    const patch: Record<string, number> = {};
    for (const [k] of fields) { const n = Number(draft[k]); if (!Number.isFinite(n) || n < 0) { toast(`Enter a valid number for ${k}`, 'error'); return; } patch[k] = n; }
    try { setSettings(await api.savings.updateSettings(patch)); setEditing(false); toast('Benchmarks saved'); } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <section className="card">
      <div className="card-head">
        <div><h3>Source Deck Benchmark</h3><p>Constants from the workbook's Savings Summary. The 30% revenue target drives Target Achievement and Remaining Gap.</p></div>
        {editing
          ? <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Save size={14} /> Save benchmarks</button></div>
          : <button className="btn btn-soft btn-sm" onClick={start}><Pencil size={14} /> Edit benchmarks</button>}
      </div>
      <div className="bench-grid">
        {fields.map(([k, label, kind]) => (
          <div key={k} className="bench">
            <span>{label}</span>
            {editing
              ? <input className="input" type="number" step="any" value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} aria-label={label} />
              : <b>{kind === 'money' ? money(settings[k] as number, settings[k] % 1 ? 2 : 0) : (settings[k] as number).toLocaleString('en-US')}</b>}
          </div>
        ))}
      </div>
    </section>
  );
}
