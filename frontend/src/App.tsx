import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Hosts from '@/pages/Hosts'
import Storage from '@/pages/Storage'
import VMs from '@/pages/VMs'
import Projects from '@/pages/Projects'
import ResourceGroups from '@/pages/ResourceGroups'
import Reports from '@/pages/Reports'
import DiskHealth from '@/pages/DiskHealth'
import Users from '@/pages/Users'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Redirects project/resource_group scoped users to /vms
function GlobalRoute({ element }: { element: React.ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()
  if (isLoading) return null
  const isScoped = user?.scope_type === 'project' || user?.scope_type === 'resource_group'
  if (isScoped) return <Navigate to="/vms" replace />
  return <>{element}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — redirects to /login if no valid token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<GlobalRoute element={<Dashboard />} />} />
            <Route path="hosts" element={<GlobalRoute element={<Hosts />} />} />
            <Route path="storage" element={<GlobalRoute element={<Storage />} />} />
            <Route path="vms" element={<VMs />} />
            <Route path="projects" element={<GlobalRoute element={<Projects />} />} />
            <Route path="resource-groups" element={<GlobalRoute element={<ResourceGroups />} />} />
            <Route path="reports" element={<GlobalRoute element={<Reports />} />} />
            <Route path="disk-health" element={<GlobalRoute element={<DiskHealth />} />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
