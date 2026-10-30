/**
 * Text content carried over verbatim from "30% Savings Calculation Template File_SBF for edit.xlsx"
 * (Instructions tab, Storyboard tab and the Manager Input column comments). Used by the web pages and the Excel export.
 */
export const INSTRUCTIONS = {
  title: '30% Clinical Savings | Managers Input Guide',
  purpose: 'Capture initiative assumptions once, convert operational improvements into FTE and annual dollar value, and feed the leadership storyboard.',
  target: '30% of projected 2027 exit: 335 billable FTE and $11.78M revenue equivalent.',
  steps: [
    'Enter one initiative per row on the Manager Input sheet.',
    'Complete manager, business unit/account, process, track, lever, outcome, and status.',
    'Enter annual baseline/future volume and handling time. Use the same unit and annual period for both scenarios.',
    'Enter productive hours per FTE (default recommendation: your locally approved annual productive hours), current/future annual rate, confidence, and realization.',
    'Add a concise executive story and evidence/dependencies; obtain Operations and Finance validation.',
  ],
  logic: [
    ['Baseline workload FTE', 'Baseline annual volume x baseline AHT ÷ 60 ÷ productive hours per FTE.'],
    ['Future workload FTE', 'Future annual volume x future AHT ÷ 60 ÷ productive hours per FTE.'],
    ['Capacity FTE released', 'Maximum of baseline workload FTE less future workload FTE, or zero.'],
    ['Gross annual savings', 'Headcount/capacity outcomes: released FTE x current annual rate. Rate-card outcomes: future workload FTE x (current rate - future rate).'],
    ['Risk-adjusted savings', 'Gross annual savings x confidence % x realization %. Summary uses risk-adjusted value.'],
  ],
  guardrails: [
    'Do not count the same benefit under more than one initiative or outcome.',
    'Use validated annualized volumes and fully loaded annual rate cards.',
    'Additional Work / Capacity is an economic capacity value; label it separately from cash savings in the storyboard.',
    'Finance validation should be Yes before a benefit is presented as committed.',
  ],
  source: 'Projected 2027 exit: 1,117 billable HC / $39,267,995.75; potential savings pool: 427 FTE / $12,936,071.28.',
  // Behaviour present in the workbook formulas but not spelled out in its text
  workbookNotes: [
    'Additional Work / Capacity: when future annual volume is higher than baseline volume, the workbook calculates Baseline Workload FTE with the future volume at the baseline AHT (it measures the extra work absorbed).',
    'Annual rate per FTE = hourly rate × productive hours per FTE for each initiative. In the app, enter the initiative\u2019s own hourly rates (no global default), or enter an annual rate directly when no hourly rate is available.',
    'Rate Card Savings is never negative: if the future rate is higher than the current rate the value is 0.',
  ],
};

/** Storyboard tab rows. metric keys map to live summary values. */
export const STORYBOARD = [
  { slide: '1 - What is 30%?', purpose: 'Define the ambition', headline: '30% of projected 2027 exit', metric: 'target', metricLabel: '30% Target - Revenue Equivalent', evidence: 'Baseline HC and revenue from source deck', owner: 'Leadership confirms target' },
  { slide: '2 - What does 30% mean?', purpose: 'Clarify outcomes', headline: 'Reduce billable HC, absorb more work, or lower rate card', metric: 'risk_adjusted_value', metricLabel: 'Risk-Adjusted Value', evidence: 'Separate cash and capacity value', owner: 'Finance aligns benefit taxonomy' },
  { slide: '3 - How do we get there?', purpose: 'Explain the math', headline: 'Handling time + volume improvement converts to FTE and value', metric: 'capacity_fte_released', metricLabel: 'Capacity FTE Released', evidence: 'Before/after volume, AHT, productive hours, rate', owner: 'Operations validates assumptions' },
  { slide: '4 - Savings tracks', purpose: 'Show portfolio mix', headline: 'Process, People, and Technology levers build the pipeline', metric: 'initiatives_entered', metricLabel: 'Initiatives Entered', evidence: 'Track-level value and initiative count', owner: 'Track owners close gaps' },
  { slide: '5 - Pipeline vs target', purpose: 'Show progress', headline: 'Risk-adjusted portfolio value versus $11.78M target', metric: 'target_achievement', metricLabel: 'Target Achievement', evidence: 'Target achievement and validation status', owner: 'Prioritize highest-confidence gap closures' },
  { slide: '6 - Initiative proof points', purpose: 'Make it tangible', headline: 'Top initiatives demonstrate credible delivery', metric: 'max_risk_adjusted', metricLabel: 'Largest initiative (risk-adjusted)', evidence: 'Executive story, evidence, timing, owner', owner: 'Secure sign-off and Finance validation' },
];

