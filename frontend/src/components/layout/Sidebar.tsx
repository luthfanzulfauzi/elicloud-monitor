import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  Database,
  Monitor,
  FolderOpen,
  Layers,
  FileBarChart,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hosts', label: 'Hosts', icon: Server, end: false },
  { to: '/storage', label: 'Storage', icon: Database, end: false },
  { to: '/vms', label: 'Virtual Machines', icon: Monitor, end: false },
  { to: '/projects', label: 'Projects', icon: FolderOpen, end: false },
  { to: '/resource-groups', label: 'Resource Groups', icon: Layers, end: false },
  { to: '/reports', label: 'Reports', icon: FileBarChart, end: false },
]

const systemItems = [
  { to: '/users', label: 'User Management', icon: Users, end: false },
]

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: React.ElementType; end?: boolean }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
            isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
          )
        }
        style={({ isActive }) =>
          isActive ? { background: 'rgba(14,165,233,0.15)' } : {}
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r"
                style={{ background: '#0ea5e9' }}
              />
            )}
            <Icon
              className={cn(
                'h-4 w-4 flex-shrink-0 transition-colors',
                isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300',
              )}
            />
            {label}
          </>
        )}
      </NavLink>
    </li>
  )
}

export default function Sidebar() {
  const { view: canViewUsers } = usePermission('User Management')

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col"
      style={{ background: '#0c1528' }}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 60%, #7dd3fc 100%)' }}
      />

      {/* Logo */}
      <div className="flex h-[60px] flex-shrink-0 items-center gap-3 px-5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            boxShadow: '0 0 0 1px rgba(14,165,233,0.25), 0 2px 8px rgba(14,165,233,0.2)',
          }}
        >
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white">EliCloud</div>
          <div className="text-[10px] font-medium" style={{ color: '#475569' }}>
            Monitor
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        <p
          className="mb-1.5 px-5 text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: '#2d4a6b' }}
        >
          Infrastructure
        </p>
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>

        {canViewUsers && (
          <>
            <div className="mx-4 my-4 border-t" style={{ borderColor: '#1a2d44' }} />
            <p
              className="mb-1.5 px-5 text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: '#2d4a6b' }}
            >
              System
            </p>
            <ul className="space-y-0.5 px-3">
              {systemItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid #1a2d44' }}>
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <p className="text-[10px]" style={{ color: '#3d5a7a' }}>
            v1.0.0 · Read-only mode
          </p>
        </div>
      </div>
    </aside>
  )
}
