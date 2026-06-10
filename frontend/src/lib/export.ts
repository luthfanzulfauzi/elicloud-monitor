import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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

function _sectionHeader(doc: jsPDF, margin: number, W: number, y: number, title: string) {
  doc.setFillColor(30, 41, 59)
  doc.rect(margin, y, W - margin * 2, 7, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title, margin + 3, y + 4.8)
}

function _pageFooter(doc: jsPDF, W: number, H: number) {
  return (data: { pageNumber: number }) => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${data.pageNumber}  ·  EliCloud Monitor  ·  Infrastructure Executive Report`,
      W / 2,
      H - 5,
      { align: 'center' },
    )
  }
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
  const footer = _pageFooter(doc, W, H)

  // ── Header bar
  doc.setFillColor(12, 21, 40)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('EliCloud Monitor', margin, 11.5)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(data.generatedAt, W - margin, 11.5, { align: 'right' })

  // ── Title
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Infrastructure Executive Report', margin, 27)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${data.generatedAt}`, margin, 33)

  let y = 40

  // ── Summary boxes (2 rows × 4 cols)
  const boxes = [
    { label: 'Total Hosts', value: String(data.summary.total_hosts) },
    { label: 'Total VMs', value: String(data.summary.total_vms) },
    { label: 'Running VMs', value: String(data.summary.running_vms) },
    { label: 'Stopped VMs', value: String(data.summary.stopped_vms) },
    { label: 'CPU Allocation Rate', value: `${data.summary.cpu_alloc_pct.toFixed(1)}%` },
    { label: 'Memory Allocation Rate', value: `${data.summary.mem_alloc_pct.toFixed(1)}%` },
    { label: 'Storage Used', value: `${data.summary.storage_used_tb} TB` },
    { label: 'Storage Total', value: `${data.summary.storage_total_tb} TB` },
  ]
  const boxW = (W - margin * 2) / 4 - 2
  const boxH = 14
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const box = boxes[row * 4 + col]
      const x = margin + col * (boxW + 2)
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
  y += 2 * (boxH + 2) + 6

  // ── HOST UTILIZATION
  _sectionHeader(doc, margin, W, y, 'HOST UTILIZATION')
  y += 9

  autoTable(doc, {
    startY: y,
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
    margin: { left: margin, right: margin },
    ...(_tableStyles),
    didDrawPage: footer,
  })

  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 8

  // ── STORAGE — PHYSICAL
  if (y > H - 50) { doc.addPage(); y = margin }
  _sectionHeader(doc, margin, W, y, 'STORAGE UTILIZATION — PHYSICAL')
  y += 9

  autoTable(doc, {
    startY: y,
    head: [['Storage Name', 'Type', 'State', 'Physical Total TB', 'Physical Used TB', 'Utilization %']],
    body: data.physicalStorage.map((s) => [
      s.name, s.type, s.state,
      s.total_tb.toFixed(2),
      s.used_tb.toFixed(2),
      `${s.util_pct.toFixed(1)}%`,
    ]),
    margin: { left: margin, right: margin },
    ...(_tableStyles),
    didDrawPage: footer,
  })

  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 8

  // ── STORAGE — VIRTUAL
  if (y > H - 50) { doc.addPage(); y = margin }
  _sectionHeader(doc, margin, W, y, 'STORAGE UTILIZATION — VIRTUAL (PROVISIONED)')
  y += 9

  autoTable(doc, {
    startY: y,
    head: [['Storage Name', 'Type', 'State', 'Virtual Total TB', 'Virtual Used TB', 'Utilization %']],
    body: data.virtualStorage.map((s) => [
      s.name, s.type, s.state,
      s.total_tb.toFixed(2),
      s.used_tb.toFixed(2),
      `${s.util_pct.toFixed(1)}%`,
    ]),
    margin: { left: margin, right: margin },
    ...(_tableStyles),
    didDrawPage: footer,
  })

  const dateStr = data.generatedAt.split(',')[0].replace(/\//g, '-').replace(/ /g, '_')
  doc.save(`executive_report_${dateStr}.pdf`)
}
