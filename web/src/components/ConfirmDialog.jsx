import { useEffect } from 'react'
import Icon from './Icon'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" className="card w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-3">
          <div className="h-fit rounded-full bg-red-50 p-2 text-red-600"><Icon name="delete" /></div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 break-all text-sm text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
