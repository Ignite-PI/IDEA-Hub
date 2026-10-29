export const STATUSES = [
  'Idea',
  'Assessing',
  'Validated',
  'Approved',
  'In Delivery',
  'Implemented',
  'On Hold',
  'Cancelled',
] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const CHARTER_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export type CharterStatus = (typeof CHARTER_STATUSES)[number];

export const STATUS_META: Record<ProjectStatus, { color: string; bg: string; fg: string; solid?: boolean; blurb: string }> = {
  Idea:          { color: '#A39DB8', bg: '#F1F0F5', fg: '#4D4762', blurb: 'Captured, not yet reviewed' },
  Assessing:     { color: '#44B8F3', bg: '#E1ECFF', fg: '#14679A', blurb: 'Feasibility under review' },
  Validated:     { color: '#00B8BA', bg: '#D9F5F5', fg: '#007476', blurb: 'Value confirmed' },
  Approved:      { color: '#794CFF', bg: '#EBE4FF', fg: '#5009B5', blurb: 'Green-lit to proceed' },
  'In Delivery': { color: '#5009B5', bg: '#5009B5', fg: '#FFFFFF', solid: true, blurb: 'Actively being executed' },
  Implemented:   { color: '#00A3A5', bg: '#00A3A5', fg: '#FFFFFF', solid: true, blurb: 'Live and delivering value' },
  'On Hold':     { color: '#E8A33D', bg: '#FFF3DF', fg: '#8A5A00', blurb: 'Paused for now' },
  Cancelled:     { color: '#C25A7C', bg: '#FAEAF0', fg: '#963457', blurb: 'Stopped, no further action' },
};

export const CHARTER_META: Record<CharterStatus, { color: string; bg: string; fg: string }> = {
  'Not Started': { color: '#B7B2C6', bg: '#F5F5F5', fg: '#5F5A72' },
  'In Progress': { color: '#44B8F3', bg: '#E1ECFF', fg: '#14679A' },
  Completed:     { color: '#00B8BA', bg: '#D9F5F5', fg: '#007476' },
};

export interface Project {
  id: string;
  title: string;
  description: string;
  owner: string;
  functional_area: string;
  ops_manager: string;
  status: ProjectStatus;
  link: string;
  created_at: string;
  updated_at: string;
  charter_status: CharterStatus;
  charter_updated_at: string | null;
  timeline_total: number;
  timeline_completed: number;
}

export type ProjectInput = Pick<Project, 'title' | 'description' | 'owner' | 'functional_area' | 'ops_manager' | 'status' | 'link'>;

export interface Milestone {
  id: string;
  task: string;
  owner: string;
  dueDate: string;
}

export const TIMELINE_PHASES = ['Collaborate', 'Understand', 'Redesign', 'Execute', 'Sustain'] as const;
export type TimelinePhase = (typeof TIMELINE_PHASES)[number];

/** Legacy single-task-per-phase timeline (kept for older charters; superseded by TimelineActivity). */
export interface TimelineEntry {
  task: string;
  start: string;
  end: string;
}

export interface KeyMetric {
  id: string;
  metric: string;
  definition: string;
  target: string;
  baseline: string;
  impact: string;
}

export interface CharterData {
  projectTitle: string;
  businessFunction: string;
  businessOwner: string;
  executiveSponsor: string;
  lineOfBusiness: string;
  executionLead: string;
  curesLead: string;
  problemStatement: string;
  /** Shown as "Engagement Goals" (template wording). */
  projectGoals: string;
  keyMetrics: KeyMetric[];
  inScope: string;
  outOfScope: string;
  constraints: string;
  deliverables: string;
  businessImpact: string;
  raci: { responsible: string; accountable: string; consulted: string; informed: string };
  milestones: Milestone[];
  timeline: Record<TimelinePhase, TimelineEntry>;
}

export const ACTIVITY_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_META: Record<ActivityStatus, { color: string; bg: string; fg: string }> = {
  'Not Started': { color: '#B7B2C6', bg: '#F1F0F5', fg: '#4D4762' },
  'In Progress': { color: '#44B8F3', bg: '#E1ECFF', fg: '#14679A' },
  Completed:     { color: '#00B8BA', bg: '#D9F5F5', fg: '#007476' },
  'On Hold':     { color: '#E8A33D', bg: '#FFF3DF', fg: '#8A5A00' },
  Delayed:       { color: '#D6456E', bg: '#FCE8EE', fg: '#A3204A' },
};

export interface TimelineActivity {
  id: string;
  project_id?: string;
  phase: TimelinePhase;
  task: string;
  start_date: string;
  end_date: string;
  status: ActivityStatus;
  progress: number | null;
  depends_on: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StatusHistoryEntry {
  id: string;
  project_id: string;
  from_status: ProjectStatus | null;
  to_status: ProjectStatus;
  changed_at: string;
  changed_by: string;
  note: string;
}

export interface Charter {
  project_id: string;
  data: CharterData;
  status: Exclude<CharterStatus, 'Not Started'>;
  completeness?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  charter: Charter | null;
  timeline: TimelineActivity[];
  status_history: StatusHistoryEntry[];
}
