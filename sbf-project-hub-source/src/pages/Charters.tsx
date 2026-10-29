import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, FileText, Pencil, Plus, Search } from 'lucide-react';
import { api } from '../api';
import { BRAND, CHARACTERS } from '../characters';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { Person } from '../components/Person';
import { useProjects } from '../components/ProjectsContext';
import { useToast } from '../components/Toast';
import { CHARTER_META, CHARTER_STATUSES, type CharterStatus, type Project } from '../types';
import { normalizeCharter } from '../utils/charter';
import { downloadCharterDocx, downloadCharterPdf } from '../utils/exportCharter';
import { timeAgo } from '../utils/format';

export function Charters() {
  const { projects, loading, error } = useProjects();
  const navigate = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState<CharterStatus | ''>('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(CHARTER_STATUSES.map((s) => [s, projects.filter((p) => p.charter_status === s).length])) as Record<CharterStatus, number>,
    [projects],
  );

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const order = { 'In Progress': 0, Completed: 1, 'Not Started': 2 } as const;
    return projects
      .filter((p) => (!filter || p.charter_status === filter) && (!term || [p.title, p.owner, p.functional_area].some((v) => v.toLowerCase().includes(term))))
      .sort((a, b) => order[a.charter_status] - order[b.charter_status] || (b.charter_updated_at ?? '').localeCompare(a.charter_updated_at ?? '') || a.title.localeCompare(b.title));
  }, [projects, filter, q]);

  const download = async (p: Project, kind: 'docx' | 'pdf') => {
    setBusy(`${p.id}:${kind}`);
    try {
      const detail = await api.getProject(p.id);
      const data = normalizeCharter(detail.charter?.data, detail);
      await (kind === 'docx' ? downloadCharterDocx(data, detail.timeline) : downloadCharterPdf(data, detail.timeline));
      toast(`Downloaded ${p.title} charter`);
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="card" style={{ marginTop: 12, overflow: 'hidden', position: 'relative' }}>
        <div className="row wrap" style={{ alignItems: 'stretch', gap: 0 }}>
          <div style={{ flex: '1 1 420px', padding: '28px 30px' }}>
            <img src={BRAND.full} alt="Payment Integrity IGNITE" style={{ height: 46, display: 'block', marginBottom: 12 }} />
            <div className="eyebrow">Project Charters</div>
            <h1>Define, align and deliver</h1>
            <p className="muted" style={{ maxWidth: 520, marginTop: 6 }}>
              Every project has one SBF Project Charter. Continue where you left off, mark charters complete and download the latest version as Word or PDF.
              Charter Status is separate from Project Status — completing a charter never changes the project's status.
            </p>
            <div className="row wrap" style={{ marginTop: 20, gap: 12 }}>
              {CHARTER_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(filter === s ? '' : s)}
                  className="status-tile"
                  style={{ ['--tile-color' as string]: CHARTER_META[s].color, minWidth: 150, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', outline: filter === s ? `2px solid ${CHARTER_META[s].color}` : undefined }}
                >
                  <span className="tile-name">{s}</span>
                  <span className="tile-count" style={{ fontSize: 24 }}>{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: '0 0 300px', background: 'linear-gradient(160deg, var(--purple-pale), var(--cyan-pale))', display: 'grid', placeItems: 'end center', paddingTop: 16 }}>
            <img src={CHARACTERS.heroes} alt="" style={{ height: 230, display: 'block' }} />
          </div>
        </div>
      </section>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search by project, owner or area…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tabs" style={{ border: 0, padding: 0 }}>
            <button className={`tab${!filter ? ' active' : ''}`} onClick={() => setFilter('')}>All<span className="n">{projects.length}</span></button>
            {CHARTER_STATUSES.map((s) => (
              <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{s}<span className="n">{counts[s]}</span></button>
            ))}
          </div>
        </div>

        {loading ? <Loading /> : error ? <EmptyState image={CHARACTERS.corix} title="We couldn't load charters">{error}</EmptyState> : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Project</th><th>Owner</th><th>Project Status</th><th>Charter Status</th><th>Last saved</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const started = p.charter_status !== 'Not Started';
                  return (
                    <tr key={p.id} onClick={() => navigate(`/projects/${p.id}/charter`)}>
                      <td><span className="cell-title">{p.title}</span><span className="cell-desc">{p.functional_area || 'No functional area'}</span></td>
                      <td><Person name={p.owner} /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td><CharterBadge status={p.charter_status} short /></td>
                      <td className="small muted">{started ? timeAgo(p.charter_updated_at) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          {started ? (
                            <>
                              <button className="btn btn-soft btn-sm" onClick={() => navigate(`/projects/${p.id}/charter`)}><Pencil size={13} /> Edit</button>
                              <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => download(p, 'docx')} title="Download Word"><FileDown size={13} /> {busy === `${p.id}:docx` ? '…' : 'Word'}</button>
                              <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => download(p, 'pdf')} title="Download PDF"><FileDown size={13} /> {busy === `${p.id}:pdf` ? '…' : 'PDF'}</button>
                            </>
                          ) : (
                            <button className="btn btn-accent btn-sm" onClick={() => navigate(`/projects/${p.id}/charter`)}><FileText size={13} /> Start charter</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : projects.length ? (
          <EmptyState image={CHARACTERS.iggy} title="No charters match">Try a different search or charter status.</EmptyState>
        ) : (
          <EmptyState image={CHARACTERS.alex} title="No projects yet" action={<button className="btn btn-primary" onClick={() => navigate('/new')}><Plus size={16} /> Add Project / Idea</button>}>
            Charters are attached to projects. Add a project first, then build its charter.
          </EmptyState>
        )}
      </div>
    </>
  );
}
