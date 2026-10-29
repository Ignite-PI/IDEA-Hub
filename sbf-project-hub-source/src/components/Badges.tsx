import { CHARTER_META, STATUS_META, type CharterStatus, type ProjectStatus } from '../types';

export function StatusBadge({ status, large }: { status: ProjectStatus; large?: boolean }) {
  const m = STATUS_META[status] ?? STATUS_META.Idea;
  return (
    <span className={`badge${large ? ' badge-lg' : ''}`} style={{ background: m.bg, color: m.fg }}>
      <span className="dot" style={{ background: m.solid ? 'rgba(255,255,255,0.85)' : m.color }} />
      {status}
    </span>
  );
}

export function CharterBadge({ status, large, short }: { status: CharterStatus; large?: boolean; short?: boolean }) {
  const m = CHARTER_META[status];
  return (
    <span className={`badge${large ? ' badge-lg' : ''}`} style={{ background: m.bg, color: m.fg }}>
      <span className="dot" style={{ background: m.color }} />
      {short ? status : `Charter ${status.toLowerCase()}`}
    </span>
  );
}
