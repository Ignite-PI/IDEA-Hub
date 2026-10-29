import {
  TIMELINE_PHASES, type CharterData, type KeyMetric, type Project, type TimelineActivity, type TimelinePhase,
} from '../types';

export const PHASE_COLORS: Record<TimelinePhase, string> = {
  Collaborate: '#794CFF',
  Understand: '#5009B5',
  Redesign: '#44B8F3',
  Execute: '#00B8BA',
  Sustain: '#2B1B49',
};

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const emptyMilestone = () => ({ id: newId(), task: '', owner: '', dueDate: '' });
export const emptyMetric = (): KeyMetric => ({ id: newId(), metric: '', definition: '', target: '', baseline: '', impact: '' });
export const emptyActivity = (phase: TimelinePhase = 'Collaborate'): TimelineActivity => ({
  id: newId(), phase, task: '', start_date: '', end_date: '', status: 'Not Started', progress: null, depends_on: '',
});

export function emptyCharter(project?: Pick<Project, 'title' | 'owner' | 'functional_area'>): CharterData {
  return {
    projectTitle: project?.title ?? '',
    businessFunction: project?.functional_area ?? '',
    businessOwner: project?.owner ?? '',
    executiveSponsor: '',
    lineOfBusiness: '',
    executionLead: '',
    curesLead: '',
    problemStatement: '',
    projectGoals: '',
    keyMetrics: [emptyMetric()],
    inScope: '',
    outOfScope: '',
    constraints: '',
    deliverables: '',
    businessImpact: '',
    raci: { responsible: '', accountable: '', consulted: '', informed: '' },
    milestones: [emptyMilestone()],
    timeline: Object.fromEntries(TIMELINE_PHASES.map((p) => [p, { task: '', start: '', end: '' }])) as CharterData['timeline'],
  };
}

/** Merge stored data onto a blank charter so older/partial records always have every field. */
export function normalizeCharter(data: Partial<CharterData> | undefined, project?: Project): CharterData {
  const base = emptyCharter(project);
  if (!data) return base;
  return {
    ...base,
    ...data,
    raci: { ...base.raci, ...data.raci },
    keyMetrics: data.keyMetrics?.length ? data.keyMetrics.map((m) => ({ ...emptyMetric(), ...m })) : base.keyMetrics,
    milestones: data.milestones?.length ? data.milestones : base.milestones,
    timeline: Object.fromEntries(
      TIMELINE_PHASES.map((p) => [p, { ...base.timeline[p], ...data.timeline?.[p] }]),
    ) as CharterData['timeline'],
  };
}

const filled = (v?: string) => !!v && v.trim().length > 0;

export interface SectionProgress {
  key: string;
  label: string;
  done: number;
  total: number;
}

/** Charter completeness: how much of the charter document is filled in. Says nothing about project delivery. */
export function charterProgress(c: CharterData, activities: TimelineActivity[] = []): { sections: SectionProgress[]; percent: number } {
  const sections: SectionProgress[] = [
    {
      key: 'information', label: 'Project Information', total: 7,
      done: [c.projectTitle, c.businessFunction, c.businessOwner, c.executiveSponsor, c.lineOfBusiness, c.executionLead, c.curesLead].filter(filled).length,
    },
    { key: 'definition', label: 'Problem, Goals & Impact', total: 4, done: [c.problemStatement, c.projectGoals, c.businessImpact, c.deliverables].filter(filled).length },
    { key: 'metrics', label: 'Key Metrics', total: 1, done: c.keyMetrics.some((m) => filled(m.metric)) ? 1 : 0 },
    { key: 'scope', label: 'Scope & Constraints', total: 3, done: [c.inScope, c.outOfScope, c.constraints].filter(filled).length },
    { key: 'raci', label: 'RACI', total: 4, done: Object.values(c.raci).filter(filled).length },
    { key: 'milestones', label: 'Milestones / Tasks', total: 1, done: c.milestones.some((m) => filled(m.task)) ? 1 : 0 },
    {
      key: 'timeline', label: 'CURES Timeline', total: TIMELINE_PHASES.length,
      done: TIMELINE_PHASES.filter((p) => activities.some((a) => a.phase === p && filled(a.task) && a.start_date && a.end_date)).length,
    },
  ];
  const done = sections.reduce((s, x) => s + x.done, 0);
  const total = sections.reduce((s, x) => s + x.total, 0);
  return { sections, percent: Math.round((done / total) * 100) };
}

