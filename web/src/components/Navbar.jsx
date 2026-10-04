import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import { useApp } from '../context'

const links = [
  { to: '/buckets', label: 'Buckets', icon: 'inventory_2' },
  { to: '/files', label: 'Files', icon: 'folder_open' },
  { to: '/upload', label: 'Upload', icon: 'upload_file' },
]

export default function Navbar() {
  const { bucket } = useApp()
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Icon name="database" className="text-brand-600" size={24} />
          <span>RustFS Console</span>
        </div>
        <nav className="flex gap-1">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `btn ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <Icon name={icon} size={18} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-sm text-slate-600 sm:flex">
          <Icon name="inventory_2" size={16} />
          {bucket || 'No bucket selected'}
        </div>
      </div>
    </header>
  )
}
