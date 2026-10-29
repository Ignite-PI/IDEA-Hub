/**
 * Copies legacy SQLite rows (projects, charters, status_history, timeline_activities) into Postgres.
 * Non-destructive and idempotent: existing ids are skipped, nothing is updated or deleted.
 * Used by scripts/migrate-sqlite-to-postgres.cjs and the authenticated POST /api/admin/import.
 */
async function importLegacy(q, data) {
  const count = { projects: 0, charters: 0, history: 0, timeline: 0, skipped: 0 };
  const str = (v) => (v === null || v === undefined ? '' : String(v));

  for (const p of data.projects ?? []) {
    const r = await q(`INSERT INTO projects (id, title, description, owner, functional_area, ops_manager, status, link, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [p.id, p.title, str(p.description), str(p.owner), str(p.functional_area), str(p.ops_manager), p.status, str(p.link), p.created_at, p.updated_at]);
    r.length ? count.projects++ : count.skipped++;
  }
  for (const c of data.charters ?? []) {
    const d = typeof c.data === 'string' ? JSON.parse(c.data) : c.data;
    const r = await q(`INSERT INTO charters (project_id, data, status, completeness, created_at, updated_at) VALUES ($1,$2::jsonb,$3,NULL,$4,$5)
                       ON CONFLICT (project_id) DO NOTHING RETURNING project_id`, [c.project_id, JSON.stringify(d), c.status, c.created_at, c.updated_at]);
    if (!r.length) { count.skipped++; continue; }
    count.charters++;
    const raci = d.raci ?? {};
    await q('INSERT INTO charter_raci (project_id, responsible, accountable, consulted, informed) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [c.project_id, str(raci.responsible), str(raci.accountable), str(raci.consulted), str(raci.informed)]);
    for (const [i, m] of (Array.isArray(d.keyMetrics) ? d.keyMetrics : []).entries()) {
      if (![m.metric, m.definition, m.target, m.baseline, m.impact].some((x) => str(x).trim())) continue;
      await q('INSERT INTO charter_key_metrics (id, project_id, position, metric, definition, target, baseline, impact) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',
        [`${c.project_id}:${m.id ?? i}`, c.project_id, i, str(m.metric), str(m.definition), str(m.target), str(m.baseline), str(m.impact)]);
    }
  }
  for (const h of data.status_history ?? []) {
    const r = await q(`INSERT INTO status_history (id, project_id, from_status, to_status, changed_at, changed_by, note) VALUES ($1,$2,$3,$4,$5,$6,$7)
                       ON CONFLICT (id) DO NOTHING RETURNING id`, [h.id, h.project_id, h.from_status || null, h.to_status, h.changed_at, str(h.changed_by), str(h.note)]);
    r.length ? count.history++ : count.skipped++;
  }
  for (const a of data.timeline_activities ?? []) {
    const r = await q(`INSERT INTO timeline_activities (id, project_id, phase, task, start_date, end_date, status, progress, depends_on, sort_order, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [a.id, a.project_id, a.phase, str(a.task), a.start_date || null, a.end_date || null, a.status, a.progress ?? null, str(a.depends_on), a.sort_order ?? 0, a.created_at, a.updated_at]);
    r.length ? count.timeline++ : count.skipped++;
  }
  return count;
}

module.exports = { importLegacy };
