import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useApp } from '../context'

export default function UserLayout() {
  const { user, logout } = useApp()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <div className="rounded-md bg-brand-600 p-1 text-white">
              <Icon name="database" size={16} />
            </div>
            <span>RustFS</span>
          </div>

          <nav className="flex gap-1">
            <NavLink
              to="/portal/files"
              className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon name="folder_open" size={18} />
              <span className="hidden sm:inline">My Files</span>
            </NavLink>
            <NavLink
              to="/portal/upload"
              className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon name="upload_file" size={18} />
              <span className="hidden sm:inline">Upload</span>
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">
              {user?.full_name || user?.username}
            </span>
            <button className="btn-ghost py-1.5" onClick={handleLogout}>
              <Icon name="logout" size={18} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-2 py-8 sm:px-3">
        <Outlet />
      </main>
    </div>
  )
}
