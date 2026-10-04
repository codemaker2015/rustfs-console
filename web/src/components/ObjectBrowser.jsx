import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import BucketSelect from './BucketSelect'
import ConfirmDialog from './ConfirmDialog'
import FileDetails from './FileDetails'
import Icon from './Icon'
import Modal from './Modal'
import PageHeader from './PageHeader'

const FILE_ICON = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  pdf: 'picture_as_pdf',
  csv: 'table_chart', xlsx: 'table_chart', xls: 'table_chart',
  json: 'code', xml: 'code', yaml: 'code', yml: 'code', js: 'code', py: 'code', ts: 'code',
  zip: 'folder_zip', tar: 'folder_zip', gz: 'folder_zip',
  mp4: 'movie', mov: 'movie', webm: 'movie',
  mp3: 'audio_file', wav: 'audio_file',
}
const iconFor = (key) => FILE_ICON[key.split('.').pop()?.toLowerCase()] || 'description'

function simulateFolders(allFiles, prefix) {
  const folderKeys = new Set()
  const direct = []
  for (const file of allFiles) {
    if (!file.key.startsWith(prefix)) continue
    if (file.key === prefix) continue
    const rel = file.key.slice(prefix.length)
    if (!rel) continue
    const slash = rel.indexOf('/')
    if (slash === -1) direct.push(file)
    else folderKeys.add(prefix + rel.slice(0, slash + 1))
  }
  return {
    files: direct,
    folders: [...folderKeys].map((key) => ({ key, size: 0, modified: '', type: 'folder' })),
  }
}

function Breadcrumb({ prefix, onNavigate }) {
  const parts = prefix ? prefix.split('/').filter(Boolean) : []
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Folder navigation">
      <button
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 ${!prefix ? 'font-medium text-brand-700' : 'text-slate-500'}`}
        onClick={() => onNavigate('')}
      >
        <Icon name="inventory_2" size={14} className="text-brand-600" />
        Root
      </button>
      {parts.map((part, i) => {
        const path = parts.slice(0, i + 1).join('/') + '/'
        return (
          <span key={path} className="flex items-center gap-1">
            <Icon name="chevron_right" size={14} className="text-slate-400" />
            <button
              className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${i === parts.length - 1 ? 'font-medium text-brand-700' : 'text-slate-500'}`}
              onClick={() => onNavigate(path)}
            >
              {part}
            </button>
          </span>
        )
      })}
    </nav>
  )
}

function CreateFolderModal({ bucket, prefix, onCreated, onClose }) {
  const { notify } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.createFolder(bucket, prefix + name.trim())
      notify(`Folder "${name.trim()}" created`)
      onCreated()
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create folder" onClose={onClose} size="sm"
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </>}
    >
      <form onSubmit={submit}>
        <label className="block text-sm font-medium">Folder name</label>
        <input
          className="input mt-1"
          placeholder="my-folder"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {prefix && <p className="mt-1 text-xs text-slate-400">Will be created at: {prefix}{name}/</p>}
      </form>
    </Modal>
  )
}

function CopyObjectModal({ bucket, sourceKey, onCopied, onClose }) {
  const { notify } = useApp()
  const [destKey, setDestKey] = useState(sourceKey)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!destKey.trim() || destKey === sourceKey) return
    setBusy(true)
    try {
      await api.copyObject(bucket, sourceKey, destKey.trim())
      notify(`Copied to "${destKey.trim()}"`)
      onCopied()
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Copy object" onClose={onClose} size="sm"
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !destKey.trim() || destKey === sourceKey}>
          {busy ? 'Copying…' : 'Copy'}
        </button>
      </>}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-500">Source</label>
          <p className="mt-1 truncate rounded bg-slate-50 px-3 py-2 text-sm font-mono">{sourceKey}</p>
        </div>
        <div>
          <label className="block text-sm font-medium">Destination key</label>
          <input
            className="input mt-1 font-mono text-sm"
            value={destKey}
            onChange={(e) => setDestKey(e.target.value)}
            autoFocus
          />
        </div>
      </form>
    </Modal>
  )
}

