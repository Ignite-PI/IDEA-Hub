/**
 * Project Charter document export (Word + PDF).
 * Page 1 reproduces the SBF "PROJECT CHARTER TEMPLATE.pptx" grid (landscape):
 *   header · info rows · Problem Statement | Engagement Goals · Key Metric table ·
 *   Business Impact / Benefit | Scope & Constraints | Timeline (Start and End) per CURES phase.
 * Page 2 ("Supporting Detail") holds the hub's extra sections: deliverables, RACI,
 * milestones / tasks and the full CURES activity list.
 * Libraries are lazy-loaded to keep the main bundle small.
 */
import { ACTIVITY_META, TIMELINE_PHASES, bfLabel, type CharterData, type TimelineActivity } from '../types';
import { BRAND } from '../characters';
import { charterProgress, durationDays, enteredActivities, phaseRange, timelineProgress } from './charter';
import { formatDate, safeFileName } from './format';
import { parseRich, richToPlain, type Block } from './richText';

// Colours sampled from the PowerPoint template
const T = {
  navy: '1A3673',
  label: 'E1EDFF',
  line: '8C9AB9',
  text: '231E33',
  muted: '6B6680',
  placeholder: 'A39DB8',
};

const fileName = (d: CharterData, ext: string) => `${safeFileName(d.projectTitle)}_ProjectCharter.${ext}`;
const val = (s: string | undefined) => (s && s.trim() ? s.trim() : '');
const date = (s: string) => (s ? formatDate(s) : '');
const RACI_ROWS = [
  ['Responsible', 'responsible'],
  ['Accountable', 'accountable'],
  ['Consulted', 'consulted'],
  ['Informed', 'informed'],
] as const;

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const filledMilestones = (d: CharterData) => d.milestones.filter((m) => val(m.task) || val(m.owner) || m.dueDate);
const filledMetrics = (d: CharterData) => d.keyMetrics.filter((m) => [m.metric, m.definition, m.target, m.baseline, m.impact].some((x) => val(x)));

/** Scope & Constraints box content (template has one box; the hub captures three parts). */
const scopeParts = (d: CharterData) =>
  ([['In scope', d.inScope], ['Out of scope', d.outOfScope], ['Constraints', d.constraints]] as const).filter(([, v]) => val(v));

const phaseDates = (acts: TimelineActivity[]) => TIMELINE_PHASES.map((p) => ({ phase: p, ...phaseRange(acts, p) }));
/**
 * Exports show the portfolio Business Function label (Clinical Functions / Specialized Business Functions, or
 * "Needs Business Function"), followed by the charter's earlier free-text business area when one was entered.
 */
export function withBusinessFunction(d: CharterData, code: string | null | undefined): CharterData {
  const label = bfLabel(code);
  const area = val(d.businessFunction);
  return { ...d, businessFunction: area && area !== label ? `${label} (${area})` : label };
}

/** Several people ("A; B; C") shown one per line in exports — every person is kept. */
const peopleLines = (v: string) => String(v ?? '').split(/\s*;\s*|\s*\n+\s*/).filter(Boolean).join('\n');

