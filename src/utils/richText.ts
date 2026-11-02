/**
 * Lightweight rich text for long charter fields, stored as plain text so existing values keep working:
 *   - paragraphs separated by a blank line (single newlines are line breaks)
 *   - bullet items: lines starting with "- ", "• " or "* "
 *   - numbered items: lines starting with "1. " / "1) "
 *   - bold: **text**
 * The same parser feeds the editor, the read-only views, the AI suggestions and the Word / PDF / PowerPoint exports.
 */
export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: 'p'; lines: Inline[][] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][] };

const BULLET = /^\s*(?:[-•*▪●◦‣])\s+(.*)$/;
const NUMBER = /^\s*\d{1,3}[.)]\s+(.*)$/;

/** Splits **bold** markers into runs. Unmatched markers are kept as literal text. */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out.length ? out : [{ text: '', bold: false }];
}

export function parseRich(text: string | undefined | null): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', lines: para.map(parseInline) }); para = []; } };
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const b = BULLET.exec(raw);
    const n = !b ? NUMBER.exec(raw) : null;
    if (b || n) {
      flush();
      const type = b ? 'ul' : 'ol';
      const item = parseInline((b ?? n)![1]!);
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === type) prev.items.push(item); else blocks.push({ type, items: [item] } as Block);
    } else if (!raw.trim()) {
      flush();
      // a blank line also ends a list, so the next list starts fresh
      if (blocks.length && blocks[blocks.length - 1]!.type !== 'p') blocks.push({ type: 'p', lines: [] });
    } else {
      // text right after a list item starts a new paragraph
      para.push(raw.trimEnd());
    }
  }
  flush();
  return blocks.filter((bl) => bl.type !== 'p' || bl.lines.length);
}

const inlineText = (runs: Inline[]) => runs.map((r) => (r.bold && r.text.trim() ? `**${r.text}**` : r.text)).join('');

/** Canonical text form of blocks (what is stored). */
export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.type === 'p') return b.lines.map(inlineText).join('\n');
    if (b.type === 'ul') return b.items.map((i) => `- ${inlineText(i)}`).join('\n');
    return b.items.map((i, k) => `${k + 1}. ${inlineText(i)}`).join('\n');
  }).filter((s) => s.trim()).join('\n\n');
}

/** Plain lines for outputs without inline styling (bold markers removed, bullets as • and numbers kept). */
export function richToPlain(text: string | undefined | null): string {
  return parseRich(text).map((b) => {
    const t = (runs: Inline[]) => runs.map((r) => r.text).join('');
    if (b.type === 'p') return b.lines.map(t).join('\n');
    if (b.type === 'ul') return b.items.map((i) => `•  ${t(i)}`).join('\n');
    return b.items.map((i, k) => `${k + 1}.  ${t(i)}`).join('\n');
  }).join('\n\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inlineHtml = (runs: Inline[]) => runs.map((r) => (r.bold ? `<strong>${esc(r.text)}</strong>` : esc(r.text))).join('') || '<br>';

/** HTML for the editor (all text escaped; only p/ul/ol/li/strong/br are produced). */
export function richToHtml(text: string): string {
  const blocks = parseRich(text);
  if (!blocks.length) return '<p><br></p>';
  return blocks.map((b) => {
    if (b.type === 'p') return `<p>${b.lines.map(inlineHtml).join('<br>')}</p>`;
    const tag = b.type;
    return `<${tag}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${tag}>`;
  }).join('');
}

/** Reads the editor DOM back into blocks (handles the markup browsers create while editing). */
export function domToText(root: HTMLElement): string {
  const blocks: Block[] = [];
  let lines: Inline[][] = [[]];
  const flushPara = () => {
    const ls = lines.filter((l, i) => l.some((r) => r.text.trim()) || (i > 0 && i < lines.length - 1));
    if (ls.some((l) => l.some((r) => r.text.trim()))) blocks.push({ type: 'p', lines: ls });
    lines = [[]];
  };
  const inline = (node: Node, bold: boolean, into: Inline[][]) => {
    if (node.nodeType === Node.TEXT_NODE) { into[into.length - 1]!.push({ text: (node.textContent ?? '').replace(/\u00a0/g, ' '), bold }); return; }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === 'BR') { into.push([]); return; }
    const b = bold || tag === 'B' || tag === 'STRONG' || (parseInt(node.style.fontWeight, 10) >= 600);
    node.childNodes.forEach((c) => inline(c, b, into));
  };
  const walk = (node: Node) => {
    if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
      flushPara();
      const items: Inline[][] = [];
      node.querySelectorAll(':scope > li').forEach((li) => {
        const parts: Inline[][] = [[]];
        li.childNodes.forEach((c) => { if (!(c instanceof HTMLElement && (c.tagName === 'UL' || c.tagName === 'OL'))) inline(c, false, parts); });
        items.push(parts.flatMap((p, i) => (i ? [{ text: ' ', bold: false }, ...p] : p)));
      });
      const filled = items.filter((i) => i.some((r) => r.text.trim()));
      if (filled.length) blocks.push({ type: node.tagName === 'UL' ? 'ul' : 'ol', items: filled } as Block);
      return;
    }
    if (node instanceof HTMLElement && ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE'].includes(node.tagName)) {
      flushPara();
      node.childNodes.forEach(walk);
      flushPara();
      return;
    }
    inline(node, false, lines);
  };
  root.childNodes.forEach(walk);
  flushPara();
  return blocksToText(blocks.map((b) => (b.type === 'p'
    ? { ...b, lines: b.lines.map((l) => mergeRuns(l)) }
    : { ...b, items: b.items.map(mergeRuns) })));
}

function mergeRuns(runs: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (prev && prev.bold === r.bold) prev.text += r.text; else out.push({ ...r });
  }
  // keep spaces outside of bold markers so "**text**" is never broken by edge whitespace
  return out.flatMap((r) => {
    if (!r.bold) return [r];
    const m = /^(\s*)(.*?)(\s*)$/s.exec(r.text)!;
    return [{ text: m[1]!, bold: false }, { text: m[2]!, bold: true }, { text: m[3]!, bold: false }].filter((x) => x.text);
  });
}

export const isRichEmpty = (text: string | undefined | null) => !parseRich(text).length;
