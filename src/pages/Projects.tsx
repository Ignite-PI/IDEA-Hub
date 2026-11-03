import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { CHARACTERS } from '../characters';
import { EmptyState, Loading } from '../components/EmptyState';
import { ProjectTable } from '../components/ProjectTable';
import { MultiSelect } from '../components/MultiSelect';
import { useProjects } from '../components/ProjectsContext';
import { STATUSES } from '../types';
import {
  SORT_OPTIONS, VIEWS, countByStatus, distinct, filterProjects, needsTitle, sortProjects,
  type Filters, type SortDir, type SortKey,
} from '../utils/projectQuery';

const FILTER_LABELS: Record<Exclude<keyof Filters, 'q'>, string> = {
  status: 'Status',
  area: 'Functional Area',
  manager: 'Ops Manager',
  owner: 'Owner',
  needs: 'Needs',
};

export function Projects() {
  const { projects, loading, error } = useProjects();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // Multi-select filters live in the URL as repeated params (?status=Idea&status=Approved), so links keep working
  const filters: Filters = {
    q: params.get('q') ?? '',
    status: params.getAll('status').filter(Boolean),
    area: params.getAll('area').filter(Boolean),
    manager: params.getAll('manager').filter(Boolean),
    owner: params.getAll('owner').filter(Boolean),
    needs: params.get('needs') ?? '',
  };
  const needsTitleCount = projects.filter(needsTitle).length;
  const [sortKey, sortDir] = (params.get('sort') ?? 'updated:desc').split(':') as [SortKey, SortDir];

  const set = (updates: Record<string, string | string[]>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      next.delete(k);
      for (const x of Array.isArray(v) ? v : [v]) if (x) next.append(k, x);
    }
    setParams(next, { replace: true });
  };
  const clearAll = () => set({ q: '', status: [], area: [], manager: [], owner: [], needs: '' });

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

  // One removable pill per selected value
  const pills = (['status', 'area', 'manager', 'owner'] as const).flatMap((k) => filters[k].map((v) => ({ k, v })));
  const anyFilter = pills.length > 0 || !!filters.q || !!filters.needs;
  const singleStatus = filters.status.length === 1 ? filters.status[0] : filters.status.length ? null : '';
  const view = VIEWS.find((v) => v.status === singleStatus) ?? VIEWS[0];
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
          <button key={v.label} className={`tab${v.status === singleStatus ? ' active' : ''}`} onClick={() => set({ status: v.status })}>
            {v.label}<span className="n">{v.status ? counts[v.status] : projects.length}</span>
          </button>
        ))}
        <button className={`tab tab-warn${filters.needs === 'title' ? ' active' : ''}`} onClick={() => set({ needs: filters.needs === 'title' ? '' : 'title' })}
          title="Projects whose title still needs to be entered">
          <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Needs Project Title<span className="n">{needsTitleCount}</span>
        </button>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search title, description, people, link…" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          <MultiSelect label="Status" allLabel="All statuses" options={[...STATUSES]} value={filters.status} onChange={(v) => set({ status: v })} />
          <MultiSelect label="Functional Area" allLabel="All functional areas" options={options.area} value={filters.area} onChange={(v) => set({ area: v })} />
          <MultiSelect label="Operations Manager" allLabel="All ops managers" options={options.manager} value={filters.manager} onChange={(v) => set({ manager: v })} />
          <MultiSelect label="Project Owner" allLabel="All project owners" options={options.owner} value={filters.owner} onChange={(v) => set({ owner: v })} />
          <select className="select" value={sortValue} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
            {!SORT_OPTIONS.some((o) => o.value === sortValue) && <option value={sortValue}>Custom column sort</option>}
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
        </div>

        {anyFilter && (
          <div className="active-filters">
            <span className="small muted" style={{ fontWeight: 600 }}>{results.length} result{results.length === 1 ? '' : 's'}</span>
            {filters.q && <button className="filter-pill" onClick={() => set({ q: '' })}>“{filters.q}” <X size={13} /></button>}
            {filters.needs === 'title' && <button className="filter-pill" onClick={() => set({ needs: '' })}>Needs Project Title <X size={13} /></button>}
            {pills.map(({ k, v }) => (
              <button key={`${k}:${v}`} className="filter-pill" onClick={() => set({ [k]: filters[k].filter((x) => x !== v) })}>{FILTER_LABELS[k]}: {v} <X size={13} /></button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all</button>
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
            action={<button className="btn btn-secondary" onClick={clearAll}>Clear filters</button>}
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
