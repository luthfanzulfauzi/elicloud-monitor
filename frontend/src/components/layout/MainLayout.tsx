import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/hosts': 'Hosts',
  '/storage': 'Storage',
  '/vms': 'Virtual Machines',
  '/projects': 'Projects',
  '/resource-groups': 'Resource Groups',
  '/reports': 'Reports',
}

export default function MainLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'EliCloud Monitor'

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden pl-60">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
