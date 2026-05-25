import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, LogOut } from 'lucide-react'
import { fetchDashboardSummary } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { timeAgo, cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function SyncBadge({
  status,
  lastSync,
}: {
  status: 'success' | 'partial' | 'failed'
  lastSync: string
}) {
  const configs = {
    success: {
      icon: CheckCircle,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'Synced',
    },
    partial: {
      icon: AlertTriangle,
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
      dot: 'bg-amber-500',
      label: 'Partial sync',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-700',
      bg: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      label: 'Sync failed',
    },
  }

  const cfg = configs[status]
  const Icon = cfg.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium',
        cfg.bg,
        cfg.color,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      <Icon className="h-3.5 w-3.5" />
      <span>{cfg.label}</span>
      <span className="text-slate-400">·</span>
      <span className="font-normal text-slate-500">Last sync {timeAgo(lastSync)}</span>
    </div>
  )
}

interface HeaderProps {
  title: string
}

const ROLE_STYLES: Record<string, string> = {
  Admin: 'bg-violet-100 text-violet-700',
  Operator: 'bg-amber-100 text-amber-700',
  Viewer: 'bg-slate-100 text-slate-600',
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: syncData } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    staleTime: 1000 * 60 * 2,
  })
  const { data: currentUser } = useCurrentUser()

  function handleLogout() {
    clearToken()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5">
        <Activity className="h-4 w-4 text-sky-500" />
        <h1 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {syncData?.sync_info ? (
          <SyncBadge status={syncData.sync_info.status} lastSync={syncData.sync_info.last_sync} />
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing…</span>
          </div>
        )}

        {currentUser && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="text-right">
              <p className="text-[11px] font-medium text-slate-700 leading-none">{currentUser.name}</p>
              <span className={cn(
                'inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold',
                ROLE_STYLES[currentUser.role] ?? 'bg-slate-100 text-slate-600',
              )}>
                {currentUser.role}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Sign out"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500 hover:border-slate-300 hover:text-slate-700 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}
