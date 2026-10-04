import { useEffect } from 'react'
import Icon from './Icon'

export function Row({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-all">{children}</dd>
    </div>
  )
}

export default function Drawer({ title, icon, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside role="dialog" aria-label={title} className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
          <Icon name={icon} className="text-brand-600" />
          <h2 className="min-w-0 flex-1 truncate font-semibold" title={title}>{title}</h2>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  )
}
