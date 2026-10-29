/**
 * Server-side prompt catalogue. The browser can only pick an action id — it can
 * never send its own system prompt.
 */
const SYSTEM = `You are the writing assistant inside SBF Project Hub, an internal tool the SBF Tower uses to track improvement ideas, projects and Project Charters. Projects follow the CURES approach: Collaborate, Understand, Redesign, Execute, Sustain.
Rules:
- Use ONLY the project information and text provided. Do not invent facts, people, systems, numbers or dates.
- Where a specific value is needed but not provided, use a clearly marked placeholder in square brackets, e.g. [baseline %] or [target date].
- Write clear, concise, professional business English suitable for leadership.
- Return only the requested content: no preamble, no explanations, no markdown headings, no surrounding quotes.
- For lists, put each item on its own line starting with "- ".`;

const TEXT_ACTIONS = {
  rephrase: 'Rephrase the text while keeping its meaning.',
  clarity: 'Rewrite the text to improve clarity and readability while keeping its meaning.',
  concise: 'Make the text more concise. Remove repetition and filler while keeping all key points.',
  professional: 'Rewrite the text in a more professional tone appropriate for leadership.',
  grammar: 'Correct spelling, grammar and punctuation only. Keep wording and meaning otherwise unchanged.',
  expand: 'Expand the explanation with more helpful detail, using only the project context provided. Mark any needed specifics as placeholders.',
  summarize: 'Summarize the text in 2-3 sentences.',
  improve_problem: 'Rewrite this as a strong problem statement: describe the current state, who is affected, the measurable impact (use placeholders for unknown numbers) and why it matters now. Do not propose solutions.',
  improve_goals: 'Rewrite these as SMART project/engagement goals (specific, measurable, achievable, relevant, time-bound), as a short list. Use placeholders for unknown targets or dates.',
  improve_impact: 'Rewrite this as a clear business impact / benefit statement covering e.g. cost, quality, member/provider experience, compliance or risk, as applicable to the context. Use placeholders for unknown values.',
  improve_scope: 'Rewrite this scope text so in-scope and out-of-scope items and constraints are explicit and unambiguous, as a short list.',
  suggest_metrics: 'Suggest 3-5 measurable key metrics for this project as a list. For each give the metric name and how it is measured.',
  suggest_deliverables: 'Suggest concrete project deliverables for this project as a list.',
  suggest_milestones: 'Suggest key milestones or tasks for this project as a list, ordered in sequence across the CURES phases where relevant.',
};

const ROW_ACTIONS = {
  suggest_metrics_rows: {
    instruction: 'Suggest 3-5 measurable key metrics for this project.',
    schema: '{"items":[{"metric":"short name","definition":"how it is measured","target":"target value or placeholder","baseline":"baseline value or placeholder","impact":"expected impact"}]}',
    fields: ['metric', 'definition', 'target', 'baseline', 'impact'],
  },
  suggest_milestones_rows: {
    instruction: 'Suggest 4-8 key milestones or tasks for this project, in sequence.',
    schema: '{"items":[{"task":"milestone or task","owner":"owner name only if given in the context, otherwise empty","dueDate":"YYYY-MM-DD only if derivable from the context, otherwise empty"}]}',
    fields: ['task', 'owner', 'dueDate'],
  },
};

const CHAT_PRESETS = {
  problem: 'Help me improve the problem statement.',
  goals: 'Suggest measurable project goals.',
  metrics: 'Suggest key metrics for this project, with a definition, baseline and target for each (use placeholders where unknown).',
  deliverables: 'Turn the project description into a list of project deliverables.',
  risks: 'Suggest possible project risks and a mitigation for each.',
  summary: 'Summarize this Project Charter for leadership in a short paragraph.',
  gaps: 'Check which Project Charter sections are missing or need more detail, and say specifically what to add to each.',
};

const LIMIT = 4000;
const clip = (v) => String(v ?? '').slice(0, LIMIT);

/** Turns the (unsaved) project/charter state sent by the browser into a compact, bounded context block. */
function formatContext(ctx = {}) {
  const p = ctx.project ?? {};
  const c = ctx.charter ?? {};
  const lines = [];
  const add = (label, v) => { if (v && String(v).trim()) lines.push(`${label}: ${clip(v)}`); };
  add('Project Title', p.title || c.projectTitle);
  add('Project Description', p.description);
  add('Project Status', p.status);
  add('Functional Area', p.functional_area || c.businessFunction);
  add('Project Owner', p.owner || c.businessOwner);
  add('Operations Manager', p.ops_manager);
  add('Executive Sponsor', c.executiveSponsor);
  add('Line of Business', c.lineOfBusiness);
  add('Execution Lead', c.executionLead);
  add('CURES Lead', c.curesLead);
  add('Problem Statement', c.problemStatement);
  add('Engagement / Project Goals', c.projectGoals);
  add('Business Impact / Benefit', c.businessImpact);
  add('In Scope', c.inScope);
  add('Out of Scope', c.outOfScope);
  add('Constraints', c.constraints);
  add('Project Deliverables', c.deliverables);
  if (Array.isArray(c.keyMetrics)) {
    const m = c.keyMetrics.filter((x) => x && x.metric).slice(0, 20)
      .map((x) => `- ${clip(x.metric)} | definition: ${clip(x.definition)} | baseline: ${clip(x.baseline)} | target: ${clip(x.target)} | impact: ${clip(x.impact)}`);
    if (m.length) lines.push(`Key Metrics:\n${m.join('\n')}`);
  }
  if (c.raci) {
    for (const k of ['responsible', 'accountable', 'consulted', 'informed']) add(`RACI ${k}`, c.raci[k]);
  }
  if (Array.isArray(c.milestones)) {
    const m = c.milestones.filter((x) => x && x.task).slice(0, 30).map((x) => `- ${clip(x.task)}${x.owner ? ` (owner: ${clip(x.owner)})` : ''}${x.dueDate ? ` due ${x.dueDate}` : ''}`);
    if (m.length) lines.push(`Milestones / Tasks:\n${m.join('\n')}`);
  }
  if (Array.isArray(ctx.timeline)) {
    const t = ctx.timeline.filter((x) => x && (x.task || x.start_date)).slice(0, 40)
      .map((x) => `- ${x.phase}: ${clip(x.task)} [${x.start_date || '?'} to ${x.end_date || '?'}] status: ${x.status}`);
    if (t.length) lines.push(`CURES Timeline Activities:\n${t.join('\n')}`);
  }
  return lines.join('\n').slice(0, 16000) || '(no project information provided yet)';
}

module.exports = { SYSTEM, TEXT_ACTIONS, ROW_ACTIONS, CHAT_PRESETS, formatContext, clip };
