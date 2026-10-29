import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { ACTIVITY_STATUSES, TIMELINE_PHASES, type ActivityStatus, type TimelineActivity, type TimelinePhase } from '../types';
import { PHASE_COLORS, emptyActivity } from '../utils/charter';
import { Menu } from './Menu';

interface Props {
  activities: TimelineActivity[];
  onChange: (next: TimelineActivity[]) => void;
}

export const timelineErrors = (activities: TimelineActivity[]) =>
  activities.flatMap((a, i) => (a.start_date && a.end_date && a.end_date < a.start_date ? [`Activity ${i + 1} (${a.task || a.phase}) ends before it starts.`] : []));

/** Editable list of CURES timeline activities, grouped by phase. Controlled component. */
export function TimelineEditor({ activities, onChange }: Props) {
  const update = (id: string, patch: Partial<TimelineActivity>) =>
    onChange(activities.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const add = (phase: TimelinePhase) => {
    // insert after the last activity of this phase so phases stay grouped
    const idx = activities.map((a) => a.phase).lastIndexOf(phase);
    const at = idx >= 0 ? idx + 1 : activities.filter((a) => TIMELINE_PHASES.indexOf(a.phase) < TIMELINE_PHASES.indexOf(phase)).length;
    const next = [...activities];
    next.splice(at, 0, emptyActivity(phase));
    onChange(next);
  };
  const remove = (id: string) => onChange(activities.filter((a) => a.id !== id).map((a) => (a.depends_on === id ? { ...a, depends_on: '' } : a)));
  const move = (id: string, dir: -1 | 1) => {
    const phaseList = activities.filter((a) => a.phase === activities.find((x) => x.id === id)!.phase);
    const i = phaseList.findIndex((a) => a.id === id);
    const swap = phaseList[i + dir];
    if (!swap) return;
    const next = [...activities];
    const ia = next.findIndex((a) => a.id === id);
    const ib = next.findIndex((a) => a.id === swap.id);
    [next[ia], next[ib]] = [next[ib]!, next[ia]!];
    onChange(next);
  };

  return (
    <div className="tl-editor">
      <div className="tle-row tle-head">
        <span>Activity / task</span><span>Start date</span><span>End date</span><span>Status</span><span>Progress</span><span>Depends on</span><span />
      </div>
      {TIMELINE_PHASES.map((phase) => {
        const acts = activities.filter((a) => a.phase === phase);
        return (
          <div key={phase} className="tle-phase">
            <div className="tle-phase-head">
              <span className="chev" style={{ background: PHASE_COLORS[phase] }}>{phase}</span>
              <span className="small muted">{acts.length ? `${acts.length} activit${acts.length === 1 ? 'y' : 'ies'}` : 'No activities yet'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(phase)}><Plus size={14} /> Add {phase} activity</button>
            </div>
            {acts.map((a, i) => {
              const bad = !!(a.start_date && a.end_date && a.end_date < a.start_date);
              return (
                <div key={a.id} className="tle-row">
                  <input className="input" value={a.task} placeholder={`What happens in ${phase.toLowerCase()}?`} onChange={(e) => update(a.id, { task: e.target.value })} aria-label={`${phase} activity ${i + 1}`} />
                  <input className="input" type="date" value={a.start_date} onChange={(e) => update(a.id, { start_date: e.target.value })} aria-label="Start date" />
                  <div>
                    <input className="input" type="date" value={a.end_date} min={a.start_date || undefined} onChange={(e) => update(a.id, { end_date: e.target.value })} aria-label="End date" style={bad ? { borderColor: '#d6456e' } : undefined} />
                    {bad && <div className="small" style={{ color: '#b4234a', marginTop: 3 }}>Ends before it starts</div>}
                  </div>
                  <select className="select" value={a.status} onChange={(e) => {
                    const status = e.target.value as ActivityStatus;
                    update(a.id, { status, progress: status === 'Completed' ? 100 : a.progress });
                  }} aria-label="Activity status">
                    {ACTIVITY_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input className="input" type="number" min={0} max={100} placeholder="%" value={a.progress ?? ''} aria-label="Progress percent"
                    onChange={(e) => update(a.id, { progress: e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))) })} />
                  <select className="select" value={a.depends_on} onChange={(e) => update(a.id, { depends_on: e.target.value })} aria-label="Depends on">
                    <option value="">None</option>
                    {activities.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.phase}: {x.task || 'Untitled'}</option>)}
                  </select>
                  <Menu align="end" trigger={(toggle) => <button type="button" className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Activity actions"><MoreHorizontal size={16} /></button>}>
                    {(close) => (
                      <>
                        <button type="button" disabled={i === 0} onClick={() => { close(); move(a.id, -1); }}><ArrowUp size={15} /> Move up</button>
                        <button type="button" disabled={i === acts.length - 1} onClick={() => { close(); move(a.id, 1); }}><ArrowDown size={15} /> Move down</button>
                        <button type="button" onClick={() => { close(); remove(a.id); }}><Trash2 size={15} color="#b4234a" /> Remove activity</button>
                      </>
                    )}
                  </Menu>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
