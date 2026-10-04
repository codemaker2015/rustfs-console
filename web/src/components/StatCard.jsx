import Icon from './Icon'

export default function StatCard({ icon, label, value, sub, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-brand-50 p-3">
          <Icon name={icon} className="text-brand-600" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{label}</p>
          {loading
            ? <div className="mt-1 h-7 w-24 animate-pulse rounded bg-slate-200" />
            : <p className="mt-0.5 text-2xl font-semibold leading-none">{value}</p>}
          {sub && !loading && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}
