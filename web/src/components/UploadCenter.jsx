import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatSize, uid } from '../api'
import { useApp } from '../context'
import BucketSelect from './BucketSelect'
import Icon from './Icon'
import PageHeader from './PageHeader'

const STATUS = {
  pending:   { icon: 'schedule',           cls: 'text-slate-400' },
  uploading: { icon: 'progress_activity',  cls: 'text-brand-600 animate-spin' },
  done:      { icon: 'check_circle',       cls: 'text-emerald-600' },
  error:     { icon: 'error',              cls: 'text-red-600' },
}

export default function UploadCenter() {
  const { bucket, notify } = useApp()
  const [items, setItems] = useState([])
  const [prefix, setPrefix] = useState('')
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)

  const add = (files) =>
    setItems((cur) => [
      ...cur,
      ...files.map((file) => ({ id: uid(), file, status: 'pending', error: '' })),
    ])

  const patch = (id, change) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...change } : i)))

  const upload = async () => {
    if (!bucket) { notify('Select a bucket first', 'error'); return }
    setRunning(true)
    let ok = 0
    for (const item of items.filter((i) => i.status !== 'done')) {
      patch(item.id, { status: 'uploading', error: '' })
      try {
        await api.uploadObject(bucket, item.file, prefix)
        patch(item.id, { status: 'done' })
        ok++
      } catch (e) {
        patch(item.id, { status: 'error', error: e.message })
      }
    }
    setRunning(false)
    if (ok) notify(`Uploaded ${ok} file${ok > 1 ? 's' : ''} to "${bucket}"`)
  }

  const removeItem = (id) => setItems((c) => c.filter((x) => x.id !== id))
  const clearDone = () => setItems((c) => c.filter((x) => x.status !== 'done'))

  const pending = items.filter((i) => i.status !== 'done').length
  const allDone = items.length > 0 && items.every((i) => i.status === 'done')

  return (
    <>
      <PageHeader title="Upload" subtitle="Add files to a bucket. Use a prefix to place them inside a folder." />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Bucket
          <div className="mt-1.5"><BucketSelect /></div>
        </label>
        <label className="block text-sm font-medium">
          Folder prefix <span className="font-normal text-slate-400">(optional)</span>
          <input
            className="input mt-1.5"
            placeholder="images/2026"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </label>
      </div>

      {/* Drop zone */}
      <input
        id="admin-upload-input"
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files)
          e.target.value = ''
          if (files.length) add(files)
        }}
      />
      <label
        htmlFor="admin-upload-input"
        className={`mt-5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(Array.from(e.dataTransfer.files)) }}
      >
        <div className="rounded-xl bg-brand-50 p-4">
          <Icon name="cloud_upload" size={36} className="text-brand-600" />
        </div>
        <p className="mt-3 font-medium">Drag & drop files here, or click to browse</p>
        <p className="mt-1 text-sm text-slate-400">Any file type · Multiple files supported</p>
      </label>

      {/* File queue */}
      {items.length > 0 && (
        <div className="card mt-4 divide-y divide-slate-100 overflow-hidden">
          {/* Queue header */}
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500">
            <span>{items.length} file{items.length !== 1 ? 's' : ''} queued</span>
            {allDone && (
              <button className="btn-ghost py-1 text-xs" onClick={clearDone}>
                <Icon name="clear_all" size={14} /> Clear done
              </button>
            )}
          </div>
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Icon name={STATUS[item.status].icon} className={`shrink-0 ${STATUS[item.status].cls}`} size={18} />
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.file.name}</p>
                {item.error && <p className="text-xs text-red-600">{item.error}</p>}
              </div>
              <span className="shrink-0 text-slate-400">{formatSize(item.file.size)}</span>
              <button
                className="btn-ghost shrink-0 p-1"
                disabled={running && item.status === 'uploading'}
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.file.name}`}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        {allDone && (
          <Link to="/admin/objects" className="btn-ghost">
            <Icon name="folder_open" size={18} /> View objects
          </Link>
        )}
        {items.length > 0 && (
          <button className="btn-ghost border border-slate-300" onClick={() => setItems([])} disabled={running}>
            <Icon name="clear_all" size={18} /> Clear all
          </button>
        )}
        <button
          className="btn-primary"
          onClick={upload}
          disabled={!bucket || !pending || running}
        >
          {running
            ? <><Icon name="progress_activity" size={18} className="animate-spin" /> Uploading…</>
            : <><Icon name="upload" size={18} /> Upload{pending ? ` ${pending} file${pending > 1 ? 's' : ''}` : ''}</>}
        </button>
      </div>
    </>
  )
}
