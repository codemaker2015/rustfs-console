async function request(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* non-JSON error */ }
    throw new Error(typeof detail === 'string' ? detail : res.statusText || 'Request failed')
  }
  return res.status === 204 ? null : res.json()
}

const b = (name) => encodeURIComponent(name)

export const api = {
  listBuckets: () => request('/api/buckets'),
  createBucket: (name) =>
    request('/api/buckets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  deleteBucket: (name) => request(`/api/buckets/${b(name)}`, { method: 'DELETE' }),
  listObjects: (bucket, prefix = '') => request(`/api/buckets/${b(bucket)}/objects?prefix=${encodeURIComponent(prefix)}`),
  uploadObject: (bucket, file, prefix = '') => {
    const form = new FormData()
    form.append('file', file)
    form.append('prefix', prefix)
    return request(`/api/buckets/${b(bucket)}/objects`, { method: 'POST', body: form })
  },
  deleteObject: (bucket, key) => request(`/api/buckets/${b(bucket)}/objects?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),
  bucketStats: (bucket) => request(`/api/buckets/${b(bucket)}/stats`),
  objectInfo: (bucket, key) => request(`/api/buckets/${b(bucket)}/info?key=${encodeURIComponent(key)}`),
  presign: (bucket, key, expires) => request(`/api/buckets/${b(bucket)}/presign?key=${encodeURIComponent(key)}&expires=${expires}`),
  viewUrl: (bucket, key) => `/api/buckets/${b(bucket)}/download?key=${encodeURIComponent(key)}&inline=true`,
  downloadUrl: (bucket, key) => `/api/buckets/${b(bucket)}/download?key=${encodeURIComponent(key)}`,
}

export const formatSize = (n) => {
  let size = n
  for (const unit of ['B', 'KB', 'MB', 'GB']) {
    if (size < 1024) return `${size.toFixed(unit === 'B' ? 0 : 1)} ${unit}`
    size /= 1024
  }
  return `${size.toFixed(1)} TB`
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
