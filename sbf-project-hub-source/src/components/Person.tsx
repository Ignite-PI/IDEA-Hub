import { initials } from '../utils/format';

export function Person({ name, alt }: { name: string; alt?: boolean }) {
  if (!name) return <span className="empty-dash">—</span>;
  return (
    <span className="person">
      <span className={`avatar${alt ? ' alt' : ''}`}>{initials(name)}</span>
      {name}
    </span>
  );
}
