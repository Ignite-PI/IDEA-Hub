import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { CHARACTERS } from '../characters';
import { EmptyState, Loading } from '../components/EmptyState';
import { ProjectTable } from '../components/ProjectTable';
import { MultiSelect } from '../components/MultiSelect';
import { useProjects } from '../components/ProjectsContext';
import { useBase } from '../components/BasePath';
import { BUSINESS_FUNCTIONS, CHARTER_STATUSES, NEEDS_BF, STATUSES, bfLabel, type BusinessFunction, type Project } from '../types';
import {
  SORT_OPTIONS, VIEWS, countByStatus, distinct, filterProjects, needsTitle, sortProjects,
  type Filters, type SortDir, type SortKey,
} from '../utils/projectQuery';

const MULTI = ['bf', 'status', 'area', 'manager', 'owner', 'charter'] as const;
type MultiKey = typeof MULTI[number];
const FILTER_LABELS: Record<MultiKey, string> = {
  bf: 'Business Function', status: 'Status', area: 'Functional Area', manager: 'Ops Manager', owner: 'Owner', charter: 'Charter',
};
const BF_LABELS: Record<string, string> = { clinical: 'Clinical Functions', sbf: 'Specialized Business Functions', none: NEEDS_BF };
export type Portfolio = 'all' | BusinessFunction;
const PORTFOLIOS: { key: Portfolio; label: string }[] = [
  { key: 'all', label: 'All Clinical Tower Projects' },
  ...BUSINESS_FUNCTIONS.map((b) => ({ key: b.code as Portfolio, label: b.label })),
];

/**
 * Project portfolio list: IGNITE "All Projects" (no portfolio prop) and the MANAGERS Clinical Tower Projects dashboards
 * (portfolio = all | clinical | sbf). Same project records, same filters: OR within a filter, AND across filters.
 */
export function Projects({ portfolio }: { portfolio?: Portfolio } = {}) {
  const { projects: allProjects, loading, error } = useProjects();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const base = useBase();
  const projects = useMemo(
    () => (!portfolio || portfolio === 'all' ? allProjects : allProjects.filter((p) => p.business_function === portfolio)),
    [allProjects, portfolio],
  );

  // Multi-select filters live in the URL as repeated params (?status=Idea&status=Approved), so links keep working
  const filters: Filters = {
    q: params.get('q') ?? '',
    bf: params.getAll('bf').filter(Boolean),
    status: params.getAll('status').filter(Boolean),
    area: params.getAll('area').filter(Boolean),
    manager: params.getAll('manager').filter(Boolean),
    owner: params.getAll('owner').filter(Boolean),
    charter: params.getAll('charter').filter(Boolean),
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
  const clearAll = () => set({ q: '', needs: '', ...Object.fromEntries(MULTI.map((k) => [k, []])) });

  const onSort = (key: SortKey) => {
    const defaultDir: SortDir = key === 'updated' || key === 'created' ? 'desc' : 'asc';
    const dir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : defaultDir;
    set({ sort: `${key}:${dir}` });
  };

  const counts = useMemo(() => countByStatus(projects), [projects]);
  // Filter options come from the real project records (deduplicated)
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
  const pills = MULTI.flatMap((k) => filters[k].map((v) => ({ k, v })));
  const anyFilter = pills.length > 0 || !!filters.q || !!filters.needs;
  const singleStatus = filters.status.length === 1 ? filters.status[0] : filters.status.length ? null : '';
  const view = VIEWS.find((v) => v.status === singleStatus) ?? VIEWS[0];
  const sortValue = `${sortKey}:${sortDir}`;
  const showBfFilter = !portfolio || portfolio === 'all';
  const needsBf = projects.filter((p) => !p.business_function).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{portfolio ? 'Clinical Tower Projects' : 'Portfolio'}</div>
          <h1>{portfolio ? PORTFOLIOS.find((x) => x.key === portfolio)!.label : view.title}</h1>
          <p>{portfolio ? 'The same project records IGNITE uses. Open a project to view or update it, its Project Charter, CURES timeline and decks.' : 'Search, filter and sort every idea and project across the Clinical Towers.'}</p>
        </div>
      </div>

      {portfolio && <PortfolioSummary all={allProjects} scoped={projects} portfolio={portfolio} base={base} />}

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
        {showBfFilter && (
          <button className={`tab tab-warn${filters.bf.length === 1 && filters.bf[0] === 'none' ? ' active' : ''}`}
            onClick={() => set({ bf: filters.bf.length === 1 && filters.bf[0] === 'none' ? [] : ['none'] })} title="Projects without a Business Function">
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {NEEDS_BF}<span className="n">{needsBf}</span>
          </button>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search title, description, people, link…" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          {showBfFilter && <MultiSelect label="Business Function" allLabel="All business functions" options={['clinical', 'sbf', 'none']} labels={BF_LABELS} value={filters.bf} onChange={(v) => set({ bf: v })} />}
          <MultiSelect label="Status" allLabel="All statuses" options={[...STATUSES]} value={filters.status} onChange={(v) => set({ status: v })} />
          <MultiSelect label="Functional Area" allLabel="All functional areas" options={options.area} value={filters.area} onChange={(v) => set({ area: v })} />
          <MultiSelect label="Operations Manager" allLabel="All ops managers" options={options.manager} value={filters.manager} onChange={(v) => set({ manager: v })} />
          <MultiSelect label="Project Owner" allLabel="All project owners" options={options.owner} value={filters.owner} onChange={(v) => set({ owner: v })} />
          <MultiSelect label="Charter Status" allLabel="All charter statuses" options={[...CHARTER_STATUSES]} value={filters.charter} onChange={(v) => set({ charter: v })} />
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
              <button key={`${k}:${v}`} className="filter-pill" onClick={() => set({ [k]: filters[k].filter((x) => x !== v) })}>
                {FILTER_LABELS[k]}: {k === 'bf' ? BF_LABELS[v] ?? v : v} <X size={13} />
              </button>
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
          <EmptyState image={CHARACTERS.iggy} title="No projects match these filters"
            action={<button className="btn btn-secondary" onClick={clearAll}>Clear filters</button>}>
            Try a different search term or remove a filter to widen the results.
          </EmptyState>
        ) : (
          <EmptyState image={CHARACTERS.alex} title={portfolio && portfolio !== 'all' ? `No ${bfLabel(portfolio)} projects yet` : 'No projects yet'}
            action={<button className="btn btn-primary" onClick={() => navigate(`${base}/new`)}><Plus size={16} /> Add Project / Idea</button>}>
            {portfolio && portfolio !== 'all'
              ? `Projects appear here once their Business Function is set to ${bfLabel(portfolio)} (Edit Project or Project Charter).`
              : 'Start the Clinical Towers portfolio by capturing the first idea or initiative.'}
          </EmptyState>
        )}
      </div>
    </>
  );
}

