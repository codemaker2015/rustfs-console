import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import Icon from './Icon'
import StatCard from './StatCard'
import PageHeader from './PageHeader'

export default function Dashboard() {
  const { user, notify } = useApp()
  const [info, setInfo] = useState(null)
  const [buckets, setBuckets] = useState(null)
  const [userCount, setUserCount] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [infoData, bucketsData, usersData] = await Promise.all([
        api.serverInfo(),
        api.listBuckets(),
        api.listUsers(),
      ])
      setInfo(infoData)
      setBuckets(bucketsData)
      setUserCount(usersData.length)
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.full_name || user?.username}`}
        subtitle="Here's an overview of your RustFS deployment."
      >
        <button className="btn-ghost border border-slate-300 bg-white" onClick={load} disabled={loading}>
          <Icon name="refresh" size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="inventory_2" label="Buckets" value={info?.bucket_count ?? 0} loading={loading} />
        <StatCard icon="description" label="Objects" value={info?.total_objects?.toLocaleString() ?? 0} loading={loading} />
        <StatCard
          icon="storage"
          label="Total Storage"
          value={info ? formatSize(info.total_size) : '0 B'}
          sub={info?.error ? 'Error loading stats' : undefined}
          loading={loading}
        />
        <StatCard icon="group" label="Users" value={userCount ?? 0} loading={loading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Recent Buckets */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Buckets</h2>
            <Link to="/admin/buckets" className="btn-ghost py-1 text-xs">
              View all <Icon name="chevron_right" size={16} />
            </Link>
          </div>
          <div className="card overflow-hidden">
            {buckets === null || loading ? (
              <div className="divide-y divide-slate-100">
                {[0,1,2].map(i => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : buckets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
                <Icon name="inventory_2" size={32} className="text-slate-300" />
                No buckets yet
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="hidden px-4 py-2.5 sm:table-cell">Created</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(buckets || []).slice(0, 8).map((b) => (
                    <tr key={b.name} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Icon name="inventory_2" className="text-brand-600" size={16} />
                          <span className="font-medium">{b.name}</span>
                        </span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-slate-400 sm:table-cell">
                        {formatDate(b.created)}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          to="/admin/objects"
                          state={{ bucket: b.name }}
                          className="btn-ghost py-1 text-xs"
                        >
                          <Icon name="folder_open" size={14} /> Browse
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Quick actions</h2>
          <div className="space-y-2">
            {[
              { to: '/admin/buckets', icon: 'add_circle', label: 'Create a bucket', desc: 'Set up a new storage container' },
              { to: '/admin/upload',  icon: 'upload_file', label: 'Upload files',    desc: 'Add files to a bucket' },
              { to: '/admin/users',  icon: 'person_add',  label: 'Add a user',      desc: 'Grant access to the console' },
              { to: '/admin/objects',icon: 'folder_open', label: 'Browse objects',  desc: 'View and manage your files' },
            ].map(({ to, icon, label, desc }) => (
              <Link key={to} to={to} className="card flex items-center gap-3 p-3.5 hover:border-brand-200 hover:bg-brand-50 transition-colors">
                <div className="rounded-lg bg-brand-50 p-2">
                  <Icon name={icon} className="text-brand-600" size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
                <Icon name="chevron_right" size={16} className="ml-auto text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Server info footer */}
      {info && (
        <div className="mt-6 flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Icon name="cloud" size={15} className="text-slate-400" />
            Endpoint: <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{info.endpoint}</code>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="location_on" size={15} className="text-slate-400" />
            Region: <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{info.region}</code>
          </span>
        </div>
      )}
    </>
  )
}
