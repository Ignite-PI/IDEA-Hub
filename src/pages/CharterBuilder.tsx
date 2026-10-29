import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, BarChart3, CalendarRange, Check, ChevronDown, ChevronRight, ClipboardList, FileDown, Info, Plus,
  RotateCcw, Save, Scale, Target, Trash2, Users,
} from 'lucide-react';
import { api, type AiContext } from '../api';
import { CHARACTERS } from '../characters';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { Gantt } from '../components/Gantt';
import { Menu } from '../components/Menu';
import { useProjects } from '../components/ProjectsContext';
import { TimelineEditor, timelineErrors } from '../components/TimelineEditor';
import { useToast } from '../components/Toast';
import { AiAssistButton, AiRowsButton } from '../components/ai/AiAssist';
import { AiPanel, type InsertTarget } from '../components/ai/AiPanel';
import type { Charter, CharterData, KeyMetric, Milestone, ProjectDetail, TimelineActivity } from '../types';
import { charterMissing, charterProgress, emptyActivity, emptyMetric, emptyMilestone, enteredActivities, newId, normalizeCharter } from '../utils/charter';
import { downloadCharterDocx, downloadCharterPdf } from '../utils/exportCharter';
import { timeAgo } from '../utils/format';

const RACI = [
  { key: 'responsible', letter: 'R', label: 'Responsible', hint: 'Does the work', color: '#5009B5' },
  { key: 'accountable', letter: 'A', label: 'Accountable', hint: 'Owns the outcome', color: '#794CFF' },
  { key: 'consulted', letter: 'C', label: 'Consulted', hint: 'Provides input', color: '#00B8BA' },
  { key: 'informed', letter: 'I', label: 'Informed', hint: 'Kept up to date', color: '#44B8F3' },
] as const;

const SECTIONS = [
  { key: 'information', label: 'Project Information' },
  { key: 'definition', label: 'Problem, Goals & Impact' },
  { key: 'metrics', label: 'Key Metrics' },
  { key: 'scope', label: 'Scope & Constraints' },
  { key: 'raci', label: 'RACI' },
  { key: 'milestones', label: 'Milestones / Tasks' },
  { key: 'timeline', label: 'CURES Timeline' },
] as const;

const INFO_FIELDS = [
  ['projectTitle', 'Project Title'], ['businessFunction', 'Business Function'], ['businessOwner', 'Business Owner'],
  ['executiveSponsor', 'Executive Sponsor'], ['lineOfBusiness', 'Line of Business'], ['executionLead', 'Execution Lead'], ['curesLead', 'CURES Lead'],
] as const;

type TextKey = 'problemStatement' | 'projectGoals' | 'businessImpact' | 'deliverables' | 'inScope' | 'outOfScope' | 'constraints';