export default function ObjectBrowser() {
  const { bucket, setBucket, notify } = useApp()
  const location = useLocation()

  const [prefix, setPrefix] = useState('')
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [fileDetail, setFileDetail] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [copySource, setCopySource] = useState(null)
  const [busy, setBusy] = useState(false)

  // Accept bucket from navigation state (e.g. from Dashboard)
  useEffect(() => {
    if (location.state?.bucket) {
      setBucket(location.state.bucket)
    }
  }, [location.state, setBucket])

  const load = useCallback(() => {
    if (!bucket) return setItems(null)
    setItems(null)
    setSelected(new Set())
    api.listObjects(bucket, prefix)
      .then(({ files }) => setItems(simulateFolders(files, prefix)))
      .catch((e) => { setItems({ files: [], folders: [] }); notify(e.message, 'error') })
  }, [bucket, prefix, notify])

  useEffect(load, [load])

  // Combined list for display: folders first, then files, filtered
  const allItems = useMemo(() => {
    if (!items) return []
    const folders = items.folders.map((f) => ({ ...f, displayName: f.key.slice(prefix.length) }))
    const files = items.files
      .filter((f) => f.key !== prefix) // exclude the folder sentinel itself
      .filter((f) => f.key.toLowerCase().includes(filter.toLowerCase()))
      .map((f) => ({ ...f, displayName: f.key.slice(prefix.length) }))
    return [...folders, ...files]
  }, [items, prefix, filter])

  const selectAll = () => {
    const fileKeys = items?.files?.filter(f => f.key !== prefix).map(f => f.key) || []
    if (selected.size === fileKeys.length) setSelected(new Set())
    else setSelected(new Set(fileKeys))
  }

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const deleteOne = async () => {
    setBusy(true)
    try {
      await api.deleteObject(bucket, toDelete)
      notify('Object deleted')
      if (fileDetail === toDelete) setFileDetail(null)
      load()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
      setToDelete(null)
    }
  }

  const bulkDelete = async () => {
    setBusy(true)
    const keys = [...selected]
    try {
      const result = await api.bulkDelete(bucket, keys)
      notify(`Deleted ${result.deleted} object${result.deleted !== 1 ? 's' : ''}`)
      setSelected(new Set())
      load()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
      setBulkConfirm(false)
    }
  }

  const fileKeys = items?.files?.filter(f => f.key !== prefix).map(f => f.key) || []
  const allSelected = fileKeys.length > 0 && selected.size === fileKeys.length
  const someSelected = selected.size > 0

  return (
    <>
      <PageHeader title="Objects" subtitle="Browse, upload and manage your objects by folder.">
        <div className="flex flex-wrap items-center gap-2">
          <BucketSelect className="w-44" />
          <button className="btn-ghost border border-slate-300 bg-white" onClick={load} disabled={!bucket} aria-label="Refresh">
            <Icon name="refresh" size={18} />
          </button>
          <button className="btn-ghost border border-slate-300 bg-white" onClick={() => setShowCreateFolder(true)} disabled={!bucket}>
            <Icon name="create_new_folder" size={18} /> Folder
          </button>
        </div>
      </PageHeader>

      <div className="card overflow-hidden">
        {!bucket ? (
          <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
            <Icon name="inventory_2" size={40} className="text-slate-300" />
            <p className="font-medium">Select a bucket to browse</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Breadcrumb prefix={prefix} onNavigate={(p) => { setPrefix(p); setFilter('') }} />
              <div className="ml-auto flex items-center gap-2">
                {someSelected && (
                  <button
                    className="btn-danger py-1.5 text-xs"
                    onClick={() => setBulkConfirm(true)}
                  >
                    <Icon name="delete" size={15} />
                    Delete {selected.size}
                  </button>
                )}
                <div className="relative">
                  <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input w-44 py-1.5 pl-8 text-xs"
                    placeholder="Filter objects…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            {items === null ? (
              <div className="divide-y divide-slate-100">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="h-4 w-4 rounded bg-slate-200" />
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                    <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : allItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
                <Icon name="draft" size={40} className="text-slate-300" />
                <p className="font-medium">
                  {filter ? 'No objects match your filter' : 'This folder is empty'}
                </p>
                {!filter && (
                  <p className="text-sm">Upload files or create a folder to get started.</p>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={allSelected}
                        onChange={selectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="hidden px-4 py-2.5 sm:table-cell">Size</th>
                    <th className="hidden px-4 py-2.5 lg:table-cell">Last modified</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allItems.map((item) => (
                    <tr
                      key={item.key}
                      className={`hover:bg-slate-50 ${selected.has(item.key) ? 'bg-brand-50' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        {item.type === 'file' && (
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selected.has(item.key)}
                            onChange={() => toggleSelect(item.key)}
                          />
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-2.5">
                        {item.type === 'folder' ? (
                          <button
                            className="flex items-center gap-2 font-medium hover:text-brand-700"
                            onClick={() => { setPrefix(item.key); setFilter('') }}
                          >
                            <Icon name="folder" className="shrink-0 text-amber-400" size={18} />
                            <span className="truncate">{item.displayName}</span>
                          </button>
                        ) : (
                          <button
                            className="flex items-center gap-2 hover:text-brand-700"
                            onClick={() => setFileDetail(item.key)}
                          >
                            <Icon name={iconFor(item.key)} className="shrink-0 text-slate-400" size={18} />
                            <span className="truncate" title={item.key}>{item.displayName}</span>
                          </button>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-slate-400 sm:table-cell">
                        {item.type === 'file' ? formatSize(item.size) : '—'}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-slate-400 lg:table-cell">
                        {item.modified ? formatDate(item.modified) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {item.type === 'file' && (
                          <div className="flex justify-end gap-1">
                            <button className="btn-ghost py-1" onClick={() => setFileDetail(item.key)} aria-label="Details">
                              <Icon name="visibility" size={16} />
                            </button>
                            <a className="btn-ghost py-1" href={api.downloadUrl(bucket, item.key)} aria-label="Download">
                              <Icon name="download" size={16} />
                            </a>
                            <button className="btn-ghost py-1" onClick={() => setCopySource(item.key)} aria-label="Copy">
                              <Icon name="content_copy" size={16} />
                            </button>
                            <button className="btn-danger py-1" onClick={() => setToDelete(item.key)} aria-label="Delete">
                              <Icon name="delete" size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Stats bar */}
            {items && (
              <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                <span>{items.folders.length} folder{items.folders.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{fileKeys.length} file{fileKeys.length !== 1 ? 's' : ''}</span>
                {someSelected && <><span>•</span><span className="font-medium text-brand-700">{selected.size} selected</span></>}
              </div>
            )}
          </>
        )}
      </div>

      {fileDetail && (
        <FileDetails
          bucket={bucket}
          fileKey={fileDetail}
          onClose={() => setFileDetail(null)}
          onDelete={(key) => { setFileDetail(null); setToDelete(key) }}
        />
      )}

      {showCreateFolder && (
        <CreateFolderModal
          bucket={bucket}
          prefix={prefix}
          onCreated={load}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {copySource && (
        <CopyObjectModal
          bucket={bucket}
          sourceKey={copySource}
          onCopied={load}
          onClose={() => setCopySource(null)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete object?"
          message={`"${toDelete}" will be permanently removed.`}
          busy={busy}
          onConfirm={deleteOne}
          onCancel={() => setToDelete(null)}
        />
      )}

      {bulkConfirm && (
        <ConfirmDialog
          title={`Delete ${selected.size} object${selected.size !== 1 ? 's' : ''}?`}
          message="These objects will be permanently removed. This cannot be undone."
          busy={busy}
          onConfirm={bulkDelete}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </>
  )
}
