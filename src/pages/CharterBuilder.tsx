import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, CalendarRange, Check, ChevronDown, ChevronRight, ClipboardList, FileDown, Info, ListChecks, Plus,
  RotateCcw, Save, Target, Trash2, Users,
} from 'lucide-react';
import { api } from '../api';
import { CHARACTERS } from '../characters';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { Menu } from '../components/Menu';
import { useProjects } from '../components/ProjectsContext';
import { useToast } from '../components/Toast';
import { TIMELINE_PHASES, type Charter, type CharterData, type ProjectDetail, type TimelinePhase } from '../types';
import { PHASE_COLORS, charterProgress, emptyMilestone, normalizeCharter } from '../utils/charter';
import { downloadCharterDocx, downloadCharterPdf } from '../utils/exportCharter';
import { timeAgo } from '../utils/format';

const RACI = [
  { key: 'responsible', letter: 'R', label: 'Responsible', hint: 'Does the work', color: '#5009B5' },
  { key: 'accountable', letter: 'A', label: 'Accountable', hint: 'Owns the outcome', color: '#794CFF' },
  { key: 'consulted', letter: 'C', label: 'Consulted', hint: 'Provides input', color: '#00B8BA' },
  { key: 'informed', letter: 'I', label: 'Informed', hint: 'Kept up to date', color: '#44B8F3' },
] as const;

const SECTIONS = [
  { key: 'information', label: 'Project Information', icon: Info },
  { key: 'definition', label: 'Project Definition', icon: Target },
  { key: 'raci', label: 'RACI', icon: Users },
  { key: 'milestones', label: 'Milestones / Tasks', icon: ListChecks },
  { key: 'timeline', label: 'Timeline', icon: CalendarRange },
] as const;

