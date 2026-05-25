import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchVMs, type VM } from '@/lib/api'
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
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, cn } from '@/lib/utils'
import { downloadCSV } from '@/lib/export'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function VMStateBadge({ state }: { state: VM['state'] }) {
  return (
    <Badge variant={state === 'Running' ? 'success' : 'secondary'}>
      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${state === 'Running' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {state}
    </Badge>
  )
}

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

function ColumnFilterHeader({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const active = value !== 'all'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-sky-600' : 'text-slate-400'}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'cursor-pointer appearance-none rounded border px-1.5 py-0.5 text-[10px] outline-none transition-colors',
          active
            ? 'border-sky-300 bg-sky-50 font-medium text-sky-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
        )}
      >
        <option value="all">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export default function VMs() {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [hostFilter, setHostFilter] = useState('all')
  const [osFilter, setOsFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [goToInput, setGoToInput] = useState('')

  const { data: vms, isLoading } = useQuery({ queryKey: ['vms'], queryFn: fetchVMs })

  const hostOptions = useMemo(
    () => [...new Set((vms ?? []).map((v) => v.host).filter(Boolean) as string[])].sort(),
    [vms],
  )
  const osOptions = useMemo(
    () => [...new Set((vms ?? []).map((v) => v.platform).filter(Boolean) as string[])].sort(),
    [vms],
  )

  const filtered = useMemo(
    () =>
      (vms ?? []).filter((vm) => {
        const matchSearch =
          search === '' ||
          vm.name.toLowerCase().includes(search.toLowerCase()) ||
          (vm.private_ip ?? '').includes(search) ||
          (vm.eip ?? '').includes(search)
        const matchState = stateFilter === 'all' || vm.state === stateFilter
        const matchHost = hostFilter === 'all' || vm.host === hostFilter
        const matchOS = osFilter === 'all' || vm.platform === osFilter
        return matchSearch && matchState && matchHost && matchOS
      }),
    [vms, search, stateFilter, hostFilter, osFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageList = buildPageList(currentPage, totalPages)

  function resetPage() { setPage(1) }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); resetPage() }
  }

  function handleGoTo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const n = parseInt(goToInput, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) setPage(n)
    setGoToInput('')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or IP…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-2"
          disabled={filtered.length === 0}
          onClick={() => {
            const today = new Date().toISOString().split('T')[0]
            downloadCSV(
              `vms_${today}.csv`,
              ['Name', 'State', 'Host', 'OS', 'Private IP', 'EIP', 'vCPU', 'vRAM (GB)', 'Storage (GB)', 'Created At'],
              filtered.map((vm) => [
                vm.name,
                vm.state,
                vm.host ?? '',
                vm.platform ?? '',
                vm.private_ip ?? '',
                vm.eip ?? '',
                vm.vcpu,
                vm.vram_gb,
                vm.storage_gb,
                vm.created_at ? formatDate(vm.created_at) : '',
              ]),
            )
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Name</th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="State" value={stateFilter} options={['Running', 'Stopped']} onChange={handleFilterChange(setStateFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="Host" value={hostFilter} options={hostOptions} onChange={handleFilterChange(setHostFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="OS" value={osFilter} options={osOptions} onChange={handleFilterChange(setOsFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Private IP</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">EIP</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">vCPU</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">vRAM (GB)</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Storage (GB)</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-400">
                          No virtual machines match the current filters.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((vm) => (
                        <tr key={vm.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-800">{vm.name}</td>
                          <td className="px-4 py-3"><VMStateBadge state={vm.state} /></td>
                          <td className="px-4 py-3 text-slate-600">{vm.host ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-600">{vm.platform ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{vm.private_ip ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{vm.eip ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.vcpu}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.vram_gb}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.storage_gb}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(vm.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
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
    </div>
  )
}
