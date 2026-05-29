import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import {
  fetchUsers,
  createUser,
  updateUser,
  updateUserPermissions,
  deleteUser,
  type AppUser,
  type UserRole,
  type UserStatus,
  type AppModule,
  type PermissionMap,
  APP_MODULES,
  defaultPermissions,
} from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatDate, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    Admin: 'bg-violet-100 text-violet-700 border-violet-200',
    Operator: 'bg-amber-100 text-amber-700 border-amber-200',
    Viewer: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-medium', styles[role])}>
      {role}
    </span>
  )
}

// ─── Login status badge ───────────────────────────────────────────────────────

const ONLINE_MS  = 5  * 60 * 1000   // < 5 min  → Online
const IDLE_MS    = 8  * 60 * 60 * 1000 // < 8 hr → Idle  (within token validity)

type SessionStatus = 'online' | 'idle' | 'offline'

function sessionStatus(lastActiveAt: string | null): SessionStatus {
  if (!lastActiveAt) return 'offline'
  const diff = Date.now() - new Date(lastActiveAt).getTime()
  if (diff < ONLINE_MS) return 'online'
  if (diff < IDLE_MS)   return 'idle'
  return 'offline'
}

function LoginStatusBadge({ lastActiveAt }: { lastActiveAt: string | null }) {
  const status = sessionStatus(lastActiveAt)
  const config = {
    online:  { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'Online' },
    idle:    { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Idle'   },
    offline: { dot: 'bg-slate-300',   text: 'text-slate-400',   label: 'Offline' },
  }[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', config.dot)} />
      <span className={cn('text-[10px] font-medium', config.text)}>{config.label}</span>
    </span>
  )
}

// ─── Avatar initial ───────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', color)}>
      {initials}
    </div>
  )
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'Viewer' as UserRole,
  status: 'Active' as UserStatus,
  password: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Users() {
  const queryClient = useQueryClient()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const { manage: canManage } = usePermission('User Management')

  // Only Admin role may access this page
  if (!userLoading && currentUser?.role !== 'Admin') {
    return <Navigate to="/" replace />
  }

  const { data: displayUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  // ── User dialog ──
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Permissions dialog ──
  const [permDialogOpen, setPermDialogOpen] = useState(false)
  const [permUser, setPermUser] = useState<AppUser | null>(null)
  const [permMap, setPermMap] = useState<PermissionMap>(defaultPermissions('Viewer'))
  const [savingPerms, setSavingPerms] = useState(false)

  // ── Delete confirmation ──
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setUserDialogOpen(true)
  }

  function openEdit(user: AppUser) {
    setEditingUser(user)
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status, password: '' })
    setSaveError(null)
    setUserDialogOpen(true)
  }

  function openPermissions(user: AppUser) {
    setPermUser(user)
    setPermMap(structuredClone(user.permissions))
    setPermDialogOpen(true)
  }

  async function handleSaveUser() {
    if (!form.name.trim() || !form.email.trim()) return
    if (!editingUser && !form.password.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
          ...(form.password.trim() ? { password: form.password } : {}),
        })
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
          password: form.password,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserDialogOpen(false)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSaveError(detail ?? 'Failed to save user. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePermissions() {
    if (!permUser) return
    setSavingPerms(true)
    try {
      await updateUserPermissions(permUser.id, permMap)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setPermDialogOpen(false)
    } finally {
      setSavingPerms(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteUser(id)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    } finally {
      setDeletingId(null)
    }
  }

  function togglePerm(mod: AppModule, type: 'view' | 'manage') {
    setPermMap((prev) => {
      const next = { ...prev, [mod]: { ...prev[mod] } }
      if (type === 'manage') {
        next[mod].manage = !next[mod].manage
        if (next[mod].manage) next[mod].view = true
      } else {
        next[mod].view = !next[mod].view
        if (!next[mod].view) next[mod].manage = false
      }
      return next
    })
  }

  // ── Stats ──
  const total = displayUsers.length
  const active = displayUsers.filter((u) => u.status === 'Active').length
  const inactive = displayUsers.filter((u) => u.status === 'Inactive').length
  const admins = displayUsers.filter((u) => u.role === 'Admin').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">User Management</h2>
          <p className="text-[10px] text-slate-400">Manage users and access permissions</p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Users', value: total, sub: 'registered accounts' },
          { label: 'Active', value: active, sub: 'currently active' },
          { label: 'Inactive', value: inactive, sub: 'disabled accounts' },
          { label: 'Admins', value: admins, sub: 'with full access' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
              <p className="text-[10px] text-slate-400">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>All Users</CardTitle>
          <p className="text-[10px] text-slate-400">{displayUsers.length} user{displayUsers.length !== 1 ? 's' : ''}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['User', 'Email', 'Role', 'Status', 'Session', 'Last Login', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[10px] text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  displayUsers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-sky-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={user.name} />
                          <span className="text-xs font-medium text-slate-700">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{user.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.status === 'Active' ? 'success' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <LoginStatusBadge lastActiveAt={user.last_active_at} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {user.last_login ? timeAgo(user.last_login) : <span className="text-slate-300">Never</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-700"
                                title="Edit user"
                                onClick={() => openEdit(user)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-violet-600"
                                title="Manage permissions"
                                onClick={() => openPermissions(user)}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-7 w-7',
                                  deletingId === user.id
                                    ? 'text-red-600'
                                    : 'text-slate-400 hover:text-red-600',
                                )}
                                title={deletingId === user.id ? 'Click again to confirm' : 'Delete user'}
                                onClick={() => {
                                  if (deletingId === user.id) handleDelete(user.id)
                                  else setDeletingId(user.id)
                                }}
                                onBlur={() => setDeletingId(null)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {!canManage && <span className="text-[10px] text-slate-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit User Dialog ── */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user details. Changing the role resets permissions to role defaults.'
                : 'Create a new user. Permissions are initialized from the selected role.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full Name</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sarah Ops"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. sarah@elitery.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin" className="text-xs">Admin</SelectItem>
                    <SelectItem value="Operator" className="text-xs">Operator</SelectItem>
                    <SelectItem value="Viewer" className="text-xs">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as UserStatus }))}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active" className="text-xs">Active</SelectItem>
                    <SelectItem value="Inactive" className="text-xs">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">
                {editingUser ? 'New Password' : 'Password'}
              </Label>
              <Input
                id="u-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Set a password'}
              />
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">
                <span className="font-semibold">Admin</span> — full access to all modules.{' '}
                <span className="font-semibold">Operator</span> — can manage infrastructure, cannot manage users.{' '}
                <span className="font-semibold">Viewer</span> — read-only access.
              </p>
            </div>
            {saveError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[10px] text-red-700">
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSaveUser}
              disabled={saving || !form.name.trim() || !form.email.trim() || (!editingUser && !form.password.trim())}
            >
              {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permissions Dialog ── */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-500" />
              Access Permissions
            </DialogTitle>
            <DialogDescription>
              {permUser && (
                <>
                  Configuring permissions for{' '}
                  <span className="font-semibold text-slate-700">{permUser.name}</span>
                  {' '}({permUser.role}).
                  {permUser.role === 'Admin' && ' Admin users have all permissions and cannot be restricted.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Module</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">View</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {APP_MODULES.map((mod) => {
                    const isAdmin = permUser?.role === 'Admin'
                    const perm = permMap[mod]
                    return (
                      <tr key={mod} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{mod}</td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={perm.view}
                            disabled={isAdmin}
                            onChange={() => togglePerm(mod, 'view')}
                            className="h-3.5 w-3.5 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={perm.manage}
                            disabled={isAdmin}
                            onChange={() => togglePerm(mod, 'manage')}
                            className="h-3.5 w-3.5 cursor-pointer accent-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Enabling <span className="font-medium">Manage</span> automatically grants <span className="font-medium">View</span>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)} disabled={savingPerms}>Cancel</Button>
            <Button onClick={handleSavePermissions} disabled={savingPerms || permUser?.role === 'Admin'}>
              {savingPerms ? 'Saving…' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
