import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderKanban, Plus } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHARACTERS } from '../characters';
import { StatusBadge } from '../components/Badges';
import { EmptyState, Loading } from '../components/EmptyState';
import { ProjectTable } from '../components/ProjectTable';
import { useProjects } from '../components/ProjectsContext';
import { StatusIcon } from '../components/StatusIcon';
import { CHARTER_META, CHARTER_STATUSES, STATUSES, STATUS_META } from '../types';
import { timeAgo } from '../utils/format';
import { VIEWS, countByStatus, sortProjects } from '../utils/projectQuery';

export function Dashboard() {
  const { projects, loading, error } = useProjects();
  const navigate = useNavigate();
  const [view, setView] = useState(0);

  const counts = useMemo(() => countByStatus(projects), [projects]);
  const total = projects.length;
  const active = counts.Approved + counts['In Delivery'];
  const chartersDone = projects.filter((p) => p.charter_status === 'Completed').length;

  const charterData = CHARTER_STATUSES.map((s) => ({ name: s, value: projects.filter((p) => p.charter_status === s).length, color: CHARTER_META[s].color }));
  const pipelineData = STATUSES.map((s) => ({ name: s, value: counts[s], color: STATUS_META[s].color }));

  const areas = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const p of projects) {
      const key = p.functional_area || 'Unassigned';
      const row = map.get(key) ?? {};
      row[p.status] = (row[p.status] ?? 0) + 1;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([name, byStatus]) => ({ name, byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
  }, [projects]);
  const maxArea = Math.max(1, ...areas.map((a) => a.total));

  const recent = useMemo(() => sortProjects(projects, 'updated', 'desc').slice(0, 6), [projects]);
  const viewProjects = useMemo(() => {
    const s = VIEWS[view].status;
    return sortProjects(projects.filter((p) => !s || p.status === s), 'updated', 'desc');
  }, [projects, view]);

  return (
    <div className="stack">
      <section className="hero" style={{ marginTop: 12 }}>
        <div className="hero-copy">
          <span className="hero-tag"><i /> SBF Tower · Ideas & Improvement Portfolio</span>
          <h1>Every idea, initiative and project — in one place.</h1>
          <p>Track the SBF Tower portfolio from first spark to implementation, keep project charters current, and give leadership a clear view at a glance.</p>
          <div className="hero-stats">
            <div className="hero-stat"><strong>{total}</strong><span>In portfolio</span></div>
            <div className="hero-stat"><strong>{active}</strong><span>Approved & in delivery</span></div>
            <div className="hero-stat"><strong>{counts.Implemented}</strong><span>Implemented</span></div>
            <div className="hero-stat"><strong>{chartersDone}</strong><span>Charters completed</span></div>
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button className="btn btn-white" onClick={() => navigate('/new')}><Plus size={16} /> Add Project / Idea</button>
            <button className="btn btn-glass" onClick={() => navigate('/projects')}><FolderKanban size={16} /> Browse portfolio</button>
          </div>
        </div>
        <div className="hero-art"><img src={CHARACTERS.team} alt="SBF Tower characters" /></div>
      </section>

      {loading ? <Loading label="Loading portfolio…" /> : error ? (
        <div className="card"><EmptyState image={CHARACTERS.corix} title="We couldn't reach the portfolio service">{error}. Make sure the SBF Tower server is running, then refresh.</EmptyState></div>
      ) : (
        <>
          <section>
            <div className="page-head" style={{ margin: '8px 0 14px' }}>
              <div>
                <h2>Portfolio by status</h2>
                <p>Select a status to see the projects behind the number.</p>
              </div>
            </div>
            <div className="status-grid">
              {STATUSES.map((s) => {
                const m = STATUS_META[s];
                const style = { '--tile-color': m.color, '--tile-bg': m.solid ? m.color : m.bg, '--tile-fg': m.solid ? '#fff' : m.fg } as CSSProperties;
                return (
                  <Link key={s} to={`/projects?status=${encodeURIComponent(s)}`} className="status-tile" style={style}>
                    <div className="tile-top">
                      <span className="tile-name">{s}</span>
                      <span className="tile-icon"><StatusIcon status={s} size={16} /></span>
                    </div>
                    <span className="tile-count">{counts[s]}</span>
                    <div className="bar"><i style={{ width: `${total ? (counts[s] / total) * 100 : 0}%` }} /></div>
                    <span className="tile-blurb">{m.blurb}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {total === 0 ? (
            <div className="card">
              <EmptyState
                image={CHARACTERS.alex}
                title="Your portfolio is ready for its first idea"
                action={<button className="btn btn-primary" onClick={() => navigate('/new')}><Plus size={16} /> Add the first project</button>}
              >
                Capture an idea or improvement initiative and it will appear here, with its status, owner and charter progress.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="grid split">
                <div className="card">
                  <div className="card-head"><div><h3>Pipeline</h3><p>Projects at each stage, from idea to implementation</p></div></div>
                  <div className="card-body" style={{ height: 290 }}>
                    <ResponsiveContainer>
                      <BarChart data={pipelineData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
                        <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#6b6680' }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: '#9a95ab' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#f5f2ff' }} contentStyle={{ borderRadius: 12, border: '1px solid #e9e6f0', boxShadow: '0 8px 24px -8px rgba(43,27,73,.2)' }} />
                        <Bar dataKey="value" name="Projects" radius={[8, 8, 3, 3]} isAnimationActive={false} onClick={(d: { name?: string }) => d.name && navigate(`/projects?status=${encodeURIComponent(d.name)}`)} style={{ cursor: 'pointer' }}>
                          {pipelineData.map((d) => <Cell key={d.name} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><div><h3>Charter coverage</h3><p>How many projects have a charter</p></div></div>
                  <div className="card-body row" style={{ gap: 20, alignItems: 'center' }}>
                    <div style={{ width: 160, height: 160, position: 'relative', flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={charterData} dataKey="value" isAnimationActive={false} innerRadius={52} outerRadius={76} paddingAngle={charterData.filter((d) => d.value).length > 1 ? 3 : 0} stroke="none">
                            {charterData.map((d) => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                        <div><strong style={{ fontSize: 24, display: 'block', lineHeight: 1 }}>{Math.round((chartersDone / total) * 100)}%</strong><span className="small muted">completed</span></div>
                      </div>
                    </div>
                    <div className="chart-legend" style={{ flex: 1 }}>
                      {charterData.map((d) => (
                        <div key={d.name} className="legend-row"><span className="sw" style={{ background: d.color }} />{d.name}<b>{d.value}</b></div>
                      ))}
                      <Link to="/charters" className="small" style={{ fontWeight: 600, marginTop: 4 }}>Manage charters <ArrowRight size={12} style={{ verticalAlign: -2 }} /></Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid split">
                <div className="card">
                  <div className="card-head"><div><h3>By functional area</h3><p>Where ideas and projects are coming from</p></div></div>
                  <div className="card-body">
                    {areas.map((a) => (
                      <div key={a.name} className="area-row">
                        <span className="area-name" title={a.name}>{a.name}</span>
                        <div className="track" style={{ width: `${(a.total / maxArea) * 100}%` }}>
                          {STATUSES.filter((s) => a.byStatus[s]).map((s) => (
                            <i key={s} title={`${s}: ${a.byStatus[s]}`} style={{ width: `${(a.byStatus[s] / a.total) * 100}%`, background: STATUS_META[s].color }} />
                          ))}
                        </div>
                        <b style={{ textAlign: 'right' }}>{a.total}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><div><h3>Recently updated</h3><p>Latest movement in the portfolio</p></div></div>
                  <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
                    {recent.map((p) => (
                      <div key={p.id} className="activity" onClick={() => navigate(`/projects/${p.id}`)}>
                        <span className="tile-icon" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: STATUS_META[p.status].bg, color: STATUS_META[p.status].fg, flexShrink: 0 }}>
                          <StatusIcon status={p.status} size={15} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="a-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                          <div className="a-meta">{p.owner || 'No owner'} · {timeAgo(p.updated_at)}</div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <section className="card">
                <div className="card-head" style={{ flexWrap: 'wrap' }}>
                  <div><h3>Portfolio views</h3><p>{VIEWS[view].title} · {viewProjects.length} item{viewProjects.length === 1 ? '' : 's'}</p></div>
                  <Link className="btn btn-soft btn-sm" to={`/projects${VIEWS[view].status ? `?status=${encodeURIComponent(VIEWS[view].status)}` : ''}`}>
                    Open full view <ArrowRight size={14} />
                  </Link>
                </div>
                <div style={{ padding: '14px 20px 0' }}>
                  <div className="tabs">
                    {VIEWS.map((v, i) => (
                      <button key={v.label} className={`tab${i === view ? ' active' : ''}`} onClick={() => setView(i)}>
                        {v.label}<span className="n">{v.status ? counts[v.status] : total}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ paddingTop: 10 }}>
                  {viewProjects.length ? (
                    <>
                      <ProjectTable projects={viewProjects.slice(0, 6)} compact />
                      {viewProjects.length > 6 && (
                        <div className="table-foot">
                          Showing 6 of {viewProjects.length}
                          <Link to={`/projects${VIEWS[view].status ? `?status=${encodeURIComponent(VIEWS[view].status)}` : ''}`} style={{ fontWeight: 600 }}>View all</Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState image={CHARACTERS.ecobi} title={`No ${VIEWS[view].title.toLowerCase()} right now`}>
                      Projects will show up here as soon as they move into this stage.
                    </EmptyState>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
