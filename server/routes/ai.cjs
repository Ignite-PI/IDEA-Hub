const express = require('express');
const { chat, status, AiError } = require('../ai/azureOpenAI.cjs');
const { SYSTEM, TEXT_ACTIONS, ROW_ACTIONS, CHAT_PRESETS, formatContext, clip } = require('../ai/prompts.cjs');

const router = express.Router();

// Simple per-client rate limit to protect the Azure quota
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.AI_MAX_REQUESTS_PER_MINUTE) || 20;
const hits = new Map();
router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const key = req.ip;
  const t = Date.now();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return res.status(429).json({ error: 'Too many AI requests. Please wait a minute and try again.', code: 'rate_limited' });
  recent.push(t);
  hits.set(key, recent);
  next();
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof AiError) return res.status(e.status).json({ error: e.message, code: e.code });
  console.error('[ai]', e);
  res.status(500).json({ error: 'The AI assistant hit an unexpected problem. Your text has not been changed.', code: 'internal' });
});

const contextBlock = (ctx) => `PROJECT CONTEXT (use only this information):\n${formatContext(ctx)}`;

router.get('/status', (_req, res) => res.json(status()));

/** Rewrite / suggest for a single field. Returns a suggestion only — the client decides what to do with it. */
router.post('/assist', wrap(async (req, res) => {
  const { action, text = '', field = 'text', context } = req.body ?? {};
  const fieldLabel = clip(field).slice(0, 80);

  if (ROW_ACTIONS[action]) {
    const spec = ROW_ACTIONS[action];
    const content = await chat([
      { role: 'system', content: `${SYSTEM}\nRespond with a single JSON object exactly matching this shape: ${spec.schema}` },
      { role: 'user', content: `${contextBlock(context)}\n\nEXISTING ${fieldLabel.toUpperCase()} (do not repeat these):\n${clip(text) || '(none)'}\n\nTASK: ${spec.instruction}` },
    ], { json: true });
    let items;
    try {
      items = JSON.parse(content).items;
    } catch {
      throw new AiError('bad_response', 'The AI response could not be read. Please try Regenerate.', 502);
    }
    if (!Array.isArray(items) || !items.length) throw new AiError('bad_response', 'The AI did not return any suggestions. Please try Regenerate.', 502);
    const rows = items.slice(0, 12).map((it) => Object.fromEntries(spec.fields.map((f) => [f, clip(it?.[f]).slice(0, 500)])));
    return res.json({ kind: 'rows', rows });
  }

  const instruction = TEXT_ACTIONS[action];
  if (!instruction) return res.status(400).json({ error: 'Unknown AI action.', code: 'invalid_request' });
  const source = clip(text);
  const generative = action.startsWith('suggest_') || action === 'expand';
  if (!source.trim() && !generative) return res.status(400).json({ error: 'Enter some text first, then ask the assistant to improve it.', code: 'empty_text' });

  const suggestion = await chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `${contextBlock(context)}\n\nFIELD: ${fieldLabel}\nCURRENT TEXT:\n${source || '(empty)'}\n\nTASK: ${instruction}` },
  ]);
  res.json({ kind: 'text', suggestion });
}));

/** AI Assistant panel: preset or free-text question about the current project only. */
router.post('/chat', wrap(async (req, res) => {
  const { preset, message = '', context } = req.body ?? {};
  const question = CHAT_PRESETS[preset] ?? clip(message).slice(0, 1000).trim();
  if (!question) return res.status(400).json({ error: 'Choose a suggested prompt or type a question.', code: 'empty_text' });
  const reply = await chat([
    { role: 'system', content: `${SYSTEM}\nYou may use short paragraphs and "- " bullet lists. If the question is unrelated to this project, politely say you can only help with this project.` },
    { role: 'user', content: `${contextBlock(context)}\n\nQUESTION: ${question}` },
  ], { maxTokens: 1100 });
  res.json({ reply, prompt: question });
}));

module.exports = router;