export function CharterBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useProjects();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CharterData | null>(null);
  const [savedJson, setSavedJson] = useState('');
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
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const dirty = !!data && JSON.stringify(data) !== savedJson;
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

  const progress = useMemo(() => (data ? charterProgress(data) : null), [data]);

  const set = useCallback(<K extends keyof CharterData>(key: K, value: CharterData[K]) => setData((d) => (d ? { ...d, [key]: value } : d)), []);

  const save = async (nextStatus: Charter['status'] = status, quiet = false) => {
    if (!data || !project) return null;
    setSaving(true);
    try {
      const p = await api.saveCharter(project.id, data, nextStatus);
      setProject(p);
      setSavedJson(JSON.stringify(data));
      await refresh();
      if (!quiet) toast(nextStatus === 'Completed' ? 'Charter saved and marked completed' : 'Charter saved');
      return p;
    } catch (e) {
      toast((e as Error).message, 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const download = async (kind: 'docx' | 'pdf') => {
    if (!data) return;
    if (dirty || isNew) {
      const ok = await save(status, true);
      if (!ok) return;
    }
    try {
      await (kind === 'docx' ? downloadCharterDocx(data) : downloadCharterPdf(data));
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

  const setMilestone = (i: number, patch: Partial<CharterData['milestones'][number]>) =>
    set('milestones', data.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const moveMilestone = (i: number, dir: -1 | 1) => {
    const ms = [...data.milestones];
    [ms[i], ms[i + dir]] = [ms[i + dir]!, ms[i]!];
    set('milestones', ms);
  };
  const setPhase = (phase: TimelinePhase, patch: Partial<CharterData['timeline'][TimelinePhase]>) =>
    set('timeline', { ...data.timeline, [phase]: { ...data.timeline[phase], ...patch } });

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
          <div className="row wrap" style={{ marginTop: 10 }}>
            <StatusBadge status={project.status} />
            <CharterBadge status={isNew ? 'Not Started' : status} />
            {!isNew && <span className="small muted">Last saved {timeAgo(project.charter!.updated_at)}</span>}
          </div>
        </div>
        <Menu
          trigger={(toggle) => <button className="btn btn-secondary" onClick={toggle}><FileDown size={16} /> Download <ChevronDown size={14} /></button>}
        >
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
              <span className="small" style={{ fontWeight: 650 }}>Overall</span>
              <span className="small" style={{ fontWeight: 700, color: 'var(--purple)' }}>{progress.percent}%</span>
            </div>
            <div className="progress"><i style={{ width: `${progress.percent}%` }} /></div>
            <img src={CHARACTERS.heroes} alt="" style={{ display: 'block', height: 170, margin: '16px auto 0' }} />
          </div>
        </aside>

        <div className="stack">
          <Section id="information" refFn={sectionRef('information')} icon={<Info size={18} />} title="Project Information" subtitle="Who owns and sponsors this project">
            <div className="form-grid">
              <Field label="Project Title" full>
                <input className="input" value={data.projectTitle} onChange={(e) => set('projectTitle', e.target.value)} placeholder={project.title} />
              </Field>
              <Field label="Business Function"><input className="input" value={data.businessFunction} onChange={(e) => set('businessFunction', e.target.value)} /></Field>
              <Field label="Business Owner"><input className="input" value={data.businessOwner} onChange={(e) => set('businessOwner', e.target.value)} /></Field>
              <Field label="Executive Sponsor"><input className="input" value={data.executiveSponsor} onChange={(e) => set('executiveSponsor', e.target.value)} /></Field>
              <Field label="Line of Business"><input className="input" value={data.lineOfBusiness} onChange={(e) => set('lineOfBusiness', e.target.value)} /></Field>
              <Field label="Execution Lead" full><input className="input" value={data.executionLead} onChange={(e) => set('executionLead', e.target.value)} /></Field>
            </div>
          </Section>

          <Section id="definition" refFn={sectionRef('definition')} icon={<Target size={18} />} title="Project Definition" subtitle="The problem, the goal and the boundaries">
            <div className="form-grid">
              <Field label="Problem Statement" full hint="What is happening today, and why does it matter?">
                <textarea className="textarea" rows={4} value={data.problemStatement} onChange={(e) => set('problemStatement', e.target.value)} />
              </Field>
              <Field label="Project Goals" full hint="What will success look like? Make goals measurable where possible.">
                <textarea className="textarea" rows={4} value={data.projectGoals} onChange={(e) => set('projectGoals', e.target.value)} />
              </Field>
              <Field label="In Scope"><textarea className="textarea" rows={5} value={data.inScope} onChange={(e) => set('inScope', e.target.value)} placeholder="What this project will cover" /></Field>
              <Field label="Out of Scope"><textarea className="textarea" rows={5} value={data.outOfScope} onChange={(e) => set('outOfScope', e.target.value)} placeholder="What this project will not cover" /></Field>
              <Field label="Project Deliverables" full>
                <textarea className="textarea" rows={4} value={data.deliverables} onChange={(e) => set('deliverables', e.target.value)} />
              </Field>
              <Field label="Business Impact / Benefit" full hint="Savings, quality, experience or risk improvements expected.">
                <textarea className="textarea" rows={4} value={data.businessImpact} onChange={(e) => set('businessImpact', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="raci" refFn={sectionRef('raci')} icon={<Users size={18} />} title="RACI" subtitle="Clarify who does what">
            <div className="raci-grid">
              {RACI.map((r) => (
                <div key={r.key} className="raci-card">
                  <div className="row">
                    <span className="raci-letter" style={{ background: r.color }}>{r.letter}</span>
                    <div><div style={{ fontWeight: 700 }}>{r.label}</div><div className="small muted">{r.hint}</div></div>
                  </div>
                  <textarea className="textarea" value={data.raci[r.key]} onChange={(e) => set('raci', { ...data.raci, [r.key]: e.target.value })} placeholder="Names or roles" />
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="milestones" refFn={sectionRef('milestones')} icon={<ClipboardList size={18} />} title="Milestones / Tasks" subtitle="Key checkpoints and the people responsible"
            action={<button className="btn btn-soft btn-sm" onClick={() => set('milestones', [...data.milestones, emptyMilestone()])}><Plus size={14} /> Add milestone</button>}
          >
            <div className="stack" style={{ gap: 10 }}>
              <div className="ms-row ms-head"><span>#</span><span>Milestone / Task</span><span>Owner</span><span>Target date</span><span /></div>
              {data.milestones.map((m, i) => (
                <div key={m.id} className="ms-row">
                  <span className="ms-idx">{i + 1}</span>
                  <input className="input" value={m.task} onChange={(e) => setMilestone(i, { task: e.target.value })} placeholder="Describe the milestone or task" aria-label={`Milestone ${i + 1}`} />
                  <input className="input" value={m.owner} onChange={(e) => setMilestone(i, { owner: e.target.value })} placeholder="Owner" aria-label={`Milestone ${i + 1} owner`} />
                  <input className="input" type="date" value={m.dueDate} onChange={(e) => setMilestone(i, { dueDate: e.target.value })} aria-label={`Milestone ${i + 1} target date`} />
                  <Menu
                    trigger={(toggle) => <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Milestone actions"><ChevronDown size={16} /></button>}
                  >
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
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('milestones', [...data.milestones, emptyMilestone()])}>
                <Plus size={14} /> Add another milestone
              </button>
            </div>
          </Section>

          <Section id="timeline" refFn={sectionRef('timeline')} icon={<CalendarRange size={18} />} title="Timeline" subtitle="Plan each phase of the SBF improvement journey">
            <div className="tl-row ms-head" style={{ paddingTop: 0 }}><span>Phase</span><span>Task</span><span>Start date</span><span>End date</span></div>
            <div className="timeline">
              {TIMELINE_PHASES.map((phase) => {
                const t = data.timeline[phase];
                const bad = t.start && t.end && t.end < t.start;
                return (
                  <div key={phase} className="tl-row">
                    <div className="tl-phase"><span className="chev" style={{ background: PHASE_COLORS[phase] }}>{phase}</span></div>
                    <div className="tl-task"><input className="input" value={t.task} onChange={(e) => setPhase(phase, { task: e.target.value })} placeholder={`Key task for ${phase.toLowerCase()}`} aria-label={`${phase} task`} /></div>
                    <input className="input" type="date" value={t.start} onChange={(e) => setPhase(phase, { start: e.target.value })} aria-label={`${phase} start date`} />
                    <div>
                      <input className="input" type="date" value={t.end} min={t.start || undefined} onChange={(e) => setPhase(phase, { end: e.target.value })} aria-label={`${phase} end date`} style={bad ? { borderColor: '#d6456e' } : undefined} />
                      {bad && <div className="small" style={{ color: '#b4234a', marginTop: 4 }}>Ends before it starts</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <div className="save-bar">
            <span className={`state${dirty || isNew ? ' dirty' : ''}`}>
              <i /> {saving ? 'Saving…' : isNew ? 'Not saved yet' : dirty ? 'Unsaved changes' : `All changes saved · ${status}`}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-glass" onClick={() => navigate(`/projects/${project.id}`)}>Back to project</button>
            {status === 'Completed' && !isNew ? (
              <>
                <button className="btn btn-glass" disabled={saving} onClick={() => save('In Progress')}><RotateCcw size={15} /> Reopen as in progress</button>
                <button className="btn btn-accent" disabled={saving || !dirty} onClick={() => save('Completed')}><Save size={15} /> Save changes</button>
              </>
            ) : (
              <>
                <button className="btn btn-glass" disabled={saving || (!dirty && !isNew)} onClick={() => save('In Progress')}><Save size={15} /> Save draft</button>
                <button className="btn btn-accent" disabled={saving} onClick={() => save('Completed')}><Check size={15} /> Save & mark completed</button>
              </>
            )}
          </div>
        </div>
      </div>
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

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}
