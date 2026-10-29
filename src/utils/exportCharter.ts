/**
 * Project Charter document export (Word + PDF).
 * Both generators share the same section model so the documents stay identical
 * in structure. Libraries are lazy-loaded to keep the main bundle small.
 */
import { TIMELINE_PHASES, type CharterData } from '../types';
import { PHASE_COLORS } from './charter';
import { formatDate, safeFileName } from './format';

const C = {
  purple: '5009B5',
  dark: '2B1B49',
  light: '794CFF',
  pale: 'EBE4FF',
  turq: '00B8BA',
  paleTurq: 'D9F5F5',
  text: '231E33',
  muted: '6B6680',
  border: 'D9D4E6',
  gray: 'F5F5F5',
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

// ─── Word (.docx) ────────────────────────────────────────────────────────────
export async function downloadCharterDocx(d: CharterData): Promise<void> {
  const {
    AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
    TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
  } = await import('docx');

  const FULL = 10800; // usable width in twips (Letter, 0.5" margins)
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.border };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const margins = { top: 70, bottom: 70, left: 120, right: 120 };

  // keepNext on every in-table paragraph keeps each section's table together on one page
  const paras = (text: string, opts: { bold?: boolean; color?: string; size?: number; placeholder?: string } = {}) => {
    const lines = (val(text) || opts.placeholder || '').split('\n');
    return lines.map((line) => new Paragraph({
      keepNext: true,
      spacing: { after: 0 },
      children: [new TextRun({ text: line, bold: opts.bold, color: val(text) ? opts.color ?? C.text : 'A39DB8', size: opts.size ?? 18, font: 'Segoe UI' })],
    }));
  };
  const subHead = (text: string, color: string) =>
    new Paragraph({ keepNext: true, children: [new TextRun({ text, bold: true, color, size: 18, font: 'Segoe UI' })] });

  const cell = (text: string, o: { width: number; span?: number; fill?: string; bold?: boolean; color?: string; label?: boolean; center?: boolean } ) =>
    new TableCell({
      width: { size: o.width, type: WidthType.DXA },
      columnSpan: o.span,
      margins,
      verticalAlign: VerticalAlign.CENTER,
      shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      children: o.label
        ? [new Paragraph({ keepNext: true, alignment: o.center ? AlignmentType.CENTER : undefined, children: [new TextRun({ text, bold: true, color: o.color ?? C.dark, size: 18, font: 'Segoe UI' })] })]
        : paras(text, { bold: o.bold, color: o.color }),
    });

  const table = (columnWidths: number[], rows: InstanceType<typeof TableRow>[]) =>
    new Table({ width: { size: FULL, type: WidthType.DXA }, columnWidths, layout: TableLayoutType.FIXED, borders, rows });

  const heading = (title: string, cols: number[]) =>
    new TableRow({
      children: [new TableCell({
        columnSpan: cols.length,
        width: { size: FULL, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        shading: { fill: C.purple, type: ShadingType.CLEAR, color: 'auto' },
        children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: title.toUpperCase(), bold: true, color: 'FFFFFF', size: 20, font: 'Segoe UI', characterSpacing: 20 })] })],
      })],
    });

  const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

  // Project information — 4 columns: label | value | label | value
  const infoCols = [1900, 3500, 1900, 3500];
  const info = table(infoCols, [
    heading('Project Information', infoCols),
    new TableRow({ children: [cell('Project Title', { width: infoCols[0], fill: C.pale, label: true }), cell(d.projectTitle, { width: FULL - infoCols[0], span: 3, bold: true })] }),
    new TableRow({ children: [
      cell('Business Function', { width: infoCols[0], fill: C.pale, label: true }), cell(d.businessFunction, { width: infoCols[1] }),
      cell('Business Owner', { width: infoCols[2], fill: C.pale, label: true }), cell(d.businessOwner, { width: infoCols[3] }),
    ] }),
    new TableRow({ children: [
      cell('Executive Sponsor', { width: infoCols[0], fill: C.pale, label: true }), cell(d.executiveSponsor, { width: infoCols[1] }),
      cell('Line of Business', { width: infoCols[2], fill: C.pale, label: true }), cell(d.lineOfBusiness, { width: infoCols[3] }),
    ] }),
    new TableRow({ children: [cell('Execution Lead', { width: infoCols[0], fill: C.pale, label: true }), cell(d.executionLead, { width: FULL - infoCols[0], span: 3 })] }),
  ]);

  // Project definition
  const defCols = [2400, 4200, 4200];
  const defRow = (label: string, text: string) =>
    new TableRow({ children: [cell(label, { width: defCols[0], fill: C.pale, label: true }), cell(text, { width: FULL - defCols[0], span: 2 })] });
  const definition = table(defCols, [
    heading('Project Definition', defCols),
    defRow('Problem Statement', d.problemStatement),
    defRow('Project Goals', d.projectGoals),
    new TableRow({ children: [
      cell('In Scope / Out of Scope', { width: defCols[0], fill: C.pale, label: true }),
      new TableCell({
        width: { size: defCols[1], type: WidthType.DXA }, margins,
        children: [subHead('In Scope', '007476'), ...paras(d.inScope)],
      }),
      new TableCell({
        width: { size: defCols[2], type: WidthType.DXA }, margins,
        children: [subHead('Out of Scope', '963457'), ...paras(d.outOfScope)],
      }),
    ] }),
    defRow('Project Deliverables', d.deliverables),
    defRow('Business Impact / Benefit', d.businessImpact),
  ]);

  // RACI
  const raciCols = [2700, 2700, 2700, 2700];
  const raci = table(raciCols, [
    heading('RACI', raciCols),
    new TableRow({ tableHeader: true, children: RACI_ROWS.map(([label]) => cell(label, { width: 2700, fill: C.pale, label: true, center: true })) }),
    new TableRow({ children: RACI_ROWS.map(([, key]) => cell(d.raci[key], { width: 2700 })) }),
  ]);

  // Milestones
  const msCols = [600, 6000, 2400, 1800];
  const ms = filledMilestones(d);
  const milestones = table(msCols, [
    heading('Milestones / Tasks', msCols),
    new TableRow({ tableHeader: true, children: ['#', 'Milestone / Task', 'Owner', 'Target Date'].map((h, i) => cell(h, { width: msCols[i], fill: C.pale, label: true, center: i === 0 })) }),
    ...(ms.length ? ms : [{ task: '', owner: '', dueDate: '', id: '' }]).map((m, i) => new TableRow({ children: [
      cell(ms.length ? String(i + 1) : '', { width: msCols[0], label: true, center: true, color: C.purple }),
      cell(m.task, { width: msCols[1] }), cell(m.owner, { width: msCols[2] }), cell(date(m.dueDate), { width: msCols[3] }),
    ] })),
  ]);

  // Timeline
  const tlCols = [2000, 5000, 1900, 1900];
  const timeline = table(tlCols, [
    heading('Timeline', tlCols),
    new TableRow({ tableHeader: true, children: ['Phase', 'Task', 'Start Date', 'End Date'].map((h, i) => cell(h, { width: tlCols[i], fill: C.pale, label: true })) }),
    ...TIMELINE_PHASES.map((p) => {
      const t = d.timeline[p];
      return new TableRow({ children: [
        cell(p, { width: tlCols[0], fill: PHASE_COLORS[p].slice(1), label: true, color: 'FFFFFF' }),
        cell(t.task, { width: tlCols[1] }), cell(date(t.start), { width: tlCols[2] }), cell(date(t.end), { width: tlCols[3] }),
      ] });
    }),
  ]);

  // Title band
  const header = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: [FULL], layout: TableLayoutType.FIXED,
    borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.SINGLE, size: 24, color: C.turq }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: FULL, type: WidthType.DXA },
      margins: { top: 200, bottom: 200, left: 240, right: 240 },
      shading: { fill: C.dark, type: ShadingType.CLEAR, color: 'auto' },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'SBF PROJECT CHARTER', bold: true, color: 'B9A6FF', size: 18, font: 'Segoe UI', characterSpacing: 40 })] }),
        new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: val(d.projectTitle) || 'Untitled Project', bold: true, color: 'FFFFFF', size: 36, font: 'Segoe UI' })] }),
        new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: `SBF Tower · Generated ${formatDate(new Date().toISOString())}`, color: 'D9D2EE', size: 16, font: 'Segoe UI' })] }),
      ],
    })] })],
  });

  const doc = new Document({
    creator: 'SBF Tower Portfolio Hub',
    title: `${d.projectTitle} — Project Charter`,
    styles: { default: { document: { run: { font: 'Segoe UI', size: 18, color: C.text } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720, footer: 360 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: FULL }],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
            children: [
              new TextRun({ text: `${val(d.projectTitle) || 'Project'} — SBF Project Charter`, color: C.muted, size: 15 }),
              new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], color: C.muted, size: 15 }),
            ],
          })],
        }),
      },
      children: [header, gap(), info, gap(), definition, gap(), raci, gap(), milestones, gap(), timeline],
    }],
  });

  triggerDownload(await Packer.toBlob(doc), fileName(d, 'docx'));
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
export async function downloadCharterPdf(d: CharterData): Promise<void> {
  const [{ jsPDF }, atModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // UMD build: the default export may be wrapped depending on the bundler's CJS interop
  const atDefault = atModule.default as unknown as typeof atModule.default | { default: typeof atModule.default };
  const autoTable = typeof atDefault === 'function' ? atDefault : atDefault.default;
  type Cell = Record<string, unknown> | string;

  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const CW = W - M * 2;

  // Title band
  doc.setFillColor(...rgb(C.dark));
  doc.roundedRect(M, M, CW, 78, 6, 6, 'F');
  doc.setFillColor(...rgb(C.turq));
  doc.rect(M, M + 74, CW, 4, 'F');
  doc.setTextColor(185, 166, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SBF PROJECT CHARTER', M + 18, M + 22, { charSpace: 1.5 });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(val(d.projectTitle) || 'Untitled Project', CW - 36) as string[];
  doc.text(titleLines[0] + (titleLines.length > 1 ? '…' : ''), M + 18, M + 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(217, 210, 238);
  doc.text(`SBF Tower · Generated ${formatDate(new Date().toISOString())}`, M + 18, M + 63);

  let y = M + 92;
  const base = {
    margin: { left: M, right: M, top: M, bottom: M + 14 },
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 }, lineColor: rgb(C.border), lineWidth: 0.6, textColor: rgb(C.text), valign: 'middle' as const, overflow: 'linebreak' as const },
    headStyles: { fillColor: rgb(C.purple), textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 10, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
  };
  const label = (text: string, cellProps: Record<string, unknown> = {}): Cell => ({ content: text, ...cellProps, styles: { fillColor: rgb(C.pale), fontStyle: 'bold', textColor: rgb(C.dark) } });
  const sub = (text: string): Cell => ({ content: text, styles: { fillColor: rgb(C.pale), fontStyle: 'bold', textColor: rgb(C.dark), halign: 'left' } });
  const head = (title: string, span: number) => [[{ content: title.toUpperCase(), colSpan: span }]];
  const section = (head_: Cell[][], body: Cell[][], columnStyles: Record<number, Record<string, unknown>>) => {
    autoTable(doc, { ...base, startY: y, head: head_, body, columnStyles, rowPageBreak: 'avoid', pageBreak: 'avoid' });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  section(head('Project Information', 4), [
    [label('Project Title'), { content: val(d.projectTitle), colSpan: 3, styles: { fontStyle: 'bold' } }],
    [label('Business Function'), val(d.businessFunction), label('Business Owner'), val(d.businessOwner)],
    [label('Executive Sponsor'), val(d.executiveSponsor), label('Line of Business'), val(d.lineOfBusiness)],
    [label('Execution Lead'), { content: val(d.executionLead), colSpan: 3 }],
  ], { 0: { cellWidth: 100 }, 1: { cellWidth: CW / 2 - 100 }, 2: { cellWidth: 100 } });

  section(head('Project Definition', 3), [
    [label('Problem Statement'), { content: val(d.problemStatement), colSpan: 2 }],
    [label('Project Goals'), { content: val(d.projectGoals), colSpan: 2 }],
    [
      label('In Scope / Out of Scope', { rowSpan: 2 }),
      { content: 'In Scope', styles: { fillColor: rgb(C.paleTurq), fontStyle: 'bold', textColor: rgb('007476') } },
      { content: 'Out of Scope', styles: { fillColor: rgb('FAEAF0'), fontStyle: 'bold', textColor: rgb('963457') } },
    ],
    [val(d.inScope), val(d.outOfScope)],
    [label('Project Deliverables'), { content: val(d.deliverables), colSpan: 2 }],
    [label('Business Impact / Benefit'), { content: val(d.businessImpact), colSpan: 2 }],
  ], { 0: { cellWidth: 120 }, 1: { cellWidth: (CW - 120) / 2 }, 2: { cellWidth: (CW - 120) / 2 } });

  section(head('RACI', 4), [
    RACI_ROWS.map(([l]) => sub(l)),
    RACI_ROWS.map(([, k]) => val(d.raci[k])),
  ], { 0: { cellWidth: CW / 4 }, 1: { cellWidth: CW / 4 }, 2: { cellWidth: CW / 4 }, 3: { cellWidth: CW / 4 } });

  const ms = filledMilestones(d);
  section(head('Milestones / Tasks', 4), [
    [sub('#'), sub('Milestone / Task'), sub('Owner'), sub('Target Date')],
    ...(ms.length ? ms.map((m, i) => [{ content: String(i + 1), styles: { halign: 'center', fontStyle: 'bold', textColor: rgb(C.purple) } }, val(m.task), val(m.owner), date(m.dueDate)]) : [['', '', '', '']]),
  ], { 0: { cellWidth: 30 }, 2: { cellWidth: 130 }, 3: { cellWidth: 90 } });

  section(head('Timeline', 4), [
    [sub('Phase'), sub('Task'), sub('Start Date'), sub('End Date')],
    ...TIMELINE_PHASES.map((p) => [
      { content: p, styles: { fillColor: rgb(PHASE_COLORS[p].slice(1)), textColor: [255, 255, 255], fontStyle: 'bold' } },
      val(d.timeline[p].task), date(d.timeline[p].start), date(d.timeline[p].end),
    ]),
  ], { 0: { cellWidth: 100 }, 2: { cellWidth: 90 }, 3: { cellWidth: 90 } });

  // Footer + page numbers on every page

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...rgb(C.border));
    doc.line(M, H - M + 2, W - M, H - M + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C.muted));
    doc.text(`${val(d.projectTitle) || 'Project'} — SBF Project Charter`, M, H - M + 14);
    doc.text(`Page ${i} of ${pages}`, W - M, H - M + 14, { align: 'right' });
  }

  triggerDownload(doc.output('blob'), fileName(d, 'pdf'));
}
