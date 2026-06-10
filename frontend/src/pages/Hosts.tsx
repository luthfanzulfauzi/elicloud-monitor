import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHosts, fetchHostTrend, fetchHostDiskSummary, type Host, type HostDiskSummaryMap } from '@/lib/api'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HostTrendChart from '@/components/charts/HostTrendChart'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PaginationBar from '@/components/ui/PaginationBar'
import { calcPercent, cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

type HostRow = Host & Record<string, unknown>

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

function DiskCell({ hostId, diskSummary }: { hostId: string; diskSummary: HostDiskSummaryMap | undefined }) {
  const summary = diskSummary?.[hostId] ?? null
  if (!summary || summary.root_use_pct == null) {
    return <span className="text-slate-400 text-xs">—</span>
  }

  const pct = Math.round(summary.root_use_pct)
  const colorClass = pct >= 90 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-emerald-600'
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'

  const isStale = summary.collected_at
    ? Date.now() - new Date(summary.collected_at).getTime() > 15 * 60 * 1000
    : false

  const ageLabel = (() => {
    if (!isStale || !summary.collected_at) return null
    const ageMin = Math.round((Date.now() - new Date(summary.collected_at).getTime()) / 60000)
    return ageMin >= 60 ? `${Math.round(ageMin / 60)}h ago` : `${ageMin}m ago`
  })()

  const maxPct = summary.max_use_pct != null ? Math.round(summary.max_use_pct) : null
  const maxMount = summary.max_mountpoint
  const showMax = maxPct != null && maxMount != null && maxMount !== '/'
  const maxColorClass = maxPct != null ? (maxPct >= 90 ? 'text-red-600' : maxPct >= 75 ? 'text-amber-600' : 'text-emerald-600') : ''
  const maxBarColor  = maxPct != null ? (maxPct >= 90 ? 'bg-red-500'  : maxPct >= 75 ? 'bg-amber-500'  : 'bg-emerald-500') : ''

  return (
    <div className="flex flex-col gap-1">
      {/* Root / utilization */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 w-9 shrink-0">/</span>
        <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className={`text-xs font-semibold ${colorClass}`}>{pct}%</span>
        {isStale && ageLabel && (
          <span className="text-[9px] text-slate-400">({ageLabel})</span>
        )}
      </div>
      {/* Max mount utilization (when different from /) */}
      {showMax && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-9 shrink-0 truncate">{maxMount}</span>
          <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${maxBarColor}`} style={{ width: `${Math.min(maxPct!, 100)}%` }} />
          </div>
          <span className={`text-xs font-semibold ${maxColorClass}`}>{maxPct}%</span>
        </div>
      )}
    </div>
  )
}

export default function Hosts() {
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [trendHostId, setTrendHostId] = useState<string>('all')
  const [trendPreset, setTrendPreset] = useState<DatePreset>('30d')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: hosts, isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: fetchHosts,
  })

  const { data: diskSummary } = useQuery<HostDiskSummaryMap>({
    queryKey: ['host-disk-summary'],
    queryFn: fetchHostDiskSummary,
    staleTime: 60_000,
    refetchInterval: 300_000,
  })

  const { data: hostTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['host-trend', trendHostId, trendPreset],
    queryFn: () => {
      const { start, end } = getDateRange(trendPreset)
      return fetchHostTrend(start, end, trendHostId === 'all' ? undefined : trendHostId)
    },
  })

  const columns = useMemo<Column<HostRow>[]>(() => [
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
    {
      key: '_disk',
      header: '/ Disk',
      sortable: false,
      render: (row) => <DiskCell hostId={row.id as string} diskSummary={diskSummary} />,
    },
  ], [diskSummary])

  const filtered = (hosts ?? []).filter(
    (h) => stateFilter === 'all' || h.state === stateFilter,
  ) as HostRow[]

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function resetPage() { setPage(1) }

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
              <PaginationBar
                total={filtered.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
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
