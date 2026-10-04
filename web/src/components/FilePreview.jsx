import { useEffect, useState } from 'react'
import { api } from '../api'
import Icon from './Icon'

const TEXT_EXT = ['txt', 'md', 'log', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv', 'js', 'jsx', 'ts', 'py', 'sh', 'sql', 'ini', 'toml', 'html', 'css']
const MAX_TEXT = 512 * 1024

function kindOf(key, type) {
  const ext = key.split('.').pop().toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('text/') || type.includes('json') || type.includes('xml') || TEXT_EXT.includes(ext)) return 'text'
  return null
}

export default function FilePreview({ bucket, fileKey, contentType, size }) {
  const kind = kindOf(fileKey, contentType)
  const src = api.viewUrl(bucket, fileKey)
  const [text, setText] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (kind !== 'text' || size > MAX_TEXT) return
    setText(null)
    setError('')
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Could not load preview'))))
      .then((t) => {
        if (fileKey.toLowerCase().endsWith('.json')) {
          try { t = JSON.stringify(JSON.parse(t), null, 2) } catch { /* show raw */ }
        }
        setText(t)
      })
      .catch((e) => setError(e.message))
  }, [kind, src, size, fileKey])

  const box = 'overflow-hidden rounded-md border border-slate-200 bg-slate-50'
  if (kind === 'image') return <div className={`${box} flex justify-center p-2`}><img src={src} alt={fileKey} className="max-h-96 object-contain" /></div>
  if (kind === 'pdf') return <iframe src={src} title={fileKey} className={`${box} h-[28rem] w-full`} />
  if (kind === 'video') return <video src={src} controls className={`${box} w-full`} />
  if (kind === 'audio') return <audio src={src} controls className="w-full" />
  if (kind === 'text') {
    if (size > MAX_TEXT) return <Notice text="This file is too large to preview. Download it to view the contents." />
    if (error) return <Notice text={error} />
    return (
      <pre className={`${box} max-h-96 overflow-auto p-3 text-xs leading-relaxed`}>
        {text === null ? 'Loading preview…' : text}
      </pre>
    )
  }
  return <Notice text="No preview is available for this file type. Use Download to open it." />
}

function Notice({ text }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      <Icon name="visibility_off" size={18} /> {text}
    </div>
  )
}
