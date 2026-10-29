import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDashed, Copy, ExternalLink, FileDown, FileText, Pencil, Trash2,
} from 'lucide-react';
import { api } from '../api';
import { CHARACTERS } from '../characters';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { useLinkActions } from '../components/LinkActions';
import { Menu } from '../components/Menu';
import { Person } from '../components/Person';
import { useProjects } from '../components/ProjectsContext';
import { useToast } from '../components/Toast';
import { STATUSES, STATUS_META, type ProjectDetail, type ProjectStatus } from '../types';
import { charterProgress, normalizeCharter } from '../utils/charter';
import { downloadCharterDocx, downloadCharterPdf } from '../utils/exportCharter';
import { formatDate, timeAgo } from '../utils/format';
import { resolveLink } from '../utils/links';

export function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useProjects();
  const { open, copy } = useLinkActions();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
  const progress = charter ? charterProgress(charter) : null;
  const hasLink = !!project.link.trim();
  const canOpen = hasLink && !!resolveLink(project.link).href;

  const changeStatus = async (status: ProjectStatus) => {
    if (status === project.status) return;
    setBusy('status');
    try {
      setProject(await api.updateStatus(project.id, status));
      await refresh();
      toast(`Status updated to ${status}`);
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
      await (kind === 'docx' ? downloadCharterDocx(charter) : downloadCharterPdf(charter));
      toast(`Charter downloaded as ${kind === 'docx' ? 'Word' : 'PDF'}`);
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${project.title}” and its charter? This cannot be undone.`)) return;
    await api.deleteProject(project.id);
    await refresh();
    toast('Project deleted');
    navigate('/projects');
  };

  return (
    <>
      <div className="crumbs">
        <Link to="/projects">All Projects</Link>
        <ChevronRight size={14} />
        <span>{project.title}</span>
      </div>

      <div className="two-col" style={{ marginTop: 12 }}>
        <div className="stack">
          <section className="card">
            <div className="detail-hero">
              <div className="row wrap">
                <StatusBadge status={project.status} large />
                <CharterBadge status={project.charter_status} large />
              </div>
              <h1>{project.title}</h1>
              <p className="muted small">Created {formatDate(project.created_at)} · Updated {timeAgo(project.updated_at)}</p>
              <div className="detail-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/projects/${project.id}/edit`)}><Pencil size={15} /> Edit Project</button>
                <button className="btn btn-secondary" disabled={!hasLink} onClick={() => open(project.link)} title={hasLink ? project.link : 'No project link added'}>
                  {canOpen || !hasLink ? <ExternalLink size={15} /> : <Copy size={15} />} {canOpen || !hasLink ? 'Open Project Link' : 'Copy Project Link'}
                </button>
                <button className="btn btn-accent" onClick={() => navigate(`/projects/${project.id}/charter`)}>
                  <FileText size={15} /> {charter ? 'Edit Project Charter' : 'Create Project Charter'}
                </button>
                <Menu
                  trigger={(toggle) => (
                    <button className="btn btn-soft" onClick={toggle} disabled={busy === 'status'}>
                      Update status <ChevronDown size={15} />
                    </button>
                  )}
                >
                  {(close) => STATUSES.map((s) => (
                    <button key={s} className={s === project.status ? 'on' : ''} onClick={() => { close(); void changeStatus(s); }}>
                      <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s].color }} />
                      {s}
                    </button>
                  ))}
                </Menu>
              </div>
            </div>
            <div className="meta-grid">
              <div className="meta"><div className="k">Project Owner</div><div className="v"><Person name={project.owner} /></div></div>
              <div className="meta"><div className="k">Functional Area</div><div className="v">{project.functional_area || <span className="empty-dash">—</span>}</div></div>
              <div className="meta"><div className="k">Operations Manager</div><div className="v"><Person name={project.ops_manager} alt /></div></div>
              <div className="meta"><div className="k">Status</div><div className="v"><StatusBadge status={project.status} /></div></div>
              <div className="meta"><div className="k">Date Created</div><div className="v">{formatDate(project.created_at, true)}</div></div>
              <div className="meta"><div className="k">Last Updated</div><div className="v">{formatDate(project.updated_at, true)}</div></div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3>Description</h3></div>
            <div className="card-body">
              {project.description ? <p className="prose">{project.description}</p> : <p className="muted">No description yet. <Link to={`/projects/${project.id}/edit`}>Add one</Link>.</p>}
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
              ) : <p className="muted">No link added. <Link to={`/projects/${project.id}/edit`}>Add a link</Link>.</p>}
            </div>
          </section>

          <section>
            <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={14} /> Delete project</button>
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-head">
              <div><h3>Project Charter</h3><p>{charter ? `Last saved ${timeAgo(project.charter!.updated_at)}` : 'Not started yet'}</p></div>
              <CharterBadge status={project.charter_status} />
            </div>
            {charter && progress ? (
              <div className="card-body">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="small" style={{ fontWeight: 650 }}>Completeness</span>
                  <span className="small" style={{ fontWeight: 700, color: 'var(--purple)' }}>{progress.percent}%</span>
                </div>
                <div className="progress" style={{ marginBottom: 14 }}><i style={{ width: `${progress.percent}%` }} /></div>
                {progress.sections.map((s) => (
                  <div key={s.key} className="section-check">
                    {s.done === s.total ? <CheckCircle2 size={16} className="ok" /> : s.done ? <CircleDashed size={16} className="partial" /> : <Circle size={16} className="none" />}
                    {s.label}
                    <span className="n">{s.done}/{s.total}</span>
                  </div>
                ))}
                <div className="stack" style={{ gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => navigate(`/projects/${project.id}/charter`)}><Pencil size={15} /> Edit Project Charter</button>
                  <div className="row">
                    <button className="btn btn-secondary" style={{ flex: 1 }} disabled={!!busy} onClick={() => download('docx')}><FileDown size={15} /> {busy === 'docx' ? 'Preparing…' : 'Word'}</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} disabled={!!busy} onClick={() => download('pdf')}><FileDown size={15} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-body" style={{ textAlign: 'center' }}>
                <img src={CHARACTERS.alex} alt="" style={{ height: 170, margin: '4px auto 12px', display: 'block' }} />
                <p className="muted small" style={{ marginBottom: 14 }}>Define the problem, goals, scope, RACI and timeline in the SBF Project Charter.</p>
                <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => navigate(`/projects/${project.id}/charter`)}><FileText size={15} /> Create Project Charter</button>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Create the charter first"><FileDown size={15} /> Word</button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Create the charter first"><FileDown size={15} /> PDF</button>
                </div>
              </div>
            )}
          </section>

          {charter && (charter.problemStatement || charter.executiveSponsor || charter.executionLead) && (
            <section className="card">
              <div className="card-head"><h3>Charter snapshot</h3></div>
              <div className="card-body stack" style={{ gap: 12 }}>
                {charter.executiveSponsor && <div><div className="label muted">Executive Sponsor</div><div>{charter.executiveSponsor}</div></div>}
                {charter.executionLead && <div><div className="label muted">Execution Lead</div><div>{charter.executionLead}</div></div>}
                {charter.problemStatement && <div><div className="label muted">Problem Statement</div><p className="prose small" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{charter.problemStatement}</p></div>}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
