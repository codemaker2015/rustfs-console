import { useEffect, useState } from 'react'
import { api, formatSize } from '../api'
import { useApp } from '../context'
import Icon from './Icon'
import PageHeader from './PageHeader'

export default function SettingsPage() {
  const { user, notify } = useApp()
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    api.serverInfo()
      .then(setInfo)
      .catch((e) => notify(e.message, 'error'))
      .finally(() => setInfoLoading(false))
  }, [notify])

  const changePassword = async (e) => {
    e.preventDefault()
    if (next !== confirm) { notify('Passwords do not match', 'error'); return }
    if (next.length < 8) { notify('Password must be at least 8 characters', 'error'); return }
    setPwBusy(true)
    try {
      await api.changePassword(current, next)
      notify('Password changed successfully')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Server configuration and account preferences." />

      <div className="max-w-2xl space-y-6">
        {/* Server info */}
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Server information</h2>
          {infoLoading ? (
            <div className="space-y-3">
              {[0,1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}
            </div>
          ) : (
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                { label: 'Endpoint',       value: info?.endpoint },
                { label: 'Region',         value: info?.region },
                { label: 'Buckets',        value: info?.bucket_count },
                { label: 'Total objects',  value: info?.total_objects?.toLocaleString() },
                { label: 'Total storage',  value: info ? formatSize(info.total_size) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4 py-2.5">
                  <dt className="w-36 shrink-0 text-slate-500">{label}</dt>
                  <dd className="font-medium">{value ?? '—'}</dd>
                </div>
              ))}
              {info?.error && (
                <div className="flex items-center gap-2 py-2.5 text-amber-600">
                  <Icon name="warning" size={16} />
                  <span className="text-xs">Could not collect full stats: {info.error}</span>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* My account */}
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">My account</h2>
          <p className="mb-4 text-sm text-slate-500">Signed in as <strong>{user?.username}</strong> ({user?.role})</p>

          <h3 className="mb-3 text-sm font-medium">Change password</h3>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-600">Current password</label>
              <input className="input mt-1 max-w-sm" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">New password</label>
              <input className="input mt-1 max-w-sm" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="min. 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">Confirm new password</label>
              <input className="input mt-1 max-w-sm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="btn-primary"
                disabled={pwBusy || !current || !next || !confirm}
              >
                {pwBusy ? 'Saving…' : 'Update password'}
              </button>
              {(current || next || confirm) && (
                <button type="button" className="btn-ghost" onClick={() => { setCurrent(''); setNext(''); setConfirm('') }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Environment info */}
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Environment variables</h2>
          <p className="mb-3 text-sm text-slate-500">
            Configure these in your <code className="rounded bg-slate-100 px-1">.env</code> file or Docker Compose environment.
          </p>
          <div className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs">
            <pre className="text-slate-300">{`RUSTFS_ENDPOINT=http://localhost:9000
RUSTFS_PUBLIC_ENDPOINT=http://localhost:9000
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=your-secret-key
RUSTFS_REGION=us-east-1
JWT_SECRET=your-jwt-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password`}</pre>
          </div>
        </section>
      </div>
    </>
  )
}
