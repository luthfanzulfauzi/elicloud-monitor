import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchHosts, fetchHostTrend, type Host } from '@/lib/api'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HostTrendChart from '@/components/charts/HostTrendChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calcPercent, cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

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

type HostRow = Host & Record<string, unknown>

const columns: Column<HostRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'management_ip', header: 'Management IP', sortable: true },
  {
    key: 'state',
    header: 'State',
    sortable: true,
    render: (row) => (
      <Badge variant={row.state === 'Enabled' ? 'success' : 'danger'}>{String(row.state)}</Badge>
    ),
  },
  {
    key: 'vcpu_allocated',
    header: 'CPU Allocated / Total',
    sortable: true,
    render: (row) => (
      <span className="text-slate-700">
        {String(row.vcpu_allocated)} / {String(row.vcpu_total)} vCPU
      </span>
    ),
  },
  {
    key: 'memory_allocated_gb',
    header: 'Memory Alloc. / Total',
    sortable: true,
    render: (row) => (
      <span className="text-slate-700">
        {String(row.memory_allocated_gb)} / {String(row.memory_total_gb)} GB
      </span>
    ),
  },
  { key: 'vm_count', header: 'VM Count', sortable: true },
  {
    key: '_cpu_pct',
    header: 'CPU Overcommit %',
    sortable: false,
    render: (row) => {
      const pct = calcPercent(row.vcpu_allocated as number, row.vcpu_total as number)
      return (
        <span
          className={
            pct >= 90
              ? 'font-semibold text-red-600'
              : pct >= 70
              ? 'font-semibold text-amber-600'
              : 'font-semibold text-emerald-600'
          }
        >
          {pct}%
        </span>
      )
    },
  },
  {
    key: '_mem_pct',
    header: 'Mem Overcommit %',
    sortable: false,
    render: (row) => {
      const pct = calcPercent(row.memory_allocated_gb as number, row.memory_total_gb as number)
      return (
        <span
          className={
            pct >= 90
              ? 'font-semibold text-red-600'
              : pct >= 70
              ? 'font-semibold text-amber-600'
              : 'font-semibold text-emerald-600'
          }
        >
          {pct}%
        </span>
      )
    },
  },
]

type DatePreset = '7d' | '30d' | '90d'

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  if (preset === '7d') start.setDate(start.getDate() - 7)
  else if (preset === '30d') start.setDate(start.getDate() - 30)
  else start.setDate(start.getDate() - 90)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export default function Hosts() {
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [trendHostId, setTrendHostId] = useState<string>('all')
  const [trendPreset, setTrendPreset] = useState<DatePreset>('30d')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [goToInput, setGoToInput] = useState('')

  const { data: hosts, isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: fetchHosts,
  })

  const { data: hostTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['host-trend', trendHostId, trendPreset],
    queryFn: () => {
      const { start, end } = getDateRange(trendPreset)
      return fetchHostTrend(start, end, trendHostId === 'all' ? undefined : trendHostId)
    },
  })

  const filtered = (hosts ?? []).filter(
    (h) => stateFilter === 'all' || h.state === stateFilter,
  ) as HostRow[]

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageList = buildPageList(currentPage, totalPages)

  function resetPage() { setPage(1) }

  function handleGoTo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const n = parseInt(goToInput, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) setPage(n)
    setGoToInput('')
  }

  const selectedHostName =
    trendHostId === 'all'
      ? 'All Hosts'
      : (hosts ?? []).find((h) => h.id === trendHostId)?.name ?? trendHostId

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">All Hosts</h2>
          <p className="text-[10px] text-slate-400">{(hosts ?? []).length} physical compute nodes</p>
        </div>
        <div className="w-44">
          <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); resetPage() }}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All States</SelectItem>
              <SelectItem value="Enabled" className="text-xs">Enabled</SelectItem>
              <SelectItem value="Disabled" className="text-xs">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[10px] font-medium text-slate-500">
            {filtered.length} host{filtered.length !== 1 ? 's' : ''} shown
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <DataTable<HostRow>
                columns={columns}
                data={paginated}
                rowKey="id"
                emptyMessage="No hosts match the current filter."
              />
              {/* Pagination bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-slate-500">
                    {filtered.length === 0
                      ? '0 results'
                      : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`}
                  </p>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetPage() }}>
                    <SelectTrigger className="h-7 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-[10px]">{n} / page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {pageList.map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="px-1 text-[10px] text-slate-400 select-none">…</span>
                    ) : (
                      <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-[10px]" onClick={() => setPage(p as number)}>
                        {p}
                      </Button>
                    )
                  )}
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Host Usage Trend</CardTitle>
              <p className="mt-0.5 text-[10px] text-slate-400">
                CPU &amp; Memory allocation % — {selectedHostName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Host selector */}
              <Select value={trendHostId} onValueChange={setTrendHostId}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Hosts (Total)</SelectItem>
                  {(hosts ?? []).map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-xs">
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Date range */}
              <div className="flex rounded-md border border-slate-200 overflow-hidden">
                {(['7d', '30d', '90d'] as DatePreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTrendPreset(p)}
                    className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                      trendPreset === p
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : hostTrend && hostTrend.length > 0 ? (
            <HostTrendChart data={hostTrend} />
          ) : (
            <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">
              No trend data available for the selected period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
