import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Plus, Save } from 'lucide-react';
import { api } from '../api';
import { CHARACTERS } from '../characters';
import { EmptyState, Loading } from '../components/EmptyState';
import { useProjects } from '../components/ProjectsContext';
import { useToast } from '../components/Toast';
import { STATUSES, STATUS_META, type ProjectDetail, type ProjectInput } from '../types';
import { distinct } from '../utils/projectQuery';

const BLANK: ProjectInput = { title: '', description: '', owner: '', functional_area: '', ops_manager: '', status: 'Idea', link: '' };

export function ProjectForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { projects, refresh } = useProjects();

  const [form, setForm] = useState<ProjectInput>(BLANK);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    if (!id) { setForm(BLANK); setCreated(null); setTouched(false); return; }
    setLoading(true);
    api.getProject(id)
      .then((p) => setForm({ title: p.title, description: p.description, owner: p.owner, functional_area: p.functional_area, ops_manager: p.ops_manager, status: p.status, link: p.link }))
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const suggestions = useMemo(() => ({
    owner: distinct(projects, 'owner'),
    area: distinct(projects, 'functional_area'),
    manager: distinct(projects, 'ops_manager'),
  }), [projects]);

  const update = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const titleError = touched && !form.title.trim() ? 'Project Title is required.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateProject(id!, form);
        await refresh();
        toast('Project saved');
        navigate(`/projects/${id}`);
      } else {
        const p = await api.createProject(form);
        await refresh();
        setCreated(p);
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (loadError) return <div className="card" style={{ marginTop: 20 }}><EmptyState image={CHARACTERS.corix} title="Project not found">{loadError}</EmptyState></div>;

  if (created) {
    return (
      <div className="card success" style={{ marginTop: 20 }}>
        <img src={CHARACTERS.ecobi} alt="" />
        <div>
          <div className="eyebrow">Saved to the portfolio</div>
          <h1>“{created.title}” has been added</h1>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto 22px 0' }}>
            It now appears on the dashboard as <strong>{created.status}</strong>. When you're ready, start the Project Charter to define scope, RACI and the timeline.
          </p>
          <div className="row wrap">
            <button className="btn btn-primary" onClick={() => navigate(`/projects/${created.id}`)}>View project</button>
            <button className="btn btn-accent" onClick={() => navigate(`/projects/${created.id}/charter`)}><FileText size={16} /> Start Project Charter</button>
            <button className="btn btn-secondary" onClick={() => { setForm(BLANK); setCreated(null); setTouched(false); }}><Plus size={16} /> Add another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="crumbs">
        <Link to="/projects">All Projects</Link>
        <ChevronRight size={14} />
        {editing ? <><Link to={`/projects/${id}`}>{form.title || 'Project'}</Link><ChevronRight size={14} /><span>Edit</span></> : <span>New</span>}
      </div>
      <div className="page-head">
        <div>
          <h1>{editing ? 'Edit project' : 'Add a project or idea'}</h1>
          <p>{editing ? 'Update the details below and save your changes.' : 'Only the title is required — you can fill in the rest as the idea matures.'}</p>
        </div>
      </div>

      <form className="two-col" onSubmit={submit} noValidate>
        <div className="card">
          <div className="card-body">
            <div className="form-grid">
              <div className={`field full${titleError ? ' invalid' : ''}`}>
                <label htmlFor="title">Project Title<span className="req">*</span></label>
                <input id="title" className="input" autoFocus value={form.title} onChange={(e) => update('title', e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. Automate claims intake triage" maxLength={200} />
                {titleError && <span className="error">{titleError}</span>}
              </div>
              <div className="field full">
                <label htmlFor="desc">Project Description</label>
                <textarea id="desc" className="textarea" rows={5} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What is the idea, what problem does it solve, and who benefits?" />
              </div>
              <div className="field">
                <label htmlFor="owner">Project Owner</label>
                <input id="owner" className="input" list="owners" value={form.owner} onChange={(e) => update('owner', e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label htmlFor="area">Functional Area</label>
                <input id="area" className="input" list="areas" value={form.functional_area} onChange={(e) => update('functional_area', e.target.value)} placeholder="e.g. Claims, Enrollment, Billing" />
              </div>
              <div className="field">
                <label htmlFor="mgr">Operations Manager</label>
                <input id="mgr" className="input" list="managers" value={form.ops_manager} onChange={(e) => update('ops_manager', e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label htmlFor="link">Project Link</label>
                <input id="link" className="input" value={form.link} onChange={(e) => update('link', e.target.value)} placeholder="URL, SharePoint, \\server\share, app link…" />
                <span className="hint">Any reference works — web, SharePoint, network path or app link.</span>
              </div>
              <div className="field full">
                <span className="label">Project Status</span>
                <div className="status-picker" role="radiogroup" aria-label="Project Status">
                  {STATUSES.map((s) => {
                    const m = STATUS_META[s];
                    const on = form.status === s;
                    const style = { '--opt-color': m.color, '--opt-bg': m.solid ? m.color : m.bg, '--opt-fg': m.fg } as CSSProperties;
                    return (
                      <button type="button" key={s} role="radio" aria-checked={on} className={`status-opt${on ? ' on' : ''}`} style={style} onClick={() => update('status', s)}>
                        <span className="dot" style={{ background: on && m.solid ? '#fff' : m.color }} />{s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="card-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => (editing ? navigate(`/projects/${id}`) : navigate(-1))}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : editing ? 'Save changes' : 'Create project'}</button>
          </div>
        </div>

        <aside className="side-art">
          <h3>{editing ? 'Keep it current' : 'From spark to delivery'}</h3>
          <p className="small muted">{editing ? 'Up-to-date status and ownership keeps leadership views accurate.' : 'Every great improvement starts as an idea. Capture it now and refine it later.'}</p>
          <ul>
            <li>Use a short, specific title</li>
            <li>Pick the stage that matches today</li>
            <li>Paste any type of link or path</li>
            <li>Add a charter once it's assessed</li>
          </ul>
          <img src={editing ? CHARACTERS.alex : CHARACTERS.iggy} alt="" />
        </aside>
      </form>

      <datalist id="owners">{suggestions.owner.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="areas">{suggestions.area.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="managers">{suggestions.manager.map((s) => <option key={s} value={s} />)}</datalist>
    </>
  );
}
