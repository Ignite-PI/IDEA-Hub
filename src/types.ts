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

export interface TimelineEntry {
  task: string;
  start: string;
  end: string;
}

export interface CharterData {
  projectTitle: string;
  businessFunction: string;
  businessOwner: string;
  executiveSponsor: string;
  lineOfBusiness: string;
  executionLead: string;
  problemStatement: string;
  projectGoals: string;
  inScope: string;
  outOfScope: string;
  deliverables: string;
  businessImpact: string;
  raci: { responsible: string; accountable: string; consulted: string; informed: string };
  milestones: Milestone[];
  timeline: Record<TimelinePhase, TimelineEntry>;
}

export interface Charter {
  project_id: string;
  data: CharterData;
  status: Exclude<CharterStatus, 'Not Started'>;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  charter: Charter | null;
}
