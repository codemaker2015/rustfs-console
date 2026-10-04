import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatDate } from '../api'
import { useApp } from '../context'
import BucketDetails from './BucketDetails'
import ConfirmDialog from './ConfirmDialog'
import CreateBucket from './CreateBucket'
import EmptyState from './EmptyState'
import Icon from './Icon'
import PageHeader from './PageHeader'

export default function BucketList() {
  const { bucket, setBucket, notify } = useApp()
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [details, setDetails] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.listBuckets().then(setBuckets).catch((e) => { setBuckets([]); notify(e.message, 'error') })
  }, [notify])

  useEffect(load, [load])

  const open = (name) => { setBucket(name); navigate('/files') }

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteBucket(toDelete)
      if (bucket === toDelete) setBucket('')
      notify(`Deleted bucket ${toDelete}`)
      load()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <PageHeader title="Buckets" subtitle="Containers that hold your files. A bucket must be empty before it can be deleted.">
        <CreateBucket onCreated={load} />
      </PageHeader>

      <div className="card overflow-hidden">
        {buckets === null ? (
          <p className="p-6 text-sm text-slate-500">Loading buckets…</p>
        ) : buckets.length === 0 ? (
          <EmptyState icon="inventory_2" title="No buckets yet" hint="Create your first bucket above to start storing files." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b) => (
                <tr key={b.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon name="inventory_2" className="text-brand-600" />
                      {b.name}
                      {b.name === bucket && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">Selected</span>}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{formatDate(b.created)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost" onClick={() => setDetails(b)}><Icon name="info" size={18} /> Details</button>
                      <button className="btn-ghost" onClick={() => open(b.name)}><Icon name="folder_open" size={18} /> Open</button>
                      <button className="btn-danger" onClick={() => setToDelete(b.name)} aria-label={`Delete ${b.name}`}><Icon name="delete" size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {details && <BucketDetails name={details.name} created={details.created} onClose={() => setDetails(null)} />}

      {toDelete && (
        <ConfirmDialog title="Delete bucket?" message={`“${toDelete}” will be permanently removed.`} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
      )}
    </>
  )
}
