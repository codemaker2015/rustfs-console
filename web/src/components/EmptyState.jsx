import Icon from './Icon'

export default function EmptyState({ icon, title, hint, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">
        <Icon name={icon} size={28} />
      </div>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
