import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import writeXlsxFile from 'write-excel-file/browser'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  WidthType, BorderStyle, ShadingType, AlignmentType,
  Header, Footer, PageOrientation, PageNumber,
} from 'docx'

// ── CSV ──────────────────────────────────────────────────────────────────────

type CellValue = string | number | null | undefined

function escapeCsv(v: CellValue): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCSV(filename: string, headers: string[], rows: CellValue[][]) {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export interface SummaryStat {
  label: string
  value: string
}

export interface PDFExportOptions {
  title: string
  subtitle?: string
  headers: string[]
  rows: CellValue[][]
  filename: string
  summary?: SummaryStat[]
}

export function downloadPDF({ title, subtitle, headers, rows, filename, summary }: PDFExportOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margin = 14

  // ── Header bar
  doc.setFillColor(12, 21, 40)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('EliCloud Monitor', margin, 11.5)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    W - margin,
    11.5,
    { align: 'right' },
  )

  // ── Title
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, 27)

  let y = 33
  if (subtitle) {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle, margin, y)
    y += 7
  }

  // ── Summary stat boxes
  if (summary && summary.length > 0) {
    const boxW = (W - margin * 2) / summary.length - 2
    summary.forEach((s, i) => {
      const x = margin + i * (boxW + 2)
      doc.setFillColor(248, 250, 252)
      doc.rect(x, y, boxW, 13, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(x, y, boxW, 13, 'S')
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(s.label.toUpperCase(), x + 2.5, y + 4.5)
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(s.value, x + 2.5, y + 10.5)
    })
    y += 17
  }

  // ── Data table
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows.map((r) => r.map((v) => (v == null ? '—' : String(v)))),
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: [30, 41, 59] as [number, number, number],
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [12, 21, 40] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    didDrawPage: (data) => {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Page ${data.pageNumber}  ·  EliCloud Monitor`,
        W / 2,
        H - 5,
        { align: 'center' },
      )
    },
  })

  doc.save(filename)
}

// ── Executive Report PDF ──────────────────────────────────────────────────────

export interface ExecutiveReportData {
  generatedAt: string
  summary: {
    total_hosts: number
    total_vms: number
    running_vms: number
    stopped_vms: number
    cpu_alloc_pct: number
    mem_alloc_pct: number
    storage_used_tb: number
    storage_total_tb: number
  }
  hosts: Array<{
    name: string
    state: string
    vcpu_allocated: number
    vcpu_total: number
    memory_allocated_gb: number
    memory_total_gb: number
    vm_count: number
    cpu_overcommit_pct: number
    mem_overcommit_pct: number
  }>
  physicalStorage: Array<{
    name: string
    type: string
    state: string
    total_tb: number
    used_tb: number
    util_pct: number
  }>
  virtualStorage: Array<{
    name: string
    type: string
    state: string
    total_tb: number
    used_tb: number
    util_pct: number
  }>
}

const _tableStyles = {
  styles: {
    fontSize: 7.5,
    cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    textColor: [30, 41, 59] as [number, number, number],
    lineColor: [226, 232, 240] as [number, number, number],
    lineWidth: 0.2,
  },
  headStyles: {
    fillColor: [51, 65, 85] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 7,
  },
  alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
}

export function downloadExecutivePDF(data: ExecutiveReportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margin = 14

  // ── Mini header: 12mm bar shown on every page after page 1
  const miniHeader = () => {
    doc.setFillColor(12, 21, 40)
    doc.rect(0, 0, W, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('EliCloud Monitor', margin, 8)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Infrastructure Executive Report', W / 2, 8, { align: 'center' })
    doc.text(data.generatedAt, W - margin, 8, { align: 'right' })
  }

  // ── Section bar — dark strip just below mini header
  const sectionBar = (title: string, y: number) => {
    doc.setFillColor(30, 41, 59)
    doc.rect(margin, y, W - margin * 2, 7, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 3, y + 4.8)
  }

  // ── Footer: uses absolute doc page number
  const pageFooter = () => {
    const num = (doc.internal as any).getCurrentPageInfo?.()?.pageNumber ?? doc.getNumberOfPages()
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${num}  ·  EliCloud Monitor  ·  Infrastructure Executive Report`,
      W / 2, H - 5, { align: 'center' },
    )
  }

  // ── Shared hooks: mini header on every table page, footer on every table page
  const tableHooks = {
    willDrawPage: () => miniHeader(),
    didDrawPage: () => pageFooter(),
  }

  // ── PAGE 1: EXECUTIVE SUMMARY ─────────────────────────────────────────────
  doc.setFillColor(12, 21, 40)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('EliCloud Monitor', margin, 11.5)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.generatedAt, W - margin, 11.5, { align: 'right' })

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Infrastructure Executive Report', margin, 27)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${data.generatedAt}`, margin, 33)

  sectionBar('EXECUTIVE SUMMARY', 39)
  let y = 50

  const boxes = [
    { label: 'Total Hosts',           value: String(data.summary.total_hosts) },
    { label: 'Total VMs',             value: String(data.summary.total_vms) },
    { label: 'Running VMs',           value: String(data.summary.running_vms) },
    { label: 'Stopped VMs',           value: String(data.summary.stopped_vms) },
    { label: 'CPU Allocation Rate',   value: `${data.summary.cpu_alloc_pct.toFixed(1)}%` },
    { label: 'Memory Allocation Rate',value: `${data.summary.mem_alloc_pct.toFixed(1)}%` },
    { label: 'Storage Used',          value: `${data.summary.storage_used_tb} TB` },
    { label: 'Storage Total',         value: `${data.summary.storage_total_tb} TB` },
  ]
  const boxW = (W - margin * 2) / 4 - 2
  const boxH = 14
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const box = boxes[row * 4 + col]
      const x  = margin + col * (boxW + 2)
      const yy = y + row * (boxH + 2)
      doc.setFillColor(248, 250, 252)
      doc.rect(x, yy, boxW, boxH, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(x, yy, boxW, boxH, 'S')
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(box.label.toUpperCase(), x + 2.5, yy + 4.5)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(box.value, x + 2.5, yy + 11)
    }
  }
  pageFooter()

  // ── PAGE 2: HOST UTILIZATION ──────────────────────────────────────────────
  // willDrawPage draws mini header on every page of this table (including page 2 itself).
  // sectionBar drawn manually so it only appears on the first page of the section.
  doc.addPage()
  sectionBar('HOST UTILIZATION', 13)

  autoTable(doc, {
    startY: 24,
    head: [['Host Name', 'State', 'vCPU Alloc / Total', 'Memory Alloc / Total', 'VMs', 'CPU OC%', 'Mem OC%']],
    body: data.hosts.map((h) => [
      h.name,
      h.state,
      `${h.vcpu_allocated} / ${h.vcpu_total} vCPU`,
      `${h.memory_allocated_gb} / ${h.memory_total_gb} GB`,
      h.vm_count,
      `${h.cpu_overcommit_pct.toFixed(1)}%`,
      `${h.mem_overcommit_pct.toFixed(1)}%`,
    ]),
    margin: { top: 18, left: margin, right: margin, bottom: 10 },
    ...(_tableStyles),
    ...tableHooks,
  })

  // ── PAGE 3+: STORAGE UTILIZATION ─────────────────────────────────────────
  doc.addPage()
  sectionBar('STORAGE UTILIZATION — PHYSICAL', 13)

  autoTable(doc, {
    startY: 24,
    head: [['Storage Name', 'Type', 'State', 'Physical Total TB', 'Physical Used TB', 'Utilization %']],
    body: data.physicalStorage.map((s) => [
      s.name, s.type, s.state,
      s.total_tb.toFixed(2),
      s.used_tb.toFixed(2),
      `${s.util_pct.toFixed(1)}%`,
    ]),
    margin: { top: 18, left: margin, right: margin, bottom: 10 },
    ...(_tableStyles),
    ...tableHooks,
  })

  // Virtual storage — same page if there's room, otherwise new page
  let virtY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 10
  if (virtY > H - 45) {
    doc.addPage()
    virtY = 24
    sectionBar('STORAGE UTILIZATION — VIRTUAL (PROVISIONED)', 13)
  } else {
    sectionBar('STORAGE UTILIZATION — VIRTUAL (PROVISIONED)', virtY)
    virtY += 9
  }

  autoTable(doc, {
    startY: virtY,
    head: [['Storage Name', 'Type', 'State', 'Virtual Total TB', 'Virtual Used TB', 'Utilization %']],
    body: data.virtualStorage.map((s) => [
      s.name, s.type, s.state,
      s.total_tb.toFixed(2),
      s.used_tb.toFixed(2),
      `${s.util_pct.toFixed(1)}%`,
    ]),
    margin: { top: 18, left: margin, right: margin, bottom: 10 },
    ...(_tableStyles),
    ...tableHooks,
  })

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  doc.save(`Elicloud_JK3_Executive_Report_${dateStr}.pdf`)
}

