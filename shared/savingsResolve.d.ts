export declare const MISSING: 'Missing Information';
export type ValueSource = 'project' | 'charter' | 'manual' | 'missing';
export interface Resolved<T = string> { value: T; source: ValueSource }

export interface LinkedProjectInfo {
  id: string;
  title: string;
  owner: string;
  functional_area: string;
  ops_manager: string;
  status: string;
  charter_status: 'Not Started' | 'In Progress' | 'Completed';
  raci: { responsible?: string; accountable?: string; consulted?: string; informed?: string } | null;
  timeline_total: number;
  timeline_dated: number;
}

export interface ResolvedInitiative {
  linked: boolean;
  project_title: string | null;
  project_owner: string | null;
  initiative_name: Resolved;
  ops_manager: Resolved;
  functional_area: Resolved;
  status: Resolved;
  project_charter: Resolved<'Y' | 'N' | 'Missing Information'>;
  raci: Record<'R' | 'A' | 'C' | 'I', Resolved>;
}

export interface InitiativeIssue { field: string; label: string; category: string; kind: 'missing' | 'validation' | 'notice' }

export declare function resolveInitiative(row: Record<string, unknown>, project: LinkedProjectInfo | null): ResolvedInitiative;
export declare function initiativeIssues(row: Record<string, unknown>, resolved: ResolvedInitiative): InitiativeIssue[];
export declare function isIncomplete(issues: InitiativeIssue[]): boolean;
export declare function needsValidation(issues: InitiativeIssue[]): boolean;
