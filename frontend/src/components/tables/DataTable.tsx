import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T
  onRowClick?: (row: T) => void
  selectedRowKey?: string | null
  emptyMessage?: string
}

type SortDirection = 'asc' | 'desc' | null

function getValue<T extends Record<string, unknown>>(row: T, key: string): unknown {
  return key.split('.').reduce<unknown>((obj, k) => {
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[k]
    }
    return undefined
  }, row)
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectedRowKey,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') {
        setSortKey(null)
        setSortDir(null)
      } else setSortDir('asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0
    const av = getValue(a, sortKey)
    const bv = getValue(b, sortKey)
    if (av == null) return 1
    if (bv == null) return -1
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: Column<T> }) {
    if (!col.sortable) return null
    const active = sortKey === col.key
    if (active && sortDir === 'asc')
      return <ChevronUp className="ml-1 inline h-3 w-3 text-sky-500" />
    if (active && sortDir === 'desc')
      return <ChevronDown className="ml-1 inline h-3 w-3 text-sky-500" />
    return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-slate-300" />
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400',
                  col.sortable && 'cursor-pointer select-none transition-colors hover:text-slate-600',
                  col.className,
                )}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
              >
                {col.header}
                <SortIcon col={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-xs text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = String(row[rowKey])
              const isSelected = selectedRowKey === key
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-sky-50/40',
                    isSelected && 'bg-sky-50 hover:bg-sky-50',
                    !onRowClick && 'hover:bg-slate-50/60',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn('px-4 py-3 text-slate-700', col.className)}
                    >
                      {col.render
                        ? col.render(row)
                        : String(getValue(row, String(col.key)) ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
