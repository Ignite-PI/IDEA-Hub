import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, CalendarRange, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDashed, Copy, ExternalLink, FileDown, FileText,
  History, Pencil, Plus, Save, Trash2,
} from 'lucide-react';
import { api } from '../api';
import { CHARACTERS } from '../characters';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { Gantt, GanttLegend, TimelineOverview, TimelineStats } from '../components/Gantt';
import { useLinkActions } from '../components/LinkActions';
import { Menu } from '../components/Menu';
import { Person } from '../components/Person';
import { useProjects } from '../components/ProjectsContext';
import { TimelineEditor, timelineErrors } from '../components/TimelineEditor';
import { useToast } from '../components/Toast';
import { STATUSES, STATUS_META, type ActivityStatus, type ProjectDetail, type ProjectStatus, type TimelineActivity } from '../types';
import { charterProgress, emptyActivity, enteredActivities, normalizeCharter, timelineProgress } from '../utils/charter';
import { downloadCharterDocx, downloadCharterPdf } from '../utils/exportCharter';
import { formatDate, timeAgo } from '../utils/format';
import { resolveLink } from '../utils/links';

/** readOnly: used by the MANAGERS account — shows everything, hides every edit action. */
export function ProjectDetails({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useProjects();
  const { open, copy } = useLinkActions();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimelineActivity[] | null>(null);

  const load = useCallback(() => {
    api.getProject(id!).then(setProject).catch((e) => setError((e as Error).message));
  }, [id]);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <EmptyState image={CHARACTERS.corix} title="Project not found" action={<Link className="btn btn-primary" to="/projects">Back to all projects</Link>}>
          {error}
        </EmptyState>
      </div>
    );
  }
  if (!project) return <Loading />;

  const charter = project.charter ? normalizeCharter(project.charter.data, project) : null;
  const completeness = charter ? charterProgress(charter, project.timeline) : null;
  const tp = timelineProgress(project.timeline);
  const tpShown = draft ? timelineProgress(draft) : tp; // the summary follows what the Gantt is currently showing
  const hasTimeline = enteredActivities(project.timeline).length > 0;
  const hasLink = !!project.link.trim();
  const canOpen = hasLink && !!resolveLink(project.link).href;

  const changeStatus = async (status: ProjectStatus) => {
    if (status === project.status) return;
    setBusy('status');
    try {
      setProject(await api.updateStatus(project.id, status));
      await refresh();
      toast(`Project status updated to ${status}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const changeActivityStatus = async (a: TimelineActivity, status: ActivityStatus) => {
    setBusy(a.id);
    try {
      const updated = await api.updateActivity(a.id, { status, ...(status === 'Completed' ? { progress: 100 } : {}) });
      setProject((p) => (p ? { ...p, timeline: p.timeline.map((x) => (x.id === a.id ? updated : x)) } : p));
      await refresh();
      toast(`“${a.task || a.phase}” marked ${status}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveTimeline = async () => {
    if (!draft) return;
    const errs = timelineErrors(draft);
    if (errs.length) { toast(errs[0]!, 'error'); return; }
    setBusy('timeline');
    try {
      const timeline = await api.saveTimeline(project.id, enteredActivities(draft));
      setProject((p) => (p ? { ...p, timeline } : p));
      setDraft(null);
      await refresh();
      toast('Timeline saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const download = async (kind: 'docx' | 'pdf') => {
    if (!charter) return;
    setBusy(kind);
    try {
      await (kind === 'docx' ? downloadCharterDocx(charter, project.timeline) : downloadCharterPdf(charter, project.timeline));
      toast(`Charter downloaded as ${kind === 'docx' ? 'Word' : 'PDF'}`);
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${project.title}”, its charter, timeline and status history? This cannot be undone.`)) return;
    await api.deleteProject(project.id);
    await refresh();
    toast('Project deleted');
    navigate('/projects');
  };

  const statusMenu = (
    <Menu
      trigger={(toggle, isOpen) => (
        <button className="btn btn-soft" onClick={toggle} disabled={busy === 'status'} aria-haspopup="menu" aria-expanded={isOpen}>
          {busy === 'status' ? 'Updating…' : 'Update Status'} <ChevronDown size={15} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="menu-label">Project status</div>
          {STATUSES.map((s) => (
            <button key={s} className={s === project.status ? 'on' : ''} onClick={() => { close(); void changeStatus(s); }}>
              <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s].color }} />
              {s}
              {s === project.status && <span className="small muted" style={{ marginLeft: 'auto' }}>current</span>}
            </button>
          ))}
        </>
      )}
    </Menu>
  );

  return (
    <>
      <div className="crumbs">
        <Link to={readOnly ? '/managers/projects' : '/projects'}>{readOnly ? 'SBF Projects' : 'All Projects'}</Link>
        <ChevronRight size={14} />
        <span>{project.title}</span>
      </div>
      {readOnly && <div className="filter-note" role="status">Read-only view for the MANAGERS account. Project, charter and timeline changes are made by the project team (IGNITE).</div>}

      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="detail-hero">
            <div className="status-pair">
              <div><span className="k">Project Status</span><StatusBadge status={project.status} large /></div>
              <div><span className="k">Charter Status</span><CharterBadge status={project.charter_status} large short /></div>
              <div><span className="k">Timeline Progress</span><span className="v">{tp.percent === null ? 'No activities' : `${tp.percent}% · ${tp.completed}/${tp.total} done`}</span></div>
            </div>
            <h1>{project.title}</h1>
            <p className="muted small">Created {formatDate(project.created_at)} · Updated {timeAgo(project.updated_at)}</p>
            <div className="detail-actions">
              {!readOnly && <button className="btn btn-primary" onClick={() => navigate(`/projects/${project.id}/edit`)}><Pencil size={15} /> Edit Project</button>}
              {!readOnly && statusMenu}
              <button className="btn btn-secondary" disabled={!hasLink} onClick={() => open(project.link)} title={hasLink ? project.link : 'No project link added'}>
                {canOpen || !hasLink ? <ExternalLink size={15} /> : <Copy size={15} />} {canOpen || !hasLink ? 'Open Project Link' : 'Copy Project Link'}
              </button>
              {!readOnly && (
                <button className="btn btn-accent" onClick={() => navigate(`/projects/${project.id}/charter`)}>
                  <FileText size={15} /> {charter ? 'Edit Project Charter' : 'Create Project Charter'}
                </button>
              )}
            </div>
          </div>
          <div className="meta-grid">
            <div className="meta"><div className="k">Project Owner</div><div className="v"><Person name={project.owner} /></div></div>
            <div className="meta"><div className="k">Functional Area</div><div className="v">{project.functional_area || <span className="empty-dash">—</span>}</div></div>
            <div className="meta"><div className="k">Operations Manager</div><div className="v"><Person name={project.ops_manager} alt /></div></div>
            <div className="meta"><div className="k">Project Status</div><div className="v"><StatusBadge status={project.status} /></div></div>
            <div className="meta"><div className="k">Date Created</div><div className="v">{formatDate(project.created_at, true)}</div></div>
            <div className="meta"><div className="k">Last Updated</div><div className="v">{formatDate(project.updated_at, true)}</div></div>
          </div>
        </section>

        <aside className="card">
          <div className="card-head">
            <div><h3>Project Charter</h3><p>{charter ? `Last saved ${timeAgo(project.charter!.updated_at)}` : 'Not started yet'}</p></div>
            <div className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
              <span className="small muted" style={{ fontWeight: 650 }}>Charter Status</span>
              <CharterBadge status={project.charter_status} short />
            </div>
          </div>
          {charter && completeness ? (
            <div className="card-body">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small" style={{ fontWeight: 650 }}>Charter Completeness</span>
                <span className="small" style={{ fontWeight: 700, color: 'var(--purple)' }}>{completeness.percent}%</span>
              </div>
              <div className="progress" style={{ marginBottom: 6 }}><i style={{ width: `${completeness.percent}%` }} /></div>
              <p className="small muted" style={{ marginBottom: 8 }}>How much of the charter document is filled in — not project delivery progress.</p>
              {completeness.sections.map((s) => (
                <div key={s.key} className="section-check">
                  {s.done === s.total ? <CheckCircle2 size={16} className="ok" /> : s.done ? <CircleDashed size={16} className="partial" /> : <Circle size={16} className="none" />}
                  {s.label}
                  <span className="n">{s.done}/{s.total}</span>
                </div>
              ))}
              <div className="stack" style={{ gap: 8, marginTop: 16 }}>
                {!readOnly && <button className="btn btn-primary" onClick={() => navigate(`/projects/${project.id}/charter`)}><Pencil size={15} /> Edit Project Charter</button>}
                <div className="row">
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled={!!busy} onClick={() => download('docx')}><FileDown size={15} /> {busy === 'docx' ? 'Preparing…' : 'Word'}</button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled={!!busy} onClick={() => download('pdf')}><FileDown size={15} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-body" style={{ textAlign: 'center' }}>
              <img src={CHARACTERS.alex} alt="" style={{ height: 150, margin: '4px auto 12px', display: 'block' }} />
              <p className="muted small" style={{ marginBottom: 14 }}>Define the problem, goals, key metrics, scope and CURES timeline in the SBF Project Charter.</p>
              {!readOnly && <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => navigate(`/projects/${project.id}/charter`)}><FileText size={15} /> Create Project Charter</button>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Create the charter first"><FileDown size={15} /> Word</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Create the charter first"><FileDown size={15} /> PDF</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="card" id="timeline" style={{ marginTop: 20 }}>
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="section-icon"><CalendarRange size={18} /></span>
            <div>
              <h2>Project Timeline / Gantt Chart</h2>
              <p>Generated from the CURES timeline activities · Project Status: <strong>{project.status}</strong></p>
            </div>
          </div>
          <div className="row wrap">
            {readOnly ? null : draft ? (
              <>
                <button className="btn btn-ghost" onClick={() => setDraft(null)} disabled={busy === 'timeline'}>Cancel</button>
                <button className="btn btn-primary" onClick={saveTimeline} disabled={busy === 'timeline'}><Save size={15} /> {busy === 'timeline' ? 'Saving…' : 'Save timeline'}</button>
              </>
            ) : (
              <button className="btn btn-soft" onClick={() => setDraft(project.timeline.length ? project.timeline : [emptyActivity()])}>
                {hasTimeline ? <><Pencil size={15} /> Edit timeline</> : <><Plus size={15} /> Add CURES activities</>}
              </button>
            )}
          </div>
        </div>

        {(hasTimeline || draft) && (
          <div className="gantt-summary">
            <div className="tp">
              <span className="k">Timeline Progress{draft ? ' (unsaved preview)' : ''}</span>
              <strong>{tpShown.percent === null ? '—' : `${tpShown.percent}%`}</strong>
              <span className="small muted">{tpShown.completed} of {tpShown.total} timeline task{tpShown.total === 1 ? '' : 's'} completed</span>
              <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${tpShown.percent ?? 0}%`, background: 'var(--turquoise)' }} /></div>
            </div>
            <TimelineStats activities={draft ?? project.timeline} />
            <GanttLegend />
          </div>
        )}
        {hasTimeline && !draft && <TimelineOverview activities={project.timeline} />}

        {draft ? (
          <div className="card-body stack">
            <TimelineEditor activities={draft} onChange={setDraft} />
            {enteredActivities(draft).length > 0 && (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>Preview</div>
                <Gantt activities={draft} />
              </div>
            )}
          </div>
        ) : hasTimeline ? (
          <div className="card-body" style={{ paddingTop: 8 }}>
            <Gantt activities={project.timeline} onStatusChange={readOnly ? undefined : changeActivityStatus} busyId={busy} />
            {!readOnly && <p className="small muted" style={{ marginTop: 10 }}>Tip: click an activity's status to update it. Activity statuses are independent of the project status.</p>}
          </div>
        ) : (
          <EmptyState
            image={CHARACTERS.iggy}
            title="No timeline activities yet."
            action={readOnly ? undefined : <button className="btn btn-primary" onClick={() => setDraft([emptyActivity()])}><Plus size={16} /> Add CURES timeline activities</button>}
          >
            Add activities to the CURES timeline to generate the Gantt chart.
          </EmptyState>
        )}
      </section>

      <div className="two-col" style={{ marginTop: 20 }}>
        <div className="stack">
          <section className="card">
            <div className="card-head"><h3>Description</h3></div>
            <div className="card-body">
              {project.description ? <p className="prose">{project.description}</p> : <p className="muted">No description yet.{!readOnly && <> <Link to={`/projects/${project.id}/edit`}>Add one</Link>.</>}</p>}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3>Project Link</h3></div>
            <div className="card-body">
              {hasLink ? (
                <div className="link-box">
                  <span style={{ flex: 1 }}>{project.link}</span>
                  {canOpen && <button className="btn btn-ghost btn-icon" title="Open" onClick={() => open(project.link)}><ExternalLink size={16} /></button>}
                  <button className="btn btn-ghost btn-icon" title="Copy" onClick={() => copy(project.link)}><Copy size={15} /></button>
                </div>
              ) : <p className="muted">No link added.{!readOnly && <> <Link to={`/projects/${project.id}/edit`}>Add a link</Link>.</>}</p>}
            </div>
          </section>
          {!readOnly && (
            <section>
              <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={14} /> Delete project</button>
            </section>
          )}
        </div>

        <section className="card">
          <div className="card-head">
            <div className="row" style={{ gap: 10 }}><History size={17} color="var(--purple)" /><div><h3>Project Status History</h3><p>Only project status changes are recorded</p></div></div>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {project.status_history.length ? (
              <ol className="history">
                {project.status_history.map((h) => (
                  <li key={h.id}>
                    <span className="h-dot" style={{ background: STATUS_META[h.to_status]?.color ?? '#999' }} />
                    <div className="h-line">
                      {h.from_status ? <><StatusBadge status={h.from_status} /><ArrowRight size={13} className="muted" /></> : null}
                      <StatusBadge status={h.to_status} />
                    </div>
                    <div className="small muted">
                      {formatDate(h.changed_at, true)}{h.changed_by ? ` · by ${h.changed_by}` : ''}{h.note ? ` · ${h.note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="muted small">No status changes recorded yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
