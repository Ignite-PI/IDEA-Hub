export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week']];
  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, label] = units[i];
    if (diff >= secs) {
      if (label === 'week' && diff > 604800 * 4) break;
      const n = Math.floor(diff / secs);
      return `${n} ${label}${n > 1 ? 's' : ''} ago`;
    }
  }
  return formatDate(value);
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

export const safeFileName = (title: string) =>
  (title || 'Project').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '') || 'Project';
