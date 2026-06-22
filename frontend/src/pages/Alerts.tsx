import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { Bell, Plus, Pencil, Trash2, ChevronDown, ChevronRight, SendHorizonal, FlaskConical } from 'lucide-react'
import {
  fetchAlertChannels,
  createAlertChannel,
  updateAlertChannel,
  deleteAlertChannel,
  fetchAlertRules,
  updateAlertRule,
  testAlertChannel,
  testAlertLevel,
  type AlertChannel,
} from '@/lib/api'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200', className)} />
}

// ─── Level badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    MAJOR:    'bg-orange-100 text-orange-700 border-orange-200',
    WARNING:  'bg-amber-100 text-amber-700 border-amber-200',
  }
  return (
    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide', styles[level] ?? 'bg-slate-100 text-slate-600')}>
      {level}
    </span>
  )
}

// ─── Rules sub-panel ──────────────────────────────────────────────────────────

function ChannelRules({
  channelId,
  onToast,
}: {
  channelId: string
  onToast: (msg: string, ok: boolean) => void
}) {
  const qc = useQueryClient()
  const [testingLevel, setTestingLevel] = useState<string | null>(null)

  const { data: rules, isLoading } = useQuery({
    queryKey: ['alert-rules', channelId],
    queryFn: () => fetchAlertRules(channelId),
  })

  const patchRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { interval_hours?: number; enabled?: boolean } }) =>
      updateAlertRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules', channelId] }),
  })

  async function handleTestLevel(level: string) {
    setTestingLevel(level)
    try {
      const result = await testAlertLevel(channelId, level)
      onToast(result.message, result.success)
    } catch {
      onToast(`Failed to send test ${level} alert.`, false)
    } finally {
      setTestingLevel(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 py-3 px-6">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    )
  }

  const LEVEL_ORDER = ['CRITICAL', 'MAJOR', 'WARNING']
  const sorted = [...(rules ?? [])].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  )

  return (
    <div className="border-t border-slate-100 bg-slate-50">
      <div className="px-6 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
          Alert Rules — disk health
        </p>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-slate-400">
              <th className="py-1 text-left font-medium w-28">Level</th>
              <th className="py-1 text-left font-medium w-40">Interval (hours)</th>
              <th className="py-1 text-left font-medium w-20">Enabled</th>
              <th className="py-1 text-left font-medium">Test</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((rule) => (
              <tr key={rule.id} className="hover:bg-slate-100">
                <td className="py-1.5 pr-4">
                  <LevelBadge level={rule.level} />
                </td>
                <td className="py-1.5 pr-4">
                  <Input
                    type="number"
                    step={0.5}
                    min={0.5}
                    defaultValue={rule.interval_hours}
                    className="h-6 w-24 text-[10px] px-2"
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val > 0 && val !== rule.interval_hours) {
                        patchRule.mutate({ id: rule.id, data: { interval_hours: val } })
                      }
                    }}
                  />
                </td>
                <td className="py-1.5 pr-4">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    className="h-3.5 w-3.5 cursor-pointer accent-sky-500"
                    onChange={(e) =>
                      patchRule.mutate({ id: rule.id, data: { enabled: e.target.checked } })
                    }
                  />
                </td>
                <td className="py-1.5">
                  <button
                    title={`Send test ${rule.level} alert with real disk data`}
                    disabled={testingLevel !== null}
                    onClick={() => handleTestLevel(rule.level)}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-white hover:text-sky-600 border border-transparent hover:border-slate-200 transition-colors disabled:opacity-40"
                  >
                    <FlaskConical className="h-3 w-3" />
                    {testingLevel === rule.level ? 'Sending…' : 'Send Test'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[9px] text-slate-400">
          Test sends a real alert using current disk data — does not affect alert intervals.
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { data: user, isLoading: userLoading } = useCurrentUser()

  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Add channel dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addWebhook, setAddWebhook] = useState('')
  const [addEnabled, setAddEnabled] = useState(true)

  // Edit channel dialog state
  const [editChannel, setEditChannel] = useState<AlertChannel | null>(null)
  const [editName, setEditName] = useState('')
  const [editWebhook, setEditWebhook] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AlertChannel | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)

  // Toast-like feedback
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // Guard — admin only
  if (!userLoading && user?.role !== 'Admin') {
    return <Navigate to="/" replace />
  }

  const { data: channels, isLoading } = useQuery({
    queryKey: ['alert-channels'],
    queryFn: fetchAlertChannels,
  })

  const createMutation = useMutation({
    mutationFn: createAlertChannel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-channels'] })
      setAddOpen(false)
      setAddName('')
      setAddWebhook('')
      setAddEnabled(true)
      showToast('Channel created successfully.', true)
    },
    onError: () => showToast('Failed to create channel.', false),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; webhook_url?: string; enabled?: boolean } }) =>
      updateAlertChannel(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-channels'] })
      setEditChannel(null)
      showToast('Channel updated.', true)
    },
    onError: () => showToast('Failed to update channel.', false),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAlertChannel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-channels'] })
      setDeleteTarget(null)
      setDeleteArmed(false)
      showToast('Channel deleted.', true)
    },
    onError: () => showToast('Failed to delete channel.', false),
  })

  const testMutation = useMutation({
    mutationFn: testAlertChannel,
    onSuccess: (result) => showToast(result.message, result.success),
    onError: () => showToast('Test request failed.', false),
  })

  function maskWebhook(url: string): string {
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/')
      if (parts.length > 2) {
        const last = parts[parts.length - 1]
        parts[parts.length - 1] = last.slice(0, 6) + '••••••' + last.slice(-4)
        u.pathname = parts.join('/')
      }
      return u.origin + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? '…' : '')
    } catch {
      return url.slice(0, 40) + (url.length > 40 ? '…' : '')
    }
  }

  function openEdit(ch: AlertChannel) {
    setEditChannel(ch)
    setEditName(ch.name)
    setEditWebhook(ch.webhook_url)
    setEditEnabled(ch.enabled)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 0 0 1px rgba(14,165,233,0.25)' }}
          >
            <Bell className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Alerts</h1>
            <p className="text-[10px] text-slate-500">Alert channels and rules for disk health monitoring</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff' }}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Channel
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 rounded-lg px-4 py-2.5 text-xs font-medium shadow-lg transition-all',
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.msg}
        </div>
      )}

      {/* Channels card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-5 py-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Alert Channels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !channels || channels.length === 0 ? (
            <p className="p-5 text-xs text-slate-400">No channels configured. Click "Add Channel" to get started.</p>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] uppercase tracking-widest text-slate-400">
                  <th className="w-8 px-4 py-2" />
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Webhook URL</th>
                  <th className="px-4 py-2 text-left font-medium">Enabled</th>
                  <th className="px-4 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <>
                    <tr
                      key={ch.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}
                    >
                      <td className="w-8 px-4 py-2.5 text-slate-400">
                        {expandedId === ch.id ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{ch.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 capitalize">{ch.channel_type.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{maskWebhook(ch.webhook_url)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[9px] font-semibold',
                            ch.enabled
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {ch.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td
                        className="px-4 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            title="Test webhook"
                            className="rounded p-1 hover:bg-sky-50 text-sky-500 hover:text-sky-700"
                            onClick={() => testMutation.mutate(ch.id)}
                            disabled={testMutation.isPending}
                          >
                            <SendHorizonal className="h-3 w-3" />
                          </button>
                          <button
                            title="Edit"
                            className="rounded p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            onClick={() => openEdit(ch)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            title="Delete"
                            className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-600"
                            onClick={() => { setDeleteTarget(ch); setDeleteArmed(false) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === ch.id && (
                      <tr key={`${ch.id}-rules`}>
                        <td colSpan={6}>
                          <ChannelRules channelId={ch.id} onToast={showToast} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Add channel dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Alert Channel</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure a Google Chat Space webhook to receive disk health alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. Infra Alerts"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                value={addWebhook}
                onChange={(e) => setAddWebhook(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="add-enabled"
                checked={addEnabled}
                className="h-3.5 w-3.5 accent-sky-500"
                onChange={(e) => setAddEnabled(e.target.checked)}
              />
              <Label htmlFor="add-enabled" className="text-xs cursor-pointer">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff' }}
              disabled={!addName.trim() || !addWebhook.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ name: addName.trim(), webhook_url: addWebhook.trim(), enabled: addEnabled })
              }
            >
              {createMutation.isPending ? 'Creating…' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit channel dialog ── */}
      <Dialog open={!!editChannel} onOpenChange={(open) => { if (!open) setEditChannel(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Channel</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update the channel name, webhook URL, or enabled state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-8 text-xs"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={editWebhook}
                onChange={(e) => setEditWebhook(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-enabled"
                checked={editEnabled}
                className="h-3.5 w-3.5 accent-sky-500"
                onChange={(e) => setEditEnabled(e.target.checked)}
              />
              <Label htmlFor="edit-enabled" className="text-xs cursor-pointer">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditChannel(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff' }}
              disabled={!editName.trim() || !editWebhook.trim() || updateMutation.isPending}
              onClick={() => {
                if (!editChannel) return
                updateMutation.mutate({
                  id: editChannel.id,
                  data: { name: editName.trim(), webhook_url: editWebhook.trim(), enabled: editEnabled },
                })
              }}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteArmed(false) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Channel</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This will permanently delete the channel and all its rules and alert history.
              {!deleteArmed && ' Click Delete again to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-slate-700 font-medium">
            {deleteTarget?.name}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setDeleteTarget(null); setDeleteArmed(false) }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={cn('h-8 text-xs', deleteArmed ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200')}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteArmed) {
                  setDeleteArmed(true)
                  return
                }
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : deleteArmed ? 'Confirm Delete' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
