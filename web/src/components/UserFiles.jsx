import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import ConfirmDialog from './ConfirmDialog'
import FileDetails from './FileDetails'
import Icon from './Icon'
import Modal from './Modal'
import PageHeader from './PageHeader'

// ── Icon map ──────────────────────────────────────────────────────────────────
const FILE_ICON = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  pdf: 'picture_as_pdf', csv: 'table_chart', xlsx: 'table_chart',
  json: 'code', js: 'code', py: 'code', ts: 'code',
  zip: 'folder_zip', tar: 'folder_zip', gz: 'folder_zip',
  mp4: 'movie', mov: 'movie', mp3: 'audio_file', wav: 'audio_file',
}
const iconFor = (key) => FILE_ICON[key.split('.').pop()?.toLowerCase()] || 'description'
const canManageBuckets = (user) => user?.role === 'admin' || user?.allowed_buckets === null

// ── Pure helpers ──────────────────────────────────────────────────────────────
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

function buildTree(files) {
  const root = { name: '', path: '', children: {} }
  const ensure = (node, parts, cur, max) => {
    if (cur >= max) return
    const name = parts[cur]
    const path = parts.slice(0, cur + 1).join('/') + '/'
    if (!node.children[name]) node.children[name] = { name, path, children: {} }
    ensure(node.children[name], parts, cur + 1, max)
  }
  for (const file of files) {
    const parts = file.key.split('/').filter(Boolean)
    const max = file.key.endsWith('/') ? parts.length : parts.length - 1
    if (max > 0) ensure(root, parts, 0, max)
  }
  return root
}

// ── Folder tree node ──────────────────────────────────────────────────────────
function FolderTreeNode({ node, currentPrefix, onNavigate, depth = 0 }) {
  const hasChildren = Object.keys(node.children).length > 0
  const isActive = currentPrefix === node.path
  const [open, setOpen] = useState(
    depth === 0 || currentPrefix === node.path || currentPrefix.startsWith(node.path)
  )
  useEffect(() => {
    if (node.path && currentPrefix.startsWith(node.path)) setOpen(true)
  }, [currentPrefix, node.path])

  return (
    <div>
      <button
        className={`flex w-full items-center gap-1 rounded py-1 pr-2 text-left text-sm transition-colors hover:bg-slate-100 ${
          isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600'
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        onClick={() => { onNavigate(node.path); if (hasChildren) setOpen((o) => !o) }}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          {hasChildren && <Icon name={open ? 'expand_more' : 'chevron_right'} size={13} />}
        </span>
        <Icon
          name={open && hasChildren ? 'folder_open' : 'folder'}
          size={14}
          className={`shrink-0 ${isActive ? 'text-brand-500' : 'text-amber-400'}`}
        />
        <span className="ml-0.5 truncate text-xs">{depth === 0 ? 'Root' : node.name}</span>
      </button>
      {open && Object.values(node.children).map((child) => (
        <FolderTreeNode
          key={child.path}
          node={child}
          currentPrefix={currentPrefix}
          onNavigate={onNavigate}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

// ── Bucket node (expandable root of tree) ─────────────────────────────────────
function BucketNode({ name, isActive, tree, currentPrefix, onSelect, onNavigate, onDelete, canDelete, loading }) {
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  return (
    <div className="group/bkt">
      <div className="flex items-center">
        <button
          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded py-1.5 pl-2 pr-1 text-left text-sm font-medium transition-colors hover:bg-slate-100 ${
            isActive ? 'text-brand-700' : 'text-slate-700'
          }`}
          onClick={() => { onSelect(); setOpen((o) => !o || !isActive) }}
        >
          <span className="flex w-4 shrink-0 items-center justify-center">
            <Icon name={open && isActive ? 'expand_more' : 'chevron_right'} size={13} className="text-slate-400" />
          </span>
          <Icon name="inventory_2" size={15} className={isActive ? 'shrink-0 text-brand-600' : 'shrink-0 text-slate-400'} />
          <span className="truncate">{name}</span>
          {loading && <Icon name="progress_activity" size={12} className="ml-auto shrink-0 animate-spin text-slate-400" />}
        </button>
        {canDelete && (
          <button
            className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover/bkt:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(name) }}
            title={`Delete "${name}"`}
          >
            <Icon name="close" size={11} />
          </button>
        )}
      </div>
      {open && isActive && tree && (
        <div className="ml-5 border-l border-slate-200 pl-0.5">
          <FolderTreeNode node={tree} currentPrefix={currentPrefix} onNavigate={onNavigate} depth={0} />
        </div>
      )}
    </div>
  )
}

