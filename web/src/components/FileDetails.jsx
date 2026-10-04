import { useEffect, useState } from 'react'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import CopyField from './CopyField'
import Drawer, { Row } from './Drawer'
import FilePreview from './FilePreview'
import Icon from './Icon'

const EXPIRY = [
  { label: '15 minutes', value: 900 },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
]

export default function FileDetails({ bucket, fileKey, onClose, onDelete }) {
  const { notify } = useApp()
  const [info, setInfo] = useState(null)
  const [expires, setExpires] = useState(3600)
  const [shareUrl, setShareUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setInfo(null)
    setShareUrl('')
    api.objectInfo(bucket, fileKey).then(setInfo).catch((e) => { notify(e.message, 'error'); onClose() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, fileKey])

  const share = async () => {
    setBusy(true)
    try {
      setShareUrl((await api.presign(bucket, fileKey, expires)).url)
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer title={fileKey} icon="description" onClose={onClose}>
      {!info ? (
        <p className="text-sm text-slate-500">Loading file details…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={api.viewUrl(bucket, fileKey)} target="_blank" rel="noreferrer"><Icon name="open_in_new" size={18} /> Open</a>
            <a className="btn-ghost border border-slate-300" href={api.downloadUrl(bucket, fileKey)}><Icon name="download" size={18} /> Download</a>
            <button className="btn-danger ml-auto" onClick={() => onDelete(fileKey)}><Icon name="delete" size={18} /> Delete</button>
          </div>

          <section>
            <h3 className="mb-2 font-semibold">Preview</h3>
            <FilePreview bucket={bucket} fileKey={fileKey} contentType={info.content_type} size={info.size} />
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Locations</h3>
            <CopyField label="S3 URI" value={info.s3_uri} />
            <CopyField label="Object URL" value={info.url} />
            <p className="text-xs text-slate-500">The object URL only works for requests that are signed or for public buckets. Create a temporary link to share the file.</p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">Temporary share link</h3>
            <div className="flex gap-2">
              <select className="input w-40" value={expires} onChange={(e) => { setExpires(Number(e.target.value)); setShareUrl('') }} aria-label="Link expiry">
                {EXPIRY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button className="btn-ghost border border-slate-300" onClick={share} disabled={busy}><Icon name="link" size={18} /> Create link</button>
            </div>
            {shareUrl && <div className="mt-3"><CopyField label="Share link" value={shareUrl} /></div>}
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Properties</h3>
            <dl className="divide-y divide-slate-100">
              <Row label="Bucket">{bucket}</Row>
              <Row label="Key">{info.key}</Row>
              <Row label="Size">{formatSize(info.size)} ({info.size.toLocaleString()} bytes)</Row>
              <Row label="Content type">{info.content_type}</Row>
              <Row label="Last modified">{formatDate(info.modified)}</Row>
              <Row label="ETag"><code className="text-xs">{info.etag}</code></Row>
              <Row label="Storage class">{info.storage_class}</Row>
              {Object.entries(info.metadata).map(([k, v]) => <Row key={k} label={`Meta: ${k}`}>{v}</Row>)}
            </dl>
          </section>
        </div>
      )}
    </Drawer>
  )
}
