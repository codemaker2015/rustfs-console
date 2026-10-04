const getToken = () => localStorage.getItem('token')

// crypto.randomUUID() requires HTTPS; use this fallback instead
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

async function request(url, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* non-JSON body */ }
    throw new Error(typeof detail === 'string' ? detail : res.statusText || 'Request failed')
  }
  return res.status === 204 ? null : res.json()
}

const b = (name) => encodeURIComponent(name)

export const api = {
  // Auth
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/api/auth/me'),
  changePassword: (current_password, new_password) =>
    request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password }),
    }),

  // Users (admin)
  listUsers: () => request('/api/users'),
  createUser: (data) =>
    request('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  updateUser: (id, data) =>
    request(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

  // Server
  serverInfo: () => request('/api/server/info'),

  // Buckets
  listBuckets: () => request('/api/buckets'),
  createBucket: (name) =>
    request('/api/buckets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  deleteBucket: (name) => request(`/api/buckets/${b(name)}`, { method: 'DELETE' }),
  bucketStats: (bucket) => request(`/api/buckets/${b(bucket)}/stats`),
  getVersioning: (bucket) => request(`/api/buckets/${b(bucket)}/versioning`),
  setVersioning: (bucket, enabled) =>
    request(`/api/buckets/${b(bucket)}/versioning`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  getPolicy: (bucket) => request(`/api/buckets/${b(bucket)}/policy`),
  setPolicy: (bucket, isPublic) =>
    request(`/api/buckets/${b(bucket)}/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: isPublic }),
    }),

  // Objects
  listObjects: (bucket, prefix = '') =>
    request(`/api/buckets/${b(bucket)}/objects?prefix=${encodeURIComponent(prefix)}`),
  uploadObject: (bucket, file, prefix = '') => {
    const form = new FormData()
    form.append('file', file)
    form.append('prefix', prefix)
    return request(`/api/buckets/${b(bucket)}/objects`, { method: 'POST', body: form })
  },
  deleteObject: (bucket, key) =>
    request(`/api/buckets/${b(bucket)}/objects?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),
  bulkDelete: (bucket, keys) =>
    request(`/api/buckets/${b(bucket)}/objects/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    }),
  createFolder: (bucket, prefix) =>
    request(`/api/buckets/${b(bucket)}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix }),
    }),
  copyObject: (bucket, source_key, dest_key) =>
    request(`/api/buckets/${b(bucket)}/objects/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_key, dest_key }),
    }),
  transfer: (src_bucket, src_key, dest_bucket, dest_key, move = false) =>
    request('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src_bucket, src_key, dest_bucket, dest_key, move }),
    }),
  objectInfo: (bucket, key) =>
    request(`/api/buckets/${b(bucket)}/info?key=${encodeURIComponent(key)}`),
  presign: (bucket, key, expires) =>
    request(`/api/buckets/${b(bucket)}/presign?key=${encodeURIComponent(key)}&expires=${expires}`),
  viewUrl: (bucket, key) => {
    const token = getToken()
    return `/api/buckets/${b(bucket)}/download?key=${encodeURIComponent(key)}&inline=true${token ? `&token=${token}` : ''}`
  },
  downloadUrl: (bucket, key) => {
    const token = getToken()
    return `/api/buckets/${b(bucket)}/download?key=${encodeURIComponent(key)}${token ? `&token=${token}` : ''}`
  },
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
