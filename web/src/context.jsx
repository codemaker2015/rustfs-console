import { createContext, useCallback, useContext, useState } from 'react'
import Icon from './components/Icon'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [bucket, setBucketState] = useState(() => localStorage.getItem('bucket') || '')
  const [toasts, setToasts] = useState([])

  const setBucket = (name) => {
    setBucketState(name)
    if (name) localStorage.setItem('bucket', name)
    else localStorage.removeItem('bucket')
  }

  const notify = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <Ctx.Provider value={{ bucket, setBucket, notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`card flex items-start gap-2 px-3 py-2.5 text-sm shadow-lg ${t.type === 'error' ? 'border-red-200' : 'border-brand-100'}`}>
            <Icon name={t.type === 'error' ? 'error' : 'check_circle'} className={t.type === 'error' ? 'text-red-600' : 'text-brand-600'} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
