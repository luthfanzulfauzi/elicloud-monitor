import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './select'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  const addPage = (n: number) => { if (pages[pages.length - 1] !== n) pages.push(n) }
  addPage(1)
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p)
  if (current < total - 2) pages.push('...')
  addPage(total)
  return pages
}

interface PaginationBarProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

export default function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationBarProps) {
  const [goToInput, setGoToInput] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageList = buildPageList(currentPage, totalPages)

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, total)

  function handleGoTo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const n = parseInt(goToInput, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n)
    setGoToInput('')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3">
      {/* Left: count + rows per page */}
      <div className="flex items-center gap-3">
        <p className="text-[10px] text-slate-500">
          {total === 0 ? '0 results' : `${rangeStart}–${rangeEnd} of ${total}`}
        </p>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1) }}
        >
          <SelectTrigger className="h-7 w-20 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-[10px]">{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Center: prev / page buttons / next */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pageList.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1 text-[10px] text-slate-400 select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              size="icon"
              className="h-7 w-7 text-[10px]"
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right: go to */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400">Go to</span>
        <Input
          className="h-7 w-16 text-center text-[10px]"
          placeholder={String(currentPage)}
          value={goToInput}
          onChange={(e) => setGoToInput(e.target.value)}
          onKeyDown={handleGoTo}
        />
        <span className="text-[10px] text-slate-400">/ {totalPages}</span>
      </div>
    </div>
  )
}
