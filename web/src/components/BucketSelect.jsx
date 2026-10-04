import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'

export default function BucketSelect({ className = '' }) {
  const { bucket, setBucket, notify } = useApp()
  const [buckets, setBuckets] = useState([])

  useEffect(() => {
    api.listBuckets()
      .then((list) => {
        setBuckets(list)
        if (bucket && !list.some((b) => b.name === bucket)) setBucket('')
      })
      .catch((e) => notify(e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <select className={`input ${className}`} value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Bucket">
      <option value="">Select a bucket…</option>
      {buckets.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
    </select>
  )
}