// ── Validation ────────────────────────────────────────────────────────────────
function bucketNameError(name) {
  if (name.length < 3) return 'At least 3 characters required.'
  if (name.length > 63) return 'Maximum 63 characters.'
  if (!/^[a-z0-9]/.test(name)) return 'Must start with a letter or number.'
  if (!/[a-z0-9]$/.test(name)) return 'Must end with a letter or number.'
  if (!/^[a-z0-9-]+$/.test(name)) return 'Only lowercase letters, numbers, and hyphens.'
  if (/--/.test(name)) return 'Cannot contain consecutive hyphens.'
  return ''
}

// ── Modals ────────────────────────────────────────────────────────────────────
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
    try { await api.createBucket(trimmed); notify(`Bucket "${trimmed}" created`); onCreated(); onClose() }
    catch (err) { notify(err.message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Create bucket" onClose={onClose} size="sm"
      footer={<><button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !canSubmit}>{busy ? 'Creating…' : 'Create'}</button></>}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Bucket name</label>
          <input className={`input mt-1 ${error ? 'border-red-400' : ''}`} placeholder="my-bucket"
            value={name} onChange={(e) => setName(e.target.value.toLowerCase())} autoFocus />
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p>
            : <p className="mt-1 text-xs text-slate-400">3–63 chars · lowercase, numbers, hyphens · no leading/trailing hyphens</p>}
        </div>
      </form>
    </Modal>
  )
}

function CreateFolderModal({ bucket, prefix, onCreated, onClose }) {
  const { notify } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim().replace(/\/+/g, '')
  const error = !trimmed ? '' : /[/\\]/.test(name.trim()) ? 'Name cannot contain slashes.' : ''
  const canSubmit = trimmed && !error

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try { await api.createFolder(bucket, prefix + trimmed); notify(`Folder "${trimmed}" created`); onCreated(); onClose() }
    catch (err) { notify(err.message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Create folder" onClose={onClose} size="sm"
      footer={<><button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !canSubmit}>{busy ? 'Creating…' : 'Create'}</button></>}
    >
      <form onSubmit={submit} className="space-y-2">
        {prefix && <p className="text-xs text-slate-400">Inside: <code className="rounded bg-slate-100 px-1">{prefix}</code></p>}
        <div>
          <label className="block text-sm font-medium">Folder name</label>
          <input className={`input mt-1 ${error ? 'border-red-400' : ''}`} placeholder="my-folder"
            value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </form>
    </Modal>
  )
}

