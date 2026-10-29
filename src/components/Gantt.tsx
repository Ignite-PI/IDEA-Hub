import { Fragment, useMemo } from 'react';
import { AlertTriangle, Check, ChevronDown, Link2 } from 'lucide-react';
import { ACTIVITY_META, ACTIVITY_STATUSES, TIMELINE_PHASES, type ActivityStatus, type TimelineActivity } from '../types';
import { PHASE_COLORS, durationDays, enteredActivities, isOverdue, phaseRange, todayIso } from '../utils/charter';
import { formatDate } from '../utils/format';
import { Menu } from './Menu';

const DAY = 86400000;
const toMs = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
const ROW_H = 44;
const PHASE_H = 36;

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const m = ACTIVITY_META[status];
  return (
    <span className="badge" style={{ background: m.bg, color: m.fg }}>
      <span className="dot" style={{ background: m.color }} />{status}
    </span>
  );
}

interface Props {
  activities: TimelineActivity[];
  onStatusChange?: (activity: TimelineActivity, status: ActivityStatus) => void;
  busyId?: string | null;
}

/** Gantt chart generated only from the user's CURES timeline activities. */
export function Gantt({ activities, onStatusChange, busyId }: Props) {
  const today = todayIso();
  const list = useMemo(() => enteredActivities(activities), [activities]);

  const scale = useMemo(() => {
    const dates = list.flatMap((a) => [a.start_date, a.end_date]).filter(Boolean).sort();
    if (!dates.length) return null;
    let min = toMs(dates[0]!);
    let max = toMs(dates[dates.length - 1]!) + DAY;
    const t = toMs(today);
    if (t >= min - 14 * DAY && t <= max + 14 * DAY) { min = Math.min(min, t); max = Math.max(max, t + DAY); }
    const pad = Math.max(DAY, Math.round((max - min) * 0.03 / DAY) * DAY);
    min -= pad;
    max += pad;
    const span = max - min;
    const pct = (ms: number) => ((ms - min) / span) * 100;

    const ticks: { left: number; label: string }[] = [];
    if (span / DAY <= 62) {
      const d = new Date(min);
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
      for (; d.getTime() < max; d.setDate(d.getDate() + 7)) {
        ticks.push({ left: pct(d.getTime()), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
      }
    } else {
      const d = new Date(min);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const step = span / DAY > 540 ? 3 : 1;
      for (; d.getTime() < max; d.setMonth(d.getMonth() + step)) {
        ticks.push({ left: pct(d.getTime()), label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) });
      }
    }
    return { pct, ticks, todayLeft: t >= min && t <= max ? pct(t + DAY / 2) : null };
  }, [list, today]);

  // Row layout (needed to draw dependency connectors)
  const rows = useMemo(() => {
    const out: ({ kind: 'phase'; phase: (typeof TIMELINE_PHASES)[number]; top: number } | { kind: 'task'; a: TimelineActivity; top: number })[] = [];
    let top = 0;
    for (const phase of TIMELINE_PHASES) {
      const acts = list.filter((a) => a.phase === phase);
      if (!acts.length) continue;
      out.push({ kind: 'phase', phase, top });
      top += PHASE_H;
      for (const a of acts) { out.push({ kind: 'task', a, top }); top += ROW_H; }
    }
    return { out, height: top };
  }, [list]);

  const byId = useMemo(() => new Map(list.map((a) => [a.id, a])), [list]);
  const topOf = useMemo(() => new Map(rows.out.flatMap((r) => (r.kind === 'task' ? [[r.a.id, r.top] as const] : []))), [rows]);

  if (!list.length) return null;

  const bar = (a: TimelineActivity) => {
    if (!scale || !a.start_date || !a.end_date) return null;
    const left = scale.pct(toMs(a.start_date));
    const width = Math.max(0.6, scale.pct(toMs(a.end_date) + DAY) - left);
    return { left, width };
  };

  const connectors = scale
    ? list.flatMap((a) => {
      const pred = a.depends_on ? byId.get(a.depends_on) : undefined;
      const pb = pred && bar(pred);
      const sb = bar(a);
      if (!pred || !pb || !sb) return [];
      const y1 = (topOf.get(pred.id) ?? 0) + ROW_H / 2;
      const y2 = (topOf.get(a.id) ?? 0) + ROW_H / 2;
      const x1 = pb.left + pb.width;
      const x2 = sb.left;
      return [{ id: a.id, x1, x2, y1, y2 }];
    })
    : [];

  return (
    <div className="gantt-scroll">
      <div className="gantt">
        <div className="g-row g-head">
          <div className="g-left">
            <span>CURES phase / activity</span><span>Status</span><span>Start</span><span>End</span><span>Days</span><span>Progress</span>
          </div>
          <div className="g-right">
            {scale?.ticks.map((t) => <span key={`${t.left}`} className="g-tick" style={{ left: `${t.left}%` }}>{t.label}</span>)}
          </div>
        </div>

        <div className="g-body">
          <div className="g-grid" aria-hidden>
            {scale?.ticks.map((t) => <i key={`${t.left}`} style={{ left: `${t.left}%` }} />)}
            {scale?.todayLeft != null && <b className="g-today" style={{ left: `${scale.todayLeft}%` }}><span>Today</span></b>}
            {connectors.length > 0 && (
              <svg className="g-links" style={{ height: rows.height }}>
                <defs>
                  <marker id="g-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#6b6680" />
                  </marker>
                </defs>
                {connectors.map((c) => (
                  <g key={c.id} stroke="#6b6680" strokeWidth="1.4" fill="none" strokeDasharray="3 3">
                    <line x1={`${c.x1}%`} y1={c.y1} x2={`${c.x1}%`} y2={c.y2} />
                    <line x1={`${c.x1}%`} y1={c.y2} x2={`${c.x2}%`} y2={c.y2} markerEnd="url(#g-arrow)" />
                  </g>
                ))}
              </svg>
            )}
          </div>

          {rows.out.map((r) => {
            if (r.kind === 'phase') {
              const range = phaseRange(list, r.phase);
              const pb = scale && range.start && range.end ? { left: scale.pct(toMs(range.start)), width: scale.pct(toMs(range.end) + DAY) - scale.pct(toMs(range.start)) } : null;
              return (
                <div key={r.phase} className="g-row g-phase">
                  <div className="g-left">
                    <span className="g-phase-name"><i style={{ background: PHASE_COLORS[r.phase] }} />{r.phase}</span>
                    <span /><span className="small muted">{range.start ? formatDate(range.start) : ''}</span><span className="small muted">{range.end ? formatDate(range.end) : ''}</span>
                    <span className="small muted">{durationDays(range.start, range.end) ?? ''}</span><span />
                  </div>
                  <div className="g-right">
                    {pb && <span className="g-phase-bar" style={{ left: `${pb.left}%`, width: `${pb.width}%`, background: PHASE_COLORS[r.phase] }} />}
                  </div>
                </div>
              );
            }
            const a = r.a;
            const m = ACTIVITY_META[a.status];
            const b = bar(a);
            const overdue = isOverdue(a, today);
            const progress = a.status === 'Completed' ? 100 : a.progress;
            const dur = durationDays(a.start_date, a.end_date);
            const pred = a.depends_on ? byId.get(a.depends_on) : undefined;
            return (
              <div key={a.id} className={`g-row g-task${overdue ? ' overdue' : ''}`}>
                <div className="g-left">
                  <span className="g-task-name" title={a.task}>
                    <span className="t">{a.task || <em className="muted">Untitled activity</em>}</span>
                    {pred && <span className="g-dep"><Link2 size={11} /> after {pred.task || 'activity'}</span>}
                  </span>
                  <span>
                    {onStatusChange ? (
                      <Menu
                        trigger={(toggle) => (
                          <button className="g-status-btn" onClick={toggle} disabled={busyId === a.id} aria-label={`Change status of ${a.task}`}>
                            <ActivityStatusBadge status={a.status} /><ChevronDown size={13} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <div className="menu-label">Activity status</div>
                            {ACTIVITY_STATUSES.map((s) => (
                              <button key={s} className={s === a.status ? 'on' : ''} onClick={() => { close(); if (s !== a.status) onStatusChange(a, s); }}>
                                <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: ACTIVITY_META[s].color }} />{s}
                              </button>
                            ))}
                          </>
                        )}
                      </Menu>
                    ) : <ActivityStatusBadge status={a.status} />}
                    {overdue && <span className="g-overdue"><AlertTriangle size={11} /> Overdue</span>}
                  </span>
                  <span>{a.start_date ? formatDate(a.start_date) : <span className="empty-dash">—</span>}</span>
                  <span>{a.end_date ? formatDate(a.end_date) : <span className="empty-dash">—</span>}</span>
                  <span>{dur ?? <span className="empty-dash">—</span>}</span>
                  <span>{progress != null ? `${progress}%` : <span className="empty-dash">—</span>}</span>
                </div>
                <div className="g-right">
                  {b ? (
                    <span
                      className={`g-bar${a.status === 'Completed' ? ' done' : ''}`}
                      style={{ left: `${b.left}%`, width: `${b.width}%`, background: m.bg, borderColor: overdue ? '#D6456E' : m.color }}
                      title={`${a.task}: ${formatDate(a.start_date)} – ${formatDate(a.end_date)} · ${a.status}${progress != null ? ` · ${progress}%` : ''}${overdue ? ' · Overdue' : ''}`}
                    >
                      <i style={{ width: `${progress ?? 0}%`, background: m.color }} />
                      {a.status === 'Completed' && <Check size={12} className="g-check" />}
                    </span>
                  ) : <span className="g-nodates">Add start and end dates to show this activity</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Leadership read-out: done / now / next / delayed and how far through the planned timeline we are. */
export function TimelineOverview({ activities }: { activities: TimelineActivity[] }) {
  const today = todayIso();
  const list = enteredActivities(activities);
  const done = list.filter((a) => a.status === 'Completed');
  const now = list.filter((a) => a.status === 'In Progress' || (a.status !== 'Completed' && a.start_date && a.end_date && a.start_date <= today && today <= a.end_date && a.status !== 'Delayed' && a.status !== 'On Hold'));
  const next = list
    .filter((a) => a.status === 'Not Started' && a.start_date && a.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const delayed = list.filter((a) => a.status === 'Delayed' || isOverdue(a, today));
  const starts = list.map((a) => a.start_date).filter(Boolean).sort();
  const ends = list.map((a) => a.end_date).filter(Boolean).sort();
  const first = starts[0];
  const last = ends[ends.length - 1];
  const total = first && last ? durationDays(first, last) : null;
  const elapsedDays = first && total ? Math.min(total, Math.max(0, (durationDays(first, today) ?? 0))) : null;
  const elapsed = total && elapsedDays !== null ? Math.round((elapsedDays / total) * 100) : null;
  const names = (xs: TimelineActivity[]) => xs.slice(0, 2).map((a) => a.task || a.phase).join(', ') + (xs.length > 2 ? ` +${xs.length - 2} more` : '');

  return (
    <div className="g-overview">
      <div className="g-ov done"><span className="k">Completed</span><b>{done.length}</b><span className="v">{done.length ? names(done) : 'Nothing completed yet'}</span></div>
      <div className="g-ov now"><span className="k">Happening now</span><b>{now.length}</b><span className="v">{now.length ? names(now) : 'No active tasks'}</span></div>
      <div className="g-ov next"><span className="k">Up next</span><b>{next ? formatDate(next.start_date) : '—'}</b><span className="v">{next ? `${next.phase}: ${next.task || 'Untitled'}` : 'No upcoming tasks scheduled'}</span></div>
      <div className={`g-ov late${delayed.length ? ' alert' : ''}`}><span className="k">Delayed / overdue</span><b>{delayed.length}</b><span className="v">{delayed.length ? names(delayed) : 'On track'}</span></div>
      <div className="g-ov time">
        <span className="k">Timeline elapsed</span>
        <b>{elapsed === null ? '—' : `${elapsed}%`}</b>
        <span className="v">{first && last ? `${formatDate(first)} – ${formatDate(last)}${total ? ` · day ${Math.min(elapsedDays ?? 0, total)} of ${total}` : ''}` : 'Add dates to see the timeline span'}</span>
      </div>
    </div>
  );
}

export function GanttLegend() {
  return (
    <div className="g-legend">
      {ACTIVITY_STATUSES.map((s) => (
        <span key={s}><i style={{ background: ACTIVITY_META[s].color }} />{s}</span>
      ))}
      <span><i style={{ background: '#fff', border: '2px solid #D6456E' }} />Overdue</span>
      <span><i className="today" />Today</span>
    </div>
  );
}

export function TimelineStats({ activities }: { activities: TimelineActivity[] }) {
  const list = enteredActivities(activities);
  const today = todayIso();
  const counts = Object.fromEntries(ACTIVITY_STATUSES.map((s) => [s, list.filter((a) => a.status === s).length]));
  const overdue = list.filter((a) => isOverdue(a, today)).length;
  return (
    <div className="g-stats">
      {ACTIVITY_STATUSES.map((s) => (
        <Fragment key={s}>
          <span className="g-stat"><b style={{ color: ACTIVITY_META[s].fg }}>{counts[s]}</b>{s}</span>
        </Fragment>
      ))}
      <span className="g-stat"><b style={{ color: '#A3204A' }}>{overdue}</b>Overdue</span>
    </div>
  );
}
