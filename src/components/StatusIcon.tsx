import { BadgeCheck, Lightbulb, PauseCircle, Rocket, ScanSearch, ThumbsUp, Trophy, XCircle, type LucideProps } from 'lucide-react';
import type { ProjectStatus } from '../types';

const ICONS: Record<ProjectStatus, (p: LucideProps) => JSX.Element> = {
  Idea: (p) => <Lightbulb {...p} />,
  Assessing: (p) => <ScanSearch {...p} />,
  Validated: (p) => <BadgeCheck {...p} />,
  Approved: (p) => <ThumbsUp {...p} />,
  'In Delivery': (p) => <Rocket {...p} />,
  Implemented: (p) => <Trophy {...p} />,
  'On Hold': (p) => <PauseCircle {...p} />,
  Cancelled: (p) => <XCircle {...p} />,
};

export const StatusIcon = ({ status, ...p }: { status: ProjectStatus } & LucideProps) => ICONS[status](p);
