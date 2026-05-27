import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HardDrive, RefreshCw, Download, CheckCircle2, AlertTriangle,
  XCircle, Plus, Pencil, Trash2, Server, Search,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import {
  fetchDiskHealth, refreshDiskHealth, fetchSmartctlLastUpdated, type DiskHealthRecord,
  fetchStorageNodes, createStorageNode, updateStorageNode, deleteStorageNode,
  type StorageNode, type StorageNodeCreate,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import PaginationBar from '@/components/ui/PaginationBar'
import { cn } from '@/lib/utils'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// ─── Disk health display components ──────────────────────────────────────────

function HealthBadge({ health }: { health: string }) {
  if (health === 'PASSED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> PASSED
      </span>
    )
  }
  if (health === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        <XCircle className="h-3 w-3" /> FAILED
      </span>
    )
  }
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
      {health}
    </span>
  )
}

function SummaryBadge({ summary }: { summary: string | null }) {
  if (!summary) return <span className="text-slate-400">—</span>
  if (summary === 'Good') return <span className="text-[10px] font-medium text-emerald-600">{summary}</span>
  if (summary === 'Warning') return <span className="text-[10px] font-medium text-amber-600">{summary}</span>
  return <span className="text-[10px] font-semibold text-red-600">{summary}</span>
}

function PctCell({ value, warnBelow, dangerBelow }: { value: number | null; warnBelow?: number; dangerBelow?: number }) {
  if (value == null) return <span className="text-slate-400">—</span>
  const danger = dangerBelow != null && value <= dangerBelow
  const warn = !danger && warnBelow != null && value < warnBelow
  return (
    <span className={cn('font-medium', danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-700')}>
      {value.toFixed(1)}%
    </span>
  )
}

function CollectStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-slate-400">Never</span>
  if (status === 'success') {
    return <span className="text-[10px] font-medium text-emerald-600">Success</span>
  }
  if (status === 'failed') {
    return <span className="text-[10px] font-medium text-red-600">Failed</span>
  }
  return <span className="text-[10px] font-medium text-amber-600">{status}</span>
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, iconClass,
}: { label: string; value: number | string; icon: React.ElementType; iconClass?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconClass ?? 'bg-slate-100')}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-0.5 text-lg font-bold text-slate-800">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(records: DiskHealthRecord[]) {
  const header = [
    'hostname', 'nvme_device', 'model_number', 'capacity_tb', 'tbw',
    'endurance_used_pct', 'life_remaining_pct', 'available_spare_pct',
    'disk_health', 'summary', 'notes', 'collected_at',
  ]
  const rows = records.map((r) =>
    [
      r.hostname, r.nvme_device, r.model_number ?? '',
      r.capacity_tb ?? '', r.tbw ?? '',
      r.endurance_used_pct ?? '', r.life_remaining_pct ?? '', r.available_spare_pct ?? '',
      r.disk_health, r.summary ?? '', r.notes ?? '', r.collected_at,
    ].join(',')
  )
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'disk_health.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey =
  | 'hostname' | 'nvme_device' | 'model_number' | 'capacity_tb' | 'tbw'
  | 'endurance_used_pct' | 'life_remaining_pct' | 'available_spare_pct'
  | 'disk_health' | 'summary'

type SortDir = 'asc' | 'desc' | null

interface SortableThProps {
  label: string
  colKey: SortKey
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (k: SortKey) => void
}

function SortableTh({ label, colKey, sortKey, sortDir, onSort }: SortableThProps) {
  const active = sortKey === colKey
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700"
      onClick={() => onSort(colKey)}
    >
      {label}
      {active && sortDir === 'asc'
        ? <ChevronUp className="ml-1 inline h-3 w-3 text-sky-500" />
        : active && sortDir === 'desc'
        ? <ChevronDown className="ml-1 inline h-3 w-3 text-sky-500" />
        : <ChevronsUpDown className="ml-1 inline h-3 w-3 text-slate-300" />}
    </th>
  )
}

// ─── StorageNode form dialog ──────────────────────────────────────────────────

