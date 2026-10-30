import { useNavigate } from 'react-router-dom';
import { STORYBOARD } from '../../shared/savingsContent';
import { fte, money, moneyShort, pct, useSavings } from './SavingsContext';

/** Workbook "Storyboard" tab as a leadership slide-style view; every metric is live. */
export function StoryboardPage() {
  const { summary: s, filtered, settings, activeFilterCount } = useSavings();
  const navigate = useNavigate();
  const metric: Record<string, string> = {
    target: money(s.target),
    risk_adjusted_value: money(s.risk_adjusted_value),
    capacity_fte_released: `${fte(s.capacity_fte_released)} FTE`,
    initiatives_entered: String(s.initiatives_entered),
    target_achievement: pct(s.target_achievement, 1),
    max_risk_adjusted: money(s.max_risk_adjusted),
  };
  const top = [...filtered].sort((a, b) => b.calc.risk_adjusted_savings - a.calc.risk_adjusted_savings).slice(0, 5);
  const cash = s.outcomes.filter((o) => o.label !== 'Additional Work / Capacity').reduce((t, o) => t + o.risk_adjusted_savings, 0);
  const capacity = s.outcomes.find((o) => o.label === 'Additional Work / Capacity')?.risk_adjusted_savings ?? 0;

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><div className="eyebrow">Storyboard</div><h1>30% Clinical Savings</h1><p>Leadership narrative built from the live portfolio{activeFilterCount ? ' (filters applied)' : ''}.</p></div>
      </div>
      <div className="story-grid">
        {STORYBOARD.map((r, i) => (
          <section key={r.slide} className="card story-slide">
            <div className="story-no">{i + 1}</div>
            <div className="story-body">
              <span className="eyebrow">{r.slide.replace(/^\d+ - /, '')}</span>
              <h3>{r.headline}</h3>
              <div className="story-metric"><b>{metric[r.metric]}</b><span>{r.metricLabel}</span></div>
              {r.metric === 'risk_adjusted_value' && (
                <p className="small">Cash value (headcount + rate card): <b>{money(cash)}</b> · Capacity value (not cash): <b>{money(capacity)}</b></p>
              )}
              {r.metric === 'target' && <p className="small">Projected 2027 exit: {settings.projected_exit_hc.toLocaleString('en-US')} billable HC / {money(settings.projected_exit_revenue, 2)}.</p>}
              {r.metric === 'initiatives_entered' && (
                <div className="story-tracks">{s.tracks.map((t) => <span key={t.label}><b>{t.label}</b> {moneyShort(t.risk_adjusted_savings)} · {t.initiatives}</span>)}</div>
              )}
              {r.metric === 'target_achievement' && (
                <div className="target-bar small" role="img" aria-label={`Target achievement ${pct(s.target_achievement, 1)}`}><i style={{ width: `${Math.min(s.target_achievement, 1) * 100}%` }} /></div>
              )}
              <dl>
                <dt>Purpose</dt><dd>{r.purpose}</dd>
                <dt>Evidence to show</dt><dd>{r.evidence}</dd>
                <dt>Owner / action</dt><dd>{r.owner}</dd>
              </dl>
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="card-head"><div><h3>Initiative proof points</h3><p>Top initiatives by risk-adjusted value — executive story, evidence, timing and validation</p></div></div>
        <div className="proof-list">
          {top.map((e) => (
            <button key={e.row.id} className="proof" onClick={() => navigate(`/managers/input/${e.row.id}`)}>
              <div className="proof-head"><b>#{e.row.initiative_no} {e.resolved.initiative_name.value}</b><span>{money(e.calc.risk_adjusted_savings)}</span></div>
              <p>{e.row.executive_story || <em className="miss-text">No executive story yet</em>}</p>
              <small>
                {e.row.savings_track} · {e.row.savings_outcome} · {e.resolved.status.value} · Owner sign-off: {e.row.owner_signoff ?? 'not recorded'} · Finance: {e.row.finance_validated ?? 'not recorded'}
                {e.row.expected_completion ? ` · completes ${e.row.expected_completion}` : ''}
              </small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
