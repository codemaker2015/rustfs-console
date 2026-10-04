import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useApp } from '../context'

const NAV = [
  { section: 'Overview', links: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  ]},
  { section: 'Storage', links: [
    { to: '/admin/buckets',  label: 'Buckets',  icon: 'inventory_2' },
    { to: '/admin/objects',  label: 'Objects',  icon: 'folder_open' },
    { to: '/admin/upload',   label: 'Upload',   icon: 'upload_file' },
  ]},
  { section: 'Administration', links: [
    { to: '/admin/users',    label: 'Users',    icon: 'group' },
    { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  ]},
]

export default function AdminLayout() {
  const { user, logout } = useApp()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
          <div className="rounded-lg bg-brand-600 p-1.5 text-white">
            <Icon name="database" size={18} />
          </div>
          <span className="font-semibold">RustFS Console</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map(({ section, links }) => (
            <div key={section}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section}
              </p>
              {links.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
                  }
                >
                  <Icon name={icon} size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-slate-200 p-3 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {(user?.full_name || user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.full_name || user?.username}</p>
              <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button className="sidebar-link-inactive w-full" onClick={handleLogout}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
