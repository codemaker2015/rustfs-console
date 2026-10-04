import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useApp } from '../context'
import Icon from '../components/Icon'

export default function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!username || !password) { setError('Enter your username and password.'); return }
    setLoading(true)
    setError('')
    try {
      const { token, user } = await api.login(username, password)
      login(token, user)
      const isAdmin = user.role === 'admin'
      // Ignore `from` if it points to the wrong portal for this role
      const fromIsUserPortal = from?.startsWith('/portal')
      const fromIsAdminPortal = from?.startsWith('/admin')
      const dest = (isAdmin && fromIsUserPortal) || (!isAdmin && fromIsAdminPortal)
        ? (isAdmin ? '/admin/dashboard' : '/portal/files')
        : from || (isAdmin ? '/admin/dashboard' : '/portal/files')
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="rounded-xl bg-brand-600 p-3 text-white">
            <Icon name="database" size={32} />
          </div>
          <h1 className="text-2xl font-semibold">RustFS Console</h1>
          <p className="text-sm text-slate-500">Sign in to manage your object storage</p>
        </div>

        <div className="card p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input
                className="input mt-1"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                className="input mt-1"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                <Icon name="error" size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading
                ? <><Icon name="progress_activity" size={18} className="animate-spin" /> Signing in…</>
                : <><Icon name="login" size={18} /> Sign in</>}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Default credentials: <code className="rounded bg-slate-100 px-1 py-0.5">admin / admin123</code>
        </p>
      </div>
    </div>
  )
}
