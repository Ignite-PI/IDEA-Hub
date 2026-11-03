import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { needsTitle, type SortDir, type SortKey } from '../utils/projectQuery';
import { BusinessFunctionBadge, CharterBadge, StatusBadge } from './Badges';
import { useBase } from './BasePath';
import { LinkIconButtons } from './LinkActions';
import { Person } from './Person';

interface Props {
  projects: Project[];
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (key: SortKey) => void;
  compact?: boolean;
}

const COLUMNS: { key: SortKey | null; label: string; compactHide?: boolean }[] = [
  { key: 'title', label: 'Project' },
  { key: null, label: 'Business Function', compactHide: true },
  { key: 'owner', label: 'Project Owner' },
  { key: 'functional_area', label: 'Functional Area' },
  { key: 'ops_manager', label: 'Operations Manager', compactHide: true },
  { key: 'status', label: 'Project Status' },
  { key: null, label: 'Link' },
  { key: 'charter', label: 'Charter Status' },
  { key: null, label: 'Timeline Progress', compactHide: true },
];

export function ProjectTable({ projects, sortKey, sortDir, onSort, compact }: Props) {
  const navigate = useNavigate();
  const base = useBase();
  const cols = COLUMNS.filter((c) => !(compact && c.compactHide));

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map((c) => {
              const sortable = !!(onSort && c.key);
              const sorted = sortable && sortKey === c.key;
              return (
                <th
                  key={c.label}
                  className={`${sortable ? 'sortable' : ''} ${sorted ? 'sorted' : ''}`}
                  onClick={sortable ? () => onSort!(c.key!) : undefined}
                  aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.label}
                  {sortable && (
                    <span className="sort-ind">
                      {sorted ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} onClick={() => navigate(`${base}/projects/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`${base}/projects/${p.id}`)}>
              <td style={{ minWidth: 200 }}>
                <span className="cell-title">
                  {needsTitle(p) ? <span className="needs-pill"><AlertTriangle size={12} aria-hidden /> Needs Project Title</span> : p.title}
                </span>
                <span className="cell-desc">{p.description || <span className="empty-dash">No description</span>}</span>
              </td>
              {!compact && <td><BusinessFunctionBadge code={p.business_function} /></td>}
              <td><Person name={p.owner} /></td>
              <td>{p.functional_area ? <span className="chip">{p.functional_area}</span> : <span className="empty-dash">—</span>}</td>
              {!compact && <td><Person name={p.ops_manager} alt /></td>}
              <td><StatusBadge status={p.status} /></td>
              <td><LinkIconButtons link={p.link} /></td>
              <td><CharterBadge status={p.charter_status} short /></td>
              {!compact && <td className="small">{p.timeline_total ? `${Math.round((p.timeline_completed / p.timeline_total) * 100)}% (${p.timeline_completed}/${p.timeline_total})` : <span className="empty-dash">No timeline</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
