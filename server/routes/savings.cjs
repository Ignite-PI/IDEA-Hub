/** Senior Manager savings module API — MANAGERS account only (see app.cjs). */
const express = require('express');
const savings = require('../repositories/savingsRepository.cjs');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => (e.status ? res.status(e.status).json({ error: e.message }) : next(e)));
const userOf = (req) => {
  let name = '';
  try { name = decodeURIComponent(String(req.get('x-user-name') || '')).trim().slice(0, 100); } catch { /* ignore */ }
  return name ? `${name} (${req.session.username})` : req.session.username;
};
const LIST_KEYS = ['savings_track', 'savings_lever', 'savings_outcome', 'status', 'yes_no', 'area', 'functional_area'];
const SETTING_KEYS = ['projected_exit_hc', 'projected_exit_revenue', 'target_fte', 'target_revenue', 'potential_pool_revenue', 'potential_pool_fte', 'target_percent'];

router.get('/bootstrap', wrap(async (_req, res) => {
  const [lists, settings, initiatives, projects] = await Promise.all([savings.getLists(), savings.getSettings(), savings.listInitiatives(), savings.linkedProjects()]);
  res.json({ lists, settings, initiatives, projects });
}));

router.post('/initiatives', wrap(async (req, res) => {
  res.status(201).json(await savings.saveInitiative(null, req.body ?? {}, userOf(req)));
}));

router.put('/initiatives/:id', wrap(async (req, res) => {
  const row = await savings.saveInitiative(req.params.id, req.body ?? {}, userOf(req));
  if (!row) return res.status(404).json({ error: 'Initiative not found' });
  res.json(row);
}));

router.delete('/initiatives/:id', wrap(async (req, res) => {
  if (!(await savings.deleteInitiative(req.params.id))) return res.status(404).json({ error: 'Initiative not found' });
  res.json({ success: true });
}));

router.put('/settings', wrap(async (req, res) => {
  const patch = {};
  for (const k of SETTING_KEYS) {
    if (req.body?.[k] === undefined) continue;
    const n = Number(req.body[k]);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} must be a positive number.` });
    patch[k] = n;
  }
  res.json(await savings.updateSettings(patch));
}));

router.post('/lists', wrap(async (req, res) => {
  const key = String(req.body?.list_key || '');
  const value = String(req.body?.value || '').trim().slice(0, 120);
  if (!LIST_KEYS.includes(key) || ['savings_outcome', 'status', 'yes_no'].includes(key)) {
    // Outcome/Status/Yes-No drive calculations or shared statuses; only descriptive lists are extendable here
    return res.status(400).json({ error: 'That list cannot be extended from the app.' });
  }
  if (!value) return res.status(400).json({ error: 'Enter a value.' });
  res.json(await savings.addListValue(key, value));
}));

router.post('/import', wrap(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows || rows.some((r) => !String(r.source_key || '').startsWith('workbook:'))) return res.status(400).json({ error: 'Expected workbook rows with source keys.' });
  res.json(await savings.importWorkbookRows(rows, userOf(req)));
}));

router.get('/export', wrap(async (_req, res) => {
  const { buildSavingsWorkbook } = require('../savingsExport.cjs');
  const [lists, settings, initiatives, projects] = await Promise.all([savings.getLists(), savings.getSettings(), savings.listInitiatives(), savings.linkedProjects()]);
  const buffer = await buildSavingsWorkbook({ lists, settings, initiatives, projects });
  const stamp = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="30pct_Savings_${stamp}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
}));

module.exports = router;
