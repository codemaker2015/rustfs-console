import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import ConfirmDialog from './ConfirmDialog'
import Icon from './Icon'
import Modal from './Modal'
import PageHeader from './PageHeader'

function bucketNameError(name) {
  if (name.length < 3) return 'At least 3 characters required.'
  if (name.length > 63) return 'Maximum 63 characters.'
  if (!/^[a-z0-9]/.test(name)) return 'Must start with a lowercase letter or number.'
  if (!/[a-z0-9]$/.test(name)) return 'Must end with a lowercase letter or number.'
  if (!/^[a-z0-9-]+$/.test(name)) return 'Only lowercase letters, numbers, and hyphens allowed.'
  if (/--/.test(name)) return 'Cannot contain consecutive hyphens.'
  return ''
}

function CreateBucketModal({ onCreated, onClose }) {
  const { notify } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  const error = trimmed ? bucketNameError(trimmed) : ''
  const canSubmit = trimmed && !error

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      await api.createBucket(trimmed)
      notify(`Bucket "${trimmed}" created`)
      onCreated()
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create bucket" onClose={onClose} size="sm"
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !canSubmit}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </>}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Bucket name</label>
          <input
            className={`input mt-1 ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="my-bucket"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            autoFocus
          />
          {error
            ? <p className="mt-1 text-xs text-red-600">{error}</p>
            : <p className="mt-1 text-xs text-slate-400">3–63 chars · lowercase letters, numbers, hyphens · no leading/trailing hyphens</p>
          }
        </div>
      </form>
    </Modal>
  )
}

function BucketSettingsModal({ bucket, onClose }) {
  const { notify } = useApp()
  const [versioning, setVersioning] = useState(null)
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    Promise.all([api.getVersioning(bucket), api.getPolicy(bucket)])
      .then(([v, p]) => { setVersioning(v); setPolicy(p) })
      .catch((e) => notify(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [bucket, notify])

  const toggleVersioning = async () => {
    setSaving('versioning')
    try {
      const enabled = versioning.status !== 'Enabled'
      const result = await api.setVersioning(bucket, enabled)
      setVersioning(result)
      notify(`Versioning ${result.status.toLowerCase()} for "${bucket}"`)
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  const togglePolicy = async () => {
    setSaving('policy')
    try {
      const result = await api.setPolicy(bucket, !policy.public)
      setPolicy(result)
      notify(`"${bucket}" is now ${result.public ? 'public' : 'private'}`)
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal title={`Settings — ${bucket}`} onClose={onClose}
      footer={<button className="btn-primary" onClick={onClose}>Done</button>}
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Versioning */}
          <div className="flex items-start justify-between rounded-lg border border-slate-200 p-4">
            <div>
              <p className="font-medium">Versioning</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Keep multiple versions of each object. Cannot be fully disabled once enabled.
              </p>
              <span className={`mt-2 inline-block badge ${versioning?.status === 'Enabled' ? 'badge-green' : 'badge-slate'}`}>
                {versioning?.status || 'Disabled'}
              </span>
            </div>
            <button
              className={`btn ${versioning?.status === 'Enabled' ? 'btn-ghost border border-slate-300' : 'btn-primary'}`}
              onClick={toggleVersioning}
              disabled={saving === 'versioning'}
            >
              {saving === 'versioning' ? 'Saving…' : versioning?.status === 'Enabled' ? 'Suspend' : 'Enable'}
            </button>
          </div>

          {/* Public access */}
          <div className="flex items-start justify-between rounded-lg border border-slate-200 p-4">
            <div>
              <p className="font-medium">Public read access</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Allow anonymous read access to all objects in this bucket.
              </p>
              <span className={`mt-2 inline-block badge ${policy?.public ? 'badge-yellow' : 'badge-green'}`}>
                {policy?.public ? 'Public' : 'Private'}
              </span>
            </div>
            <button
              className={`btn ${policy?.public ? 'btn-danger' : 'btn-ghost border border-slate-300'}`}
              onClick={togglePolicy}
              disabled={saving === 'policy'}
            >
              {saving === 'policy' ? 'Saving…' : policy?.public ? 'Make private' : 'Make public'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function BucketManager() {
  const { notify } = useApp()
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [settings, setSettings] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.listBuckets()
      .then(setBuckets)
      .catch((e) => { setBuckets([]); notify(e.message, 'error') })
  }, [notify])

  useEffect(load, [load])

  const openObjects = (name) => navigate('/admin/objects', { state: { bucket: name } })

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteBucket(toDelete)
      notify(`Deleted "${toDelete}"`)
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
      <PageHeader
        title="Buckets"
        subtitle="Containers that hold your objects. A bucket must be empty before deletion."
      >
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} /> New bucket
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        {buckets === null ? (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : buckets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
            <Icon name="inventory_2" size={40} className="text-slate-300" />
            <p className="font-medium">No buckets yet</p>
            <p className="text-sm">Create your first bucket to start storing objects.</p>
            <button className="btn-primary mt-1" onClick={() => setShowCreate(true)}>
              <Icon name="add" size={18} /> New bucket
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="hidden px-4 py-3 sm:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b) => (
                <tr key={b.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Icon name="inventory_2" className="shrink-0 text-brand-600" size={18} />
                      <button
                        className="font-medium hover:text-brand-700 hover:underline"
                        onClick={() => openObjects(b.name)}
                      >
                        {b.name}
                      </button>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                    {formatDate(b.created)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost py-1.5 text-xs" onClick={() => openObjects(b.name)}>
                        <Icon name="folder_open" size={16} /> Browse
                      </button>
                      <button className="btn-ghost py-1.5 text-xs" onClick={() => setSettings(b.name)}>
                        <Icon name="settings" size={16} /> Settings
                      </button>
                      <button className="btn-danger py-1.5" onClick={() => setToDelete(b.name)} aria-label="Delete">
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateBucketModal onCreated={load} onClose={() => setShowCreate(false)} />}
      {settings && <BucketSettingsModal bucket={settings} onClose={() => setSettings(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete bucket?"
          message={`"${toDelete}" will be permanently removed. This cannot be undone.`}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