// ─── Word (.docx) ────────────────────────────────────────────────────────────
export async function downloadCharterDocx(d: CharterData, timeline: TimelineActivity[] = []): Promise<void> {
  const {
    AlignmentType, BorderStyle, Document, Footer, HeightRule, Packer, PageBreak, PageNumber, PageOrientation, Paragraph, ShadingType, Table,
    TableCell, TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
  } = await import('docx');

  const acts = enteredActivities(timeline);
  const FULL = 14400; // Letter landscape with 0.5" margins (twips)
  const pct = (p: number) => Math.round((FULL * p) / 100);
  const line = { style: BorderStyle.SINGLE, size: 4, color: T.line };
  const borders = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line };
  const margins = { top: 50, bottom: 50, left: 100, right: 100 };
  const FONT = 'Segoe UI';

  // Rich text → Word paragraphs: paragraphs, "•" bullets and "1." numbering with hanging indents, **bold** runs
  const runs = (text: string, o: { bold?: boolean; color?: string; size?: number } = {}) => {
    const blocks = parseRich(val(text));
    const tr = (t: string, bold?: boolean) => new TextRun({ text: t, bold: o.bold || bold, color: o.color ?? T.text, size: o.size ?? 17, font: FONT });
    if (!blocks.length) return [new Paragraph({ spacing: { after: 0 }, children: [tr('')] })];
    return blocks.flatMap((b, bi) => {
      const gap = bi > 0 ? 80 : 0;
      if (b.type === 'p') {
        return [new Paragraph({ spacing: { before: gap, after: 0 }, children: b.lines.flatMap((l, li) => [...(li ? [new TextRun({ break: 1 })] : []), ...l.map((r) => tr(r.text, r.bold))]) })];
      }
      return b.items.map((it, ii) => new Paragraph({
        spacing: { before: ii === 0 ? gap : 20, after: 0 },
        indent: { left: 300, hanging: 220 },
        tabStops: [{ type: TabStopType.LEFT, position: 300 }],
        children: [tr(b.type === 'ul' ? '•' : `${ii + 1}.`), tr('\t'), ...it.map((r) => tr(r.text, r.bold))],
      }));
    });
  };

  const cell = (text: string | InstanceType<typeof Paragraph>[], o: { w: number; span?: number; rowSpan?: number; label?: boolean; center?: boolean; fill?: string; color?: string; minH?: boolean; bold?: boolean }) =>
    new TableCell({
      width: { size: o.w, type: WidthType.DXA },
      columnSpan: o.span,
      rowSpan: o.rowSpan,
      margins,
      verticalAlign: o.label ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: o.label || o.fill ? { fill: o.fill ?? T.label, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      children: Array.isArray(text)
        ? text
        : o.label
          ? [new Paragraph({ alignment: o.center ? AlignmentType.CENTER : undefined, children: [new TextRun({ text, size: 17, font: FONT, color: o.color ?? T.text, bold: o.bold })] })]
          : runs(text, { bold: o.bold }),
    });

  const table = (widths: number[], rows: InstanceType<typeof TableRow>[]) =>
    new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, borders, rows });
  const joiner = () => new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: '', size: 2 })] });
  const row = (cells: InstanceType<typeof TableCell>[], height?: number) =>
    new TableRow({ children: cells, cantSplit: true, height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined });

  const header = (title: string) => table([FULL], [row([new TableCell({
    width: { size: FULL, type: WidthType.DXA },
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    shading: { fill: T.navy, type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, color: 'FFFFFF', size: 24, font: FONT })] })],
  })])]);

  // ── Page 1: template grid ──
  const iw = [pct(10.7), pct(26.9), pct(11.4), pct(19.6), pct(12.9)];
  iw.push(FULL - iw.reduce((a, b) => a + b, 0));
  const info = table(iw, [
    row([cell('Project Title', { w: iw[0]!, label: true }), cell(d.projectTitle, { w: FULL - iw[0]!, span: 5, bold: true })]),
    row([
      cell('Business Function', { w: iw[0]!, label: true }), cell(d.businessFunction, { w: iw[1]! }),
      cell('Business Owner', { w: iw[2]!, label: true }), cell(peopleLines(d.businessOwner), { w: iw[3]! }),
      cell('Executive Sponsor', { w: iw[4]!, label: true }), cell(peopleLines(d.executiveSponsor), { w: iw[5]! }),
    ]),
    row([
      cell('Line of Business', { w: iw[0]!, label: true }), cell(d.lineOfBusiness, { w: iw[1]! }),
      cell('Execution Lead', { w: iw[2]!, label: true }), cell(d.executionLead, { w: iw[3]! }),
      cell('CURES Lead', { w: iw[4]!, label: true }), cell(d.curesLead, { w: iw[5]! }),
    ]),
  ]);

  const half = [FULL / 2, FULL / 2];
  const problem = table(half, [
    row([cell('Problem Statement', { w: half[0]!, label: true, center: true }), cell('Engagement Goals', { w: half[1]!, label: true, center: true })]),
    row([cell(d.problemStatement, { w: half[0]! }), cell(d.projectGoals, { w: half[1]! })], 1500),
  ]);

  const kw = [pct(14.5), pct(34), pct(16.8), pct(16.8)];
  kw.push(FULL - kw.reduce((a, b) => a + b, 0));
  const metrics = filledMetrics(d);
  const metricRows = metrics.length ? metrics : [null];
  const keyMetrics = table(kw, [
    row(['Key Metric', 'Definition', 'Target', 'Baseline', 'Impact'].map((h, i) => cell(h, { w: kw[i]!, label: true, center: true }))),
    ...metricRows.map((m) => row([
      cell(m?.metric ?? '', { w: kw[0]! }), cell(m?.definition ?? '', { w: kw[1]! }), cell(m?.target ?? '', { w: kw[2]! }),
      cell(m?.baseline ?? '', { w: kw[3]! }), cell(m?.impact ?? '', { w: kw[4]! }),
    ], 560)),
  ]);

  const bw = [pct(34.7), pct(37.4), pct(8.8), pct(9.4)];
  bw.push(FULL - bw.reduce((a, b) => a + b, 0));
  const scopeParas = scopeParts(d).flatMap(([label, v], i) => [
    new Paragraph({ spacing: { before: i ? 80 : 0 }, children: [new TextRun({ text: `${label}:`, bold: true, size: 17, font: FONT, color: T.navy })] }),
    ...runs(v),
  ]);
  const pdts = phaseDates(acts);
  const bottom = table(bw, [
    row([
      cell('Business Impact / Benefit', { w: bw[0]!, label: true, center: true }),
      cell('Scope & Constraints', { w: bw[1]!, label: true, center: true }),
      cell('Timeline (Start and End)', { w: bw[2]! + bw[3]! + bw[4]!, span: 3, label: true, center: true }),
    ]),
    ...pdts.map((p, i) => row([
      ...(i === 0 ? [cell(d.businessImpact, { w: bw[0]!, rowSpan: 5 }), cell(scopeParas.length ? scopeParas : runs(''), { w: bw[1]!, rowSpan: 5 })] : []),
      cell(`${p.phase}:`, { w: bw[2]!, label: true, center: true }),
      cell(date(p.start), { w: bw[3]! }),
      cell(date(p.end), { w: bw[4]! }),
    ], 380)),
  ]);

  // ── Page 2: supporting detail ──
  const sub = (title: string) => new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: title, bold: true, color: T.navy, size: 20, font: FONT })],
  });
  const deliverables = table([FULL], [row([cell(d.deliverables || ' ', { w: FULL })], 500)]);
  const rw = [FULL / 4, FULL / 4, FULL / 4, FULL / 4];
  const raci = table(rw, [
    row(RACI_ROWS.map(([l]) => cell(l, { w: rw[0]!, label: true, center: true }))),
    row(RACI_ROWS.map(([, k]) => cell(peopleLines(d.raci[k]), { w: rw[0]! })), 500),
  ]);
  const mw = [pct(5), pct(60), pct(20)];
  mw.push(FULL - mw.reduce((a, b) => a + b, 0));
  const ms = filledMilestones(d);
  const milestones = table(mw, [
    row(['#', 'Milestone / Task', 'Owner', 'Target Date'].map((h, i) => cell(h, { w: mw[i]!, label: true, center: i === 0 }))),
    ...(ms.length ? ms : [null]).map((m, i) => row([
      cell(m ? String(i + 1) : '', { w: mw[0]! }), cell(m?.task ?? '', { w: mw[1]! }), cell(m?.owner ?? '', { w: mw[2]! }), cell(date(m?.dueDate ?? ''), { w: mw[3]! }),
    ])),
  ]);
  const aw = [pct(12), pct(40), pct(12), pct(12), pct(7), pct(10)];
  aw.push(FULL - aw.reduce((a, b) => a + b, 0));
  const activities = table(aw, [
    row(['CURES Phase', 'Activity / Task', 'Start', 'End', 'Days', 'Status', 'Progress'].map((h, i) => cell(h, { w: aw[i]!, label: true }))),
    ...(acts.length ? acts : [null]).map((a) => row([
      cell(a?.phase ?? '', { w: aw[0]!, bold: true }), cell(a?.task ?? '', { w: aw[1]! }), cell(date(a?.start_date ?? ''), { w: aw[2]! }),
      cell(date(a?.end_date ?? ''), { w: aw[3]! }), cell(a ? String(durationDays(a.start_date, a.end_date) ?? '') : '', { w: aw[4]! }),
      cell(a?.status ?? '', { w: aw[5]!, ...(a ? { fill: ACTIVITY_META[a.status].bg.slice(1), label: true, color: ACTIVITY_META[a.status].fg.slice(1) } : {}) }),
      cell(a ? (a.status === 'Completed' ? '100%' : a.progress != null ? `${a.progress}%` : '') : '', { w: aw[6]! }),
    ])),
  ]);

  const doc = new Document({
    creator: 'SBF Project Hub',
    title: `${d.projectTitle} — Project Charter`,
    styles: { default: { document: { run: { font: FONT, size: 17, color: T.text } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, bottom: 720, left: 720, right: 720, footer: 300 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: FULL }],
            children: [
              new TextRun({ text: `${val(d.projectTitle) || 'Project'} — Project Charter · Generated ${formatDate(new Date().toISOString())}`, color: T.muted, size: 14 }),
              new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], color: T.muted, size: 14 }),
            ],
          })],
        }),
      },
      children: [
        header('Project Charter'), joiner(), info, joiner(), problem, joiner(), keyMetrics, joiner(), bottom,
        new Paragraph({ children: [new PageBreak()] }),
        header('Project Charter — Supporting Detail'),
        sub('Project Deliverables'), deliverables,
        sub('RACI'), raci,
        sub('Milestones / Tasks'), milestones,
        sub('CURES Timeline Activities'), activities,
      ],
    }],
  });

  triggerDownload(await Packer.toBlob(doc), fileName(d, 'docx'));
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
export async function downloadCharterPdf(d: CharterData, timeline: TimelineActivity[] = []): Promise<void> {
  const [{ jsPDF }, atModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // UMD build: the default export may be wrapped depending on the bundler's CJS interop
  const atDefault = atModule.default as unknown as typeof atModule.default | { default: typeof atModule.default };
  const autoTable = typeof atDefault === 'function' ? atDefault : atDefault.default;
  type Cell = Record<string, unknown> | string;

  const acts = enteredActivities(timeline);
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const M = 28;
  const CW = W - M * 2;
  const w = (p: number) => (CW * p) / 100;
  let y = M;

  const header = (title: string) => {
    doc.setFillColor(...rgb(T.navy));
    doc.rect(M, y, CW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, W / 2, y + 17, { align: 'center' });
    y += 26;
  };

  const base = {
    margin: { left: M, right: M, top: M, bottom: M + 12 },
    theme: 'grid' as const,
    tableWidth: CW,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, lineColor: rgb(T.line), lineWidth: 0.5, textColor: rgb(T.text), valign: 'top' as const, overflow: 'linebreak' as const },
  };
  const L = (text: string, extra: Record<string, unknown> = {}): Cell => ({ content: text, ...extra, styles: { fillColor: rgb(T.label), valign: 'middle', halign: extra.center ? 'center' : 'left' } });
  const block = (body: Cell[][], columnStyles: Record<number, Record<string, unknown>>, opts: Record<string, unknown> = {}) => {
    autoTable(doc, { ...base, startY: y, body, columnStyles, rowPageBreak: 'avoid', ...opts });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  };

  // ── Page 1: template grid ──
  header('Project Charter');
  block([
    [L('Project Title'), { content: val(d.projectTitle), colSpan: 5, styles: { fontStyle: 'bold' } }],
    [L('Business Function'), val(d.businessFunction), L('Business Owner'), peopleLines(d.businessOwner), L('Executive Sponsor'), peopleLines(d.executiveSponsor)],
    [L('Line of Business'), val(d.lineOfBusiness), L('Execution Lead'), val(d.executionLead), L('CURES Lead'), val(d.curesLead)],
  ], { 0: { cellWidth: w(10.7) }, 1: { cellWidth: w(26.9) }, 2: { cellWidth: w(11.4) }, 3: { cellWidth: w(19.6) }, 4: { cellWidth: w(12.9) }, 5: { cellWidth: w(18.5) } });

  block([
    [L('Problem Statement', { center: true }), L('Engagement Goals', { center: true })],
    [{ content: richToPlain(d.problemStatement), styles: { minCellHeight: 70 } }, { content: richToPlain(d.projectGoals), styles: { minCellHeight: 70 } }],
  ], { 0: { cellWidth: CW / 2 }, 1: { cellWidth: CW / 2 } });

  const metrics = filledMetrics(d);
  block([
    ['Key Metric', 'Definition', 'Target', 'Baseline', 'Impact'].map((h) => L(h, { center: true })),
    ...(metrics.length ? metrics : [null]).map((m) =>
      [m?.metric, m?.definition, m?.target, m?.baseline, m?.impact].map((v) => ({ content: val(v ?? ''), styles: { minCellHeight: 30 } }))),
  ], { 0: { cellWidth: w(14.5) }, 1: { cellWidth: w(34) }, 2: { cellWidth: w(16.8) }, 3: { cellWidth: w(16.8) }, 4: { cellWidth: w(17.9) } });

  const scopeText = scopeParts(d).map(([l, v]) => `${l}:\n${richToPlain(v)}`).join('\n\n');
  const pdts = phaseDates(acts);
  block([
    [L('Business Impact / Benefit', { center: true }), L('Scope & Constraints', { center: true }), L('Timeline (Start and End)', { colSpan: 3, center: true })],
    ...pdts.map((p, i) => [
      ...(i === 0 ? [{ content: richToPlain(d.businessImpact), rowSpan: 5 }, { content: scopeText, rowSpan: 5 }] : []),
      L(`${p.phase}:`, { center: true }),
      { content: date(p.start), styles: { minCellHeight: 22, valign: 'middle' } },
      { content: date(p.end), styles: { valign: 'middle' } },
    ] as Cell[]),
  ], { 0: { cellWidth: w(34.7) }, 1: { cellWidth: w(37.4) }, 2: { cellWidth: w(8.8) }, 3: { cellWidth: w(9.4) }, 4: { cellWidth: w(9.7) } });

  // ── Page 2: supporting detail ──
  doc.addPage();
  y = M;
  header('Project Charter — Supporting Detail');
  const sub = (title: string) => {
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...rgb(T.navy));
    doc.text(title, M, y);
    y += 5;
  };
  sub('Project Deliverables');
  block([[{ content: richToPlain(d.deliverables), styles: { minCellHeight: 30 } }]], { 0: { cellWidth: CW } });
  sub('RACI');
  block([RACI_ROWS.map(([l]) => L(l, { center: true })), RACI_ROWS.map(([, k]) => ({ content: peopleLines(d.raci[k]), styles: { minCellHeight: 30 } }))],
    { 0: { cellWidth: CW / 4 }, 1: { cellWidth: CW / 4 }, 2: { cellWidth: CW / 4 }, 3: { cellWidth: CW / 4 } });
  sub('Milestones / Tasks');
  const ms = filledMilestones(d);
  block([
    ['#', 'Milestone / Task', 'Owner', 'Target Date'].map((h) => L(h)),
    ...(ms.length ? ms.map((m, i) => [String(i + 1), val(m.task), val(m.owner), date(m.dueDate)]) : [['', '', '', '']]),
  ], { 0: { cellWidth: w(5) }, 1: { cellWidth: w(60) }, 2: { cellWidth: w(20) }, 3: { cellWidth: w(15) } });
  sub('CURES Timeline Activities');
  block([
    ['CURES Phase', 'Activity / Task', 'Start', 'End', 'Days', 'Status', 'Progress'].map((h) => L(h)),
    ...(acts.length ? acts.map((a) => [
      { content: a.phase, styles: { fontStyle: 'bold' } }, val(a.task), date(a.start_date), date(a.end_date), String(durationDays(a.start_date, a.end_date) ?? ''),
      { content: a.status, styles: { fillColor: rgb(ACTIVITY_META[a.status].bg.slice(1)), textColor: rgb(ACTIVITY_META[a.status].fg.slice(1)), fontStyle: 'bold' } },
      a.status === 'Completed' ? '100%' : a.progress != null ? `${a.progress}%` : '',
    ]) : [['', '', '', '', '', '', '']]),
  ], { 0: { cellWidth: w(12) }, 1: { cellWidth: w(40) }, 2: { cellWidth: w(12) }, 3: { cellWidth: w(12) }, 4: { cellWidth: w(7) }, 5: { cellWidth: w(10) }, 6: { cellWidth: w(7) } });

  // Footer + page numbers on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(T.muted));
    doc.text(`${val(d.projectTitle) || 'Project'} — Project Charter · Generated ${formatDate(new Date().toISOString())}`, M, H - M + 10);
    doc.text(`Page ${i} of ${pages}`, W - M, H - M + 10, { align: 'right' });
  }

  triggerDownload(doc.output('blob'), fileName(d, 'pdf'));
}

