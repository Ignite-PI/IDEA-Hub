import { CHARTER_STATUSES, STATUSES, type Project, type ProjectStatus } from '../types';

export const VIEWS: { label: string; title: string; status: ProjectStatus | '' }[] = [
  { label: 'All Projects', title: 'All Projects', status: '' },
  { label: 'Ideas', title: 'Ideas', status: 'Idea' },
  { label: 'In Assessment', title: 'Projects in Assessment', status: 'Assessing' },
  { label: 'Validated', title: 'Validated Projects', status: 'Validated' },
  { label: 'Approved', title: 'Approved Projects', status: 'Approved' },
  { label: 'In Delivery', title: 'Projects in Delivery', status: 'In Delivery' },
  { label: 'Implemented', title: 'Implemented Projects', status: 'Implemented' },
  { label: 'On Hold', title: 'On Hold Projects', status: 'On Hold' },
  { label: 'Cancelled', title: 'Cancelled Projects', status: 'Cancelled' },
];

export type SortKey = 'updated' | 'created' | 'title' | 'status' | 'owner' | 'functional_area' | 'ops_manager' | 'charter';
export type SortDir = 'asc' | 'desc';

export const SORT_OPTIONS: { value: `${SortKey}:${SortDir}`; label: string }[] = [
  { value: 'updated:desc', label: 'Recently updated' },
  { value: 'created:desc', label: 'Newest first' },
  { value: 'created:asc', label: 'Oldest first' },
  { value: 'title:asc', label: 'Title (A–Z)' },
  { value: 'title:desc', label: 'Title (Z–A)' },
  { value: 'status:asc', label: 'Status (pipeline order)' },
  { value: 'owner:asc', label: 'Project Owner (A–Z)' },
  { value: 'functional_area:asc', label: 'Functional Area (A–Z)' },
];

export interface Filters {
  q: string;
  status: string;
  area: string;
  manager: string;
  owner: string;
}

export function filterProjects(projects: Project[], f: Filters): Project[] {
  const q = f.q.trim().toLowerCase();
  return projects.filter((p) =>
    (!f.status || p.status === f.status) &&
    (!f.area || p.functional_area === f.area) &&
    (!f.manager || p.ops_manager === f.manager) &&
    (!f.owner || p.owner === f.owner) &&
    (!q || [p.title, p.description, p.owner, p.functional_area, p.ops_manager, p.status, p.link].some((v) => v?.toLowerCase().includes(q))),
  );
}

const sortValue = (p: Project, key: SortKey): string | number => {
  switch (key) {
    case 'updated': return p.updated_at;
    case 'created': return p.created_at;
    case 'status': return STATUSES.indexOf(p.status);
    case 'charter': return CHARTER_STATUSES.indexOf(p.charter_status);
    case 'title': return p.title.toLowerCase();
    default: return (p[key] || '\uffff').toLowerCase();
  }
};

export function sortProjects(projects: Project[], key: SortKey, dir: SortDir): Project[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...projects].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    return (va < vb ? -1 : va > vb ? 1 : 0) * m || a.title.localeCompare(b.title);
  });
}

export const distinct = (projects: Project[], key: 'functional_area' | 'ops_manager' | 'owner') =>
  [...new Set(projects.map((p) => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const countByStatus = (projects: Project[]) =>
  Object.fromEntries(STATUSES.map((s) => [s, projects.filter((p) => p.status === s).length])) as Record<ProjectStatus, number>;