export function CharterBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useProjects();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CharterData | null>(null);
  const [timeline, setTimeline] = useState<TimelineActivity[]>([]);
  const [savedJson, setSavedJson] = useState('');
  const [savedTimelineJson, setSavedTimelineJson] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('information');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    api.getProject(id!)
      .then((p) => {
        const d = normalizeCharter(p.charter?.data, p);
        setProject(p);
        setData(d);
        setSavedJson(p.charter ? JSON.stringify(d) : '');
        setTimeline(p.timeline);
        setSavedTimelineJson(JSON.stringify(p.timeline));
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const timelineDirty = JSON.stringify(timeline) !== savedTimelineJson;
  const dirty = (!!data && JSON.stringify(data) !== savedJson) || timelineDirty;
  const isNew = !project?.charter;
  const status: Charter['status'] = project?.charter?.status ?? 'In Progress';

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved charter changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const ready = !!data;
  useEffect(() => {
    if (!ready) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -55% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [ready]);

  const progress = useMemo(() => (data ? charterProgress(data, timeline) : null), [data, timeline]);
  // Required-field check runs live once the user has tried to mark the charter completed
  const [checkRequired, setCheckRequired] = useState(false);
  const missing = useMemo(() => (data && checkRequired ? charterMissing(data, timeline) : []), [data, timeline, checkRequired]);
  const missingKeys = new Set(missing.map((m) => m.key));
  const miss = (key: string) => missingKeys.has(key);

  const set = useCallback(<K extends keyof CharterData>(key: K, value: CharterData[K]) => setData((d) => (d ? { ...d, [key]: value } : d)), []);
  const appendTo = useCallback((key: TextKey, text: string) =>
    setData((d) => (d ? { ...d, [key]: d[key].trim() ? `${d[key].trimEnd()}\n\n${text}` : text } : d)), []);

  // Latest unsaved state, used as AI context (only this project's information)
  const stateRef = useRef({ project, data, timeline });
  stateRef.current = { project, data, timeline };
  const getContext = useCallback((): AiContext => {
    const { project: p, data: d, timeline: t } = stateRef.current;
    return {
      project: p ? { title: p.title, description: p.description, owner: p.owner, functional_area: p.functional_area, ops_manager: p.ops_manager, status: p.status } : undefined,
      charter: d ?? undefined,
      timeline: enteredActivities(t),
    };
  }, []);

  const save = async (nextStatus: Charter['status'] = status, quiet = false) => {
    if (!data || !project || !progress) return null;
    const errs = timelineErrors(timeline);
    if (errs.length) { toast(errs[0]!, 'error'); return null; }
    if (nextStatus === 'Completed') {
      const gaps = charterMissing(data, timeline);
      setCheckRequired(true);
      if (gaps.length) {
        toast(`Complete the ${gaps.length} required item${gaps.length === 1 ? '' : 's'} highlighted before marking the charter completed. You can still Save draft.`, 'error');
        sectionRefs.current[gaps[0]!.section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return null;
      }
    }
    setSaving(true);
    try {
      let savedTimeline = timeline;
      if (timelineDirty) {
        savedTimeline = await api.saveTimeline(project.id, enteredActivities(timeline));
        setTimeline(savedTimeline);
        setSavedTimelineJson(JSON.stringify(savedTimeline));
      }
      const p = await api.saveCharter(project.id, data, nextStatus, charterProgress(data, savedTimeline).percent);
      setProject(p);
      setSavedJson(JSON.stringify(data));
      await refresh();
      if (!quiet) toast(nextStatus === 'Completed' ? 'Charter saved and marked completed (project status unchanged)' : 'Charter saved');
      return { ...p, timeline: savedTimeline };
    } catch (e) {
      toast((e as Error).message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const download = async (kind: 'docx' | 'pdf') => {
    if (!data) return;
    let acts = timeline;
    if (dirty || isNew) {
      const ok = await save(status, true);
      if (!ok) return;
      acts = ok.timeline;
    }
    try {
      await (kind === 'docx' ? downloadCharterDocx(data, acts) : downloadCharterPdf(data, acts));
      toast(`Saved and downloaded as ${kind === 'docx' ? 'Word' : 'PDF'}`);
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, 'error');
    }
  };

  if (error) {
    return <div className="card" style={{ marginTop: 20 }}><EmptyState image={CHARACTERS.corix} title="Project not found" action={<Link className="btn btn-primary" to="/charters">Back to charters</Link>}>{error}</EmptyState></div>;
  }
  if (!project || !data || !progress) return <Loading label="Loading charter…" />;

  const scrollTo = (key: string) => sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const sectionRef = (key: string) => (el: HTMLElement | null) => { sectionRefs.current[key] = el; };

  const setMilestone = (i: number, patch: Partial<Milestone>) =>
    set('milestones', data.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const moveMilestone = (i: number, dir: -1 | 1) => {
    const ms = [...data.milestones];
    [ms[i], ms[i + dir]] = [ms[i + dir]!, ms[i]!];
    set('milestones', ms);
  };
  const setMetric = (i: number, patch: Partial<KeyMetric>) =>
    set('keyMetrics', data.keyMetrics.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const nonEmpty = <T extends object>(rows: T[], keys: (keyof T)[]) => rows.filter((r) => keys.some((k) => String(r[k] ?? '').trim()));

  const textArea = (key: TextKey, label: string, opts: { hint?: string; rows?: number; ai?: string[]; placeholder?: string; full?: boolean } = {}) => (
    <Field
      label={label}
      hint={opts.hint}
      full={opts.full ?? true}
      required={key !== 'constraints'}
      invalid={miss(key)}
      action={<AiAssistButton field={label} value={data[key]} onChange={(v) => set(key, v)} getContext={getContext} extraActions={opts.ai} />}
    >
      <textarea className="textarea" rows={opts.rows ?? 4} value={data[key]} onChange={(e) => set(key, e.target.value)} placeholder={opts.placeholder} />
    </Field>
  );

  const aiTargets: InsertTarget[] = [
    { key: 'problemStatement', label: 'Problem Statement', insert: (t) => appendTo('problemStatement', t) },
    { key: 'projectGoals', label: 'Engagement Goals', insert: (t) => appendTo('projectGoals', t) },
    { key: 'businessImpact', label: 'Business Impact / Benefit', insert: (t) => appendTo('businessImpact', t) },
    { key: 'deliverables', label: 'Project Deliverables', insert: (t) => appendTo('deliverables', t) },
    { key: 'inScope', label: 'In Scope', insert: (t) => appendTo('inScope', t) },
    { key: 'outOfScope', label: 'Out of Scope', insert: (t) => appendTo('outOfScope', t) },
    { key: 'constraints', label: 'Constraints', insert: (t) => appendTo('constraints', t) },
  ];

  return (
    <>
      <div className="crumbs">
        <Link to="/charters">Project Charters</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
        <ChevronRight size={14} />
        <span>Charter</span>
      </div>
      <div className="page-head">
        <div>
          <div className="eyebrow">SBF Project Charter</div>
          <h1>{data.projectTitle || project.title}</h1>
          <div className="status-pair compact" style={{ marginTop: 10 }}>
            <div><span className="k">Project Status</span><StatusBadge status={project.status} /></div>
            <div><span className="k">Charter Status</span><CharterBadge status={isNew ? 'Not Started' : status} short /></div>
            {!isNew && <span className="small muted">Last saved {timeAgo(project.charter!.updated_at)}</span>}
          </div>
        </div>
        <Menu align="end" trigger={(toggle) => <button className="btn btn-secondary" onClick={toggle}><FileDown size={16} /> Download <ChevronDown size={14} /></button>}>
          {(close) => (
            <>
              <button onClick={() => { close(); void download('docx'); }}><FileDown size={16} color="#2B579A" /> Microsoft Word (.docx)</button>
              <button onClick={() => { close(); void download('pdf'); }}><FileDown size={16} color="#B4234A" /> PDF (.pdf)</button>
            </>
          )}
        </Menu>
      </div>

      <div className="builder">
        <aside className="builder-nav">
          <div className="card step-list">
            {SECTIONS.map((s, i) => {
              const sp = progress.sections.find((x) => x.key === s.key)!;
              const done = sp.done === sp.total;
              return (
                <button key={s.key} className={`step${activeSection === s.key ? ' active' : ''}${done ? ' done' : ''}`} onClick={() => scrollTo(s.key)}>
                  <span className="num">{done ? <Check size={14} /> : i + 1}</span>
                  <span>{s.label}<small>{sp.done} of {sp.total} complete</small></span>
                </button>
              );
            })}
          </div>
          <div className="card card-pad" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="small" style={{ fontWeight: 650 }}>Charter Completeness</span>
              <span className="small" style={{ fontWeight: 700, color: 'var(--purple)' }}>{progress.percent}%</span>
            </div>
            <div className="progress"><i style={{ width: `${progress.percent}%` }} /></div>
            <p className="small muted" style={{ marginTop: 8 }}>Completing the charter does not change the project status.</p>
            <img src={CHARACTERS.heroes} alt="" style={{ display: 'block', height: 150, margin: '12px auto 0' }} />
          </div>
        </aside>

        <div className="stack">
          <Section id="information" refFn={sectionRef('information')} icon={<Info size={18} />} title="Project Information" subtitle="Who owns, sponsors and leads this project">
            <div className="form-grid three">
              {INFO_FIELDS.map(([key, label]) => (
                <Field key={key} label={label} full={key === 'projectTitle'} required invalid={miss(key)}>
                  <input className="input" aria-label={label} value={data[key]} onChange={(e) => set(key, e.target.value)}
                    placeholder={key === 'projectTitle' ? project.title : undefined} />
                </Field>
              ))}
            </div>
          </Section>

          <Section id="definition" refFn={sectionRef('definition')} icon={<Target size={18} />} title="Problem, Goals & Impact" subtitle="What is wrong today, what success looks like and why it matters">
            <div className="form-grid">
              {textArea('problemStatement', 'Problem Statement', { hint: 'What is happening today, who is affected and why does it matter?', ai: ['improve_problem'], full: false, rows: 6 })}
              {textArea('projectGoals', 'Engagement Goals', { hint: 'What will success look like? Make goals measurable.', ai: ['improve_goals'], full: false, rows: 6 })}
              {textArea('businessImpact', 'Business Impact / Benefit', { hint: 'Savings, quality, experience or risk improvements expected.', ai: ['improve_impact'] })}
              {textArea('deliverables', 'Project Deliverables', { ai: ['suggest_deliverables'] })}
            </div>
          </Section>

          <Section
            id="metrics" refFn={sectionRef('metrics')} icon={<BarChart3 size={18} />} title="Key Metrics" subtitle="How success will be measured — add as many as you need"
            action={
              <div className="row">
                <AiRowsButton
                  action="suggest_metrics_rows" field="Key Metrics" rows={data.keyMetrics} getContext={getContext}
                  columns={[{ key: 'metric', label: 'Key Metric' }, { key: 'definition', label: 'Definition' }, { key: 'target', label: 'Target' }, { key: 'baseline', label: 'Baseline' }, { key: 'impact', label: 'Impact' }]}
                  toRow={(r) => ({ ...emptyMetric(), ...r, id: newId() })}
                  onReplace={(rows) => set('keyMetrics', rows)}
                  onInsert={(rows) => set('keyMetrics', [...nonEmpty(data.keyMetrics, ['metric', 'definition', 'target', 'baseline', 'impact']), ...rows])}
                />
                <button className="btn btn-soft btn-sm" onClick={() => set('keyMetrics', [...data.keyMetrics, emptyMetric()])}><Plus size={14} /> Add Key Metric</button>
              </div>
            }
          >
            <RequiredNote show={miss('keyMetrics')}>Add at least one Key Metric with a name and a target.</RequiredNote>
            <div className="stack" style={{ gap: 10 }}>
              <div className="km-row ms-head"><span>Key Metric</span><span>Definition</span><span>Target</span><span>Baseline</span><span>Impact</span><span /></div>
              {data.keyMetrics.map((m, i) => (
                <div key={m.id} className="km-row">
                  <input className="input" value={m.metric} onChange={(e) => setMetric(i, { metric: e.target.value })} placeholder="e.g. Claims turnaround" aria-label={`Key metric ${i + 1}`} />
                  <input className="input" value={m.definition} onChange={(e) => setMetric(i, { definition: e.target.value })} placeholder="How it's measured" aria-label={`Metric ${i + 1} definition`} />
                  <input className="input" value={m.target} onChange={(e) => setMetric(i, { target: e.target.value })} placeholder="Target" aria-label={`Metric ${i + 1} target`} />
                  <input className="input" value={m.baseline} onChange={(e) => setMetric(i, { baseline: e.target.value })} placeholder="Baseline" aria-label={`Metric ${i + 1} baseline`} />
                  <input className="input" value={m.impact} onChange={(e) => setMetric(i, { impact: e.target.value })} placeholder="Impact" aria-label={`Metric ${i + 1} impact`} />
                  <button className="btn btn-ghost btn-icon" aria-label="Remove metric" onClick={() => set('keyMetrics', data.keyMetrics.length > 1 ? data.keyMetrics.filter((_, j) => j !== i) : [emptyMetric()])}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section id="scope" refFn={sectionRef('scope')} icon={<Scale size={18} />} title="Scope & Constraints" subtitle="The boundaries of the project">
            <div className="form-grid">
              {textArea('inScope', 'In Scope', { ai: ['improve_scope'], full: false, rows: 5, placeholder: 'What this project will cover' })}
              {textArea('outOfScope', 'Out of Scope', { ai: ['improve_scope'], full: false, rows: 5, placeholder: 'What this project will not cover' })}
              {textArea('constraints', 'Constraints', { ai: ['improve_scope'], rows: 3, placeholder: 'Budget, system, staffing, regulatory or timing constraints' })}
            </div>
          </Section>

          <Section id="raci" refFn={sectionRef('raci')} icon={<Users size={18} />} title="RACI" subtitle="Clarify who does what">
            <div className="raci-grid">
              {RACI.map((r) => (
                <div key={r.key} className={`raci-card${miss(`raci.${r.key}`) ? ' invalid' : ''}`}>
                  <div className="row">
                    <span className="raci-letter" style={{ background: r.color }}>{r.letter}</span>
                    <div><div style={{ fontWeight: 700 }}>{r.label}<span className="req">*</span></div><div className="small muted">{r.hint}</div></div>
                  </div>
                  <textarea className="textarea" aria-label={`RACI ${r.label}`} value={data.raci[r.key]} onChange={(e) => set('raci', { ...data.raci, [r.key]: e.target.value })} placeholder="Names or roles" />
                  {miss(`raci.${r.key}`) && <span className="small" style={{ color: '#b4234a', fontWeight: 550 }}>Required</span>}
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="milestones" refFn={sectionRef('milestones')} icon={<ClipboardList size={18} />} title="Milestones / Tasks" subtitle="Key checkpoints and the people responsible"
            action={
              <div className="row">
                <AiRowsButton
                  action="suggest_milestones_rows" field="Milestones / Tasks" rows={data.milestones} getContext={getContext}
                  columns={[{ key: 'task', label: 'Milestone / Task' }, { key: 'owner', label: 'Owner' }, { key: 'dueDate', label: 'Target date' }]}
                  toRow={(r) => ({ ...emptyMilestone(), task: r.task ?? '', owner: r.owner ?? '', dueDate: /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate ?? '') ? r.dueDate! : '' })}
                  onReplace={(rows) => set('milestones', rows)}
                  onInsert={(rows) => set('milestones', [...nonEmpty(data.milestones, ['task', 'owner', 'dueDate']), ...rows])}
                />
                <button className="btn btn-soft btn-sm" onClick={() => set('milestones', [...data.milestones, emptyMilestone()])}><Plus size={14} /> Add milestone</button>
              </div>
            }
          >
            <RequiredNote show={miss('milestones')}>Add at least one milestone or task.</RequiredNote>
            <div className="stack" style={{ gap: 10 }}>
              <div className="ms-row ms-head"><span>#</span><span>Milestone / Task</span><span>Owner</span><span>Target date</span><span /></div>
              {data.milestones.map((m, i) => (
                <div key={m.id} className="ms-row">
                  <span className="ms-idx">{i + 1}</span>
                  <input className="input" value={m.task} onChange={(e) => setMilestone(i, { task: e.target.value })} placeholder="Describe the milestone or task" aria-label={`Milestone ${i + 1}`} />
                  <input className="input" value={m.owner} onChange={(e) => setMilestone(i, { owner: e.target.value })} placeholder="Owner" aria-label={`Milestone ${i + 1} owner`} />
                  <input className="input" type="date" value={m.dueDate} onChange={(e) => setMilestone(i, { dueDate: e.target.value })} aria-label={`Milestone ${i + 1} target date`} />
                  <Menu align="end" trigger={(toggle) => <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Milestone actions"><ChevronDown size={16} /></button>}>
                    {(close) => (
                      <>
                        <button disabled={i === 0} onClick={() => { close(); moveMilestone(i, -1); }}><ArrowUp size={15} /> Move up</button>
                        <button disabled={i === data.milestones.length - 1} onClick={() => { close(); moveMilestone(i, 1); }}><ArrowDown size={15} /> Move down</button>
                        <button onClick={() => { close(); set('milestones', data.milestones.length > 1 ? data.milestones.filter((_, j) => j !== i) : [emptyMilestone()]); }}>
                          <Trash2 size={15} color="#b4234a" /> Remove
                        </button>
                      </>
                    )}
                  </Menu>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="timeline" refFn={sectionRef('timeline')} icon={<CalendarRange size={18} />} title="CURES Timeline"
            subtitle="Activities for Collaborate, Understand, Redesign, Execute and Sustain — these build the project's Gantt chart"
          >
            <RequiredNote show={missing.some((m) => m.section === 'timeline')}>
              Each CURES phase needs at least one activity with start and end dates: {missing.filter((m) => m.section === 'timeline').map((m) => m.key.split('.')[1]).join(', ')}.
            </RequiredNote>
            <TimelineEditor activities={timeline} onChange={setTimeline} />
            {!timeline.length && (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btn-soft btn-sm" onClick={() => setTimeline([emptyActivity('Collaborate')])}><Plus size={14} /> Add first activity</button>
              </div>
            )}
            {enteredActivities(timeline).length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="label" style={{ marginBottom: 8 }}>Gantt preview</div>
                <Gantt activities={timeline} />
              </div>
            )}
          </Section>

          {missing.length > 0 && (
            <div className="card card-pad required-summary" role="alert">
              <strong>{missing.length} required item{missing.length === 1 ? '' : 's'} before this charter can be marked completed</strong>
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                {missing.map((m) => (
                  <button key={m.key} className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => scrollTo(m.section)}>{m.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="save-bar">
            <span className={`state${dirty || isNew ? ' dirty' : ''}`}>
              <i /> {saving ? 'Saving…' : isNew ? 'Not saved yet' : dirty ? 'Unsaved changes' : `All changes saved · Charter ${status}`}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-glass" onClick={() => navigate(`/projects/${project.id}`)}>Back to project</button>
            {status === 'Completed' && !isNew ? (
              <>
                <button className="btn btn-glass" disabled={saving} onClick={() => save('In Progress')}><RotateCcw size={15} /> Reopen charter</button>
                <button className="btn btn-accent" disabled={saving || !dirty} onClick={() => save('Completed')}><Save size={15} /> Save changes</button>
              </>
            ) : (
              <>
                <button className="btn btn-glass" disabled={saving || (!dirty && !isNew)} onClick={() => save('In Progress')}><Save size={15} /> Save draft</button>
                <button className="btn btn-accent" disabled={saving} onClick={() => save('Completed')}><Check size={15} /> Save & mark charter completed</button>
              </>
            )}
          </div>
        </div>
      </div>

      <AiPanel getContext={getContext} targets={aiTargets} />
    </>
  );
}

function Section({ id, refFn, icon, title, subtitle, action, children }: {
  id: string; refFn: (el: HTMLElement | null) => void; icon: ReactNode; title: string; subtitle: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} ref={refFn} className="card section">
      <div className="section-head">
        <span className="icon">{icon}</span>
        <div style={{ flex: 1 }}><h3>{title}</h3><p>{subtitle}</p></div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Field({ label, hint, full, action, required, invalid, children }: {
  label: string; hint?: string; full?: boolean; action?: ReactNode; required?: boolean; invalid?: boolean; children: ReactNode;
}) {
  return (
    <div className={`field${full ? ' full' : ''}${invalid ? ' invalid' : ''}`}>
      <div className="field-top">
        <label className="label">{label}{required ? <span className="req">*</span> : <span className="small muted"> (optional)</span>}</label>
        {action}
      </div>
      {children}
      {invalid ? <span className="error">{label} is required to mark the charter completed.</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function RequiredNote({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div className="field invalid" style={{ marginBottom: 10 }}><span className="error">{children}</span></div> : null;
}
