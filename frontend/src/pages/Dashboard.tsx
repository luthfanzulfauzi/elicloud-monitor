import { useQuery } from '@tanstack/react-query'
import { Server, Monitor, HardDrive, Activity, Cpu, MemoryStick } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import VMTrendChart from '@/components/charts/VMTrendChart'
import TrendChart from '@/components/charts/TrendChart'
import ComputeTrendChart from '@/components/charts/ComputeTrendChart'
import { Badge } from '@/components/ui/badge'
import {
  fetchDashboardSummary,
  fetchHosts,
  fetchStorage,
  fetchVMTrend,
  fetchStorageTrend,
  fetchComputeTrend,
} from '@/lib/api'
import { calcPercent, formatTB, cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
            {loading ? (
              <>
                <Skeleton className="mt-2 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-28" />
              </>
            ) : (
              <>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
                {subtitle && <p className="mt-1 text-[10px] text-slate-400">{subtitle}</p>}
              </>
            )}
          </div>
          <div className={`flex-shrink-0 rounded-xl p-2.5 ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AllocationCard({
  title,
  allocated,
  total,
  unit,
  barColor,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  title: string
  allocated: number
  total: number
  unit: string
  barColor: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  loading?: boolean
}) {
  const pct = total > 0 ? Math.round((allocated / total) * 100) : 0
  const fillColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : barColor
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
            {loading ? (
              <>
                <Skeleton className="mt-2 h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-32" />
                <Skeleton className="mt-2 h-1.5 w-full" />
              </>
            ) : (
              <>
                <p className={`mt-1.5 text-2xl font-bold tracking-tight ${textColor}`}>{pct}%</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {allocated.toLocaleString()} / {total.toLocaleString()} {unit}
                </p>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${fillColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
          <div className={`flex-shrink-0 rounded-xl p-2.5 ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OvercommitRow({ host }: { host: { name: string; management_ip: string; vcpu_allocated: number; vcpu_total: number; state: string } }) {
  const cpuPct = host.vcpu_total > 0 ? Math.round((host.vcpu_allocated / host.vcpu_total) * 100) : 0
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <td className="py-3 pr-4 text-xs font-medium text-slate-700">{host.name}</td>
      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{host.management_ip}</td>
      <td className="py-3 pr-4 text-xs text-slate-700">{host.vcpu_allocated}</td>
      <td className="py-3 pr-4 text-xs text-slate-700">{host.vcpu_total}</td>
      <td className="py-3 pr-4">
        <Badge variant={host.state === 'Enabled' ? 'success' : 'danger'}>{host.state}</Badge>
      </td>
      <td className="py-3 text-right">
        <span
          className={cn(
            'text-xs font-semibold',
            cpuPct >= 90 ? 'text-red-600' : cpuPct >= 70 ? 'text-amber-600' : 'text-emerald-600',
          )}
        >
          {cpuPct}%
        </span>
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  })

  const { data: hosts } = useQuery({ queryKey: ['hosts'], queryFn: fetchHosts })
  const { data: storage } = useQuery({ queryKey: ['storage'], queryFn: fetchStorage })
  const { data: trend } = useQuery({ queryKey: ['vm-trend'], queryFn: () => fetchVMTrend() })
  const { data: storageTrend } = useQuery({ queryKey: ['storage-trend'], queryFn: () => fetchStorageTrend() })
  const { data: computeTrend } = useQuery({ queryKey: ['compute-trend'], queryFn: () => fetchComputeTrend() })

  const totalStorageTB = summary?.total_storage_tb ?? 0
  const usedStorageTB = summary?.total_storage_used_tb ?? 0
  const storagePercent = calcPercent(usedStorageTB, totalStorageTB)

  const sortedHosts = [...(hosts ?? [])].sort((a, b) => {
    const aRatio = a.vcpu_total > 0 ? a.vcpu_allocated / a.vcpu_total : 0
    const bRatio = b.vcpu_total > 0 ? b.vcpu_allocated / b.vcpu_total : 0
    return bRatio - aRatio
  })

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Hosts"
          value={summary?.total_hosts ?? '—'}
          subtitle="Physical compute nodes"
          icon={Server}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          loading={summaryLoading}
        />
        <StatCard
          title="Running VMs"
          value={summary?.running_vms ?? '—'}
          subtitle="Active virtual machines"
          icon={Activity}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={summaryLoading}
        />
        <StatCard
          title="Stopped VMs"
          value={summary?.stopped_vms ?? '—'}
          subtitle="Inactive virtual machines"
          icon={Monitor}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
          loading={summaryLoading}
        />
        <StatCard
          title="Storage Used"
          value={summary ? `${formatTB(usedStorageTB)} / ${formatTB(totalStorageTB)}` : '—'}
          subtitle={summary ? `${storagePercent}% utilized` : undefined}
          icon={HardDrive}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={summaryLoading}
        />
      </div>

      {/* Allocation cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AllocationCard
          title="CPU Allocation Rate"
          allocated={summary?.total_cpu_allocated ?? 0}
          total={summary?.total_cpu_total ?? 0}
          unit="vCPU"
          barColor="bg-amber-500"
          icon={Cpu}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={summaryLoading}
        />
        <AllocationCard
          title="Memory Allocation Rate"
          allocated={summary?.total_memory_allocated_gb ?? 0}
          total={summary?.total_memory_total_gb ?? 0}
          unit="GB"
          barColor="bg-sky-500"
          icon={MemoryStick}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          loading={summaryLoading}
        />
        <AllocationCard
          title="Storage Utilization"
          allocated={usedStorageTB}
          total={totalStorageTB}
          unit="TB"
          barColor="bg-violet-500"
          icon={HardDrive}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={summaryLoading}
        />
      </div>

      {/* VM trend + Storage utilization */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>VM Creation Trend</CardTitle>
            <p className="text-[10px] text-slate-400">VMs created per day · last 30 days</p>
          </CardHeader>
          <CardContent>
            {trend ? (
              <VMTrendChart data={trend} />
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3">
                <Skeleton className="h-[160px] w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Storage Utilization</CardTitle>
            <p className="text-[10px] text-slate-400">Per storage pool</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(storage ?? []).flatMap((s) => {
              if (s.ceph_pools && s.ceph_pools.length > 0) {
                return s.ceph_pools.map((cp) => ({
                  key: `${s.id}-${cp.pool_name}`,
                  name: `${s.name} / ${cp.alias_name || cp.pool_name}`,
                  pct: cp.util_pct,
                  used_tb: cp.used_tb,
                  total_tb: cp.total_tb,
                }))
              }
              return [{ key: s.id, name: s.name, pct: calcPercent(s.used_tb, s.total_tb), used_tb: s.used_tb, total_tb: s.total_tb }]
            }).map((entry) => {
              const barColor = entry.pct >= 90 ? 'bg-red-500' : entry.pct >= 70 ? 'bg-amber-500' : 'bg-sky-500'
              const textColor = entry.pct >= 90 ? 'text-red-600' : entry.pct >= 70 ? 'text-amber-600' : 'text-emerald-600'
              return (
                <div key={entry.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="max-w-[180px] truncate text-xs font-medium text-slate-700" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className={`text-xs font-semibold ${textColor}`}>{entry.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(entry.pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {formatTB(entry.used_tb)} used of {formatTB(entry.total_tb)}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Provisioning trends */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Storage Provisioned per Day</CardTitle>
            <p className="text-[10px] text-slate-400">Last 30 days · GB</p>
          </CardHeader>
          <CardContent>
            {storageTrend ? (
              <TrendChart data={storageTrend} color="#8b5cf6" label="GB provisioned" formatValue={(v) => `${v} GB`} />
            ) : (
              <Skeleton className="h-[220px] w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Compute Provisioned per Day</CardTitle>
            <p className="text-[10px] text-slate-400">Last 30 days · vCPU &amp; RAM</p>
          </CardHeader>
          <CardContent>
            {computeTrend ? (
              <ComputeTrendChart data={computeTrend} />
            ) : (
              <Skeleton className="h-[220px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Hosts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Top Hosts by CPU Overcommit</CardTitle>
          <p className="text-[10px] text-slate-400">Sorted by vCPU allocation ratio</p>
        </CardHeader>
        <CardContent className="pt-0">
          {sortedHosts.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Name', 'IP Address', 'vCPU Alloc.', 'Phys. Cores', 'State', 'Overcommit %'].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 last:text-right last:pr-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedHosts.slice(0, 5).map((host) => (
                  <OvercommitRow key={host.id} host={host} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
