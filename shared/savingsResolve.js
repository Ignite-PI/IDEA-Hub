/**
 * Resolves a Manager Input record against its linked SBF Project Hub project (stable project_id relationship):
 *  - which values come from the project / Project Charter vs. manual manager entry
 *  - Project Charter (Y/N): Y = the linked project has a charter (In Progress or Completed); N = linked but no charter;
 *    not linked → the manually recorded value if any, otherwise "Missing Information" (never silently N)
 *  - RACI: each letter from the linked charter when present, otherwise the manager's manual fallback
 *  - missing-information / validation issues used for highlighting and the "Incomplete" filter
 * Shared by the browser and the server so the UI and the Excel export always agree.
 */
import { OUTCOME, annualRates } from './savingsCalc.js';

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
export const MISSING = 'Missing Information';

const RACI_KEYS = [['R', 'responsible', 'raci_r'], ['A', 'accountable', 'raci_a'], ['C', 'consulted', 'raci_c'], ['I', 'informed', 'raci_i']];

/** project: { id, title, owner, functional_area, ops_manager, status, charter_status, raci, timeline_total } | null */
export function resolveInitiative(row, project) {
  const linked = !!project;
  const pick = (projectValue, manualValue) =>
    linked && !blank(projectValue) ? { value: projectValue, source: 'project' } : { value: manualValue ?? '', source: blank(manualValue) ? 'missing' : 'manual' };

  const initiative_name = linked ? { value: project.title, source: 'project' } : pick(null, row.initiative_name);
  const ops_manager = pick(linked ? project.ops_manager : null, row.ops_manager);
  const functional_area = pick(linked ? project.functional_area : null, row.functional_area);
  const status = linked ? { value: project.status, source: 'project' } : pick(null, row.status);

  let project_charter;
  if (linked) project_charter = { value: project.charter_status && project.charter_status !== 'Not Started' ? 'Y' : 'N', source: 'project' };
  else if (!blank(row.project_charter_manual)) project_charter = { value: row.project_charter_manual, source: 'manual' };
  else project_charter = { value: MISSING, source: 'missing' };

  const raci = {};
  for (const [letter, charterKey, manualKey] of RACI_KEYS) {
    const fromCharter = linked && project.raci ? project.raci[charterKey] : '';
    raci[letter] = !blank(fromCharter)
      ? { value: fromCharter, source: 'charter' }
      : { value: row[manualKey] ?? '', source: blank(row[manualKey]) ? 'missing' : 'manual' };
  }

  return {
    linked,
    project_title: linked ? project.title : null,
    project_owner: linked ? project.owner : null,
    initiative_name, ops_manager, functional_area, status, project_charter, raci,
  };
}

/** Returns the list of issues for a record. kind: 'missing' (required information), 'validation' (needs sign-off / Finance), 'notice'. */
export function initiativeIssues(row, resolved) {
  const issues = [];
  const need = (field, label, category, value) => { if (blank(value)) issues.push({ field, label, category, kind: 'missing' }); };

  need('initiative_name', 'Initiative Name', 'Identification', resolved.initiative_name.value);
  need('ops_manager', 'Operations Manager', 'Identification', resolved.ops_manager.value);
  need('area', 'Area', 'Identification', row.area);
  need('functional_area', 'Functional Area', 'Identification', resolved.functional_area.value);
  need('process', 'Process', 'Identification', row.process);
  need('savings_track', 'Savings Track', 'Classification', row.savings_track);
  need('savings_lever', 'Savings Lever', 'Classification', row.savings_lever);
  need('savings_outcome', 'Savings Outcome', 'Classification', row.savings_outcome);
  need('status', 'Status', 'Classification', resolved.status.value);

  need('baseline_volume', 'Baseline Annual Volume', 'Operational assumptions', row.baseline_volume);
  need('baseline_aht', 'Baseline AHT (min)', 'Operational assumptions', row.baseline_aht);
  need('future_volume', 'Future Annual Volume', 'Operational assumptions', row.future_volume);
  need('future_aht', 'Future AHT (min)', 'Operational assumptions', row.future_aht);
  need('productive_hours', 'Productive Hours per FTE', 'Operational assumptions', row.productive_hours);

  const rates = annualRates(row);
  if (rates.currentSource === 'missing') issues.push({ field: 'current_hourly_rate', label: 'Current rate (hourly or annual)', category: 'Financial assumptions', kind: 'missing' });
  if (row.savings_outcome === OUTCOME.RATE && rates.futureSource === 'missing') {
    issues.push({ field: 'future_hourly_rate', label: 'Future rate (needed for Rate Card Reduction)', category: 'Financial assumptions', kind: 'missing' });
  }
  need('confidence', 'Confidence %', 'Financial assumptions', row.confidence);
  need('realization', 'Realization %', 'Financial assumptions', row.realization);

  need('target_start', 'Target Start', 'Dates', row.target_start);
  need('expected_completion', 'Expected Completion', 'Dates', row.expected_completion);
  if (!blank(row.target_start) && !blank(row.expected_completion) && row.expected_completion < row.target_start) {
    issues.push({ field: 'expected_completion', label: 'Expected Completion is before Target Start', category: 'Dates', kind: 'missing' });
  }

  need('executive_story', 'Executive Story / Impact', 'Story & evidence', row.executive_story);
  need('evidence', 'Evidence / Dependency', 'Story & evidence', row.evidence);

  if (blank(row.owner_signoff)) issues.push({ field: 'owner_signoff', label: 'Owner Sign-off not recorded', category: 'Validation', kind: 'missing' });
  else if (row.owner_signoff !== 'Yes') issues.push({ field: 'owner_signoff', label: 'Needs Owner sign-off', category: 'Validation', kind: 'validation' });
  if (blank(row.finance_validated)) issues.push({ field: 'finance_validated', label: 'Finance validation not recorded', category: 'Validation', kind: 'missing' });
  else if (row.finance_validated !== 'Yes') issues.push({ field: 'finance_validated', label: 'Needs Finance validation (not committed)', category: 'Validation', kind: 'validation' });

  if (resolved.project_charter.value === MISSING) issues.push({ field: 'project_charter', label: 'Project Charter status unknown (not linked to a project)', category: 'Project Charter', kind: 'missing' });
  else if (resolved.project_charter.value === 'N') issues.push({ field: 'project_charter', label: 'No Project Charter', category: 'Project Charter', kind: 'missing' });

  for (const letter of ['R', 'A', 'C', 'I']) {
    if (resolved.raci[letter].source === 'missing') issues.push({ field: `raci_${letter.toLowerCase()}`, label: `RACI ${letter} missing`, category: 'RACI', kind: 'missing' });
  }
  if (!resolved.linked) issues.push({ field: 'project_id', label: 'Not linked to an SBF Project Hub project', category: 'Project link', kind: 'notice' });
  return issues;
}

export const isIncomplete = (issues) => issues.some((i) => i.kind === 'missing');
export const needsValidation = (issues) => issues.some((i) => i.kind === 'validation' || (i.category === 'Validation' && i.kind === 'missing'));
