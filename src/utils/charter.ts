import { TIMELINE_PHASES, type CharterData, type Project, type TimelinePhase } from '../types';

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

export function emptyCharter(project?: Pick<Project, 'title' | 'owner' | 'functional_area'>): CharterData {
  return {
    projectTitle: project?.title ?? '',
    businessFunction: project?.functional_area ?? '',
    businessOwner: project?.owner ?? '',
    executiveSponsor: '',
    lineOfBusiness: '',
    executionLead: '',
    problemStatement: '',
    projectGoals: '',
    inScope: '',
    outOfScope: '',
    deliverables: '',
    businessImpact: '',
    raci: { responsible: '', accountable: '', consulted: '', informed: '' },
    milestones: [emptyMilestone()],
    timeline: Object.fromEntries(TIMELINE_PHASES.map((p) => [p, { task: '', start: '', end: '' }])) as Record<
      TimelinePhase,
      { task: string; start: string; end: string }
    >,
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

export function charterProgress(c: CharterData): { sections: SectionProgress[]; percent: number } {
  const sections: SectionProgress[] = [
    {
      key: 'information',
      label: 'Project Information',
      total: 6,
      done: [c.projectTitle, c.businessFunction, c.businessOwner, c.executiveSponsor, c.lineOfBusiness, c.executionLead].filter(filled).length,
    },
    {
      key: 'definition',
      label: 'Project Definition',
      total: 6,
      done: [c.problemStatement, c.projectGoals, c.inScope, c.outOfScope, c.deliverables, c.businessImpact].filter(filled).length,
    },
    { key: 'raci', label: 'RACI', total: 4, done: Object.values(c.raci).filter(filled).length },
    { key: 'milestones', label: 'Milestones / Tasks', total: 1, done: c.milestones.some((m) => filled(m.task)) ? 1 : 0 },
    {
      key: 'timeline',
      label: 'Timeline',
      total: TIMELINE_PHASES.length,
      done: TIMELINE_PHASES.filter((p) => filled(c.timeline[p].task) || filled(c.timeline[p].start) || filled(c.timeline[p].end)).length,
    },
  ];
  const done = sections.reduce((s, x) => s + x.done, 0);
  const total = sections.reduce((s, x) => s + x.total, 0);
  return { sections, percent: Math.round((done / total) * 100) };
}
