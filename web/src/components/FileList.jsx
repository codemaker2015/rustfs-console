import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import BucketDetails from './BucketDetails'
import BucketSelect from './BucketSelect'
import ConfirmDialog from './ConfirmDialog'
import FileDetails from './FileDetails'
import EmptyState from './EmptyState'
import Icon from './Icon'
import PageHeader from './PageHeader'

const iconFor = (key) => {
  const ext = key.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['pdf'].includes(ext)) return 'picture_as_pdf'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'table_chart'
  if (['json', 'xml', 'yaml', 'yml', 'js', 'py'].includes(ext)) return 'code'
  if (['zip', 'tar', 'gz'].includes(ext)) return 'folder_zip'
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'movie'
  if (['mp3', 'wav'].includes(ext)) return 'audio_file'
  return 'description'
}

export default function FileList() {
  const { bucket, notify } = useApp()
  const [files, setFiles] = useState(null)
  const [filter, setFilter] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showBucket, setShowBucket] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!bucket) return setFiles(null)
    setFiles(null)
    api.listObjects(bucket).then(setFiles).catch((e) => { setFiles([]); notify(e.message, 'error') })
  }, [bucket, notify])

  useEffect(load, [load])

  const visible = useMemo(
    () => (files || []).filter((f) => f.key.toLowerCase().includes(filter.toLowerCase())),
    [files, filter],
  )

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteObject(bucket, toDelete)
      notify('File deleted')
      setSelected(null)
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
      <PageHeader title="Files" subtitle="Browse, download and delete the files in a bucket.">
        <div className="flex w-full gap-2 sm:w-auto">
          <BucketSelect className="sm:w-56" />
          <button className="btn-ghost border border-slate-300 bg-white" onClick={() => setShowBucket(true)} disabled={!bucket} aria-label="Bucket details">
            <Icon name="info" size={18} />
          </button>
          <button className="btn-ghost border border-slate-300 bg-white" onClick={load} disabled={!bucket} aria-label="Refresh">
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </PageHeader>

      <div className="card overflow-hidden">
        {!bucket ? (
          <EmptyState icon="inventory_2" title="Select a bucket" hint="Choose a bucket above to see its files." />
        ) : files === null ? (
          <p className="p-6 text-sm text-slate-500">Loading files…</p>
        ) : (
          <>
            <div className="relative border-b border-slate-200 p-3">
              <Icon name="search" size={18} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Filter by name or prefix" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            {visible.length === 0 ? (
              <EmptyState icon="draft" title={files.length ? 'No files match your filter' : 'This bucket is empty'} hint={files.length ? undefined : 'Upload files to see them here.'}>
                {!files.length && <Link to="/upload" className="btn-primary"><Icon name="upload_file" size={18} /> Upload files</Link>}
              </EmptyState>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Last modified</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((f) => (
                    <tr key={f.key} className="hover:bg-slate-50">
                      <td className="max-w-xs px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Icon name={iconFor(f.key)} className="shrink-0 text-slate-400" />
                          <button className="truncate text-left hover:text-brand-700 hover:underline" title={f.key} onClick={() => setSelected(f.key)}>{f.key}</button>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatSize(f.size)}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 md:table-cell">{formatDate(f.modified)}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="btn-ghost" onClick={() => setSelected(f.key)} aria-label={`View ${f.key}`}><Icon name="visibility" size={18} /></button>
                          <a className="btn-ghost" href={api.downloadUrl(bucket, f.key)} aria-label={`Download ${f.key}`}><Icon name="download" size={18} /></a>
                          <button className="btn-danger" onClick={() => setToDelete(f.key)} aria-label={`Delete ${f.key}`}><Icon name="delete" size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {selected && <FileDetails bucket={bucket} fileKey={selected} onClose={() => setSelected(null)} onDelete={setToDelete} />}
      {showBucket && <BucketDetails name={bucket} onClose={() => setShowBucket(false)} />}

      {toDelete && (
        <ConfirmDialog title="Delete file?" message={`“${toDelete}” will be permanently removed from ${bucket}.`} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
      )}
    </>
  )
}