function TransferModal({ srcBucket, srcKey, onDone, onClose }) {
  const { notify } = useApp()
  const [buckets, setBuckets] = useState([])
  const [destBucket, setDestBucket] = useState(srcBucket)
  const [destFolder, setDestFolder] = useState('')
  const [mode, setMode] = useState('copy')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.listBuckets().then(setBuckets).catch(() => {}) }, [])

  const filename = srcKey.split('/').filter(Boolean).pop() || srcKey
  const destKey = destFolder.trim() ? destFolder.trim().replace(/\/+$/, '') + '/' + filename : filename

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.transfer(srcBucket, srcKey, destBucket, destKey, mode === 'move')
      notify(`${mode === 'move' ? 'Moved' : 'Copied'} to ${destBucket}/${destKey}`)
      onDone(mode); onClose()
    } catch (err) { notify(err.message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Move / Copy file" onClose={onClose} size="sm"
      footer={<><button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !destBucket}>
          {busy ? `${mode === 'move' ? 'Moving' : 'Copying'}…` : mode === 'move' ? 'Move' : 'Copy'}
        </button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-1 text-xs text-slate-500">Source</p>
          <p className="truncate rounded bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-600">{srcBucket} / {srcKey}</p>
        </div>
        <div className="flex gap-4">
          {['copy', 'move'].map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="accent-brand-600" />
              {m === 'copy' ? 'Copy' : 'Move (delete source)'}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium">Destination bucket</label>
          <select className="input mt-1" value={destBucket} onChange={(e) => setDestBucket(e.target.value)}>
            {buckets.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Destination folder <span className="font-normal text-slate-400">(optional)</span></label>
          <input className="input mt-1" placeholder="documents/2026" value={destFolder} onChange={(e) => setDestFolder(e.target.value)} />
        </div>
        <div className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Result: <span className="font-mono font-medium text-slate-700">{destBucket} / {destKey}</span>
        </div>
      </form>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserFiles() {
  const { user, bucket, setBucket, notify } = useApp()
  const canCreate = canManageBuckets(user)

  const [buckets, setBuckets] = useState(null)
  const [prefix, setPrefix] = useState('')
  const [allFiles, setAllFiles] = useState(null)
  const [loadingBucket, setLoadingBucket] = useState(false)
  const [search, setSearch] = useState('')
  const [fileDetail, setFileDetail] = useState(null)
  const [toDeleteFile, setToDeleteFile] = useState(null)
  const [toDeleteBucket, setToDeleteBucket] = useState(null)
  const [toTransferFile, setToTransferFile] = useState(null)
  const [showCreateBucket, setShowCreateBucket] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [busy, setBusy] = useState(false)
  const searchRef = useRef(null)

  const loadBuckets = useCallback(() => {
    api.listBuckets().then(setBuckets).catch((e) => notify(e.message, 'error'))
  }, [notify])

  useEffect(() => { loadBuckets() }, [loadBuckets])

  const load = useCallback(() => {
    if (!bucket) return setAllFiles(null)
    setAllFiles(null)
    setLoadingBucket(true)
    api.listObjects(bucket, '')
      .then(({ files }) => setAllFiles(files))
      .catch((e) => { setAllFiles([]); notify(e.message, 'error') })
      .finally(() => setLoadingBucket(false))
  }, [bucket, notify])

  useEffect(load, [load])

  const tree = useMemo(() => buildTree(allFiles || []), [allFiles])

  const items = useMemo(
    () => (allFiles === null ? null : simulateFolders(allFiles, prefix)),
    [allFiles, prefix]
  )

  // ── Search across loaded content ──────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const results = []

    for (const b of (buckets || [])) {
      if (b.name.toLowerCase().includes(q))
        results.push({ kind: 'bucket', label: b.name, sub: 'Bucket', bucketName: b.name })
    }

    if (allFiles && bucket) {
      const seenFolders = new Set()
      for (const f of allFiles) {
        const parts = f.key.split('/').filter(Boolean)
        const folderDepth = f.key.endsWith('/') ? parts.length : parts.length - 1
        for (let i = 0; i < folderDepth; i++) {
          const folderPath = parts.slice(0, i + 1).join('/') + '/'
          if (!seenFolders.has(folderPath) && parts[i].toLowerCase().includes(q)) {
            seenFolders.add(folderPath)
            results.push({ kind: 'folder', label: parts[i], sub: `${bucket} / ${folderPath}`, folderPath })
          }
        }
        if (!f.key.endsWith('/')) {
          const name = parts[parts.length - 1] || f.key
          if (name.toLowerCase().includes(q)) {
            const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
            results.push({ kind: 'file', label: name, sub: `${bucket} / ${f.key}`, fileKey: f.key, folderPath, file: f })
          }
        }
      }
    }
    return results
  }, [search, buckets, allFiles, bucket])

  const navigate = useCallback((path) => { setPrefix(path); setSearch('') }, [])

  const changeBucket = useCallback((name) => {
    setBucket(name)
    setPrefix('')
    setSearch('')
  }, [setBucket])

  const deleteFile = async () => {
    setBusy(true)
    try {
      await api.deleteObject(bucket, toDeleteFile)
      notify('File deleted')
      if (fileDetail === toDeleteFile) setFileDetail(null)
      setAllFiles((prev) => prev?.filter((f) => f.key !== toDeleteFile) ?? null)
    } catch (e) { notify(e.message, 'error') }
    finally { setBusy(false); setToDeleteFile(null) }
  }

  const deleteBucket = async () => {
    setBusy(true)
    try {
      await api.deleteBucket(toDeleteBucket)
      notify(`Bucket "${toDeleteBucket}" deleted`)
      if (bucket === toDeleteBucket) { setBucket(''); setPrefix('') }
      loadBuckets()
    } catch (e) { notify(e.message, 'error') }
    finally { setBusy(false); setToDeleteBucket(null) }
  }

  // allItems for normal (non-search) file list
  const allItems = useMemo(() => {
    if (!items) return []
    return [
      ...items.folders.map((f) => ({ ...f, displayName: f.key.slice(prefix.length) })),
      ...items.files.map((f) => ({ ...f, displayName: f.key.slice(prefix.length) })),
    ]
  }, [items, prefix])

  return (
    <>
      <PageHeader
        title="My Files"
        subtitle={user?.allowed_buckets
          ? `Access to ${user.allowed_buckets.length} bucket${user.allowed_buckets.length !== 1 ? 's' : ''}.`
          : 'Browse and manage your files.'}
      />

      {/* ── Global search bar ── */}
      <div className="mb-3 relative">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          className="input w-full py-2.5 pl-9 pr-9 text-sm"
          placeholder="Search buckets, folders & files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            onClick={() => { setSearch(''); searchRef.current?.focus() }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* ── Explorer layout ── */}
      <div className="flex gap-3" style={{ height: '60vh' }}>

        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 flex flex-col">
          <div className="card flex flex-col overflow-hidden h-full">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage</span>
              <div className="flex items-center gap-1">
                {bucket && (
                  <button className="btn-ghost p-1" onClick={() => setShowCreateFolder(true)} title="New folder">
                    <Icon name="create_new_folder" size={15} />
                  </button>
                )}
                {canCreate && (
                  <button className="btn-ghost p-1" onClick={() => setShowCreateBucket(true)} title="New bucket">
                    <Icon name="add_circle" size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1">
              {buckets === null ? (
                <div className="space-y-2 p-2">
                  {[80, 65, 75].map((w, i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : buckets.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">
                  No buckets yet.
                  {canCreate && (
                    <button className="mt-2 flex w-full items-center justify-center gap-1 text-brand-600 hover:underline" onClick={() => setShowCreateBucket(true)}>
                      <Icon name="add" size={13} /> Create first bucket
                    </button>
                  )}
                </div>
              ) : (
                buckets.map((b) => (
                  <BucketNode
                    key={b.name}
                    name={b.name}
                    isActive={bucket === b.name}
                    tree={bucket === b.name ? tree : null}
                    currentPrefix={prefix}
                    onSelect={() => changeBucket(b.name)}
                    onNavigate={navigate}
                    onDelete={(n) => setToDeleteBucket(n)}
                    canDelete={canCreate}
                    loading={loadingBucket && bucket === b.name}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="min-w-0 flex-1 card flex flex-col overflow-hidden">

          {/* Search results */}
          {searchResults !== null ? (
            <div className="flex flex-col h-full">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for
                  <span className="ml-1 text-brand-700">"{search.trim()}"</span>
                </p>
              </div>
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
                  <Icon name="search_off" size={38} className="text-slate-300" />
                  <p className="text-sm">No matches found</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => {
                        if (r.kind === 'bucket') changeBucket(r.bucketName)
                        else if (r.kind === 'folder') { if (bucket !== r.sub.split(' / ')[0]) changeBucket(r.sub.split(' / ')[0]); navigate(r.folderPath) }
                        else { if (r.folderPath !== undefined) navigate(r.folderPath) }
                        setSearch('')
                      }}
                    >
                      <Icon
                        name={r.kind === 'bucket' ? 'inventory_2' : r.kind === 'folder' ? 'folder' : iconFor(r.label)}
                        size={20}
                        className={r.kind === 'bucket' ? 'shrink-0 text-brand-500' : r.kind === 'folder' ? 'shrink-0 text-amber-400' : 'shrink-0 text-slate-400'}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                        <p className="truncate text-xs text-slate-400">{r.sub}</p>
                      </div>
                      <Icon name="arrow_forward" size={14} className="ml-auto shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : !bucket ? (
            /* No bucket selected */
            <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
              <Icon name="inventory_2" size={40} className="text-slate-300" />
              <p className="text-sm font-medium">Select a bucket from the sidebar</p>
              {canCreate && buckets?.length === 0 && (
                <button className="btn-primary mt-1" onClick={() => setShowCreateBucket(true)}>
                  <Icon name="add" size={18} /> Create your first bucket
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-1 text-sm">
                  <button className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 ${!prefix ? 'font-semibold text-brand-700' : 'text-slate-500'}`} onClick={() => navigate('')}>
                    <Icon name="inventory_2" size={13} className="text-brand-600" />
                    {bucket}
                  </button>
                  {prefix.split('/').filter(Boolean).map((part, i, arr) => {
                    const path = arr.slice(0, i + 1).join('/') + '/'
                    return (
                      <span key={path} className="flex items-center gap-1">
                        <Icon name="chevron_right" size={13} className="text-slate-300" />
                        <button
                          className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${i === arr.length - 1 ? 'font-semibold text-brand-700' : 'text-slate-500'}`}
                          onClick={() => navigate(path)}
                        >
                          {part}
                        </button>
                      </span>
                    )
                  })}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <button className="btn-ghost border border-slate-200 py-1.5 text-xs" onClick={() => setShowCreateFolder(true)} title="New folder">
                    <Icon name="create_new_folder" size={15} /> Folder
                  </button>
                  <input
                    id="inline-upload-input"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files)
                      e.target.value = ''
                      if (!files.length) return
                      setBusy(true)
                      try {
                        await Promise.all(files.map((f) => api.uploadObject(bucket, f, prefix)))
                        notify(`Uploaded ${files.length} file${files.length !== 1 ? 's' : ''}`)
                        load()
                      } catch (err) {
                        notify(err.message, 'error')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  />
                  <label
                    htmlFor="inline-upload-input"
                    className={`btn-primary cursor-pointer py-1.5 text-xs ${busy ? 'pointer-events-none opacity-60' : ''}`}
                    title="Upload files to current folder"
                  >
                    <Icon name="upload" size={15} /> Upload
                  </label>
                  <button className="btn-ghost border border-slate-200 py-1.5" onClick={load} title="Refresh">
                    <Icon name="refresh" size={15} />
                  </button>
                </div>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto">
              {allFiles === null ? (
                <div className="divide-y divide-slate-100">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : allItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
                  <Icon name="draft" size={38} className="text-slate-300" />
                  <p className="text-sm font-medium">This folder is empty</p>
                  <button className="btn-ghost border border-slate-200 text-sm" onClick={() => setShowCreateFolder(true)}>
                    <Icon name="create_new_folder" size={16} /> New folder
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="hidden px-3 py-2.5 sm:table-cell">Size</th>
                      <th className="hidden px-3 py-2.5 md:table-cell">Modified</th>
                      <th className="w-28 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allItems.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="min-w-0 px-3 py-2.5">
                          {item.type === 'folder' ? (
                            <button className="flex items-center gap-2 font-medium hover:text-brand-700" onClick={() => navigate(item.key)}>
                              <Icon name="folder" className="shrink-0 text-amber-400" size={18} />
                              <span className="truncate">{item.displayName}</span>
                            </button>
                          ) : (
                            <button className="flex w-full items-center gap-2 hover:text-brand-700" onClick={() => setFileDetail(item.key)}>
                              <Icon name={iconFor(item.key)} className="shrink-0 text-slate-400" size={18} />
                              <span className="truncate" title={item.key}>{item.displayName}</span>
                            </button>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-400 sm:table-cell">
                          {item.type === 'file' ? formatSize(item.size) : '—'}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-400 md:table-cell">
                          {item.modified ? formatDate(item.modified) : '—'}
                        </td>
                        <td className="w-28 px-2 py-2">
                          {item.type === 'file' && (
                            <div className="flex justify-end gap-0.5">
                              <button className="btn-ghost p-1" onClick={() => setFileDetail(item.key)} title="Details">
                                <Icon name="visibility" size={15} />
                              </button>
                              <button className="btn-ghost p-1" onClick={() => setToTransferFile(item.key)} title="Move / Copy">
                                <Icon name="drive_file_move" size={15} />
                              </button>
                              <a className="btn-ghost p-1" href={api.downloadUrl(bucket, item.key)} title="Download">
                                <Icon name="download" size={15} />
                              </a>
                              <button className="btn-danger p-1" onClick={() => setToDeleteFile(item.key)} title="Delete">
                                <Icon name="delete" size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>

              {items && (
                <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                  <span>{items.folders.length} folder{items.folders.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{items.files.length} file{items.files.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {fileDetail && (
        <FileDetails bucket={bucket} fileKey={fileDetail} onClose={() => setFileDetail(null)}
          onDelete={(key) => { setFileDetail(null); setToDeleteFile(key) }} />
      )}
      {showCreateBucket && <CreateBucketModal onCreated={loadBuckets} onClose={() => setShowCreateBucket(false)} />}
      {showCreateFolder && (
        <CreateFolderModal bucket={bucket} prefix={prefix} onCreated={load} onClose={() => setShowCreateFolder(false)} />
      )}
      {toTransferFile && (
        <TransferModal srcBucket={bucket} srcKey={toTransferFile}
          onDone={(mode) => { if (mode === 'move') setAllFiles((p) => p?.filter((f) => f.key !== toTransferFile) ?? null) }}
          onClose={() => setToTransferFile(null)} />
      )}
      {toDeleteFile && (
        <ConfirmDialog title="Delete file?"
          message={`"${toDeleteFile}" will be permanently removed from "${bucket}".`}
          busy={busy} onConfirm={deleteFile} onCancel={() => setToDeleteFile(null)} />
      )}
      {toDeleteBucket && (
        <ConfirmDialog title={`Delete bucket "${toDeleteBucket}"?`}
          message="The bucket must be empty. This cannot be undone."
          busy={busy} onConfirm={deleteBucket} onCancel={() => setToDeleteBucket(null)} />
      )}
    </>
  )
}
