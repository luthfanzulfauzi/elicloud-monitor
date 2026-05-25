import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchStorage, fetchStorageCapacityTrend, type StoragePool, type CephPool } from '@/lib/api'
import StorageCapacityTrendChart from '@/components/charts/StorageCapacityTrendChart'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { calcPercent, formatTB, cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function UtilizationBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-semibold ${
          percent >= 90
            ? 'text-red-600'
            : percent >= 70
            ? 'text-amber-600'
            : 'text-emerald-600'
        }`}
      >
        {percent}%
      </span>
    </div>
  )
}

const TABLE_HEADERS = ['Name', 'Type', 'State', 'Total', 'Used', 'Free', '90% Usable Free', 'Utilization']

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50">
        {TABLE_HEADERS.map((h) => (
          <th
            key={h}
            className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function CephPoolRow({ pool }: { pool: CephPool }) {
  const displayName = pool.alias_name || pool.pool_name
  const freeTB = pool.total_tb - pool.used_tb
  const usableFree90 = pool.total_tb * 0.9 - pool.used_tb
  return (
    <tr className="border-b border-slate-100 bg-slate-50/50 transition-colors hover:bg-slate-50">
      <td className="py-2.5 pl-10 pr-4 text-xs text-slate-500 italic">{displayName}</td>
      <td className="px-4 py-2.5">
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
          Ceph Pool
        </span>
      </td>
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(pool.total_tb)}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(pool.used_tb)}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(freeTB)}</td>
      <td className={`px-4 py-2.5 text-xs font-medium ${usableFree90 < 0 ? 'text-red-600' : 'text-slate-600'}`}>
        {formatTB(usableFree90)}
      </td>
      <td className="px-4 py-2.5">
        <UtilizationBar percent={pool.util_pct} />
      </td>
    </tr>
  )
}

function CephPoolVirtualRow({
  pool,
  totalScale,
  usedScale,
}: {
  pool: CephPool
  totalScale: number
  usedScale: number
}) {
  const displayName = pool.alias_name || pool.pool_name
  const virtualTotal = pool.total_tb * totalScale
  const virtualUsed = pool.used_tb * usedScale
  const virtualFree = virtualTotal - virtualUsed
  const virtualUsableFree90 = virtualTotal * 0.9 - virtualUsed
  const utilPct = calcPercent(virtualUsed, virtualTotal)
  return (
    <tr className="border-b border-slate-100 bg-slate-50/50 transition-colors hover:bg-slate-50">
      <td className="py-2.5 pl-10 pr-4 text-xs text-slate-500 italic">{displayName}</td>
      <td className="px-4 py-2.5">
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
          Ceph Pool
        </span>
      </td>
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(virtualTotal)}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(virtualUsed)}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600">{formatTB(virtualFree)}</td>
      <td className={`px-4 py-2.5 text-xs font-medium ${virtualUsableFree90 < 0 ? 'text-red-600' : 'text-slate-600'}`}>
        {formatTB(virtualUsableFree90)}
      </td>
      <td className="px-4 py-2.5">
        <UtilizationBar percent={utilPct} />
      </td>
    </tr>
  )
}

function PhysicalStorageRow({ pool }: { pool: StoragePool }) {
  const usedPct = calcPercent(pool.used_physical_tb, pool.total_physical_tb)
  const freeTB = pool.total_physical_tb - pool.used_physical_tb
  const usableFree90 = pool.total_physical_tb * 0.9 - pool.used_physical_tb
  return (
    <>
      <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50">
        <td className="px-4 py-3.5 text-xs font-medium text-slate-700">{pool.name}</td>
        <td className="px-4 py-3.5">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {pool.type}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <Badge variant={pool.state === 'Enabled' ? 'success' : 'danger'}>{pool.state}</Badge>
        </td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(pool.total_physical_tb)}</td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(pool.used_physical_tb)}</td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(freeTB)}</td>
        <td className={`px-4 py-3.5 text-xs font-medium ${usableFree90 < 0 ? 'text-red-600' : 'text-slate-700'}`}>
          {formatTB(usableFree90)}
        </td>
        <td className="px-4 py-3.5">
          <UtilizationBar percent={usedPct} />
        </td>
      </tr>
      {pool.ceph_pools?.map((cp) => (
        <CephPoolRow key={cp.pool_name} pool={cp} />
      ))}
    </>
  )
}

function VirtualStorageRow({ pool }: { pool: StoragePool }) {
  const usedPct = calcPercent(pool.used_tb, pool.total_tb)
  const freeTB = pool.total_tb - pool.used_tb
  const usableFree90 = pool.total_tb * 0.9 - pool.used_tb

  // Scale each pool's physical numbers to virtual using the storage-level ratio
  const physicalPoolTotal = pool.ceph_pools?.reduce((s, p) => s + p.total_tb, 0) ?? 0
  const physicalPoolUsed = pool.ceph_pools?.reduce((s, p) => s + p.used_tb, 0) ?? 0
  const totalScale = physicalPoolTotal > 0 ? pool.total_tb / physicalPoolTotal : 1
  const usedScale = physicalPoolUsed > 0 ? pool.used_tb / physicalPoolUsed : totalScale

  return (
    <>
      <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50">
        <td className="px-4 py-3.5 text-xs font-medium text-slate-700">{pool.name}</td>
        <td className="px-4 py-3.5">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {pool.type}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <Badge variant={pool.state === 'Enabled' ? 'success' : 'danger'}>{pool.state}</Badge>
        </td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(pool.total_tb)}</td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(pool.used_tb)}</td>
        <td className="px-4 py-3.5 text-xs text-slate-700">{formatTB(freeTB)}</td>
        <td className={`px-4 py-3.5 text-xs font-medium ${usableFree90 < 0 ? 'text-red-600' : 'text-slate-700'}`}>
          {formatTB(usableFree90)}
        </td>
        <td className="px-4 py-3.5">
          <UtilizationBar percent={usedPct} />
        </td>
      </tr>
      {pool.ceph_pools?.map((cp) => (
        <CephPoolVirtualRow
          key={cp.pool_name}
          pool={cp}
          totalScale={totalScale}
          usedScale={usedScale}
        />
      ))}
    </>
  )
}

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

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
        {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function Storage() {
  const [trendStorageId, setTrendStorageId] = useState<string>('all')
  const [trendPreset, setTrendPreset] = useState<DatePreset>('30d')

  const { data: pools, isLoading } = useQuery({
    queryKey: ['storage'],
    queryFn: fetchStorage,
  })

  const { data: capacityTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['storage-capacity-trend', trendStorageId, trendPreset],
    queryFn: () => {
      const { start, end } = getDateRange(trendPreset)
      return fetchStorageCapacityTrend(start, end, trendStorageId === 'all' ? undefined : trendStorageId)
    },
  })

  const poolList = pools ?? []

  const totalPhysical = poolList.reduce((a, s) => a + s.total_physical_tb, 0)
  const usedPhysical = poolList.reduce((a, s) => a + s.used_physical_tb, 0)
  const physicalPct = calcPercent(usedPhysical, totalPhysical)

  const totalVirtual = poolList.reduce((a, s) => a + s.total_tb, 0)
  const usedVirtual = poolList.reduce((a, s) => a + s.used_tb, 0)
  const virtualPct = calcPercent(usedVirtual, totalVirtual)

  const selectedStorageName =
    trendStorageId === 'all'
      ? 'All Storage Pools'
      : poolList.find((s) => s.id === trendStorageId)?.name ?? trendStorageId

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Physical Total"
          value={formatTB(totalPhysical)}
          sub="Raw hardware capacity"
        />
        <SummaryCard
          label="Physical Used"
          value={formatTB(usedPhysical)}
          sub={`${physicalPct}% utilization`}
        />
        <SummaryCard
          label="Virtual Total"
          value={formatTB(totalVirtual)}
          sub="Provisioned capacity"
        />
        <SummaryCard
          label="Virtual Used"
          value={formatTB(usedVirtual)}
          sub={`${virtualPct}% utilization`}
        />
      </div>

      {/* Physical Capacity table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Physical Capacity</CardTitle>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Raw hardware capacity — actual disk space on each storage backend
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-[10px]">
                <TableHeader />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {poolList.map((pool) => (
                    <PhysicalStorageRow key={pool.id} pool={pool} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Virtual Capacity table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Virtual Capacity</CardTitle>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Provisioned / logical capacity — includes thin-provisioning and overcommit
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-[10px]">
                <TableHeader />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {poolList.map((pool) => (
                    <VirtualStorageRow key={pool.id} pool={pool} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Virtual Capacity Utilization Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Virtual Capacity Utilization Trend</CardTitle>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Used vs total virtual capacity — {selectedStorageName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={trendStorageId} onValueChange={setTrendStorageId}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Storage (Total)</SelectItem>
                  {poolList.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.type})
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
          ) : capacityTrend && capacityTrend.length > 0 ? (
            <StorageCapacityTrendChart data={capacityTrend} />
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
