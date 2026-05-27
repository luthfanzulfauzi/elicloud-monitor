import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { fetchVMs, type VM, type VolumeInfo } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PaginationBar from '@/components/ui/PaginationBar'
import { formatDate, cn } from '@/lib/utils'
import { downloadCSV } from '@/lib/export'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// ─── Header components ────────────────────────────────────────────────────────

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

function ColumnSearchHeader({
  label,
  value,
  placeholder,
  minWidth = '100px',
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  minWidth?: string
  onChange: (v: string) => void
}) {
  const active = value !== ''
  return (
    <div className="flex flex-col gap-0.5" style={{ minWidth }}>
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-sky-600' : 'text-slate-400'}`}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className={cn(
          'rounded border px-1.5 py-0.5 text-[10px] outline-none transition-colors w-full',
          active
            ? 'border-sky-300 bg-sky-50 text-sky-700 placeholder:text-sky-300'
            : 'border-slate-200 bg-white text-slate-500 placeholder:text-slate-300 hover:border-slate-300',
        )}
      />
    </div>
  )
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function VMStateBadge({ state }: { state: VM['state'] }) {
  return (
    <Badge variant={state === 'Running' ? 'success' : 'secondary'}>
      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${state === 'Running' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {state}
    </Badge>
  )
}

function VolumeCell({ vol }: { vol: VolumeInfo }) {
  const storage = vol.storage_name ?? 'Unknown'
  return (
    <span className="block leading-relaxed text-slate-600">
      <span className="font-medium text-slate-700">{storage}</span>
      <span className="ml-1 text-slate-400">·</span>
      <span className="ml-1">{vol.size_gb} GB</span>
    </span>
  )
}

function DataVolumesCell({ volumes }: { volumes: VolumeInfo[] }) {
  if (volumes.length === 0) return <span className="text-slate-300">—</span>
  return (
    <div className="space-y-0.5">
      {volumes.map((v, i) => (
        <div key={i} className="leading-relaxed text-slate-600">
          <span className="font-mono text-[9px] text-slate-400">{v.name}</span>
          <br />
          <span className="font-medium text-slate-700">{v.storage_name ?? 'Unknown'}</span>
          <span className="ml-1 text-slate-400">·</span>
          <span className="ml-1">{v.size_gb} GB</span>
        </div>
      ))}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VMs() {
  const [nameSearch, setNameSearch] = useState('')
  const [ipSearch, setIpSearch] = useState('')
  const [eipSearch, setEipSearch] = useState('')
  const [rootDiskSearch, setRootDiskSearch] = useState('')
  const [dataDiskSearch, setDataDiskSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [hostFilter, setHostFilter] = useState('all')
  const [osFilter, setOsFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: vms, isLoading } = useQuery({ queryKey: ['vms'], queryFn: fetchVMs })

  const hostOptions = useMemo(
    () => [...new Set((vms ?? []).map((v) => v.host).filter(Boolean) as string[])].sort(),
    [vms],
  )
  const osOptions = useMemo(
    () => [...new Set((vms ?? []).map((v) => v.platform).filter(Boolean) as string[])].sort(),
    [vms],
  )
  const ownerOptions = useMemo(
    () => [...new Set((vms ?? []).map((v) => v.project_name).filter(Boolean) as string[])].sort(),
    [vms],
  )

  const filtered = useMemo(
    () =>
      (vms ?? []).filter((vm) => {
        if (nameSearch && !vm.name.toLowerCase().includes(nameSearch.toLowerCase())) return false
        if (ipSearch && !(vm.private_ip ?? '').includes(ipSearch)) return false
        if (eipSearch && !(vm.eip ?? '').toLowerCase().includes(eipSearch.toLowerCase())) return false
        if (rootDiskSearch) {
          const storageName = (vm.root_volume?.storage_name ?? '').toLowerCase()
          if (!storageName.includes(rootDiskSearch.toLowerCase())) return false
        }
        if (dataDiskSearch) {
          const q = dataDiskSearch.toLowerCase()
          const match = vm.data_volumes.some(
            (d) => (d.storage_name ?? '').toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
          )
          if (!match) return false
        }
        if (stateFilter !== 'all' && vm.state !== stateFilter) return false
        if (hostFilter !== 'all' && vm.host !== hostFilter) return false
        if (osFilter !== 'all' && vm.platform !== osFilter) return false
        if (ownerFilter !== 'all' && vm.project_name !== ownerFilter) return false
        return true
      }),
    [vms, nameSearch, ipSearch, eipSearch, rootDiskSearch, dataDiskSearch, stateFilter, hostFilter, osFilter, ownerFilter],
  )

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function resetPage() { setPage(1) }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); resetPage() }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — export only; search moved into column header */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={filtered.length === 0}
          onClick={() => {
            const today = new Date().toISOString().split('T')[0]
            downloadCSV(
              `vms_${today}.csv`,
              ['Name', 'State', 'Owner', 'Host', 'OS', 'Private IP', 'EIP', 'vCPU', 'vRAM (GB)', 'Storage (GB)', 'Created At', 'Root Disk Storage', 'Root Disk (GB)', 'Data Disks'],
              filtered.map((vm) => [
                vm.name,
                vm.state,
                vm.project_name ?? '',
                vm.host ?? '',
                vm.platform ?? '',
                vm.private_ip ?? '',
                vm.eip ?? '',
                vm.vcpu,
                vm.vram_gb,
                vm.storage_gb,
                vm.created_at ? formatDate(vm.created_at) : '',
                vm.root_volume?.storage_name ?? '',
                vm.root_volume?.size_gb ?? '',
                vm.data_volumes.map((d) => `${d.name}:${d.storage_name ?? 'Unknown'}:${d.size_gb}GB`).join(' | '),
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
                      <th className="px-4 py-3 text-left">
                        <ColumnSearchHeader label="Name" value={nameSearch} placeholder="vm name…" minWidth="140px" onChange={(v) => { setNameSearch(v); resetPage() }} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="State" value={stateFilter} options={['Running', 'Stopped']} onChange={handleFilterChange(setStateFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="Host" value={hostFilter} options={hostOptions} onChange={handleFilterChange(setHostFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="OS" value={osFilter} options={osOptions} onChange={handleFilterChange(setOsFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnFilterHeader label="Owner" value={ownerFilter} options={ownerOptions} onChange={handleFilterChange(setOwnerFilter)} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnSearchHeader label="Private IP" value={ipSearch} placeholder="10.x.x.x…" minWidth="110px" onChange={(v) => { setIpSearch(v); resetPage() }} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnSearchHeader label="EIP" value={eipSearch} placeholder="public IP…" minWidth="100px" onChange={(v) => { setEipSearch(v); resetPage() }} />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">vCPU</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">vRAM (GB)</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Storage (GB)</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Created At</th>
                      <th className="px-4 py-3 text-left">
                        <ColumnSearchHeader label="Root Disk" value={rootDiskSearch} placeholder="storage name…" minWidth="120px" onChange={(v) => { setRootDiskSearch(v); resetPage() }} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <ColumnSearchHeader label="Data Disk(s)" value={dataDiskSearch} placeholder="storage name…" minWidth="120px" onChange={(v) => { setDataDiskSearch(v); resetPage() }} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-4 py-12 text-center text-xs text-slate-400">
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
                          <td className="px-4 py-3 text-slate-600">{vm.project_name ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{vm.private_ip ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{vm.eip ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.vcpu}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.vram_gb}</td>
                          <td className="px-4 py-3 text-slate-700">{vm.storage_gb}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(vm.created_at)}</td>
                          <td className="px-4 py-3">
                            {vm.root_volume
                              ? <VolumeCell vol={vm.root_volume} />
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <DataVolumesCell volumes={vm.data_volumes} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <PaginationBar
                total={filtered.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
