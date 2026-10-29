import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import type { SortDir, SortKey } from '../utils/projectQuery';
import { CharterBadge, StatusBadge } from './Badges';
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
  { key: 'owner', label: 'Project Owner' },
  { key: 'functional_area', label: 'Functional Area' },
  { key: 'ops_manager', label: 'Operations Manager', compactHide: true },
  { key: 'status', label: 'Status' },
  { key: null, label: 'Link' },
  { key: 'charter', label: 'Charter' },
];

export function ProjectTable({ projects, sortKey, sortDir, onSort, compact }: Props) {
  const navigate = useNavigate();
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
            <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${p.id}`)}>
              <td style={{ minWidth: 200 }}>
                <span className="cell-title">{p.title}</span>
                <span className="cell-desc">{p.description || <span className="empty-dash">No description</span>}</span>
              </td>
              <td><Person name={p.owner} /></td>
              <td>{p.functional_area ? <span className="chip">{p.functional_area}</span> : <span className="empty-dash">—</span>}</td>
              {!compact && <td><Person name={p.ops_manager} alt /></td>}
              <td><StatusBadge status={p.status} /></td>
              <td><LinkIconButtons link={p.link} /></td>
              <td><CharterBadge status={p.charter_status} short /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
