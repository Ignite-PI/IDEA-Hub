import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Lock, Save } from 'lucide-react';
import { calcInitiative } from '../../shared/savingsCalc';
import { api, type ProjectSavings } from '../api';
import { useToast } from './Toast';

/**
 * SAVINGS INPUTS on a project. Reads/writes the project's ONE savings record (the same record MANAGERS see in
 * Manager Input, Savings Summary, Insights and Grid View). Calculations use the shared workbook engine (savingsCalc).
 * Blank stays blank — nothing is defaulted. Owner Sign-off / Finance Validated are shown read-only (MANAGERS only).
 */
type Key = 'baseline_volume' | 'baseline_aht' | 'productive_hours' | 'current_annual_rate' | 'future_volume' | 'future_aht' | 'future_annual_rate' | 'confidence' | 'realization';
interface FieldDef { key: Key; label: string; help: string; unit: string; pct?: boolean; step?: string }
const GROUPS: { title: string; fields: FieldDef[] }[] = [
  { title: 'Baseline assumptions', fields: [
    { key: 'baseline_volume', label: 'Baseline Annual Volume', unit: 'work items / year', help: 'Total annual transaction, case, task, or work-item volume before the improvement.' },
    { key: 'baseline_aht', label: 'Baseline AHT (min)', unit: 'minutes', step: 'any', help: 'Average handling time per work item before the improvement, entered in minutes.' },
    { key: 'productive_hours', label: 'Productive Hours per FTE', unit: 'hours / year', help: 'Approved annual productive working hours for one FTE, excluding nonproductive time as defined locally.' },
    { key: 'current_annual_rate', label: 'Current Annual Rate per FTE', unit: '$ / year', step: 'any', help: 'Current fully loaded annual cost or rate-card value for one FTE.' },
  ] },
  { title: 'Future-state assumptions', fields: [
    { key: 'future_volume', label: 'Future Annual Volume', unit: 'work items / year', help: 'Expected annual work-item volume after implementation. Use the same unit as baseline volume.' },
    { key: 'future_aht', label: 'Future AHT (min)', unit: 'minutes', step: 'any', help: 'Expected average handling time per work item after the improvement, entered in minutes.' },
    { key: 'future_annual_rate', label: 'Future Annual Rate per FTE', unit: '$ / year', step: 'any', help: 'Expected fully loaded annual rate per FTE after right-skilling, left-shifting, or rate-card changes.' },
  ] },
  { title: 'Benefit confidence', fields: [
    { key: 'confidence', label: 'Confidence %', unit: '%', pct: true, step: 'any', help: 'Probability that the estimated benefit is achievable based on evidence and validation. Enter 0%–100%.' },
    { key: 'realization', label: 'Realization %', unit: '%', pct: true, step: 'any', help: 'Share of the gross annual benefit expected to be captured in practice. Enter 0%–100%.' },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.fields);
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fte = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
// stored fractions (0–1) ↔ displayed percentages (0–100); blank stays blank
const toForm = (s: ProjectSavings | null) => Object.fromEntries(ALL.map((f) => {
  const v = s?.[f.key]; if (v === null || v === undefined) return [f.key, ''];
  return [f.key, f.pct ? String(Math.round(Number(v) * 10000) / 100) : String(v)];
})) as Record<Key, string>;

export function SavingsInputs({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [rec, setRec] = useState<ProjectSavings | null>(null);
  const [form, setForm] = useState<Record<Key, string>>(toForm(null));
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getProjectSavings(projectId).then((r) => { setRec(r.initiative); setForm(toForm(r.initiative)); })
      .catch((e) => setUnavailable((e as Error).message)).finally(() => setLoading(false));
  }, [projectId]);

  const errors = useMemo(() => {
    const e: Partial<Record<Key, string>> = {};
    for (const f of ALL) {
      const v = form[f.key].trim(); if (!v) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) e[f.key] = 'Enter a number.';
      else if (n < 0) e[f.key] = 'Cannot be negative.';
      else if (f.pct && n > 100) e[f.key] = 'Enter a value from 0% to 100%.';
    }
    return e;
  }, [form]);
  const hourlyCur = rec?.current_hourly_rate != null; const hourlyFut = rec?.future_hourly_rate != null;
  const values = useMemo(() => Object.fromEntries(ALL.map((f) => {
    const v = form[f.key].trim(); return [f.key, v === '' || !Number.isFinite(Number(v)) ? null : f.pct ? Number(v) / 100 : Number(v)];
  })) as Record<Key, number | null>, [form]);
  const calc = useMemo(() => calcInitiative({
    ...values, current_hourly_rate: rec?.current_hourly_rate ?? null, future_hourly_rate: rec?.future_hourly_rate ?? null, savings_outcome: rec?.savings_outcome ?? null,
  }), [values, rec]);
  const dirty = ALL.some((f) => form[f.key] !== toForm(rec)[f.key]);
  const missing = ALL.filter((f) => form[f.key].trim() === '' && !((f.key === 'current_annual_rate' && hourlyCur) || (f.key === 'future_annual_rate' && hourlyFut)));

  const save = async () => {
    if (Object.keys(errors).length) { toast('Fix the highlighted Savings Inputs first.', 'error'); return; }
    setBusy(true);
    try {
      const body: Partial<Record<Key, number | null>> = {};
      for (const f of ALL) if (form[f.key] !== toForm(rec)[f.key]) body[f.key] = values[f.key];
      const r = await api.saveProjectSavings(projectId, body);
      setRec(r.initiative); setForm(toForm(r.initiative));
      toast(r.initiative ? `Savings Inputs saved — shared with MANAGERS (initiative #${r.initiative.initiative_no})` : 'Nothing to save yet');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <section className="card" id="savings-inputs" style={{ marginTop: 20 }}>
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="section-icon"><Calculator size={18} /></span>
          <div>
            <h2>Savings Inputs</h2>
            <p>Operational and financial assumptions for the 30% savings calculation · shared with MANAGERS{rec ? ` (initiative #${rec.initiative_no})` : ''}</p>
          </div>
        </div>
        {!unavailable && !loading && <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !dirty}><Save size={15} /> {busy ? 'Saving…' : 'Save Savings Inputs'}</button>}
      </div>
      <div className="card-body">
        {loading ? <p className="muted small">Loading…</p> : unavailable ? <p className="muted small">{unavailable}</p> : (
          <>
            {missing.length > 0 && (
              <p className="small" style={{ color: '#7d1f3d', marginTop: 0 }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Missing Information: {missing.map((f) => f.label).join(', ')}</p>
            )}
            <div className="si-groups">
              {GROUPS.map((g) => (
                <fieldset key={g.title} className="si-group">
                  <legend>{g.title}</legend>
                  {g.fields.map((f) => {
                    const derived = (f.key === 'current_annual_rate' && hourlyCur) || (f.key === 'future_annual_rate' && hourlyFut);
                    const src = rec?.field_sources?.[f.key]?.by;
                    return (
                      <div key={f.key} className={`field${errors[f.key] ? ' invalid' : ''}${form[f.key].trim() === '' && !derived ? ' si-missing' : ''}`}>
                        <label className="label" htmlFor={`si-${f.key}`}>{f.label} {src && <span className={`src-pill src-${src}`}>{src === 'ignite' ? 'From IGNITE' : src === 'workbook' ? 'From workbook' : 'From MANAGERS'}</span>}</label>
                        {derived ? (
                          <div className="input si-derived"><Lock size={13} /> {money(f.key === 'current_annual_rate' ? (rec!.current_hourly_rate! * (values.productive_hours ?? 0)) : (rec!.future_hourly_rate! * (values.productive_hours ?? 0)))} <span className="small muted">= hourly ${f.key === 'current_annual_rate' ? rec!.current_hourly_rate : rec!.future_hourly_rate} × productive hours (set in Manager Input)</span></div>
                        ) : (
                          <div className="si-input"><input id={`si-${f.key}`} className="input" type="number" inputMode="decimal" min={0} max={f.pct ? 100 : undefined} step={f.step ?? '1'}
                            value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder="—" aria-describedby={`si-${f.key}-h`} /><span className="si-unit">{f.unit}</span></div>
                        )}
                        {errors[f.key] ? <span className="error">{errors[f.key]}</span> : <span className="hint" id={`si-${f.key}-h`}>{f.help}</span>}
                      </div>
                    );
                  })}
                </fieldset>
              ))}
              <fieldset className="si-group si-calc">
                <legend>Calculated impact <span className="small muted">(system-calculated · read-only)</span></legend>
                {([['Baseline Workload FTE', fte(calc.baseline_workload_fte)], ['Future Workload FTE', fte(calc.future_workload_fte)], ['Capacity FTE Released', fte(calc.capacity_fte_released)],
                  ['Gross Annual Savings', rec?.savings_outcome ? money(calc.gross_annual_savings) : '—'], ['Risk-Adjusted Savings', rec?.savings_outcome ? money(calc.risk_adjusted_savings) : '—']] as const).map(([l, v]) => (
                  <div key={l} className="si-calc-row"><span><Lock size={12} /> {l}</span><b>{v}</b></div>
                ))}
                {!rec?.savings_outcome && <p className="small" style={{ color: '#7d1f3d' }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> Gross and Risk-Adjusted Savings need a Savings Outcome, which MANAGERS set in Manager Input.</p>}
                <div className="si-gov small">
                  <span>Owner Sign-off: <b>{rec?.owner_signoff || 'Not set'}</b></span>
                  <span>Finance Validated: <b>{rec?.finance_validated || 'Not set'}</b></span>
                  <span className="muted">Set by MANAGERS only — entering inputs here is not a financial validation.</span>
                </div>
              </fieldset>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
