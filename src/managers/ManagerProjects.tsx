import { useNavigate } from 'react-router-dom';
import { CharterBadge, StatusBadge } from '../components/Badges';
import { useProjects } from '../components/ProjectsContext';
import { useSavings } from './SavingsContext';

/** Read-only list of SBF projects for the MANAGERS account, showing which ones are linked to a savings initiative. */
export function ManagerProjects() {
  const { projects } = useProjects();
  const { all } = useSavings();
  const navigate = useNavigate();
  const linked = new Map(all.filter((e) => e.row.project_id).map((e) => [e.row.project_id!, e]));
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><div className="eyebrow">Reference</div><h1>SBF Projects</h1><p>Read-only. Link a project to an initiative from the initiative's record.</p></div>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Project</th><th>Owner</th><th>Functional Area</th><th>Project Status</th><th>Charter Status</th><th>Savings initiative</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const e = linked.get(p.id);
                return (
                  <tr key={p.id} onClick={() => navigate(`/managers/projects/${p.id}`)}>
                    <td><span className="cell-title">{p.title}</span></td>
                    <td>{p.owner || '—'}</td>
                    <td>{p.functional_area || '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><CharterBadge status={p.charter_status} short /></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      {e ? <button className="btn btn-soft btn-sm" onClick={() => navigate(`/managers/input/${e.row.id}`)}>#{e.row.initiative_no} {e.resolved.initiative_name.value}</button> : <span className="muted small">Not linked</span>}
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
