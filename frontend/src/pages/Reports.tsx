import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, ChevronDown, ChevronRight, ChevronLeft, BarChart3, Loader2 } from 'lucide-react'
import {
  fetchVMTrend,
  fetchStorageTrend,
  fetchComputeTrend,
  fetchVMsCreatedInRange,
  fetchDashboardSummary,
  fetchHosts,
  fetchStorage,
  type VMTrendPoint,
  type ProvisioningPoint,
  type ComputePoint,
  type VM,
} from '@/lib/api'
import VMTrendChart from '@/components/charts/VMTrendChart'
import TrendChart from '@/components/charts/TrendChart'
import ComputeTrendChart from '@/components/charts/ComputeTrendChart'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { downloadCSV, downloadPDF, downloadExecutivePDF } from '@/lib/export'

type MetricTab = 'vms' | 'storage' | 'compute'

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

const BREAKDOWN_PAGE_SIZE = 10

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// group VMs by their creation date (YYYY-MM-DD)
function groupVMsByDate(vms: VM[]): Record<string, VM[]> {
  const map: Record<string, VM[]> = {}
  for (const vm of vms) {
    if (!vm.created_at) continue
    const day = vm.created_at.split('T')[0]
    ;(map[day] ??= []).push(vm)
  }
  return map
}

