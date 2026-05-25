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
import Users from '@/pages/Users'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — redirects to /login if no valid token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="hosts" element={<Hosts />} />
            <Route path="storage" element={<Storage />} />
            <Route path="vms" element={<VMs />} />
            <Route path="projects" element={<Projects />} />
            <Route path="resource-groups" element={<ResourceGroups />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