// ── Shared blob download helper ───────────────────────────────────────────────

function _blobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Executive XLSX ────────────────────────────────────────────────────────────
// Uses write-excel-file for full cell styling (bold, colours, borders).

export async function downloadExecutiveXLSX(data: ExecutiveReportData) {
  const fileDate = new Date().toISOString().split('T')[0].replace(/-/g, '')

  // Palette
  const DARK     = '#0C1528'
  const DARK_MED = '#1E2937'
  const WHITE    = '#FFFFFF'
  const ALT      = '#F1F5F9'
  const MUTED_BG = '#F8FAFC'
  const MUTED_FG = '#64748B'
  const BORDER   = '#CBD5E1'
  const RED_BG   = '#FEF2F2'
  const AMBER_BG = '#FFFBEB'

  // Cell factories — write-excel-file v4 uses textColor (not color) and columnSpan (not span)
  const title = (text: string, span: number): any => ({
    value: text, columnSpan: span,
    backgroundColor: DARK, textColor: WHITE,
    fontWeight: 'bold', fontSize: 13, height: 32,
  })
  const subtitle = (text: string, span: number): any => ({
    value: text, columnSpan: span,
    backgroundColor: MUTED_BG, textColor: MUTED_FG,
    fontSize: 9, height: 18,
  })
  const section = (text: string, span: number): any => ({
    value: text, columnSpan: span,
    backgroundColor: DARK_MED, textColor: WHITE,
    fontWeight: 'bold', fontSize: 10, height: 22,
  })
  const hdr = (text: string): any => ({
    value: text,
    backgroundColor: DARK_MED, textColor: WHITE,
    fontWeight: 'bold', fontSize: 9,
    borderStyle: 'thin', borderColor: BORDER,
    height: 20,
  })
  const dat = (value: string | number, alt: boolean, opts?: { bg?: string }): any => ({
    value,
    type: typeof value === 'number' ? Number : String,
    backgroundColor: opts?.bg ?? (alt ? ALT : WHITE),
    textColor: '#1E293B',
    fontSize: 9,
    borderStyle: 'thin', borderColor: BORDER,
    height: 18,
  })
  const ocBg = (pct: number): string | undefined =>
    pct >= 90 ? RED_BG : pct >= 70 ? AMBER_BG : undefined

  // ── Sheet 1: Summary
  const s1: any[][] = [
    [title('Infrastructure Executive Report', 2), null],
    [subtitle(`Generated: ${data.generatedAt}`, 2), null],
    [{ value: '', height: 8 }, null],
    [section('EXECUTIVE SUMMARY', 2), null],
    [hdr('Metric'), hdr('Value')],
    ...([
      ['Total Hosts', data.summary.total_hosts],
      ['Total VMs', data.summary.total_vms],
      ['Running VMs', data.summary.running_vms],
      ['Stopped VMs', data.summary.stopped_vms],
      ['CPU Allocation Rate (%)', parseFloat(data.summary.cpu_alloc_pct.toFixed(1))],
      ['Memory Allocation Rate (%)', parseFloat(data.summary.mem_alloc_pct.toFixed(1))],
      ['Storage Used (TB)', data.summary.storage_used_tb],
      ['Storage Total (TB)', data.summary.storage_total_tb],
    ] as [string, string | number][]).map(([k, v], i) => [
      dat(k, i % 2 === 1), dat(v, i % 2 === 1),
    ]),
  ]

  // ── Sheet 2: Host Utilization
  const N2 = 9
  const s2: any[][] = [
    [title('HOST UTILIZATION', N2), ...Array(N2 - 1).fill(null)],
    [
      hdr('Host Name'), hdr('State'),
      hdr('vCPU Allocated'), hdr('vCPU Total'),
      hdr('Mem Alloc (GB)'), hdr('Mem Total (GB)'),
      hdr('VM Count'), hdr('CPU OC%'), hdr('Mem OC%'),
    ],
    ...data.hosts.map((h, i) => [
      dat(h.name, i % 2 === 1),
      dat(h.state, i % 2 === 1),
      dat(h.vcpu_allocated, i % 2 === 1),
      dat(h.vcpu_total, i % 2 === 1),
      dat(h.memory_allocated_gb, i % 2 === 1),
      dat(h.memory_total_gb, i % 2 === 1),
      dat(h.vm_count, i % 2 === 1),
      dat(parseFloat(h.cpu_overcommit_pct.toFixed(1)), i % 2 === 1, { bg: ocBg(h.cpu_overcommit_pct) }),
      dat(parseFloat(h.mem_overcommit_pct.toFixed(1)), i % 2 === 1, { bg: ocBg(h.mem_overcommit_pct) }),
    ]),
  ]

  // ── Sheets 3 & 4: Storage
  const N3 = 6
  const makeStorageSheet = (rows: typeof data.physicalStorage, titleText: string): any[][] => [
    [title(titleText, N3), ...Array(N3 - 1).fill(null)],
    [
      hdr('Storage Name'), hdr('Type'), hdr('State'),
      hdr('Total TB'), hdr('Used TB'), hdr('Utilization %'),
    ],
    ...rows.map((s, i) => {
      const utilBg = s.util_pct >= 90 ? RED_BG : s.util_pct >= 75 ? AMBER_BG : undefined
      return [
        dat(s.name, i % 2 === 1),
        dat(s.type, i % 2 === 1),
        dat(s.state, i % 2 === 1),
        dat(parseFloat(s.total_tb.toFixed(2)), i % 2 === 1),
        dat(parseFloat(s.used_tb.toFixed(2)), i % 2 === 1),
        dat(parseFloat(s.util_pct.toFixed(1)), i % 2 === 1, { bg: utilBg }),
      ]
    }),
  ]

  const s3 = makeStorageSheet(data.physicalStorage, 'STORAGE UTILIZATION — PHYSICAL')
  const s4 = makeStorageSheet(data.virtualStorage, 'STORAGE UTILIZATION — VIRTUAL (PROVISIONED)')

  const blob = await writeXlsxFile([
    {
      data: s1 as any,
      sheet: 'Summary',
      columns: [{ width: 34 }, { width: 20 }],
    },
    {
      data: s2 as any,
      sheet: 'Host Utilization',
      columns: [
        { width: 24 }, { width: 10 }, { width: 14 }, { width: 12 },
        { width: 14 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 },
      ],
    },
    {
      data: s3 as any,
      sheet: 'Storage - Physical',
      columns: [{ width: 28 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }],
    },
    {
      data: s4 as any,
      sheet: 'Storage - Virtual',
      columns: [{ width: 28 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }],
    },
  ] as any).toBlob()

  _blobDownload(blob, `Elicloud_JK3_Executive_Report_${fileDate}.xlsx`)
}