function VMSubTable({ vms }: { vms: VM[] }) {
  return (
    <tr>
      <td colSpan={2} className="bg-slate-50 px-4 pb-3 pt-0">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">VM Name</th>
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">State</th>
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">Host</th>
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">OS</th>
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">vCPU</th>
              <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wide text-slate-400">RAM (GB)</th>
              <th className="py-1.5 text-left font-semibold uppercase tracking-wide text-slate-400">Storage (GB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vms.map((vm) => (
              <tr key={vm.id} className="hover:bg-slate-100">
                <td className="py-1.5 pr-3 font-medium text-slate-700">{vm.name}</td>
                <td className="py-1.5 pr-3">
                  <Badge variant={vm.state === 'Running' ? 'success' : 'secondary'}>
                    <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${vm.state === 'Running' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {vm.state}
                  </Badge>
                </td>
                <td className="py-1.5 pr-3 text-slate-600">{vm.host ?? '—'}</td>
                <td className="py-1.5 pr-3 text-slate-600">{vm.platform ?? '—'}</td>
                <td className="py-1.5 pr-3 text-slate-700">{vm.vcpu}</td>
                <td className="py-1.5 pr-3 text-slate-700">{vm.vram_gb}</td>
                <td className="py-1.5 text-slate-700">{vm.storage_gb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

async function generateExecutiveReport() {
  const [summary, hosts, storage] = await Promise.all([
    fetchDashboardSummary(),
    fetchHosts(),
    fetchStorage(),
  ])

  const cpuAllocPct = summary.total_cpu_total > 0
    ? (summary.total_cpu_allocated / summary.total_cpu_total) * 100 : 0
  const memAllocPct = summary.total_memory_total_gb > 0
    ? (summary.total_memory_allocated_gb / summary.total_memory_total_gb) * 100 : 0

  downloadExecutivePDF({
    generatedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    summary: {
      total_hosts: summary.total_hosts,
      total_vms: summary.running_vms + summary.stopped_vms,
      running_vms: summary.running_vms,
      stopped_vms: summary.stopped_vms,
      cpu_alloc_pct: cpuAllocPct,
      mem_alloc_pct: memAllocPct,
      storage_used_tb: summary.total_storage_used_tb,
      storage_total_tb: summary.total_storage_tb,
    },
    hosts: hosts.map((h) => ({
      name: h.name,
      state: h.state,
      vcpu_allocated: h.vcpu_allocated,
      vcpu_total: h.vcpu_total,
      memory_allocated_gb: h.memory_allocated_gb,
      memory_total_gb: h.memory_total_gb,
      vm_count: h.vm_count,
      cpu_overcommit_pct: h.vcpu_total > 0 ? (h.vcpu_allocated / h.vcpu_total) * 100 : 0,
      mem_overcommit_pct: h.memory_total_gb > 0 ? (h.memory_allocated_gb / h.memory_total_gb) * 100 : 0,
    })),
    physicalStorage: storage.map((s) => ({
      name: s.name,
      type: s.type,
      state: s.state,
      total_tb: s.total_physical_tb,
      used_tb: s.used_physical_tb,
      util_pct: s.total_physical_tb > 0 ? (s.used_physical_tb / s.total_physical_tb) * 100 : 0,
    })),
    virtualStorage: storage.map((s) => ({
      name: s.name,
      type: s.type,
      state: s.state,
      total_tb: s.total_tb,
      used_tb: s.used_tb,
      util_pct: s.total_tb > 0 ? (s.used_tb / s.total_tb) * 100 : 0,
    })),
  })
}

export default function Reports() {
  const [startDate, setStartDate] = useState(daysAgoStr(30))
  const [endDate, setEndDate] = useState(todayStr())
  const [generatingExec, setGeneratingExec] = useState(false)
  const [activeTab, setActiveTab] = useState<MetricTab>('vms')
  const [breakdownPage, setBreakdownPage] = useState(1)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  const { data: trend, isLoading: vmLoading } = useQuery({
    queryKey: ['vm-trend', startDate, endDate],
    queryFn: () => fetchVMTrend(startDate, endDate),
    enabled: !!(startDate && endDate),
  })

  const { data: storageTrend, isLoading: storageLoading } = useQuery({
    queryKey: ['storage-trend', startDate, endDate],
    queryFn: () => fetchStorageTrend(startDate, endDate),
    enabled: !!(startDate && endDate),
  })

  const { data: computeTrend, isLoading: computeLoading } = useQuery({
    queryKey: ['compute-trend', startDate, endDate],
    queryFn: () => fetchComputeTrend(startDate, endDate),
    enabled: !!(startDate && endDate),
  })

  const { data: createdVMs } = useQuery({
    queryKey: ['vms-created-in-range', startDate, endDate],
    queryFn: () => fetchVMsCreatedInRange(startDate, endDate),
    enabled: !!(startDate && endDate) && activeTab === 'vms',
  })

  const filteredTrend: VMTrendPoint[] = (trend ?? []).filter(
    (p) => p.date >= startDate && p.date <= endDate,
  )
  const filteredStorage: ProvisioningPoint[] = (storageTrend ?? []).filter(
    (p) => p.date >= startDate && p.date <= endDate,
  )
  const filteredCompute: ComputePoint[] = (computeTrend ?? []).filter(
    (p) => p.date >= startDate && p.date <= endDate,
  )

  const vmsByDate = useMemo(() => groupVMsByDate(createdVMs ?? []), [createdVMs])

  // VM stats
  const totalVMs = filteredTrend.reduce((a, p) => a + p.count, 0)
  const daysWithActivity = filteredTrend.filter((p) => p.count > 0).length
  const maxDay = filteredTrend.reduce((m, p) => (p.count > m.count ? p : m), { date: '—', count: 0 })

  // Storage stats
  const totalStorageGB = filteredStorage.reduce((a, p) => a + p.value, 0)
  const storageDaysWithActivity = filteredStorage.filter((p) => p.value > 0).length
  const maxStorageDay = filteredStorage.reduce((m, p) => (p.value > m.value ? p : m), { date: '—', value: 0 })

  // Compute stats
  const totalVCPU = filteredCompute.reduce((a, p) => a + p.vcpu, 0)
  const totalRAM = filteredCompute.reduce((a, p) => a + p.ram_gb, 0)
  const computeDaysWithActivity = filteredCompute.filter((p) => p.vcpu > 0 || p.ram_gb > 0).length
  const maxComputeDay = filteredCompute.reduce((m, p) => (p.vcpu > m.vcpu ? p : m), { date: '—', vcpu: 0, ram_gb: 0 })

  const isLoading = activeTab === 'vms' ? vmLoading : activeTab === 'storage' ? storageLoading : computeLoading

  // Breakdown pagination
  const activeRows =
    activeTab === 'vms' ? filteredTrend :
    activeTab === 'storage' ? filteredStorage : filteredCompute
  const totalBreakdownPages = Math.max(1, Math.ceil(activeRows.length / BREAKDOWN_PAGE_SIZE))
  const currentBreakdownPage = Math.min(breakdownPage, totalBreakdownPages)
  const pagedRows = activeRows.slice(
    (currentBreakdownPage - 1) * BREAKDOWN_PAGE_SIZE,
    currentBreakdownPage * BREAKDOWN_PAGE_SIZE,
  )

  function handleTabChange(tab: MetricTab) {
    setActiveTab(tab)
    setBreakdownPage(1)
    setExpandedDays(new Set())
  }

  return (
    <div className="space-y-5">
      {/* ── Executive Report ── */}
      <Card className="border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sky-400" />
                <h2 className="text-sm font-semibold">Infrastructure Executive Report</h2>
              </div>
              <p className="text-[10px] text-slate-300 max-w-lg">
                Point-in-time snapshot of the entire private cloud infrastructure. Generates a
                multi-section PDF with summary KPIs, host utilization table, and storage breakdown.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10px] text-slate-400">
                <span>· Total hosts, VMs (running / stopped)</span>
                <span>· CPU &amp; Memory allocation rates</span>
                <span>· Storage utilization (physical &amp; virtual)</span>
                <span>· Per-host: vCPU, memory, VM count, overcommit</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                className="gap-2 bg-sky-600 text-white hover:bg-sky-500"
                disabled={generatingExec}
                onClick={async () => {
                  setGeneratingExec(true)
                  try { await generateExecutiveReport() }
                  finally { setGeneratingExec(false) }
                }}
              >
                {generatingExec
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                  : <><FileText className="h-4 w-4" /> Generate PDF</>}
              </Button>
              <p className="text-[9px] text-slate-500">Downloads current infrastructure state</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── VM Trend Reports ── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Trend Reports</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Date Range + Export */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setBreakdownPage(1) }}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setBreakdownPage(1) }}
                className="w-44"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={activeRows.length === 0}
                onClick={() => {
                  if (activeTab === 'vms') {
                    downloadCSV(
                      `vm_creation_${startDate}_${endDate}.csv`,
                      ['Date', 'VMs Created'],
                      (filteredTrend).map((r) => [formatDate(r.date), r.count]),
                    )
                  } else if (activeTab === 'storage') {
                    downloadCSV(
                      `storage_provisioned_${startDate}_${endDate}.csv`,
                      ['Date', 'Storage Provisioned (GB)'],
                      (filteredStorage).map((r) => [formatDate(r.date), r.value]),
                    )
                  } else {
                    downloadCSV(
                      `compute_provisioned_${startDate}_${endDate}.csv`,
                      ['Date', 'vCPU', 'RAM (GB)'],
                      (filteredCompute).map((r) => [formatDate(r.date), r.vcpu, r.ram_gb]),
                    )
                  }
                }}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={activeRows.length === 0}
                onClick={() => {
                  const tabLabel =
                    activeTab === 'vms' ? 'VM Creation' :
                    activeTab === 'storage' ? 'Storage Provisioned' : 'Compute Provisioned'
                  const subtitle = `${formatDate(startDate)} — ${formatDate(endDate)}`

                  if (activeTab === 'vms') {
                    downloadPDF({
                      title: `${tabLabel} Report`,
                      subtitle,
                      filename: `vm_creation_${startDate}_${endDate}.pdf`,
                      summary: [
                        { label: 'Total VMs Created', value: String(totalVMs) },
                        { label: 'Days with Activity', value: `${daysWithActivity} / ${filteredTrend.length}` },
                        { label: 'Peak Day', value: maxDay.count > 0 ? `${maxDay.count} VMs · ${formatDate(maxDay.date)}` : '—' },
                      ],
                      headers: ['Date', 'VMs Created'],
                      rows: filteredTrend.map((r) => [formatDate(r.date), r.count]),
                    })
                  } else if (activeTab === 'storage') {
                    downloadPDF({
                      title: `${tabLabel} Report`,
                      subtitle,
                      filename: `storage_provisioned_${startDate}_${endDate}.pdf`,
                      summary: [
                        { label: 'Total Provisioned', value: `${totalStorageGB} GB` },
                        { label: 'Days with Activity', value: `${storageDaysWithActivity} / ${filteredStorage.length}` },
                        { label: 'Peak Day', value: maxStorageDay.value > 0 ? `${maxStorageDay.value} GB · ${formatDate(maxStorageDay.date)}` : '—' },
                      ],
                      headers: ['Date', 'Storage Provisioned (GB)'],
                      rows: filteredStorage.map((r) => [formatDate(r.date), r.value]),
                    })
                  } else {
                    downloadPDF({
                      title: `${tabLabel} Report`,
                      subtitle,
                      filename: `compute_provisioned_${startDate}_${endDate}.pdf`,
                      summary: [
                        { label: 'Total vCPU Provisioned', value: `${totalVCPU} vCPU` },
                        { label: 'Total RAM Provisioned', value: `${totalRAM} GB` },
                        { label: 'Days with Activity', value: `${computeDaysWithActivity} / ${filteredCompute.length}` },
                        { label: 'Peak Day (vCPU)', value: maxComputeDay.vcpu > 0 ? `${maxComputeDay.vcpu} vCPU · ${formatDate(maxComputeDay.date)}` : '—' },
                      ],
                      headers: ['Date', 'vCPU', 'RAM (GB)'],
                      rows: filteredCompute.map((r) => [formatDate(r.date), r.vcpu, r.ram_gb]),
                    })
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 w-fit">
        {(['vms', 'storage', 'compute'] as MetricTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`rounded-md px-4 py-1.5 text-[10px] font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab === 'vms' ? 'VM Creation' : tab === 'storage' ? 'Storage Provisioned' : 'Compute Provisioned'}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      {activeTab === 'vms' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total VMs Created</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalVMs}</p>
            <p className="text-[10px] text-slate-400">in selected range</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Days with Activity</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{daysWithActivity}</p>
            <p className="text-[10px] text-slate-400">out of {filteredTrend.length} days</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Peak Day</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{maxDay.count > 0 ? maxDay.count : '—'}</p>
            <p className="text-[10px] text-slate-400">{maxDay.count > 0 ? formatDate(maxDay.date) : 'No activity'}</p>
          </CardContent></Card>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Storage Provisioned</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalStorageGB} GB</p>
            <p className="text-[10px] text-slate-400">in selected range</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Days with Activity</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{storageDaysWithActivity}</p>
            <p className="text-[10px] text-slate-400">out of {filteredStorage.length} days</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Peak Day</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{maxStorageDay.value > 0 ? `${maxStorageDay.value} GB` : '—'}</p>
            <p className="text-[10px] text-slate-400">{maxStorageDay.value > 0 ? formatDate(maxStorageDay.date) : 'No activity'}</p>
          </CardContent></Card>
        </div>
      )}

      {activeTab === 'compute' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total vCPUs Provisioned</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalVCPU} vCPU</p>
            <p className="text-[10px] text-slate-400">in selected range</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total RAM Provisioned</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalRAM} GB</p>
            <p className="text-[10px] text-slate-400">in selected range</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Days with Activity</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{computeDaysWithActivity}</p>
            <p className="text-[10px] text-slate-400">out of {filteredCompute.length} days</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Peak Day (vCPU)</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{maxComputeDay.vcpu > 0 ? `${maxComputeDay.vcpu} vCPU` : '—'}</p>
            <p className="text-[10px] text-slate-400">{maxComputeDay.vcpu > 0 ? `${maxComputeDay.ram_gb} GB RAM · ${formatDate(maxComputeDay.date)}` : 'No activity'}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {activeTab === 'vms' ? 'VM Creation by Day' : activeTab === 'storage' ? 'Storage Provisioned by Day' : 'Compute Provisioned by Day'}
          </CardTitle>
          <p className="text-[10px] text-slate-400">
            {startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : 'Select a date range'}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">Loading…</div>
          ) : activeTab === 'vms' ? (
            filteredTrend.length === 0
              ? <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">No data in selected range.</div>
              : <VMTrendChart data={filteredTrend} />
          ) : activeTab === 'storage' ? (
            filteredStorage.length === 0
              ? <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">No data in selected range.</div>
              : <TrendChart data={filteredStorage} color="#8b5cf6" label="GB provisioned" formatValue={(v) => `${v} GB`} />
          ) : filteredCompute.length === 0
            ? <div className="flex h-[220px] items-center justify-center text-[10px] text-slate-400">No data in selected range.</div>
            : <ComputeTrendChart data={filteredCompute} />
          }
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Daily Breakdown</CardTitle>
          {activeTab === 'vms' && (
            <p className="text-[10px] text-slate-400">Click a row to expand and view VMs created that day</p>
          )}
        </CardHeader>
        <CardContent className="pt-4 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {activeTab === 'vms' ? 'VMs Created' : activeTab === 'storage' ? 'Storage (GB)' : 'vCPU'}
                  </th>
                  {activeTab === 'compute' && (
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">RAM (GB)</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[10px] text-slate-400">
                      No data available for the selected range.
                    </td>
                  </tr>
                ) : activeTab === 'vms' ? (
                  (pagedRows as VMTrendPoint[]).map((row) => {
                    const dayVMs = vmsByDate[row.date] ?? []
                    const isExpanded = expandedDays.has(row.date)
                    return (
                      <>
                        <tr
                          key={row.date}
                          className={`transition-colors ${row.count > 0 ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                          onClick={() => row.count > 0 && toggleDay(row.date)}
                        >
                          <td className="px-4 py-2.5 text-slate-600 flex items-center gap-2">
                            {row.count > 0 ? (
                              isExpanded
                                ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                                : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                            ) : (
                              <span className="h-3 w-3 shrink-0" />
                            )}
                            {formatDate(row.date)}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.count > 0
                              ? <span className="font-semibold text-slate-800">{row.count}</span>
                              : <span className="text-slate-300">0</span>}
                          </td>
                        </tr>
                        {isExpanded && dayVMs.length > 0 && (
                          <VMSubTable key={`${row.date}-vms`} vms={dayVMs} />
                        )}
                      </>
                    )
                  })
                ) : activeTab === 'storage' ? (
                  (pagedRows as ProvisioningPoint[]).map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5">
                        {row.value > 0
                          ? <span className="font-semibold text-slate-800">{row.value} GB</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  (pagedRows as ComputePoint[]).map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5">
                        {row.vcpu > 0 ? <span className="font-semibold text-slate-800">{row.vcpu}</span> : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.ram_gb > 0 ? <span className="font-semibold text-slate-800">{row.ram_gb}</span> : <span className="text-slate-300">0</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Breakdown pagination */}
          {totalBreakdownPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-[10px] text-slate-500">
                {(currentBreakdownPage - 1) * BREAKDOWN_PAGE_SIZE + 1}–{Math.min(currentBreakdownPage * BREAKDOWN_PAGE_SIZE, activeRows.length)} of {activeRows.length} days
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentBreakdownPage <= 1} onClick={() => setBreakdownPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {buildPageList(currentBreakdownPage, totalBreakdownPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="px-1 text-[10px] text-slate-400 select-none">…</span>
                  ) : (
                    <Button key={p} variant={p === currentBreakdownPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-[10px]" onClick={() => setBreakdownPage(p as number)}>
                      {p}
                    </Button>
                  )
                )}
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentBreakdownPage >= totalBreakdownPages} onClick={() => setBreakdownPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
