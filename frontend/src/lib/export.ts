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