// ── Executive DOCX ────────────────────────────────────────────────────────────
// A4 landscape, page header/footer, KPI card grid, section bars.
// Tables use columnWidths (DXA, proportional) + percentage table width for
// reliable column sizing regardless of page orientation rendering.

// A4 landscape page dimensions in DXA (1 mm ≈ 56.7 DXA)
const _PG_W   = 16838  // 297 mm
const _PG_H   = 11906  // 210 mm
const _MARGIN = 851    // 15 mm per side

const _NBORDER = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const _LBORDER = { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }
const _TBORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' }

// ── Cell helpers (no cell-level width — column sizing via Table.columnWidths)

function _kpiCard(label: string, value: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: label.toUpperCase(), color: '94A3B8', size: 14, font: 'Calibri' })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: value, bold: true, color: '0F172A', size: 36, font: 'Calibri' })],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' },
    borders: { top: _LBORDER, bottom: _LBORDER, left: _LBORDER, right: _LBORDER },
    margins: { top: 180, bottom: 180, left: 200, right: 200 },
  })
}

function _sectionBar(text: string): Table {
  const bar = { style: BorderStyle.SINGLE, size: 1, color: '1E2937' }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })],
                spacing: { before: 80, after: 80 },
              }),
            ],
            shading: { type: ShadingType.SOLID, color: '1E2937', fill: '1E2937' },
            borders: { top: bar, bottom: bar, left: bar, right: bar },
            margins: { left: 180, right: 180 },
          }),
        ],
      }),
    ],
    borders: {
      top: _NBORDER, bottom: _NBORDER, left: _NBORDER, right: _NBORDER,
      insideHorizontal: _NBORDER, insideVertical: _NBORDER,
    },
  })
}

