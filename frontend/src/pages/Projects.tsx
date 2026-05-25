import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects, type Project, type ProjectQuota } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
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

function QuotaCell({ value, unit }: { value: number | null; unit: string }) {
  if (value == null) return <span className="text-slate-300">—</span>
  return (
    <span className="font-medium text-slate-700">
      {value.toLocaleString()}
      {unit ? <span className="ml-0.5 text-slate-400 font-normal">{unit}</span> : null}
    </span>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const q: ProjectQuota | null = project.quota ?? null
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3 text-xs font-medium text-slate-700 max-w-[200px] truncate" title={project.name}>
        {project.name}
      </td>
      <td className="px-4 py-3">
        {project.state === 'Enabled'
          ? <Badge variant="success">Enabled</Badge>
          : <Badge variant="secondary">{project.state ?? '—'}</Badge>}
      </td>
      <td className="px-4 py-3 text-xs"><QuotaCell value={q?.vm_num ?? null} unit="" /></td>
      <td className="px-4 py-3 text-xs"><QuotaCell value={q?.vcpu_num ?? null} unit="vCPU" /></td>
      <td className="px-4 py-3 text-xs">
        <QuotaCell value={q?.memory_gb != null ? Math.round(q.memory_gb) : null} unit="GB" />
      </td>
      <td className="px-4 py-3 text-xs">
        <QuotaCell value={q?.storage_tb ?? null} unit="TB" />
      </td>
      <td className="px-4 py-3 text-xs"><QuotaCell value={q?.volume_num ?? null} unit="" /></td>
      <td className="px-4 py-3 text-xs"><QuotaCell value={q?.eip_num ?? null} unit="" /></td>
    </tr>
  )
}

export default function Projects() {
  const [page, setPage] = useState(1)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const allProjects = projects ?? []
  const totalPages = Math.max(1, Math.ceil(allProjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = allProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const totalVMQuota = allProjects.reduce((s, p) => s + (p.quota?.vm_num ?? 0), 0)
  const totalCPUQuota = allProjects.reduce((s, p) => s + (p.quota?.vcpu_num ?? 0), 0)
  const totalRAMQuota = allProjects.reduce((s, p) => s + (p.quota?.memory_gb ?? 0), 0)
  const totalStorageQuota = allProjects.reduce((s, p) => s + (p.quota?.storage_tb ?? 0), 0)

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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total VM Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalVMQuota.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total CPU Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {totalCPUQuota.toLocaleString()} <span className="text-sm font-normal text-slate-400">vCPU</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total RAM Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {Math.round(totalRAMQuota).toLocaleString()} <span className="text-sm font-normal text-slate-400">GB</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Projects</CardTitle>
          <p className="text-[10px] text-slate-400">
            {allProjects.length} ZStack IAM2 projects · quota values are limits allocated per project from ZStack ·
            total storage quota: {totalStorageQuota.toFixed(1)} TB
          </p>
        </CardHeader>
        <CardContent className="pt-4 p-0">
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
                      {[
                        'Project Name',
                        'State',
                        'VM Quota',
                        'vCPU Quota',
                        'RAM Quota',
                        'Storage Quota',
                        'Volume Quota',
                        'EIP Quota',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-[10px] text-slate-400">
                          No projects found.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((p) => <ProjectRow key={p.id} project={p} />)
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <p className="text-[10px] text-slate-500">
                    {allProjects.length === 0 ? '0 results' : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, allProjects.length)} of ${allProjects.length}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {buildPageList(currentPage, totalPages).map((p, i) =>
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
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