export interface MissingItem { key: string; section: string; label: string }

/** Required content before a charter can be marked Completed (all template sections are required; Constraints is optional). */
export function charterMissing(c: CharterData, activities: TimelineActivity[] = []): MissingItem[] {
  const out: MissingItem[] = [];
  const need = (key: string, section: string, label: string, ok: boolean) => { if (!ok) out.push({ key, section, label }); };
  const info: [keyof CharterData, string][] = [
    ['projectTitle', 'Project Title'], ['businessFunction', 'Business Function'], ['businessOwner', 'Business Owner'],
    ['executiveSponsor', 'Executive Sponsor'], ['lineOfBusiness', 'Line of Business'], ['executionLead', 'Execution Lead'], ['curesLead', 'CURES Lead'],
  ];
  for (const [k, l] of info) need(k, 'information', l, filled(c[k] as string));
  need('problemStatement', 'definition', 'Problem Statement', filled(c.problemStatement));
  need('projectGoals', 'definition', 'Engagement Goals', filled(c.projectGoals));
  need('businessImpact', 'definition', 'Business Impact / Benefit', filled(c.businessImpact));
  need('deliverables', 'definition', 'Project Deliverables', filled(c.deliverables));
  need('keyMetrics', 'metrics', 'At least one Key Metric with a name and target', c.keyMetrics.some((m) => filled(m.metric) && filled(m.target)));
  need('inScope', 'scope', 'In Scope', filled(c.inScope));
  need('outOfScope', 'scope', 'Out of Scope', filled(c.outOfScope));
  for (const k of ['responsible', 'accountable', 'consulted', 'informed'] as const) need(`raci.${k}`, 'raci', `RACI – ${k[0]!.toUpperCase()}${k.slice(1)}`, filled(c.raci[k]));
  need('milestones', 'milestones', 'At least one Milestone / Task', c.milestones.some((m) => filled(m.task)));
  for (const p of TIMELINE_PHASES) {
    need(`timeline.${p}`, 'timeline', `CURES ${p}: an activity with start and end dates`,
      activities.some((a) => a.phase === p && filled(a.task) && !!a.start_date && !!a.end_date));
  }
  return out;
}

/** Only activities the user actually entered (blank rows are ignored). */
export const enteredActivities = (activities: TimelineActivity[]) =>
  activities.filter((a) => filled(a.task) || a.start_date || a.end_date);

/** Timeline Progress = completed timeline tasks / total timeline tasks × 100. */
export function timelineProgress(activities: TimelineActivity[]) {
  const list = enteredActivities(activities);
  const completed = list.filter((a) => a.status === 'Completed').length;
  return { total: list.length, completed, percent: list.length ? Math.round((completed / list.length) * 100) : null };
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const isOverdue = (a: TimelineActivity, today = todayIso()) => !!a.end_date && a.end_date < today && a.status !== 'Completed';
export { todayIso };

/** Earliest start / latest end of a CURES phase, derived from its activities. */
export function phaseRange(activities: TimelineActivity[], phase: TimelinePhase): { start: string; end: string } {
  const list = activities.filter((a) => a.phase === phase);
  const starts = list.map((a) => a.start_date).filter(Boolean).sort();
  const ends = list.map((a) => a.end_date).filter(Boolean).sort();
  return { start: starts[0] ?? '', end: ends[ends.length - 1] ?? '' };
}

export function durationDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.round(ms / 86400000) + 1;
}