function _hdrCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 16, font: 'Calibri' })],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: '1E2937', fill: '1E2937' },
    borders: { top: _TBORDER, bottom: _TBORDER, left: _TBORDER, right: _TBORDER },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  })
}

function _datCell(text: string, alt: boolean): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, color: '334155', size: 16, font: 'Calibri' })],
      }),
    ],
    shading: {
      type: ShadingType.SOLID,
      color: alt ? 'F1F5F9' : 'FFFFFF',
      fill:  alt ? 'F1F5F9' : 'FFFFFF',
    },
    borders: { top: _TBORDER, bottom: _TBORDER, left: _TBORDER, right: _TBORDER },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  })
}

export async function downloadExecutiveDOCX(data: ExecutiveReportData) {
  const fileDate = new Date().toISOString().split('T')[0].replace(/-/g, '')

  // ── KPI 4×2 card grid
  // columnWidths: 4 equal columns. Values are proportional DXA — Word distributes
  // the full table width (100%) according to these ratios.
  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2500, 2500, 2500, 2500],
    rows: [
      new TableRow({
        children: [
          _kpiCard('Total Hosts', String(data.summary.total_hosts)),
          _kpiCard('Total VMs', data.summary.total_vms.toLocaleString()),
          _kpiCard('Running VMs', data.summary.running_vms.toLocaleString()),
          _kpiCard('Stopped VMs', data.summary.stopped_vms.toLocaleString()),
        ],
      }),
      new TableRow({
        children: [
          _kpiCard('CPU Allocation Rate', `${data.summary.cpu_alloc_pct.toFixed(1)}%`),
          _kpiCard('Memory Allocation Rate', `${data.summary.mem_alloc_pct.toFixed(1)}%`),
          _kpiCard('Storage Used', `${data.summary.storage_used_tb} TB`),
          _kpiCard('Storage Total', `${data.summary.storage_total_tb} TB`),
        ],
      }),
    ],
    borders: {
      top: _NBORDER, bottom: _NBORDER, left: _NBORDER, right: _NBORDER,
      insideHorizontal: _NBORDER, insideVertical: _NBORDER,
    },
  })

  // ── Host table (7 columns, proportional widths)
  const HC = [3400, 1100, 2200, 2400, 900, 1400, 1400]
  const hostTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: HC,
    rows: [
      new TableRow({
        children: [
          _hdrCell('Host Name'),
          _hdrCell('State'),
          _hdrCell('vCPU Alloc / Total'),
          _hdrCell('Mem Alloc / Total'),
          _hdrCell('VMs'),
          _hdrCell('CPU OC%'),
          _hdrCell('Mem OC%'),
        ],
        tableHeader: true,
      }),
      ...data.hosts.map((h, i) =>
        new TableRow({
          children: [
            _datCell(h.name, i % 2 === 1),
            _datCell(h.state, i % 2 === 1),
            _datCell(`${h.vcpu_allocated} / ${h.vcpu_total} vCPU`, i % 2 === 1),
            _datCell(`${h.memory_allocated_gb} / ${h.memory_total_gb} GB`, i % 2 === 1),
            _datCell(String(h.vm_count), i % 2 === 1),
            _datCell(`${h.cpu_overcommit_pct.toFixed(1)}%`, i % 2 === 1),
            _datCell(`${h.mem_overcommit_pct.toFixed(1)}%`, i % 2 === 1),
          ],
        })
      ),
    ],
  })

  // ── Storage table factory (6 columns, proportional widths)
  const SC = [4000, 2000, 1500, 2100, 2100, 1800]
  const makeStorageTable = (rows: typeof data.physicalStorage): Table =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: SC,
      rows: [
        new TableRow({
          children: [
            _hdrCell('Storage Name'),
            _hdrCell('Type'),
            _hdrCell('State'),
            _hdrCell('Total TB'),
            _hdrCell('Used TB'),
            _hdrCell('Utilization %'),
          ],
          tableHeader: true,
        }),
        ...rows.map((s, i) =>
          new TableRow({
            children: [
              _datCell(s.name, i % 2 === 1),
              _datCell(s.type, i % 2 === 1),
              _datCell(s.state, i % 2 === 1),
              _datCell(s.total_tb.toFixed(2), i % 2 === 1),
              _datCell(s.used_tb.toFixed(2), i % 2 === 1),
              _datCell(`${s.util_pct.toFixed(1)}%`, i % 2 === 1),
            ],
          })
        ),
      ],
    })

  const sp = (after: number) => new Paragraph({ text: '', spacing: { after } })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: _PG_W, height: _PG_H },
            margin: { top: _MARGIN, right: _MARGIN, bottom: _MARGIN, left: _MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'EliCloud Monitor', bold: true, color: '0F172A', size: 18, font: 'Calibri' }),
                  new TextRun({ text: '   ·   Infrastructure Executive Report', color: '64748B', size: 18, font: 'Calibri' }),
                  new TextRun({ text: `   ·   ${data.generatedAt}`, color: '94A3B8', size: 16, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'EliCloud Monitor  ·  Confidential  ·  Page ', color: '94A3B8', size: 16, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], color: '94A3B8', size: 16 }),
                  new TextRun({ text: ' / ', color: '94A3B8', size: 16, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '94A3B8', size: 16 }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'Infrastructure Executive Report', bold: true, size: 52, color: '0F172A', font: 'Calibri' }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Generated: ${data.generatedAt}`, color: '64748B', size: 18, font: 'Calibri' }),
            ],
            spacing: { after: 400 },
          }),
          _sectionBar('EXECUTIVE SUMMARY'),
          sp(140),
          kpiTable,
          sp(400),
          _sectionBar('HOST UTILIZATION'),
          sp(140),
          hostTable,
          sp(400),
          _sectionBar('STORAGE UTILIZATION — PHYSICAL'),
          sp(140),
          makeStorageTable(data.physicalStorage),
          sp(400),
          _sectionBar('STORAGE UTILIZATION — VIRTUAL (PROVISIONED)'),
          sp(140),
          makeStorageTable(data.virtualStorage),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  _blobDownload(blob, `Elicloud_JK3_Executive_Report_${fileDate}.docx`)
}