const EMPTY_NODE: StorageNodeCreate = {
  hostname: '',
  ssh_host: '',
  ssh_port: 22,
  ssh_user: 'root',
  ssh_key_path: '/app/ssh_keys/storage.pem',
  remote_dir: '/root/smartctl',
  enabled: true,
}

function NodeDialog({
  open, node, onClose, onSave, saving,
}: {
  open: boolean
  node: StorageNode | null
  onClose: () => void
  onSave: (data: StorageNodeCreate) => void
  saving: boolean
}) {
  const [form, setForm] = useState<StorageNodeCreate>(
    node
      ? { hostname: node.hostname, ssh_host: node.ssh_host, ssh_port: node.ssh_port, ssh_user: node.ssh_user, ssh_key_path: node.ssh_key_path, remote_dir: node.remote_dir, enabled: node.enabled }
      : { ...EMPTY_NODE }
  )

  const set = (k: keyof StorageNodeCreate, v: StorageNodeCreate[typeof k]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{node ? 'Edit Storage Node' : 'Add Storage Node'}</DialogTitle>
          <DialogDescription>
            SSH credentials used by the backend to collect smartctl files via SFTP.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hostname (label)</Label>
              <Input className="mt-1 h-8 text-xs" value={form.hostname} onChange={(e) => set('hostname', e.target.value)} placeholder="zs-storage01" />
            </div>
            <div>
              <Label className="text-xs">SSH Host / IP</Label>
              <Input className="mt-1 h-8 text-xs" value={form.ssh_host} onChange={(e) => set('ssh_host', e.target.value)} placeholder="10.0.0.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">SSH Port</Label>
              <Input className="mt-1 h-8 text-xs" type="number" value={form.ssh_port} onChange={(e) => set('ssh_port', parseInt(e.target.value) || 22)} />
            </div>
            <div>
              <Label className="text-xs">SSH User</Label>
              <Input className="mt-1 h-8 text-xs" value={form.ssh_user} onChange={(e) => set('ssh_user', e.target.value)} placeholder="root" />
            </div>
          </div>
          <div>
            <Label className="text-xs">SSH Key Path (on backend)</Label>
            <Input className="mt-1 h-8 text-xs font-mono" value={form.ssh_key_path} onChange={(e) => set('ssh_key_path', e.target.value)} placeholder="/app/ssh_keys/storage.pem" />
          </div>
          <div>
            <Label className="text-xs">Remote Directory</Label>
            <Input className="mt-1 h-8 text-xs font-mono" value={form.remote_dir} onChange={(e) => set('remote_dir', e.target.value)} placeholder="/root/smartctl" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-sky-600"
            />
            <Label htmlFor="enabled" className="text-xs cursor-pointer">Enabled</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.hostname || !form.ssh_host}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiskHealth() {
  // Filters
  const [hostnameFilter, setHostnameFilter] = useState<string>('all')
  const [healthFilter, setHealthFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Node management
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<StorageNode | null>(null)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // ── Queries ──
  const { data: records, isLoading: diskLoading } = useQuery({
    queryKey: ['disk-health'],
    queryFn: () => fetchDiskHealth(),
  })

  const { data: nodes, isLoading: nodesLoading } = useQuery({
    queryKey: ['storage-nodes'],
    queryFn: fetchStorageNodes,
  })

  const { data: lastUpdated } = useQuery({
    queryKey: ['smartctl-last-updated'],
    queryFn: fetchSmartctlLastUpdated,
    refetchInterval: 60_000,
  })

  // ── Mutations ──
  const { mutate: doRefresh, isPending: isRefreshing } = useMutation({
    mutationFn: refreshDiskHealth,
    onSuccess: (result) => {
      setRefreshMsg(`Collected ${result.nodes_collected} node(s), parsed ${result.files_parsed} file(s)${result.nodes_failed > 0 ? ` — ${result.nodes_failed} node(s) failed` : ''}`)
      queryClient.invalidateQueries({ queryKey: ['disk-health'] })
      queryClient.invalidateQueries({ queryKey: ['storage-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['smartctl-last-updated'] })
      setTimeout(() => setRefreshMsg(null), 6000)
    },
  })

  const { mutate: saveNode, isPending: isSaving } = useMutation({
    mutationFn: (data: StorageNodeCreate) =>
      editingNode ? updateStorageNode(editingNode.id, data) : createStorageNode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-nodes'] })
      setNodeDialogOpen(false)
      setEditingNode(null)
    },
  })

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteStorageNode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-nodes'] }),
  })

  // ── Derived values ──
  const allRecords = records ?? []
  const allNodes = nodes ?? []

  const hostnames = useMemo(
    () => [...new Set(allRecords.map((r) => r.hostname))].sort(),
    [allRecords],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRecords.filter((r) => {
      if (hostnameFilter !== 'all' && r.hostname !== hostnameFilter) return false
      if (healthFilter !== 'all' && r.disk_health !== healthFilter) return false
      if (q && !r.hostname.toLowerCase().includes(q) &&
          !r.nvme_device.toLowerCase().includes(q) &&
          !(r.model_number ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [allRecords, hostnameFilter, healthFilter, search])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof DiskHealthRecord]
      const bv = b[sortKey as keyof DiskHealthRecord]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const currentPage = Math.min(page, Math.max(1, Math.ceil(sorted.length / pageSize)))
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null) }
      else setSortDir('asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function resetPage() { setPage(1) }

  const totalDrives = allRecords.length
  const passedCount = allRecords.filter((r) => r.disk_health === 'PASSED').length
  const warningCount = allRecords.filter((r) => r.summary === 'Warning').length
  const notGoodCount = allRecords.filter((r) => r.summary === 'Not good').length

  function openCreate() { setEditingNode(null); setNodeDialogOpen(true) }
  function openEdit(node: StorageNode) { setEditingNode(node); setNodeDialogOpen(true) }

  function handleDelete(id: string) {
    if (deleteArmed === id) {
      doDelete(id)
      setDeleteArmed(null)
    } else {
      setDeleteArmed(id)
      setTimeout(() => setDeleteArmed((cur) => (cur === id ? null : cur)), 3000)
    }
  }

  const thProps = { sortKey, sortDir, onSort: handleSort }

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
          >
            <HardDrive className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Disk Health</h1>
            <p className="text-[10px] text-slate-400">
              NVMe SMART monitoring — SCP collection from storage nodes
              {lastUpdated && (
                <span className="ml-2 text-slate-300">·</span>
              )}
              {lastUpdated && (
                <span className="ml-2 text-slate-400">
                  files last updated{' '}
                  <span className="font-medium text-slate-500">
                    {new Date(lastUpdated).toLocaleString()}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {refreshMsg && (
            <span className="text-[10px] text-slate-500">{refreshMsg}</span>
          )}
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={() => doRefresh()} disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Collecting…' : 'Collect & Refresh'}
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={() => exportCSV(sorted)} disabled={sorted.length === 0}
          >
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Drives" value={totalDrives} icon={HardDrive} iconClass="bg-sky-500" />
        <StatCard label="PASSED" value={passedCount} icon={CheckCircle2} iconClass="bg-emerald-500" />
        <StatCard label="Warning" value={warningCount} icon={AlertTriangle} iconClass="bg-amber-500" />
        <StatCard label="Not Good" value={notGoodCount} icon={XCircle} iconClass="bg-red-500" />
      </div>

      {/* ── Disk health table ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>NVMe Drive Details</CardTitle>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Latest SMART data — {sorted.length} of {totalDrives} drives shown
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-8 w-52 pl-8 text-xs"
                  placeholder="Search hostname, device, model…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage() }}
                />
              </div>
              {/* Hostname filter */}
              <Select value={hostnameFilter} onValueChange={(v) => { setHostnameFilter(v); resetPage() }}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="All Hosts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Hosts</SelectItem>
                  {hostnames.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Health filter */}
              <Select value={healthFilter} onValueChange={(v) => { setHealthFilter(v); resetPage() }}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Health</SelectItem>
                  <SelectItem value="PASSED" className="text-xs">PASSED</SelectItem>
                  <SelectItem value="FAILED" className="text-xs">FAILED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {diskLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
            </div>
          ) : allRecords.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-[10px] text-slate-400">
              No disk records found. Add storage nodes and click "Collect &amp; Refresh".
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <SortableTh label="Hostname" colKey="hostname" {...thProps} />
                      <SortableTh label="NVMe Device" colKey="nvme_device" {...thProps} />
                      <SortableTh label="Model" colKey="model_number" {...thProps} />
                      <SortableTh label="Capacity" colKey="capacity_tb" {...thProps} />
                      <SortableTh label="TBW" colKey="tbw" {...thProps} />
                      <SortableTh label="Endurance Used" colKey="endurance_used_pct" {...thProps} />
                      <SortableTh label="Life Remaining" colKey="life_remaining_pct" {...thProps} />
                      <SortableTh label="Available Spare" colKey="available_spare_pct" {...thProps} />
                      <SortableTh label="Disk Health" colKey="disk_health" {...thProps} />
                      <SortableTh label="Summary" colKey="summary" {...thProps} />
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-[10px] text-slate-400">
                          No drives match the current search / filter.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((r) => (
                        <tr
                          key={r.id}
                          className={cn(
                            'transition-colors hover:bg-slate-50',
                            r.summary === 'Not good' && 'bg-red-50/40 hover:bg-red-50/60',
                            r.summary === 'Warning' && 'bg-amber-50/40 hover:bg-amber-50/60',
                          )}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{r.hostname}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600">{r.nvme_device}</td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={r.model_number ?? ''}>{r.model_number ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.capacity_tb != null ? `${r.capacity_tb.toFixed(2)} TB` : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.tbw != null ? `${r.tbw.toFixed(1)} TB` : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3"><PctCell value={r.endurance_used_pct} warnBelow={80} dangerBelow={100} /></td>
                          <td className="whitespace-nowrap px-4 py-3"><PctCell value={r.life_remaining_pct} warnBelow={20} dangerBelow={0} /></td>
                          <td className="whitespace-nowrap px-4 py-3"><PctCell value={r.available_spare_pct} warnBelow={90} dangerBelow={10} /></td>
                          <td className="whitespace-nowrap px-4 py-3"><HealthBadge health={r.disk_health} /></td>
                          <td className="whitespace-nowrap px-4 py-3"><SummaryBadge summary={r.summary} /></td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={r.notes ?? ''}>{r.notes ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                total={sorted.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Storage nodes management ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" />
              <div>
                <CardTitle>Storage Nodes</CardTitle>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  SSH config for SFTP collection — {allNodes.filter((n) => n.enabled).length} of {allNodes.length} enabled
                </p>
              </div>
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
              <Plus className="h-3 w-3" /> Add Node
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {nodesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : allNodes.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-[10px] text-slate-400">
              No storage nodes configured. Click "Add Node" to register one.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Hostname', 'SSH Host', 'Port', 'User', 'Key Path', 'Remote Dir', 'Enabled', 'Last Collected', 'Status', 'Error', ''].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allNodes.map((node) => (
                    <tr key={node.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">{node.hostname}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-600">{node.ssh_host}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{node.ssh_port}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{node.ssh_user}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-slate-500" title={node.ssh_key_path}>{node.ssh_key_path}</td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-slate-500" title={node.remote_dir}>{node.remote_dir}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', node.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                          {node.enabled ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{fmtDate(node.last_collected_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5"><CollectStatusBadge status={node.last_collect_status} /></td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-red-500" title={node.last_collect_error ?? ''}>
                        {node.last_collect_error ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(node)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(node.id)}
                            className={cn(
                              'rounded p-1 transition-colors',
                              deleteArmed === node.id
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                            )}
                            title={deleteArmed === node.id ? 'Click again to confirm delete' : 'Delete'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Node add/edit dialog ── */}
      {nodeDialogOpen && (
        <NodeDialog
          open={nodeDialogOpen}
          node={editingNode}
          onClose={() => { setNodeDialogOpen(false); setEditingNode(null) }}
          onSave={(data) => saveNode(data)}
          saving={isSaving}
        />
      )}
    </div>
  )
}
