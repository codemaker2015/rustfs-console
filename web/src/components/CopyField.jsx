import { useApp } from '../context'
import Icon from './Icon'

export default function CopyField({ label, value }) {
  const { notify } = useApp()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      notify(`${label} copied`)
    } catch {
      notify('Copy failed. Select the text and copy it manually.', 'error')
    }
  }
  return (
    <div>
      <p className="mb-1 text-sm text-slate-500">{label}</p>
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 pl-3">
        <code className="min-w-0 flex-1 truncate py-2 text-xs" title={value}>{value}</code>
        <button className="btn-ghost p-2" onClick={copy} aria-label={`Copy ${label}`}><Icon name="content_copy" size={16} /></button>
      </div>
    </div>
  )
}