/** Manager Input columns A..AO in workbook order, with the workbook's column comments and how the app fills them. */
export const COLUMNS = [
  { col: 'A', header: 'Initiative ID', key: 'initiative_no', kind: 'system', help: 'Unique identifier for the savings initiative. Use a consistent code such as CLIN-001.' },
  { col: 'B', header: 'Operations Manager', key: 'ops_manager', kind: 'input', linked: true, help: 'Operations Manager accountable for the initiative assumptions, delivery, and updates.' },
  { col: 'C', header: 'Area', key: 'area', kind: 'input', list: 'area', help: 'Business unit, delivery group, or organizational area affected by the initiative.' },
  { col: 'D', header: 'Functional Area', key: 'functional_area', kind: 'input', list: 'functional_area', linked: true, help: 'Client, customer account, program, or internal portfolio associated with the initiative.' },
  { col: 'E', header: 'Process', key: 'process', kind: 'input', help: 'Operational process or workflow being improved, such as intake, review, documentation, or quality control.' },
  { col: 'F', header: 'Initiative Name', key: 'initiative_name', kind: 'input', linked: true, help: 'Short, specific name that clearly identifies the improvement initiative.' },
  { col: 'G', header: 'Savings Track', key: 'savings_track', kind: 'input', list: 'savings_track', help: 'Primary transformation category: Process, People, or Technology. Select from the drop-down.' },
  { col: 'H', header: 'Savings Lever', key: 'savings_lever', kind: 'input', list: 'savings_lever', help: 'Specific improvement method, such as process redesign, handoff improvement, rework reduction, right-skilling, automation, or AI.' },
  { col: 'I', header: 'Savings Outcome', key: 'savings_outcome', kind: 'input', list: 'savings_outcome', help: 'How value will be realized: Billable Headcount Reduction, Additional Work / Capacity, or Rate Card Reduction.' },
  { col: 'J', header: 'Status', key: 'status', kind: 'input', list: 'status', linked: true, help: 'Current lifecycle stage of the initiative, from Idea through Implemented. Select from the drop-down.' },
  { col: 'K', header: 'Baseline Annual Volume', key: 'baseline_volume', kind: 'input', type: 'number', help: 'Total annual transaction, case, task, or work-item volume before the improvement.' },
  { col: 'L', header: 'Baseline AHT (min)', key: 'baseline_aht', kind: 'input', type: 'number', help: 'Average handling time per work item before the improvement, entered in minutes.' },
  { col: 'M', header: 'Future Annual Volume', key: 'future_volume', kind: 'input', type: 'number', help: 'Expected annual work-item volume after implementation. Use the same unit as baseline volume.' },
  { col: 'N', header: 'Future AHT (min)', key: 'future_aht', kind: 'input', type: 'number', help: 'Expected average handling time per work item after implementation, entered in minutes.' },
  { col: 'O', header: 'Productive Hours per FTE', key: 'productive_hours', kind: 'input', type: 'number', help: 'Approved annual productive working hours for one FTE, excluding nonproductive time as defined locally.' },
  { col: 'P', header: 'Current Annual Rate per FTE', key: 'current_annual_rate', kind: 'rate', type: 'currency', help: 'Current fully loaded annual cost or rate-card value for one FTE.' },
  { col: 'Q', header: 'Future Annual Rate per FTE', key: 'future_annual_rate', kind: 'rate', type: 'currency', help: 'Expected fully loaded annual rate per FTE after right-skilling, left-shifting, or rate-card changes.' },
  { col: 'R', header: 'Confidence %', key: 'confidence', kind: 'input', type: 'percent', help: 'Probability that the estimated benefit is achievable based on evidence and validation. Enter 0%–100%.' },
  { col: 'S', header: 'Realization %', key: 'realization', kind: 'input', type: 'percent', help: 'Share of the gross annual benefit expected to be captured in practice. Enter 0%–100%.' },
  { col: 'T', header: 'Baseline Workload FTE', key: 'baseline_workload_fte', kind: 'calc', type: 'fte', help: 'Calculated baseline FTE: baseline annual volume × baseline AHT ÷ 60 ÷ productive hours per FTE.' },
  { col: 'U', header: 'Future Workload FTE', key: 'future_workload_fte', kind: 'calc', type: 'fte', help: 'Calculated future FTE: future annual volume × future AHT ÷ 60 ÷ productive hours per FTE.' },
  { col: 'V', header: 'Capacity FTE Released', key: 'capacity_fte_released', kind: 'calc', type: 'fte', help: 'Calculated capacity released: baseline workload FTE less future workload FTE, with a minimum of zero.' },
  { col: 'W', header: 'HC Reduction FTE', key: 'hc_reduction_fte', kind: 'calc', type: 'fte', help: 'Calculated released FTE classified as billable headcount reduction when that outcome is selected.' },
  { col: 'X', header: 'Extra Capacity FTE', key: 'extra_capacity_fte', kind: 'calc', type: 'fte', help: 'Calculated released FTE classified as capacity available to absorb additional work when that outcome is selected.' },
  { col: 'Y', header: 'Rate Card Savings', key: 'rate_card_savings', kind: 'calc', type: 'currency', help: 'Calculated annual value from lowering the rate: future workload FTE × (current annual rate − future annual rate).' },
  { col: 'Z', header: 'Gross Annual Savings', key: 'gross_annual_savings', kind: 'calc', type: 'currency', help: 'Calculated annual economic value before confidence and realization adjustments.' },
  { col: 'AA', header: 'Risk-Adjusted Savings', key: 'risk_adjusted_savings', kind: 'calc', type: 'currency', help: 'Calculated gross annual savings × confidence % × realization %. This feeds the summary and storyboard.' },
  { col: 'AB', header: 'Target Start', key: 'target_start', kind: 'input', type: 'date', help: 'Planned date for implementation or benefit-delivery work to begin.' },
  { col: 'AC', header: 'Expected Completion', key: 'expected_completion', kind: 'input', type: 'date', help: 'Planned date when implementation is expected to finish or the benefit reaches steady state.' },
  { col: 'AD', header: 'Executive Story / Impact', key: 'executive_story', kind: 'input', type: 'text', help: 'Concise leadership-ready statement describing the problem, intervention, operational impact, and expected value.' },
  { col: 'AE', header: 'Evidence / Dependency', key: 'evidence', kind: 'input', type: 'text', help: 'Supporting data, baseline source, pilot result, key assumption, dependency, constraint, or delivery risk.' },
  { col: 'AF', header: 'Owner Sign-off', key: 'owner_signoff', kind: 'input', list: 'yes_no', help: 'Whether the accountable Operations owner has reviewed and approved the assumptions. Select Yes or No.' },
  { col: 'AG', header: 'Finance Validated', key: 'finance_validated', kind: 'input', list: 'yes_no', help: 'Whether Finance has reviewed and validated the savings methodology and value. Select Yes or No.' },
  { col: 'AH', header: 'Last Updated', key: 'last_updated', kind: 'system', type: 'date', help: 'Date the initiative record or its assumptions were most recently reviewed and updated.' },
  { col: 'AI', header: 'Project Charter (Y/N)', key: 'project_charter', kind: 'linked', help: 'Y when the linked SBF Project Hub project has a Project Charter. Not an indication that the project is complete.' },
  { col: 'AJ', header: 'Timeline', key: 'timeline_text', kind: 'input', help: 'Free text (no definition or formula in the workbook).' },
  { col: 'AK', header: 'FTE', key: 'fte_text', kind: 'input', help: 'Free text (no definition or formula in the workbook).' },
  { col: 'AL', header: 'R', key: 'raci_r', kind: 'raci', letter: 'R', help: 'Responsible — from the linked Project Charter RACI when available, otherwise entered here.' },
  { col: 'AM', header: 'A', key: 'raci_a', kind: 'raci', letter: 'A', help: 'Accountable — from the linked Project Charter RACI when available, otherwise entered here.' },
  { col: 'AN', header: 'C', key: 'raci_c', kind: 'raci', letter: 'C', help: 'Consulted — from the linked Project Charter RACI when available, otherwise entered here.' },
  { col: 'AO', header: 'I', key: 'raci_i', kind: 'raci', letter: 'I', help: 'Informed — from the linked Project Charter RACI when available, otherwise entered here.' },
];
