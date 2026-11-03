import { CHARTER_META, STATUS_META, bfLabel, type CharterStatus, type ProjectStatus } from '../types';

/** Business Function (portfolio) badge; a missing value shows a warning badge "Needs Business Function" (icon + text). */
export function BusinessFunctionBadge({ code }: { code: string | null | undefined }) {
  if (!code) return <span className="needs-pill" title="Set the Business Function in Edit Project or the Project Charter">⚠ {bfLabel(code)}</span>;
  return <span className={`bf-badge bf-${code}`}>{bfLabel(code)}</span>;
}

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