// ─── PowerPoint (.pptx) ──────────────────────────────────────────────────────
/** Editable 16:9 deck built from the actual charter. Sections without content get no slide (no placeholder text). */
export async function downloadCharterPptx(
  d: CharterData,
  timeline: TimelineActivity[] = [],
  meta?: { status: string; charterStatus: string; owner: string },
): Promise<void> {
  const mod = await import('pptxgenjs');
  const PptxGenJS = (mod as unknown as { default: new () => PptxInstance }).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = `${val(d.projectTitle) || 'Project'} — Project Charter`;
  pptx.company = 'SBF Project Hub';

  const C = { purple: '5009B5', dark: '2B1B49', light: '794CFF', pale: 'EBE4FF', turq: '00B8BA', paleTurq: 'D9F5F5', text: '231E33', muted: '6B6680', line: 'D9D4E6' };
  const FONT = 'Segoe UI';
  const title = val(d.projectTitle) || 'Project';
  const acts = enteredActivities(timeline);
  const logo = await fetch(BRAND.full).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? blobToDataUrl(b) : null)).catch(() => null);

  pptx.defineSlideMaster({
    title: 'CTPH',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.purple } } },
      { rect: { x: 0, y: 7.12, w: 13.33, h: 0.38, fill: { color: 'F7F5FC' } } },
      { text: { text: `${title} — Project Charter`, options: { x: 0.5, y: 7.14, w: 9, h: 0.34, fontFace: FONT, fontSize: 9, color: C.muted } } },
      ...(logo ? [{ image: { data: logo, x: 11.55, y: 7.15, w: 1.3, h: 0.3 } }] : []),
    ],
    slideNumber: { x: 10.9, y: 7.17, fontFace: FONT, fontSize: 9, color: C.muted },
  });

  const heading = (s: PptxSlide, text: string, sub?: string) => {
    s.addText(text, { x: 0.5, y: 0.35, w: 12.3, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.dark });
    s.addShape('rect', { x: 0.5, y: 0.98, w: 1.1, h: 0.06, fill: { color: C.turq }, line: { color: C.turq } });
    if (sub) s.addText(sub, { x: 0.5, y: 1.08, w: 12.3, h: 0.35, fontFace: FONT, fontSize: 12, color: C.muted });
  };

  // Rich text → pptx runs (paragraphs, bullets, numbering, bold) — editable text, not images
  const richRuns = (blocks: Block[], size = 15) => {
    const out: PptxTextRun[] = [];
    blocks.forEach((b, bi) => {
      const space = bi < blocks.length - 1 ? 8 : 0;
      const push = (runs: { text: string; bold: boolean }[], para: Record<string, unknown>, last: boolean) => runs.forEach((r, ri) => out.push({
        text: r.text, options: { fontFace: FONT, fontSize: size, color: C.text, bold: r.bold, ...para, breakLine: ri === runs.length - 1, ...(last && ri === runs.length - 1 ? { paraSpaceAfter: space } : {}) },
      }));
      if (b.type === 'p') b.lines.forEach((l, li) => push(l, {}, li === b.lines.length - 1));
      else b.items.forEach((it, ii) => push(it, { bullet: b.type === 'ul' ? { indent: 18 } : { type: 'number', indent: 22 }, indentLevel: 0 }, ii === b.items.length - 1));
    });
    return out;
  };
  // Long sections continue on extra slides instead of shrinking text to unreadable sizes
  const chunk = (blocks: Block[], budget = 1100) => {
    const pages: Block[][] = [[]];
    let used = 0;
    const len = (b: Block) => (b.type === 'p' ? b.lines.flat() : b.items.flat()).reduce((n, r) => n + r.text.length + 20, 0);
    for (const b of blocks) {
      if (used + len(b) > budget && pages[pages.length - 1]!.length) {
        // split long lists item by item
        if (b.type !== 'p' && b.items.length > 1) {
          let cur: Block = { ...b, items: [] };
          for (const it of b.items) {
            const l = it.reduce((n, r) => n + r.text.length + 20, 0);
            if (used + l > budget && (cur.items.length || pages[pages.length - 1]!.length)) {
              if (cur.items.length) pages[pages.length - 1]!.push(cur);
              pages.push([]); used = 0; cur = { ...b, items: [] };
            }
            cur.items.push(it); used += l;
          }
          if (cur.items.length) pages[pages.length - 1]!.push(cur);
          continue;
        }
        pages.push([]); used = 0;
      }
      pages[pages.length - 1]!.push(b); used += len(b);
    }
    return pages.filter((p) => p.length);
  };
  const textSlides = (name: string, text: string, sub?: string) => {
    const pages = chunk(parseRich(text));
    pages.forEach((blocks, i) => {
      const s = pptx.addSlide({ masterName: 'CTPH' });
      heading(s, pages.length > 1 && i > 0 ? `${name} (continued)` : name, sub);
      s.addText(richRuns(blocks), { x: 0.6, y: 1.55, w: 12.1, h: 5.35, valign: 'top', margin: 4, fit: 'shrink' });
    });
  };
  const tableOpts = (colW: number[], y = 1.6) => ({ x: 0.5, y, w: 12.3, colW, fontFace: FONT, fontSize: 12, color: C.text, border: { type: 'solid', pt: 0.75, color: C.line }, valign: 'top', autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1, newSlideStartY: 1.3 });
  const head = (labels: string[]) => labels.map((l) => ({ text: l, options: { bold: true, color: 'FFFFFF', fill: { color: C.purple }, valign: 'middle' } }));

  // 1 · Title / overview
  const s1 = pptx.addSlide();
  s1.background = { color: C.dark };
  s1.addShape('rect', { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: C.turq }, line: { color: C.turq } });
  if (logo) {
    s1.addShape('roundRect', { x: 0.7, y: 0.5, w: 2.9, h: 0.85, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 });
    s1.addImage({ data: logo, x: 0.85, y: 0.62, w: 2.6, h: 0.6 });
  }
  s1.addText('SBF PROJECT CHARTER', { x: 0.8, y: 1.9, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: '9DE3E4', charSpacing: 4 });
  s1.addText(title, { x: 0.8, y: 2.35, w: 11.8, h: 1.4, fontFace: FONT, fontSize: 38, bold: true, color: 'FFFFFF', valign: 'top', fit: 'shrink' });
  const people: [string, string][] = ([
    ['Project Owner', meta?.owner ?? ''], ['Business Owner', peopleLines(d.businessOwner).replace(/\n/g, ', ')], ['Executive Sponsor', peopleLines(d.executiveSponsor).replace(/\n/g, ', ')],
    ['Execution Lead', d.executionLead], ['CURES Lead', d.curesLead], ['Business Function', d.businessFunction], ['Line of Business', d.lineOfBusiness],
  ] as [string, string][]).filter(([, v]) => val(v));
  people.forEach(([k, v], i) => {
    const col = i % 3; const rowN = Math.floor(i / 3);
    s1.addText([{ text: `${k}\n`, options: { fontSize: 10, color: '9DE3E4', bold: true } }, { text: v, options: { fontSize: 14, color: 'FFFFFF' } }],
      { x: 0.8 + col * 4, y: 4.1 + rowN * 0.85, w: 3.8, h: 0.8, fontFace: FONT, valign: 'top' });
  });
  if (meta) {
    s1.addText(`Project Status: ${meta.status}   ·   Charter Status: ${meta.charterStatus}`, { x: 0.8, y: 6.65, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: 'D9D4E6' });
  }

  // 2.. · narrative sections (only when filled)
  if (val(d.problemStatement)) textSlides('Problem Statement', d.problemStatement);
  if (val(d.projectGoals)) textSlides('Engagement Goals', d.projectGoals);
  const scope = scopeParts(d);
  if (scope.length) {
    const s = pptx.addSlide({ masterName: 'CTPH' });
    heading(s, 'Scope & Constraints');
    const w = 12.3 / scope.length;
    scope.forEach(([label, v], i) => {
      s.addShape('rect', { x: 0.5 + i * w + 0.05, y: 1.5, w: w - 0.1, h: 0.45, fill: { color: i === 2 ? C.paleTurq : C.pale }, line: { color: i === 2 ? C.paleTurq : C.pale } });
      s.addText(label, { x: 0.5 + i * w + 0.15, y: 1.5, w: w - 0.3, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: C.purple, valign: 'middle' });
      s.addText(richRuns(parseRich(v), 13), { x: 0.5 + i * w + 0.1, y: 2.05, w: w - 0.2, h: 4.85, valign: 'top', fit: 'shrink' });
    });
  }
  if (val(d.businessImpact)) textSlides('Business Impact / Benefit', d.businessImpact);
  if (val(d.deliverables)) textSlides('Project Deliverables', d.deliverables, 'What needs to be accomplished or delivered to complete the project');

  const metrics = filledMetrics(d);
  if (metrics.length) {
    const s = pptx.addSlide({ masterName: 'CTPH' });
    heading(s, 'Key Metrics');
    s.addTable([head(['Key Metric', 'Definition', 'Target', 'Baseline', 'Impact']), ...metrics.map((m) => [m.metric, m.definition, m.target, m.baseline, m.impact].map((x) => ({ text: val(x) })))],
      tableOpts([2.2, 4.1, 2, 2, 2]));
  }

  const raciFilled = RACI_ROWS.filter(([, k]) => val(d.raci[k]));
  if (raciFilled.length) {
    const s = pptx.addSlide({ masterName: 'CTPH' });
    heading(s, 'RACI', 'Who does what');
    const colors = [C.purple, C.light, C.turq, '44B8F3'];
    RACI_ROWS.forEach(([label, k], i) => {
      const x = 0.5 + i * 3.1;
      s.addShape('rect', { x, y: 1.55, w: 2.95, h: 0.55, fill: { color: colors[i]! }, line: { color: colors[i]! } });
      s.addText(`${label[0]} · ${label}`, { x: x + 0.1, y: 1.55, w: 2.8, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: 'FFFFFF', valign: 'middle' });
      const names = peopleLines(d.raci[k]).split('\n').filter(Boolean);
      s.addShape('rect', { x, y: 2.1, w: 2.95, h: 4.75, fill: { color: 'FBFAFF' }, line: { color: C.line } });
      s.addText(names.length ? names.map((n) => ({ text: n, options: { bullet: { indent: 14 }, breakLine: true } })) : [{ text: '—', options: { color: C.muted } }],
        { x: x + 0.08, y: 2.2, w: 2.8, h: 4.55, fontFace: FONT, fontSize: 13, color: C.text, valign: 'top', fit: 'shrink' });
    });
  }

  const ms = filledMilestones(d);
  if (ms.length) {
    const s = pptx.addSlide({ masterName: 'CTPH' });
    heading(s, 'Milestones / Tasks');
    s.addTable([head(['#', 'Milestone / Task', 'Owner', 'Target Date']), ...ms.map((m, i) => [String(i + 1), val(m.task), val(m.owner), date(m.dueDate)].map((x) => ({ text: x })))],
      tableOpts([0.6, 7.4, 2.4, 1.9]));
  }

  if (acts.length) {
    // CURES timeline: editable table plus a simple Gantt drawn with shapes for activities that have dates
    const s = pptx.addSlide({ masterName: 'CTPH' });
    const tp = timelineProgress(timeline);
    heading(s, 'CURES Timeline', `${acts.length} activit${acts.length === 1 ? 'y' : 'ies'} · Timeline Progress ${tp.percent ?? 0}% (${tp.completed} of ${tp.total} completed)`);
    const dated = acts.filter((a) => a.start_date && a.end_date);
    if (dated.length) {
      const t0 = Math.min(...dated.map((a) => Date.parse(a.start_date)));
      const t1 = Math.max(...dated.map((a) => Date.parse(a.end_date))) + 86400000;
      const X0 = 4.3; const WD = 8.5; const rows = dated.slice(0, 14); const rh = Math.min(0.36, 5.1 / rows.length);
      s.addText(`${formatDate(new Date(t0).toISOString())}`, { x: X0, y: 1.5, w: 2, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted });
      s.addText(`${formatDate(new Date(t1 - 86400000).toISOString())}`, { x: X0 + WD - 2, y: 1.5, w: 2, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: 'right' });
      rows.forEach((a, i) => {
        const y = 1.85 + i * rh;
        const sx = X0 + ((Date.parse(a.start_date) - t0) / (t1 - t0)) * WD;
        const ex = X0 + ((Date.parse(a.end_date) + 86400000 - t0) / (t1 - t0)) * WD;
        const meta2 = ACTIVITY_META[a.status];
        s.addText(`${a.phase} · ${val(a.task)}`, { x: 0.5, y, w: 3.7, h: rh, fontFace: FONT, fontSize: 10, color: C.text, valign: 'middle', fit: 'shrink' });
        s.addShape('roundRect', { x: sx, y: y + rh * 0.18, w: Math.max(ex - sx, 0.08), h: rh * 0.64, fill: { color: meta2.color.slice(1) }, line: { color: meta2.color.slice(1) }, rectRadius: 0.05 });
      });
      const now = Date.now();
      if (now >= t0 && now <= t1) {
        const tx = X0 + ((now - t0) / (t1 - t0)) * WD;
        s.addShape('line', { x: tx, y: 1.8, w: 0, h: rows.length * rh + 0.1, line: { color: 'D6456E', width: 1.5, dashType: 'dash' } });
        s.addText('Today', { x: tx - 0.4, y: 1.8 + rows.length * rh + 0.08, w: 0.8, h: 0.25, fontFace: FONT, fontSize: 9, color: 'D6456E', align: 'center' });
      }
      if (dated.length > rows.length) s.addText(`+ ${dated.length - rows.length} more activities in the table`, { x: 0.5, y: 6.7, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted });
    }
    const s2 = pptx.addSlide({ masterName: 'CTPH' });
    heading(s2, 'CURES Timeline — Activities');
    s2.addTable([
      head(['CURES Phase', 'Activity / Task', 'Start', 'End', 'Days', 'Status', 'Progress']),
      ...acts.map((a) => [
        { text: a.phase, options: { bold: true } }, { text: val(a.task) }, { text: date(a.start_date) }, { text: date(a.end_date) },
        { text: String(durationDays(a.start_date, a.end_date) ?? '') },
        { text: a.status, options: { bold: true, color: ACTIVITY_META[a.status].fg.slice(1), fill: { color: ACTIVITY_META[a.status].bg.slice(1) } } },
        { text: a.status === 'Completed' ? '100%' : a.progress != null ? `${a.progress}%` : '' },
      ]),
    ], tableOpts([1.6, 4.6, 1.5, 1.5, 0.8, 1.4, 0.9]));
  }

  // Status / progress summary (always real values)
  const cp = charterProgress(d, timeline);
  const tp = timelineProgress(timeline);
  const s9 = pptx.addSlide({ masterName: 'CTPH' });
  heading(s9, 'Project Status & Progress', 'Project Status, Charter Status, Charter Completeness and Timeline Progress are tracked separately');
  const tiles: [string, string, string][] = [
    ...(meta ? [['Project Status', meta.status, C.purple] as [string, string, string], ['Charter Status', meta.charterStatus, C.light] as [string, string, string]] : []),
    ['Charter Completeness', `${cp.percent}%`, C.turq],
    ['Timeline Progress', tp.percent === null ? 'No activities' : `${tp.percent}%`, '44B8F3'],
  ];
  tiles.forEach(([k, v, color], i) => {
    const x = 0.5 + i * (12.3 / tiles.length);
    const w = 12.3 / tiles.length - 0.2;
    s9.addShape('rect', { x, y: 1.8, w, h: 1.9, fill: { color: 'FBFAFF' }, line: { color: C.line } });
    s9.addShape('rect', { x, y: 1.8, w, h: 0.1, fill: { color }, line: { color } });
    s9.addText([{ text: `${k}\n`, options: { fontSize: 12, color: C.muted, bold: true } }, { text: v, options: { fontSize: 28, bold: true, color: C.dark } }],
      { x: x + 0.2, y: 2.0, w: w - 0.4, h: 1.6, fontFace: FONT, valign: 'middle' });
  });
  if (tp.total) {
    s9.addText(`${tp.completed} of ${tp.total} CURES timeline activities completed.`, { x: 0.5, y: 4.0, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 13, color: C.text });
  }

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  triggerDownload(blob, fileName(d, 'pptx'));
}

// Minimal structural types for pptxgenjs (avoids depending on its bundled d.ts shape)
type PptxTextRun = { text: string; options?: Record<string, unknown> };
interface PptxSlide {
  background?: Record<string, unknown>;
  addText(text: string | PptxTextRun[], opts: Record<string, unknown>): PptxSlide;
  addShape(shape: string, opts: Record<string, unknown>): PptxSlide;
  addImage(opts: Record<string, unknown>): PptxSlide;
  addTable(rows: (PptxTextRun | { text: string; options?: Record<string, unknown> })[][], opts: Record<string, unknown>): PptxSlide;
}
interface PptxInstance {
  layout: string; title: string; company: string;
  defineSlideMaster(o: Record<string, unknown>): void;
  addSlide(o?: Record<string, unknown>): PptxSlide;
  write(o: Record<string, unknown>): Promise<unknown>;
}
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });

