import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { uid } from './api'
import Icon from './components/Icon'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })
  const [authLoading, setAuthLoading] = useState(true)
  const [bucket, setBucketState] = useState(() => localStorage.getItem('bucket') || '')
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setAuthLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u)
          localStorage.setItem('user', JSON.stringify(u))
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('bucket')
    setUser(null)
    setBucketState('')
  }

  const setBucket = (name) => {
    setBucketState(name)
    if (name) localStorage.setItem('bucket', name)
    else localStorage.removeItem('bucket')
  }

  const notify = useCallback((message, type = 'success') => {
    const id = uid()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <Ctx.Provider value={{
      user, authLoading, login, logout,
      isAdmin: user?.role === 'admin',
      bucket, setBucket,
      notify,
    }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card flex items-start gap-2 px-3 py-2.5 text-sm shadow-lg ${
              t.type === 'error' ? 'border-red-200' : 'border-brand-100'
            }`}
          >
            <Icon
              name={t.type === 'error' ? 'error' : 'check_circle'}
              className={t.type === 'error' ? 'text-red-600' : 'text-brand-600'}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
