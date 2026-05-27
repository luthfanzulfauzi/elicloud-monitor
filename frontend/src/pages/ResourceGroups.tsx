import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import {
  fetchResourceGroups,
  fetchProjects,
  createResourceGroup,
  updateResourceGroup,
  deleteResourceGroup,
  type ResourceGroup,
  type Project,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

// ─── Group form dialog ────────────────────────────────────────────────────────

interface GroupFormProps {
  open: boolean
  onClose: () => void
  onSave: (name: string, description: string, projectIds: string[]) => Promise<void>
  initial?: ResourceGroup | null
  allProjects: Project[]
}

function GroupFormDialog({ open, onClose, onSave, initial, allProjects }: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.project_ids ?? []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  function toggleProject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(name.trim(), desc.trim(), [...selected])
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const filtered = allProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Resource Group' : 'New Resource Group'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Internal Services"
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description…"
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
            />
          </div>

          {/* Project picker */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Projects <span className="ml-1 text-slate-400 font-normal">({selected.size} selected)</span>
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter projects…"
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-sky-400 mb-1.5"
            />
            <div className="rounded border border-slate-200 divide-y divide-slate-100">
              {/* Select-all row */}
              {filtered.length > 0 && (() => {
                const allChecked = filtered.every((p) => selected.has(p.id))
                const someChecked = !allChecked && filtered.some((p) => selected.has(p.id))
                function toggleAll() {
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (allChecked) filtered.forEach((p) => next.delete(p.id))
                    else filtered.forEach((p) => next.add(p.id))
                    return next
                  })
                }
                return (
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      className="accent-sky-600 h-3 w-3 shrink-0"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {allChecked ? 'Deselect all' : 'Select all'} ({filtered.length})
                    </span>
                  </label>
                )
              })()}
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-[10px] text-slate-400 text-center">No projects match.</p>
              ) : (
                filtered.map((p) => {
                  const checked = selected.has(p.id)
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors',
                        checked ? 'bg-sky-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProject(p.id)}
                        className="accent-sky-600 h-3 w-3 shrink-0"
                      />
                      <span className={cn('truncate', checked ? 'text-sky-700 font-medium' : 'text-slate-700')}>
                        {p.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">{p.vm_count} VMs</span>
                    </label>
                  )
                })
              )}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

interface DeleteState { id: string; name: string; armed: boolean }

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-800">
          {value}
          {sub && <span className="text-sm font-normal text-slate-400"> {sub}</span>}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Resource group row ───────────────────────────────────────────────────────

function GroupRow({
  group,
  onEdit,
  onDelete,
  deleteState,
}: {
  group: ResourceGroup
  onEdit: (g: ResourceGroup) => void
  onDelete: (id: string, name: string) => void
  deleteState: DeleteState | null
}) {
  const isArmed = deleteState?.id === group.id && deleteState.armed

  return (
    <tr className="border-b border-slate-200 last:border-0 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50">
            <Layers className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">{group.name}</p>
            {group.description && (
              <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">{group.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1 max-w-[280px]">
          {group.projects.length === 0
            ? <span className="text-slate-300 text-xs">—</span>
            : group.projects.map((name) => (
              <Badge key={name} variant="secondary" className="text-[10px] font-normal">{name}</Badge>
            ))}
        </div>
      </td>
      <td className="px-4 py-4 text-xs font-medium text-slate-700">{group.vm_count.toLocaleString()}</td>
      <td className="px-4 py-4 text-xs text-slate-700">{group.vcpu_total.toLocaleString()} <span className="text-slate-400 font-normal">vCPU</span></td>
      <td className="px-4 py-4 text-xs text-slate-700">{group.vram_gb.toFixed(1)} <span className="text-slate-400 font-normal">GB</span></td>
      <td className="px-4 py-4 text-xs text-slate-700">{(group.storage_gb / 1024).toFixed(2)} <span className="text-slate-400 font-normal">TB</span></td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(group)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(group.id, group.name)}
            className={cn(
              'rounded p-1.5 transition-colors',
              isArmed
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'text-slate-400 hover:bg-slate-100 hover:text-red-500',
            )}
            title={isArmed ? 'Click again to confirm delete' : 'Delete'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResourceGroups() {
  const queryClient = useQueryClient()
  const { data: groups = [], isLoading } = useQuery({ queryKey: ['resource-groups'], queryFn: fetchResourceGroups })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ResourceGroup | null>(null)
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const totalVMs = groups.reduce((s, g) => s + g.vm_count, 0)
  const totalCPU = groups.reduce((s, g) => s + g.vcpu_total, 0)
  const totalRAM = groups.reduce((s, g) => s + g.vram_gb, 0)

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(g: ResourceGroup) { setEditing(g); setFormOpen(true) }

  async function handleSave(name: string, description: string, projectIds: string[]) {
    if (editing) {
      await updateResourceGroup(editing.id, { name, description, project_ids: projectIds })
    } else {
      await createResourceGroup({ name, description, project_ids: projectIds })
    }
    await queryClient.invalidateQueries({ queryKey: ['resource-groups'] })
  }

  function handleDeleteClick(id: string, name: string) {
    setDeleteError('')
    if (deleteState?.id === id && deleteState.armed) {
      // Second click — confirm delete
      deleteResourceGroup(id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['resource-groups'] })
          setDeleteState(null)
        })
        .catch(() => setDeleteError('Delete failed.'))
    } else {
      setDeleteState({ id, name, armed: true })
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Resource Groups" value={groups.length} />
        <StatCard label="Total VMs" value={totalVMs.toLocaleString()} />
        <StatCard label="Total vCPU" value={totalCPU.toLocaleString()} sub="vCPU" />
        <StatCard label="Total RAM" value={totalRAM.toFixed(1)} sub="GB" />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resource Groups</CardTitle>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Custom groupings of IAM2 projects — aggregated utilization across all member projects
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              New Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 p-0">
          {deleteError && (
            <div className="mx-4 mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{deleteError}</div>
          )}
          {deleteState?.armed && (
            <div className="mx-4 mb-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Click the delete button again to confirm removing <strong>{deleteState.name}</strong>.
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Group', 'Projects', 'VMs', 'vCPU', 'RAM', 'Storage', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                            <Layers className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="text-xs text-slate-400">No resource groups yet.</p>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" />
                            Create your first group
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => (
                      <GroupRow
                        key={g.id}
                        group={g}
                        onEdit={openEdit}
                        onDelete={handleDeleteClick}
                        deleteState={deleteState}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <GroupFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSave={handleSave}
          initial={editing}
          allProjects={projects}
        />
      )}
    </div>
  )
}
