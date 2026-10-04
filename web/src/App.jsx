import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './context'
import LoginPage from './pages/LoginPage'
import AdminLayout from './components/AdminLayout'
import UserLayout from './components/UserLayout'
import Dashboard from './components/Dashboard'
import BucketManager from './components/BucketManager'
import ObjectBrowser from './components/ObjectBrowser'
import UploadCenter from './components/UploadCenter'
import UserManager from './components/UserManager'
import SettingsPage from './components/SettingsPage'
import UserFiles from './components/UserFiles'
import UserUpload from './components/UserUpload'

function RequireAuth({ children, adminOnly }) {
  const { user, authLoading } = useApp()
  const location = useLocation()

  if (authLoading) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/portal/files" replace />
  }
  // Admins always use the admin panel, never the user portal
  if (!adminOnly && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return children
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  )
}

export default function App() {
  const { user, authLoading } = useApp()

  if (authLoading) return <Spinner />

  const defaultDest = user
    ? (user.role === 'admin' ? '/admin/dashboard' : '/portal/files')
    : '/login'

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to={defaultDest} replace /> : <LoginPage />}
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <RequireAuth adminOnly>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="buckets"   element={<BucketManager />} />
        <Route path="objects"   element={<ObjectBrowser />} />
        <Route path="upload"    element={<UploadCenter />} />
        <Route path="users"     element={<UserManager />} />
        <Route path="settings"  element={<SettingsPage />} />
      </Route>

      {/* User portal */}
      <Route
        path="/portal"
        element={
          <RequireAuth>
            <UserLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="files" replace />} />
        <Route path="files"  element={<UserFiles />} />
        <Route path="upload" element={<UserUpload />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={defaultDest} replace />} />
      <Route path="*" element={<Navigate to={defaultDest} replace />} />
    </Routes>
  )
}
