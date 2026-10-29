import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { CHARACTERS } from '../characters';
import { EmptyState, Loading } from '../components/EmptyState';
import { ProjectTable } from '../components/ProjectTable';
import { useProjects } from '../components/ProjectsContext';
import { STATUSES } from '../types';
import {
  SORT_OPTIONS, VIEWS, countByStatus, distinct, filterProjects, sortProjects,
  type Filters, type SortDir, type SortKey,
} from '../utils/projectQuery';

const FILTER_LABELS: Record<Exclude<keyof Filters, 'q'>, string> = {
  status: 'Status',
  area: 'Functional Area',
  manager: 'Ops Manager',
  owner: 'Owner',
};

export function Projects() {
  const { projects, loading, error } = useProjects();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const filters: Filters = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    area: params.get('area') ?? '',
    manager: params.get('manager') ?? '',
    owner: params.get('owner') ?? '',
  };
  const [sortKey, sortDir] = (params.get('sort') ?? 'updated:desc').split(':') as [SortKey, SortDir];

  const set = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const onSort = (key: SortKey) => {
    const defaultDir: SortDir = key === 'updated' || key === 'created' ? 'desc' : 'asc';
    const dir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : defaultDir;
    set({ sort: `${key}:${dir}` });
  };

  const counts = useMemo(() => countByStatus(projects), [projects]);
  const options = useMemo(() => ({
    area: distinct(projects, 'functional_area'),
    manager: distinct(projects, 'ops_manager'),
    owner: distinct(projects, 'owner'),
  }), [projects]);

  const results = useMemo(
    () => sortProjects(filterProjects(projects, filters), sortKey, sortDir),
    [projects, params], // filters/sort are derived from params
  );

  const active = (Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[]).filter((k) => filters[k]);
  const anyFilter = active.length > 0 || !!filters.q;
  const view = VIEWS.find((v) => v.status === filters.status) ?? VIEWS[0];
  const sortValue = `${sortKey}:${sortDir}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Portfolio</div>
          <h1>{view.title}</h1>
          <p>Search, filter and sort every idea and project across the SBF Tower.</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button key={v.label} className={`tab${v.status === filters.status ? ' active' : ''}`} onClick={() => set({ status: v.status })}>
            {v.label}<span className="n">{v.status ? counts[v.status] : projects.length}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search title, description, people, link…" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          <select className="select" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={filters.area} onChange={(e) => set({ area: e.target.value })} aria-label="Functional Area">
            <option value="">All functional areas</option>
            {options.area.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={filters.manager} onChange={(e) => set({ manager: e.target.value })} aria-label="Operations Manager">
            <option value="">All ops managers</option>
            {options.manager.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={filters.owner} onChange={(e) => set({ owner: e.target.value })} aria-label="Project Owner">
            <option value="">All project owners</option>
            {options.owner.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={sortValue} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
            {!SORT_OPTIONS.some((o) => o.value === sortValue) && <option value={sortValue}>Custom column sort</option>}
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
        </div>

        {anyFilter && (
          <div className="active-filters">
            <span className="small muted" style={{ fontWeight: 600 }}>{results.length} result{results.length === 1 ? '' : 's'}</span>
            {filters.q && <button className="filter-pill" onClick={() => set({ q: '' })}>“{filters.q}” <X size={13} /></button>}
            {active.map((k) => (
              <button key={k} className="filter-pill" onClick={() => set({ [k]: '' })}>{FILTER_LABELS[k]}: {filters[k]} <X size={13} /></button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => set({ q: '', status: '', area: '', manager: '', owner: '' })}>Clear all</button>
          </div>
        )}

        {loading ? <Loading /> : error ? (
          <EmptyState image={CHARACTERS.corix} title="We couldn't load projects">{error}</EmptyState>
        ) : results.length ? (
          <>
            <ProjectTable projects={results} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <div className="table-foot">
              <span>{results.length} of {projects.length} project{projects.length === 1 ? '' : 's'}</span>
              <span>Select a row to open the project</span>
            </div>
          </>
        ) : projects.length ? (
          <EmptyState
            image={CHARACTERS.iggy}
            title="No projects match these filters"
            action={<button className="btn btn-secondary" onClick={() => set({ q: '', status: '', area: '', manager: '', owner: '' })}>Clear filters</button>}
          >
            Try a different search term or remove a filter to widen the results.
          </EmptyState>
        ) : (
          <EmptyState
            image={CHARACTERS.alex}
            title="No projects yet"
            action={<button className="btn btn-primary" onClick={() => navigate('/new')}><Plus size={16} /> Add Project / Idea</button>}
          >
            Start the SBF Tower portfolio by capturing the first idea or initiative.
          </EmptyState>
        )}
      </div>
    </>
  );
}
