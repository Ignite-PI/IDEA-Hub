import { AlertTriangle, ClipboardCheck, FileInput, Info } from 'lucide-react';
import type { ProjectDetail } from '../types';
import { charterMissing, normalizeCharter } from '../utils/charter';
import { needsTitle } from '../utils/projectQuery';

/**
 * "What do I still need to complete?" panel. Shown for imported charters and for projects still titled
 * "Needs Project Title". Missing Information is recalculated live, so items disappear once they are filled in.
 * Never color-only: every item has an icon and a text label.
 */
export function ImportReview({ project }: { project: ProjectDetail }) {
  const info = project.charter?.data?.importInfo;
  const untitled = needsTitle(project);
  if (!info && !untitled) return null;
  const data = project.charter ? normalizeCharter(project.charter.data, project) : null;
  const live: string[] = [];
  if (untitled) live.push('Project Title');
  if (!project.business_function) live.push('Business Function (Clinical Functions or Specialized Business Functions)');
  if (!project.owner?.trim()) live.push('Project Owner');
  if (!project.functional_area?.trim()) live.push('Functional Area');
  if (data) for (const m of charterMissing(data, project.timeline)) live.push(m.label);
  const review = info?.needsReview ?? [];

  return (
    <section className="card review-card" id="needs-review" style={{ marginTop: 20 }}>
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="section-icon warn"><ClipboardCheck size={18} /></span>
          <div>
            <h2>Needs Review / Missing Information</h2>
            <p>Items to check or complete for this project</p>
          </div>
        </div>
        {info && <span className="source-pill"><FileInput size={13} aria-hidden /> Source: {info.source}</span>}
      </div>
      <div className="card-body review-grid">
        {untitled && (
          <div className="review-item title"><AlertTriangle size={15} aria-hidden /><span><b>Needs Project Title</b> — the source charter has no reliable title. Use <b>Edit Project</b> to enter it.</span></div>
        )}
        <div>
          <h4 className="review-h"><AlertTriangle size={14} aria-hidden /> Needs Review ({review.length})</h4>
          {review.length ? <ul className="review-list">{review.map((r) => <li key={r} className="review-item rv"><Info size={13} aria-hidden /><span>{r}</span></li>)}</ul>
            : <p className="small muted">Nothing flagged for review.</p>}
        </div>
        <div>
          <h4 className="review-h"><AlertTriangle size={14} aria-hidden /> Missing Information ({live.length})</h4>
          {live.length ? <ul className="review-list">{live.map((m) => <li key={m} className="review-item ms"><AlertTriangle size={13} aria-hidden /><span><b>Missing Information:</b> {m}</span></li>)}</ul>
            : <p className="small muted">All required information is filled in.</p>}
        </div>
      </div>
    </section>
  );
}
