import { AlertTriangle, BookOpen, Calculator, ClipboardList, Info, ShieldCheck, Target } from 'lucide-react';
import { INSTRUCTIONS } from '../../shared/savingsContent';
import { money, useSavings } from './SavingsContext';
import { SourceTag } from './ui';

/** Workbook "Instructions" tab as readable web content. */
export function InstructionsPage() {
  const { settings } = useSavings();
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><div className="eyebrow">Instructions</div><h1>{INSTRUCTIONS.title}</h1><p>How to complete the savings information and how the numbers are calculated.</p></div>
      </div>

      <div className="grid split">
        <section className="card card-pad ins-card">
          <h3><Info size={17} /> Purpose</h3>
          <p>{INSTRUCTIONS.purpose}</p>
        </section>
        <section className="card card-pad ins-card accent">
          <h3><Target size={17} /> Target from source deck</h3>
          <p>{INSTRUCTIONS.target}</p>
          <p className="small muted" style={{ marginTop: 8 }}>Current benchmark in the app: {settings.target_fte.toLocaleString('en-US')} billable FTE · {money(settings.target_revenue)} revenue equivalent.</p>
        </section>
      </div>

      <section className="card card-pad">
        <h3 className="ins-h"><ClipboardList size={17} /> How to complete</h3>
        <ol className="ins-steps">{INSTRUCTIONS.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="ins-legend">
          <span>In the app each field is labelled:</span>
          <SourceTag kind="enter" /> you enter it · <SourceTag kind="project" /> filled from the linked SBF project / Project Charter ·
          <SourceTag kind="calc" /> calculated, read-only · <SourceTag kind="missing" /> required information still missing
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3 className="ins-h"><Calculator size={17} /> Calculation logic</h3></div>
        <div className="ins-logic">
          {INSTRUCTIONS.logic.map(([k, v]) => (
            <div key={k} className="ins-formula"><b>{k}</b><code>{v}</code></div>
          ))}
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <h4 className="small" style={{ margin: '4px 0 8px' }}>Also applied exactly as in the workbook formulas</h4>
          <ul className="ins-notes">{INSTRUCTIONS.workbookNotes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="ins-h"><ShieldCheck size={17} /> Guardrails</h3>
        <div className="ins-guard">
          {INSTRUCTIONS.guardrails.map((g) => <div key={g} className="callout warn"><AlertTriangle size={15} /> {g}</div>)}
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="ins-h"><BookOpen size={17} /> Source deck reference</h3>
        <p>{INSTRUCTIONS.source}</p>
      </section>
    </div>
  );
}