/** Portfolio switcher (All / Clinical Functions / Specialized Business Functions) + KPI cards from real records. */
function PortfolioSummary({ all, scoped, portfolio, base }: { all: Project[]; scoped: Project[]; portfolio: Portfolio; base: string }) {
  const count = (k: Portfolio) => (k === 'all' ? all.length : all.filter((p) => p.business_function === k).length);
  const needsBf = all.filter((p) => !p.business_function).length;
  const charterDone = scoped.filter((p) => p.charter_status === 'Completed').length;
  const withTimeline = scoped.filter((p) => p.timeline_total > 0);
  const avgTimeline = withTimeline.length
    ? Math.round(withTimeline.reduce((s, p) => s + (p.timeline_completed / p.timeline_total) * 100, 0) / withTimeline.length) : null;
  const active = scoped.filter((p) => ['Approved', 'In Delivery'].includes(p.status)).length;
  return (
    <>
      <div className="portfolio-tabs" role="tablist" aria-label="Clinical Tower Projects portfolio">
        {PORTFOLIOS.map((x) => (
          <Link key={x.key} role="tab" aria-selected={x.key === portfolio} className={`portfolio-tab${x.key === portfolio ? ' active' : ''}`} to={`${base}/portfolio/${x.key}`}>
            <span className="small muted">{x.label}</span><b>{count(x.key)}</b>
          </Link>
        ))}
      </div>
      {needsBf > 0 && (
        <p className="small" style={{ margin: '-6px 0 12px', color: '#7d1f3d' }}>
          <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {needsBf} project{needsBf === 1 ? '' : 's'} {needsBf === 1 ? 'has' : 'have'} no Business Function yet ({NEEDS_BF}) — {needsBf === 1 ? 'it is' : 'they are'} counted in All but not in either portfolio.
        </p>
      )}
      <div className="kpi-row">
        <div className="kpi-mini"><b>{scoped.length}</b><span>Projects</span></div>
        <div className="kpi-mini"><b>{active}</b><span>Approved / In Delivery</span></div>
        <div className="kpi-mini"><b>{charterDone}</b><span>Project Charters completed</span></div>
        <div className="kpi-mini"><b>{withTimeline.length}</b><span>With a CURES timeline</span></div>
        <div className="kpi-mini"><b>{avgTimeline === null ? '—' : `${avgTimeline}%`}</b><span>Average timeline progress</span></div>
      </div>
    </>
  );
}
