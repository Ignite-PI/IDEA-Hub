import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ExternalLink, Info, Link2, Plus, Save, Trash2, Unlink } from 'lucide-react';
import { api, type SavingsInitiative } from '../api';
import { useToast } from '../components/Toast';
import { calcInitiative } from '../../shared/savingsCalc';
import { COLUMNS } from '../../shared/savingsContent';
import { initiativeIssues, resolveInitiative } from '../../shared/savingsResolve';
import { fte, money, pct, useSavings } from './SavingsContext';
import { CharterYN, RecordStatus, SourceTag, type FieldKind } from './ui';

type Draft = Record<string, string>;
const NUM = ['baseline_volume', 'baseline_aht', 'future_volume', 'future_aht', 'productive_hours', 'current_hourly_rate', 'future_hourly_rate', 'current_annual_rate', 'future_annual_rate'];
const PCT = ['confidence', 'realization'];
const TEXT = ['ops_manager', 'area', 'functional_area', 'process', 'initiative_name', 'savings_track', 'savings_lever', 'savings_outcome', 'status',
  'target_start', 'expected_completion', 'executive_story', 'evidence', 'owner_signoff', 'finance_validated', 'project_charter_manual',
  'timeline_text', 'fte_text', 'raci_r', 'raci_a', 'raci_c', 'raci_i', 'project_id'];
const help = (key: string) => COLUMNS.find((c) => c.key === key)?.help ?? '';

const toDraft = (r: Partial<SavingsInitiative>): Draft => {
  const d: Draft = {};
  for (const k of TEXT) d[k] = String((r as Record<string, unknown>)[k] ?? '');
  for (const k of NUM) { const v = (r as Record<string, unknown>)[k]; d[k] = v === null || v === undefined ? '' : String(v); }
  for (const k of PCT) { const v = (r as Record<string, unknown>)[k] as number | null | undefined; d[k] = v === null || v === undefined ? '' : String(+(v * 100).toFixed(6)); }
  return d;
};
/** Draft → API payload (numbers or null, percentages as fractions, blanks as null for enums/dates). */
const toPayload = (d: Draft) => {
  const o: Record<string, unknown> = {};
  for (const k of TEXT) o[k] = d[k] ?? '';
  for (const k of ['owner_signoff', 'finance_validated', 'project_charter_manual', 'target_start', 'expected_completion']) o[k] = d[k] ? d[k] : null;
  o.project_id = d.project_id || null;
  for (const k of NUM) o[k] = d[k] === '' ? null : Number(d[k]);
  for (const k of PCT) o[k] = d[k] === '' ? null : Number(d[k]) / 100;
  return o;
};

