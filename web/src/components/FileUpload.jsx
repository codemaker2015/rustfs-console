import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatSize, uid } from '../api'
import { useApp } from '../context'
import BucketSelect from './BucketSelect'
import Icon from './Icon'
import PageHeader from './PageHeader'

const STATUS = {
  pending: { icon: 'schedule', cls: 'text-slate-400' },
  uploading: { icon: 'progress_activity', cls: 'text-brand-600 animate-spin' },
  done: { icon: 'check_circle', cls: 'text-brand-600' },
  error: { icon: 'error', cls: 'text-red-600' },
}

export default function FileUpload() {
  const { bucket, notify } = useApp()
  const inputRef = useRef(null)
  const [items, setItems] = useState([])
  const [prefix, setPrefix] = useState('')
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)

  const add = (fileList) =>
    setItems((cur) => [...cur, ...Array.from(fileList).map((file) => ({ id: uid(), file, status: 'pending', error: '' }))])

  const patch = (id, change) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...change } : i)))

  const upload = async () => {
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
    if (ok) notify(`Uploaded ${ok} file${ok > 1 ? 's' : ''} to ${bucket}`)
  }

  const pending = items.filter((i) => i.status !== 'done').length

  return (
    <>
      <PageHeader title="Upload" subtitle="Add one or more files to a bucket. Use a prefix to place them in a folder." />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Bucket<div className="mt-1.5"><BucketSelect /></div></label>
        <label className="block text-sm font-medium">
          Folder prefix <span className="font-normal text-slate-500">(optional)</span>
          <input className="input mt-1.5" placeholder="documents/2026" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </label>
      </div>

      <div
        className={`mt-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files) }}
        role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current.click()}
      >
        <Icon name="cloud_upload" size={40} className="text-brand-600" />
        <p className="mt-2 font-medium">Drag files here or click to browse</p>
        <p className="text-sm text-slate-500">Any file type, multiple files supported</p>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>

      {items.length > 0 && (
        <div className="card mt-4 divide-y divide-slate-100">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Icon name={STATUS[i.status].icon} className={STATUS[i.status].cls} />
              <div className="min-w-0 flex-1">
                <p className="truncate">{i.file.name}</p>
                {i.error && <p className="text-xs text-red-600">{i.error}</p>}
              </div>
              <span className="text-slate-500">{formatSize(i.file.size)}</span>
              <button className="btn-ghost p-1.5" disabled={running && i.status === 'uploading'} onClick={() => setItems((c) => c.filter((x) => x.id !== i.id))} aria-label={`Remove ${i.file.name}`}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {items.length > 0 && items.every((i) => i.status === 'done') && (
          <Link to="/files" className="btn-ghost">View files</Link>
        )}
        <button className="btn-primary" onClick={upload} disabled={!bucket || !pending || running}>
          <Icon name="upload" size={18} />
          {running ? 'Uploading…' : `Upload${pending ? ` ${pending} file${pending > 1 ? 's' : ''}` : ''}`}
        </button>
      </div>
    </>
  )
}
