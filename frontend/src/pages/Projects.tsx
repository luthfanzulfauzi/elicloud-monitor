import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects, fetchResourceGroups } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import PaginationBar from '@/components/ui/PaginationBar'
import { cn } from '@/lib/utils'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'

type SortCol = 'name' | 'state' | 'vm_count' | 'vcpu_total' | 'vram_total_gb' | 'storage_total_tb' | 'resource_group'
type SortDir = 'asc' | 'desc'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="inline ml-1 w-3 h-3 text-slate-300" />
  return active && dir === 'asc'
    ? <ChevronUp className="inline ml-1 w-3 h-3 text-sky-500" />
    : <ChevronDown className="inline ml-1 w-3 h-3 text-sky-500" />
}

function ThSortable({
  col, label, sortCol, sortDir, align = 'left', onSort,
}: {
  col: SortCol; label: string; sortCol: SortCol; sortDir: SortDir; align?: 'left' | 'right'; onSort: (c: SortCol) => void
}) {
  const active = sortCol === col
  return (
    <th
      className={cn(
        'px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon active={active} dir={sortDir} />
    </th>
  )
}

export default function Projects() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [rgFilter, setRgFilter] = useState<string>('')

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const { data: resourceGroups } = useQuery({
    queryKey: ['resource-groups'],
    queryFn: fetchResourceGroups,
  })

  // Build project_id → resource group name map
  const projectRgMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const rg of resourceGroups ?? []) {
      for (const pid of rg.project_ids) {
        map.set(pid, rg.name)
      }
    }
    return map
  }, [resourceGroups])

  const rgNames = useMemo(() => {
    const names = Array.from(new Set((resourceGroups ?? []).map(r => r.name))).sort()
    return names
  }, [resourceGroups])

  const allProjects = projects ?? []

  const filtered = useMemo(() => {
    let list = allProjects.map(p => ({ ...p, resource_group: projectRgMap.get(p.id) ?? '' }))

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }

    if (rgFilter) {
      list = list.filter(p => p.resource_group === rgFilter)
    }

    list.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortCol) {
        case 'name':          va = a.name.toLowerCase();    vb = b.name.toLowerCase();    break
        case 'state':         va = a.state ?? '';           vb = b.state ?? '';           break
        case 'vm_count':      va = a.vm_count;              vb = b.vm_count;              break
        case 'vcpu_total':    va = a.vcpu_total;            vb = b.vcpu_total;            break
        case 'vram_total_gb': va = a.vram_total_gb;         vb = b.vram_total_gb;         break
        case 'storage_total_tb': va = a.storage_total_tb;   vb = b.storage_total_tb;      break
        case 'resource_group': va = a.resource_group.toLowerCase(); vb = b.resource_group.toLowerCase(); break
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [allProjects, search, rgFilter, sortCol, sortDir, projectRgMap])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalVMs = allProjects.reduce((s, p) => s + p.vm_count, 0)
  const totalCPU = allProjects.reduce((s, p) => s + p.vcpu_total, 0)
  const totalRAM = Math.round(allProjects.reduce((s, p) => s + p.vram_total_gb, 0))
  const totalStorage = allProjects.reduce((s, p) => s + p.storage_total_tb, 0)

  const isLoading = projectsLoading

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">IAM2 Projects</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{allProjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total VMs</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalVMs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total vCPU</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalCPU.toLocaleString()} <span className="text-sm font-normal text-slate-400">vCPU</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total RAM</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalRAM.toLocaleString()} <span className="text-sm font-normal text-slate-400">GB</span></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Projects</CardTitle>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {filtered.length} of {allProjects.length} ZStack IAM2 projects · total storage: {totalStorage.toFixed(1)} TB
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input
                  className="pl-8 h-8 text-xs w-52"
                  placeholder="Search project name…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
                {search && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => { setSearch(''); setPage(1) }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Resource Group filter */}
              <div className="relative">
                <select
                  className="h-8 rounded-md border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer"
                  value={rgFilter}
                  onChange={e => { setRgFilter(e.target.value); setPage(1) }}
                >
                  <option value="">All Resource Groups</option>
                  {rgNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="">— Unassigned</option>
                </select>
              </div>

              {/* Active filters */}
              {(search || rgFilter) && (
                <button
                  className="h-8 px-2.5 text-xs rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 flex items-center gap-1"
                  onClick={() => { setSearch(''); setRgFilter(''); setPage(1) }}
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <ThSortable col="name"            label="Project Name"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <ThSortable col="state"           label="State"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <ThSortable col="resource_group"  label="Resource Group"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <ThSortable col="vm_count"        label="VMs"             sortCol={sortCol} sortDir={sortDir} align="right" onSort={handleSort} />
                      <ThSortable col="vcpu_total"      label="vCPU"            sortCol={sortCol} sortDir={sortDir} align="right" onSort={handleSort} />
                      <ThSortable col="vram_total_gb"   label="RAM"             sortCol={sortCol} sortDir={sortDir} align="right" onSort={handleSort} />
                      <ThSortable col="storage_total_tb" label="Storage"        sortCol={sortCol} sortDir={sortDir} align="right" onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[10px] text-slate-400">
                          No projects found.
                        </td>
                      </tr>
                    ) : (
                      paginated.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 max-w-[220px] truncate" title={p.name}>
                            {p.name}
                          </td>
                          <td className="px-4 py-3">
                            {p.state === 'Enabled'
                              ? <Badge variant="success">Enabled</Badge>
                              : <Badge variant="secondary">{p.state ?? '—'}</Badge>}
                          </td>
                          <td className="px-4 py-3">
                            {p.resource_group ? (
                              <button
                                className="text-xs text-sky-600 hover:text-sky-700 hover:underline truncate max-w-[160px] block text-left"
                                title={p.resource_group}
                                onClick={() => { setRgFilter(p.resource_group === rgFilter ? '' : p.resource_group); setPage(1) }}
                              >
                                {p.resource_group}
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 text-right tabular-nums">{p.vm_count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-slate-700 text-right tabular-nums">{p.vcpu_total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-slate-700 text-right tabular-nums">{Math.round(p.vram_total_gb).toLocaleString()} GB</td>
                          <td className="px-4 py-3 text-xs text-slate-700 text-right tabular-nums">{p.storage_total_tb.toFixed(2)} TB</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 pb-3">
                <PaginationBar
                  total={filtered.length}
                  page={currentPage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 20, 50]}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