export function InitiativeEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { all, data, upsertLocal, removeLocal, setLists } = useSavings();
  const existing = all.find((e) => e.row.id === id) ?? null;
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing?.row ?? {}));
  const [saved, setSaved] = useState(() => JSON.stringify(toDraft(existing?.row ?? {})));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) { const d = toDraft(existing.row); setDraft(d); setSaved(JSON.stringify(d)); }
    // reload only when switching records
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dirty = JSON.stringify(draft) !== saved;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved changes to this initiative. Leave without saving?')) blocker.proceed(); else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const projects = data?.projects ?? [];
  const lists = data?.lists ?? {};
  const payload = useMemo(() => toPayload(draft), [draft]);
  const project = draft.project_id ? projects.find((p) => p.id === draft.project_id) ?? null : null;
  const calc = useMemo(() => calcInitiative(payload), [payload]);
  const resolved = useMemo(() => resolveInitiative(payload, project), [payload, project]);
  const issues = useMemo(() => initiativeIssues(payload, resolved), [payload, resolved]);
  const missing = new Set(issues.filter((i) => i.kind === 'missing').map((i) => i.field));
  const validationFlags = new Set(issues.filter((i) => i.kind === 'validation').map((i) => i.field));
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  if (!isNew && !existing) {
    return <div className="card card-pad"><h3>Initiative not found</h3><p className="muted">It may have been deleted. <Link to="/managers/input">Back to Manager Input</Link></p></div>;
  }

  const linkedElsewhere = new Set(all.filter((e) => e.row.project_id && e.row.id !== id).map((e) => e.row.project_id));
  const nameForMatch = (draft.initiative_name || '').trim().toLowerCase();
  const suggestions = !project && nameForMatch.length > 2
    ? projects.filter((p) => !linkedElsewhere.has(p.id) && (p.title.toLowerCase().includes(nameForMatch) || nameForMatch.includes(p.title.toLowerCase())))
    : [];

  const save = async () => {
    for (const k of [...NUM, ...PCT]) {
      if (draft[k] !== '' && (!Number.isFinite(Number(draft[k])) || Number(draft[k]) < 0)) { toast(`${COLUMNS.find((c) => c.key === k)?.header ?? k} must be a positive number.`, 'error'); return; }
    }
    for (const k of PCT) if (draft[k] !== '' && Number(draft[k]) > 100) { toast(`${k === 'confidence' ? 'Confidence' : 'Realization'} % must be between 0 and 100.`, 'error'); return; }
    setSaving(true);
    try {
      const row = isNew ? await api.savings.create(payload as Partial<SavingsInitiative>) : await api.savings.update(id!, payload as Partial<SavingsInitiative>);
      upsertLocal(row);
      const d = toDraft(row);
      setDraft(d);
      setSaved(JSON.stringify(d));
      toast(isNew ? `Initiative #${row.initiative_no} created` : 'Initiative saved');
      if (isNew) navigate(`/managers/input/${row.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Delete initiative #${existing.row.initiative_no} "${resolved.initiative_name.value}"? This removes only the savings record — the SBF project (if linked) is not affected.`)) return;
    await api.savings.remove(existing.row.id);
    removeLocal(existing.row.id);
    setSaved(JSON.stringify(draft));
    toast('Initiative deleted');
    navigate('/managers/input');
  };

  const addOption = async (listKey: string, label: string, field: string) => {
    const v = window.prompt(`Add a new ${label} option (it becomes available in every record):`);
    if (!v || !v.trim()) return;
    try { setLists(await api.savings.addListValue(listKey, v.trim())); set(field, v.trim()); toast(`${label} option added`); } catch (e) { toast((e as Error).message, 'error'); }
  };

  // ── field renderers ──
  const kindOf = (k: string): FieldKind => (missing.has(k) ? 'missing' : 'enter');
  const label = (k: string, title?: string, tag?: ReactNode) => (
    <div className="fe-label">
      <label htmlFor={`f-${k}`} title={help(k)}>{title ?? COLUMNS.find((c) => c.key === k)?.header ?? k}</label>
      {tag ?? <SourceTag kind={kindOf(k)} />}
    </div>
  );
  const text = (k: string, opts: { title?: string; placeholder?: string; area?: boolean } = {}) => (
    <div className={`fe${missing.has(k) ? ' miss' : ''}${opts.area ? ' wide' : ''}`}>
      {label(k, opts.title)}
      {opts.area
        ? <textarea id={`f-${k}`} className="textarea" rows={5} value={draft[k]} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} />
        : <input id={`f-${k}`} className="input" value={draft[k]} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} />}
      <span className="fe-help">{help(k)}</span>
    </div>
  );
  const select = (k: string, listKey: string, opts: { addable?: string } = {}) => {
    const values = lists[listKey] ?? [];
    const off = draft[k] && !values.includes(draft[k]);
    return (
      <div className={`fe${missing.has(k) ? ' miss' : ''}${validationFlags.has(k) ? ' validate' : ''}`}>
        {label(k)}
        <div className="row" style={{ gap: 6 }}>
          <select id={`f-${k}`} className="select" value={draft[k]} onChange={(e) => set(k, e.target.value)}>
            <option value="">— Select —</option>
            {values.map((v) => <option key={v} value={v}>{v}</option>)}
            {off && <option value={draft[k]}>{draft[k]} (not in list)</option>}
          </select>
          {opts.addable && <button type="button" className="btn btn-ghost btn-icon" title={`Add ${opts.addable} option`} onClick={() => addOption(listKey, opts.addable!, k)}><Plus size={15} /></button>}
        </div>
        {off ? <span className="fe-help warn-text"><AlertTriangle size={11} /> Value is not in the workbook list.</span> : <span className="fe-help">{help(k)}</span>}
      </div>
    );
  };
  const number = (k: string, opts: { suffix?: string; title?: string; step?: string; disabled?: boolean } = {}) => (
    <div className={`fe${missing.has(k) ? ' miss' : ''}`}>
      {label(k, opts.title)}
      <div className="input-suffix">
        <input id={`f-${k}`} className="input" type="number" min={0} step={opts.step ?? 'any'} max={PCT.includes(k) ? 100 : undefined}
          value={draft[k]} onChange={(e) => set(k, e.target.value)} disabled={opts.disabled} />
        {opts.suffix && <span>{opts.suffix}</span>}
      </div>
      <span className="fe-help">{help(k)}</span>
    </div>
  );
  const linkedField = (k: 'initiative_name' | 'ops_manager' | 'functional_area' | 'status', render: () => ReactNode) => {
    const r = resolved[k];
    if (project && r.source === 'project') {
      return (
        <div className="fe">
          {label(k, undefined, <SourceTag kind="project" />)}
          <div className="ro-value">{r.value}</div>
          <span className="fe-help">Taken from the linked SBF project. Change it in the project record.</span>
        </div>
      );
    }
    return render();
  };
  const calcCell = (key: string, value: string, strong = false) => (
    <div className={`calc-cell${strong ? ' strong' : ''}`} title={help(key)}>
      <span>{COLUMNS.find((c) => c.key === key)?.header}</span>
      <b>{value}</b>
      <SourceTag kind="calc" />
    </div>
  );

  const curHourly = draft.current_hourly_rate !== '';
  const futHourly = draft.future_hourly_rate !== '';

  return (
    <div className="stack">
      <div className="crumbs">
        <Link to="/managers/input">Manager Input</Link><ChevronRight size={14} />
        <span>{isNew ? 'New initiative' : `#${existing!.row.initiative_no}`}</span>
      </div>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Initiative {isNew ? '(new)' : `#${existing!.row.initiative_no}`}</div>
          <h1>{resolved.initiative_name.value || 'New initiative'}</h1>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <RecordStatus incomplete={issues.some((i) => i.kind === 'missing')} needsValidation={issues.some((i) => i.kind === 'validation' || (i.category === 'Validation'))} />
            {!isNew && <span className="small muted">Last updated {existing!.row.last_updated || '—'}{existing!.row.updated_by ? ` · by ${existing!.row.updated_by}` : ''}</span>}
          </div>
        </div>
        <div className="legend-tags">
          <SourceTag kind="enter" /> <SourceTag kind="project" /> <SourceTag kind="calc" /> <SourceTag kind="missing" />
        </div>
      </div>

      {existing?.row.import_notes && <div className="filter-note"><Info size={14} /> Imported from the workbook. {existing.row.import_notes}</div>}

      <div className="editor-grid">
        <div className="stack">
          <Section title="SBF Project link" sub="Connect this initiative to an existing project so its name, manager, area, status, charter and RACI are filled automatically.">
            {project ? (
              <div className="link-card">
                <div>
                  <b>{project.title}</b>
                  <span className="small muted">Owner: {project.owner || '—'} · Project Status: {project.status} · Charter Status: {project.charter_status} · Timeline activities: {project.timeline_total}</span>
                </div>
                <div className="row">
                  <Link className="btn btn-secondary btn-sm" to={`/managers/projects/${project.id}`}><ExternalLink size={14} /> View project</Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => set('project_id', '')}><Unlink size={14} /> Unlink</button>
                </div>
              </div>
            ) : (
              <div className="fe wide">
                <div className="fe-label"><label htmlFor="f-project">Linked SBF project</label><SourceTag kind="enter" label="Optional" /></div>
                <select id="f-project" className="select" value={draft.project_id} onChange={(e) => set('project_id', e.target.value)}>
                  <option value="">Not linked</option>
                  {projects.map((p) => <option key={p.id} value={p.id} disabled={linkedElsewhere.has(p.id)}>{p.title}{linkedElsewhere.has(p.id) ? ' (already linked)' : ''}</option>)}
                </select>
                {suggestions.length > 0 && (
                  <div className="suggest">
                    Possible match: {suggestions.map((p) => <button key={p.id} type="button" className="chip-btn" onClick={() => set('project_id', p.id)}><Link2 size={12} /> {p.title}</button>)}
                  </div>
                )}
                <span className="fe-help">Linking uses the project's stable ID — no duplicate project is created. One initiative per project.</span>
              </div>
            )}
          </Section>

          <Section title="Initiative details" sub="Who, where and what">
            <div className="fe-grid">
              <div className="fe"><div className="fe-label"><label>Initiative ID</label><SourceTag kind="calc" label="Assigned automatically" /></div><div className="ro-value">{isNew ? 'Assigned on save' : existing!.row.initiative_no}</div></div>
              {linkedField('initiative_name', () => text('initiative_name'))}
              {linkedField('ops_manager', () => text('ops_manager'))}
              {select('area', 'area', { addable: 'Area' })}
              {linkedField('functional_area', () => select('functional_area', 'functional_area', { addable: 'Functional Area' }))}
              {text('process')}
            </div>
          </Section>

          <Section title="Savings classification" sub="Track, lever, outcome and status (workbook drop-downs)">
            <div className="fe-grid">
              {select('savings_track', 'savings_track', { addable: 'Savings Track' })}
              {select('savings_lever', 'savings_lever', { addable: 'Savings Lever' })}
              {select('savings_outcome', 'savings_outcome')}
              {linkedField('status', () => select('status', 'status'))}
            </div>
          </Section>

          <Section title="Operational assumptions" sub="Use the same unit and annual period for both scenarios">
            <div className="fe-grid">
              {number('baseline_volume', { suffix: 'items / yr' })}
              {number('baseline_aht', { suffix: 'min' })}
              {number('future_volume', { suffix: 'items / yr' })}
              {number('future_aht', { suffix: 'min' })}
              {number('productive_hours', { suffix: 'hrs / FTE / yr' })}
            </div>
          </Section>

          <Section title="Financial assumptions" sub="Rates belong to this initiative only — there is no global default hourly rate">
            <div className="fe-grid">
              {number('current_hourly_rate', { title: 'Current Hourly Rate', suffix: '$ / hr' })}
              {number('future_hourly_rate', { title: 'Future Hourly Rate', suffix: '$ / hr' })}
              {curHourly
                ? <div className="fe"><div className="fe-label"><label>Current Annual Rate per FTE</label><SourceTag kind="calc" label="Hourly × productive hours" /></div><div className="ro-value calc">{money(calc.current_annual_rate_effective, 2)}</div><span className="fe-help">{help('current_annual_rate')}</span></div>
                : number('current_annual_rate', { suffix: '$ / FTE / yr', title: 'Current Annual Rate per FTE (if no hourly rate)' })}
              {futHourly
                ? <div className="fe"><div className="fe-label"><label>Future Annual Rate per FTE</label><SourceTag kind="calc" label="Hourly × productive hours" /></div><div className="ro-value calc">{money(calc.future_annual_rate_effective, 2)}</div><span className="fe-help">{help('future_annual_rate')}</span></div>
                : number('future_annual_rate', { suffix: '$ / FTE / yr', title: 'Future Annual Rate per FTE (if no hourly rate)' })}
              {number('confidence', { suffix: '%', step: '1' })}
              {number('realization', { suffix: '%', step: '1' })}
            </div>
          </Section>

          <Section title="Timing" sub="Planned dates">
            <div className="fe-grid">
              <div className={`fe${missing.has('target_start') ? ' miss' : ''}`}>{label('target_start')}<input id="f-target_start" className="input" type="date" value={draft.target_start} onChange={(e) => set('target_start', e.target.value)} /><span className="fe-help">{help('target_start')}</span></div>
              <div className={`fe${missing.has('expected_completion') ? ' miss' : ''}`}>{label('expected_completion')}<input id="f-expected_completion" className="input" type="date" value={draft.expected_completion} min={draft.target_start || undefined} onChange={(e) => set('expected_completion', e.target.value)} /><span className="fe-help">{help('expected_completion')}</span></div>
              <div className="fe"><div className="fe-label"><label>Last Updated</label><SourceTag kind="calc" label="Set automatically on save" /></div><div className="ro-value">{existing?.row.last_updated || 'On save'}</div></div>
            </div>
          </Section>

          <Section title="Executive story & evidence" sub="Leadership-ready narrative and the facts behind it">
            <div className="fe-grid">
              {text('executive_story', { area: true })}
              {text('evidence', { area: true })}
            </div>
          </Section>

          <Section title="Validation" sub="Explicit Yes/No — never set automatically. Finance validation should be Yes before a benefit is presented as committed.">
            <div className="fe-grid">
              {select('owner_signoff', 'yes_no')}
              {select('finance_validated', 'yes_no')}
            </div>
            {draft.finance_validated !== 'Yes' && <div className="callout warn"><AlertTriangle size={15} /> Not Finance-validated: present this value as pipeline, not as a committed benefit.</div>}
          </Section>

          <Section title="Project Charter & RACI" sub="Filled from the linked Project Charter where available; enter missing values manually">
            <div className="fe-grid">
              <div className="fe">
                <div className="fe-label"><label>Project Charter (Y/N)</label>
                  {resolved.project_charter.source === 'project' ? <SourceTag kind="project" /> : <SourceTag kind={resolved.project_charter.source === 'missing' ? 'missing' : 'manual'} />}
                </div>
                {project
                  ? <div className="ro-value"><CharterYN value={resolved.project_charter.value} source="project" /> <span className="small muted">Charter Status: {project.charter_status}. Y means a charter exists — not that the project is complete.</span></div>
                  : (
                    <select className="select" value={draft.project_charter_manual} onChange={(e) => set('project_charter_manual', e.target.value)} aria-label="Project Charter (Y/N)">
                      <option value="">Missing Information (not linked)</option>
                      <option value="Y">Y — recorded manually</option>
                      <option value="N">N — recorded manually</option>
                    </select>
                  )}
                <span className="fe-help">{help('project_charter')}</span>
              </div>
              {(['R', 'A', 'C', 'I'] as const).map((letter) => {
                const key = `raci_${letter.toLowerCase()}`;
                const r = resolved.raci[letter];
                const name = { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' }[letter];
                return r.source === 'charter' ? (
                  <div key={letter} className="fe"><div className="fe-label"><label>{letter} — {name}</label><SourceTag kind="charter" /></div><div className="ro-value">{r.value}</div></div>
                ) : (
                  <div key={letter} className={`fe${r.source === 'missing' ? ' miss' : ''}`}>
                    <div className="fe-label"><label htmlFor={`f-${key}`}>{letter} — {name}</label><SourceTag kind={r.source === 'missing' ? 'missing' : 'manual'} label={r.source === 'missing' ? 'Needs information' : 'Entered manually'} /></div>
                    <input id={`f-${key}`} className="input" value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder={project ? 'Not in the Project Charter — enter here' : 'Enter name(s)'} />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Other workbook columns" sub="Timeline and FTE have no definition or formula in the workbook — kept as free text">
            <div className="fe-grid">
              <div className="fe">{label('timeline_text', 'Timeline', <SourceTag kind="enter" label="Optional" />)}<input id="f-timeline_text" className="input" value={draft.timeline_text} onChange={(e) => set('timeline_text', e.target.value)} /></div>
              <div className="fe">{label('fte_text', 'FTE', <SourceTag kind="enter" label="Optional" />)}<input id="f-fte_text" className="input" value={draft.fte_text} onChange={(e) => set('fte_text', e.target.value)} /></div>
            </div>
          </Section>
        </div>

        <aside className="editor-side">
          <section className="card calc-panel">
            <div className="card-head"><div><h3>Calculated results</h3><p>Workbook formulas · update as you type</p></div></div>
            <div className="calc-list">
              {calcCell('baseline_workload_fte', fte(calc.baseline_workload_fte))}
              {calcCell('future_workload_fte', fte(calc.future_workload_fte))}
              {calcCell('capacity_fte_released', fte(calc.capacity_fte_released))}
              {calcCell('hc_reduction_fte', fte(calc.hc_reduction_fte))}
              {calcCell('extra_capacity_fte', fte(calc.extra_capacity_fte))}
              {calcCell('rate_card_savings', money(calc.rate_card_savings))}
              {calcCell('gross_annual_savings', money(calc.gross_annual_savings))}
              {calcCell('risk_adjusted_savings', money(calc.risk_adjusted_savings), true)}
            </div>
            {issues.some((i) => i.category === 'Operational assumptions' || i.category === 'Financial assumptions') && (
              <p className="callout warn small"><AlertTriangle size={14} /> Some assumptions are missing. Like the workbook, blank inputs count as 0, so these results are incomplete.</p>
            )}
            <p className="small muted" style={{ padding: '0 16px 12px' }}>Risk-adjusted = gross × {pct(Number(payload.confidence) || 0)} confidence × {pct(Number(payload.realization) || 0)} realization.</p>
          </section>

          <section className="card">
            <div className="card-head"><div><h3>Needs attention</h3><p>{issues.filter((i) => i.kind !== 'notice').length} item(s)</p></div></div>
            <ul className="issue-list">
              {issues.map((i) => (
                <li key={i.field + i.label} className={`issue ${i.kind}`}>
                  {i.kind === 'notice' ? <Info size={13} /> : <AlertTriangle size={13} />}
                  <span><b>{i.kind === 'missing' ? 'Required information missing' : i.kind === 'validation' ? 'Needs validation' : 'Note'}</b> — {i.label} <small>({i.category})</small></span>
                </li>
              ))}
              {issues.length === 0 && <li className="issue ok">All information complete and validated.</li>}
            </ul>
          </section>

          <div className="editor-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving || (!dirty && !isNew)}><Save size={16} /> {saving ? 'Saving…' : isNew ? 'Create initiative' : dirty ? 'Save changes' : 'Saved'}</button>
            {!isNew && <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={14} /> Delete initiative</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><div><h3>{title}</h3><p>{sub}</p></div></div>
      <div className="card-body">{children}</div>
    </section>
  );
}
