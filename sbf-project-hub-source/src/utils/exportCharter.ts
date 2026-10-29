/**
 * Project Charter document export (Word + PDF).
 * Page 1 reproduces the SBF "PROJECT CHARTER TEMPLATE.pptx" grid (landscape):
 *   header · info rows · Problem Statement | Engagement Goals · Key Metric table ·
 *   Business Impact / Benefit | Scope & Constraints | Timeline (Start and End) per CURES phase.
 * Page 2 ("Supporting Detail") holds the hub's extra sections: deliverables, RACI,
 * milestones / tasks and the full CURES activity list.
 * Libraries are lazy-loaded to keep the main bundle small.
 */
import { ACTIVITY_META, TIMELINE_PHASES, type CharterData, type TimelineActivity } from '../types';
import { durationDays, enteredActivities, phaseRange } from './charter';
import { formatDate, safeFileName } from './format';

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

  const runs = (text: string, o: { bold?: boolean; color?: string; size?: number } = {}) =>
    (val(text) ? val(text) : '').split('\n').map((ln) => new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: ln, bold: o.bold, color: o.color ?? T.text, size: o.size ?? 17, font: FONT })],
    }));

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
      cell('Business Owner', { w: iw[2]!, label: true }), cell(d.businessOwner, { w: iw[3]! }),
      cell('Executive Sponsor', { w: iw[4]!, label: true }), cell(d.executiveSponsor, { w: iw[5]! }),
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
    row(RACI_ROWS.map(([, k]) => cell(d.raci[k], { w: rw[0]! })), 500),
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
              new TextRun({ text: `${val(d.projectTitle) || 'Project'} — SBF Project Charter · Generated ${formatDate(new Date().toISOString())}`, color: T.muted, size: 14 }),
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
    [L('Business Function'), val(d.businessFunction), L('Business Owner'), val(d.businessOwner), L('Executive Sponsor'), val(d.executiveSponsor)],
    [L('Line of Business'), val(d.lineOfBusiness), L('Execution Lead'), val(d.executionLead), L('CURES Lead'), val(d.curesLead)],
  ], { 0: { cellWidth: w(10.7) }, 1: { cellWidth: w(26.9) }, 2: { cellWidth: w(11.4) }, 3: { cellWidth: w(19.6) }, 4: { cellWidth: w(12.9) }, 5: { cellWidth: w(18.5) } });

  block([
    [L('Problem Statement', { center: true }), L('Engagement Goals', { center: true })],
    [{ content: val(d.problemStatement), styles: { minCellHeight: 70 } }, { content: val(d.projectGoals), styles: { minCellHeight: 70 } }],
  ], { 0: { cellWidth: CW / 2 }, 1: { cellWidth: CW / 2 } });

  const metrics = filledMetrics(d);
  block([
    ['Key Metric', 'Definition', 'Target', 'Baseline', 'Impact'].map((h) => L(h, { center: true })),
    ...(metrics.length ? metrics : [null]).map((m) =>
      [m?.metric, m?.definition, m?.target, m?.baseline, m?.impact].map((v) => ({ content: val(v ?? ''), styles: { minCellHeight: 30 } }))),
  ], { 0: { cellWidth: w(14.5) }, 1: { cellWidth: w(34) }, 2: { cellWidth: w(16.8) }, 3: { cellWidth: w(16.8) }, 4: { cellWidth: w(17.9) } });

  const scopeText = scopeParts(d).map(([l, v]) => `${l}:\n${val(v)}`).join('\n\n');
  const pdts = phaseDates(acts);
  block([
    [L('Business Impact / Benefit', { center: true }), L('Scope & Constraints', { center: true }), L('Timeline (Start and End)', { colSpan: 3, center: true })],
    ...pdts.map((p, i) => [
      ...(i === 0 ? [{ content: val(d.businessImpact), rowSpan: 5 }, { content: scopeText, rowSpan: 5 }] : []),
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
  block([[{ content: val(d.deliverables), styles: { minCellHeight: 30 } }]], { 0: { cellWidth: CW } });
  sub('RACI');
  block([RACI_ROWS.map(([l]) => L(l, { center: true })), RACI_ROWS.map(([, k]) => ({ content: val(d.raci[k]), styles: { minCellHeight: 30 } }))],
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
    doc.text(`${val(d.projectTitle) || 'Project'} — SBF Project Charter · Generated ${formatDate(new Date().toISOString())}`, M, H - M + 10);
    doc.text(`Page ${i} of ${pages}`, W - M, H - M + 10, { align: 'right' });
  }

  triggerDownload(doc.output('blob'), fileName(d, 'pdf'));
}
