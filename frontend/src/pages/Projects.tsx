import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects, type Project } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PaginationBar from '@/components/ui/PaginationBar'
import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function UsageBar({ used, quota }: { used: number; quota: number | null }) {
  if (!quota) return null
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
      <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function UsageQuotaCell({
  used,
  quota,
  unit = '',
  decimals = 0,
}: {
  used: number
  quota: number | null
  unit?: string
  decimals?: number
}) {
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : n.toLocaleString()
  return (
    <div className="min-w-[80px]">
      <span className="font-medium text-slate-700">{fmt(used)}</span>
      {quota != null ? (
        <>
          <span className="mx-0.5 text-slate-300">/</span>
          <span className="text-slate-400">{fmt(quota)}</span>
        </>
      ) : (
        <span className="ml-0.5 text-slate-300">/ —</span>
      )}
      {unit ? <span className="ml-0.5 text-slate-400 font-normal">{unit}</span> : null}
      <UsageBar used={used} quota={quota} />
    </div>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const q = project.quota ?? null
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
      <td className="px-4 py-3 text-xs">
        <UsageQuotaCell used={project.vm_count} quota={q?.vm_num ?? null} />
      </td>
      <td className="px-4 py-3 text-xs">
        <UsageQuotaCell used={project.vcpu_total} quota={q?.vcpu_num ?? null} unit="vCPU" />
      </td>
      <td className="px-4 py-3 text-xs">
        <UsageQuotaCell
          used={Math.round(project.vram_total_gb)}
          quota={q?.memory_gb != null ? Math.round(q.memory_gb) : null}
          unit="GB"
        />
      </td>
      <td className="px-4 py-3 text-xs">
        <UsageQuotaCell
          used={project.storage_total_tb}
          quota={q?.storage_tb ?? null}
          unit="TB"
          decimals={2}
        />
      </td>
      <td className="px-4 py-3 text-xs">
        {q?.volume_num != null
          ? <span className="text-slate-400 font-normal">— / <span className="text-slate-700 font-medium">{q.volume_num}</span></span>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3 text-xs">
        {q?.eip_num != null
          ? <span className="text-slate-400 font-normal">— / <span className="text-slate-700 font-medium">{q.eip_num}</span></span>
          : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  )
}

export default function Projects() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const allProjects = projects ?? []
  const currentPage = Math.min(page, Math.max(1, Math.ceil(allProjects.length / pageSize)))
  const paginated = allProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalVMs = allProjects.reduce((s, p) => s + p.vm_count, 0)
  const totalVMQuota = allProjects.reduce((s, p) => s + (p.quota?.vm_num ?? 0), 0)
  const totalCPU = allProjects.reduce((s, p) => s + p.vcpu_total, 0)
  const totalCPUQuota = allProjects.reduce((s, p) => s + (p.quota?.vcpu_num ?? 0), 0)
  const totalRAM = Math.round(allProjects.reduce((s, p) => s + p.vram_total_gb, 0))
  const totalRAMQuota = Math.round(allProjects.reduce((s, p) => s + (p.quota?.memory_gb ?? 0), 0))
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">VMs Used / Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {totalVMs.toLocaleString()}
              <span className="text-sm font-normal text-slate-400"> / {totalVMQuota.toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">vCPU Used / Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {totalCPU.toLocaleString()}
              <span className="text-sm font-normal text-slate-400"> / {totalCPUQuota.toLocaleString()} vCPU</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">RAM Used / Quota</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {totalRAM.toLocaleString()}
              <span className="text-sm font-normal text-slate-400"> / {totalRAMQuota.toLocaleString()} GB</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Projects</CardTitle>
          <p className="text-[10px] text-slate-400">
            {allProjects.length} ZStack IAM2 projects · usage shown as <span className="font-semibold text-slate-500">used / quota</span> · progress bar: green &lt;70%, amber 70–90%, red ≥90% ·
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
                        'VMs (used/quota)',
                        'vCPU (used/quota)',
                        'RAM (used/quota)',
                        'Storage (used/quota)',
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

              <div className="px-4 pb-3">
                <PaginationBar
                  total={allProjects.length}
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
