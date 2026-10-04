import { useCallback, useEffect, useState } from 'react'
import { api, formatDate } from '../api'
import { useApp } from '../context'
import ConfirmDialog from './ConfirmDialog'
import Icon from './Icon'
import Modal from './Modal'
import PageHeader from './PageHeader'

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Full access to all buckets and admin settings' },
  { value: 'user',  label: 'User',  desc: 'Access limited to assigned buckets' },
]

function UserFormModal({ user, buckets, onSave, onClose }) {
  const { notify } = useApp()
  const isEdit = !!user

  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    role: user?.role || 'user',
    bucketMode: user ? (user.allowed_buckets === null ? 'all' : 'specific') : 'all',
    allowed_buckets: user?.allowed_buckets || [],
  })
  const [busy, setBusy] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const toggleBucket = (name) => {
    set('allowed_buckets', form.allowed_buckets.includes(name)
      ? form.allowed_buckets.filter((b) => b !== name)
      : [...form.allowed_buckets, name])
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!isEdit && !form.username.trim()) { notify('Username is required', 'error'); return }
    if (!isEdit && form.password.length < 8) { notify('Password must be at least 8 characters', 'error'); return }
    if (isEdit && form.password && form.password.length < 8) { notify('Password must be at least 8 characters', 'error'); return }

    setBusy(true)
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        allowed_buckets: form.bucketMode === 'all' ? null : form.allowed_buckets,
        ...(form.password ? { password: form.password } : {}),
      }
      if (isEdit) {
        await api.updateUser(user.id, payload)
        notify(`User "${user.username}" updated`)
      } else {
        await api.createUser({ ...payload, username: form.username, password: form.password })
        notify(`User "${form.username}" created`)
      }
      onSave()
      onClose()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit user — ${user.username}` : 'Create user'}
      onClose={onClose}
      size="lg"
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create user')}
        </button>
      </>}
    >
      <form onSubmit={submit} className="space-y-5">
        {/* Basic info */}
        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium">Username <span className="text-red-500">*</span></label>
              <input className="input mt-1" value={form.username} onChange={(e) => set('username', e.target.value)} autoFocus={!isEdit} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">
              {isEdit ? 'New password' : 'Password'}{!isEdit && <span className="text-red-500"> *</span>}
              {isEdit && <span className="font-normal text-slate-400"> (leave blank to keep current)</span>}
            </label>
            <input className="input mt-1" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoFocus={isEdit} placeholder={isEdit ? '••••••••' : 'min. 8 characters'} />
          </div>
          <div>
            <label className="block text-sm font-medium">Full name</label>
            <input className="input mt-1" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input className="input mt-1" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium">Role</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label key={r.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${form.role === r.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => set('role', r.value)} className="mt-0.5" />
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Bucket access (user role only) */}
        {form.role === 'user' && (
          <div>
            <label className="block text-sm font-medium">Bucket access</label>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={form.bucketMode === 'all'} onChange={() => set('bucketMode', 'all')} />
                <span className="text-sm">All buckets (no restriction)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={form.bucketMode === 'specific'} onChange={() => set('bucketMode', 'specific')} />
                <span className="text-sm">Specific buckets only</span>
              </label>
            </div>

            {form.bucketMode === 'specific' && (
              <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {buckets.length === 0 ? (
                  <p className="text-sm text-slate-400">No buckets available</p>
                ) : (
                  <div className="space-y-1">
                    {buckets.map((b) => (
                      <label key={b.name} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={form.allowed_buckets.includes(b.name)}
                          onChange={() => toggleBucket(b.name)}
                          className="rounded border-slate-300"
                        />
                        <Icon name="inventory_2" size={14} className="text-brand-600" />
                        <span className="text-sm">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

export default function UserManager() {
  const { user: currentUser, notify } = useApp()
  const [users, setUsers] = useState(null)
  const [buckets, setBuckets] = useState([])
  const [editUser, setEditUser] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [toToggle, setToToggle] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [usersData, bucketsData] = await Promise.all([api.listUsers(), api.listBuckets()])
      setUsers(usersData)
      setBuckets(bucketsData)
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [notify])

  useEffect(() => { load() }, [load])

  const deleteUser = async () => {
    setBusy(true)
    try {
      await api.deleteUser(toDelete.id)
      notify(`User "${toDelete.username}" deleted`)
      load()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
      setToDelete(null)
    }
  }

  const toggleActive = async () => {
    try {
      await api.updateUser(toToggle.id, { active: !toToggle.active })
      notify(`User "${toToggle.username}" ${toToggle.active ? 'disabled' : 'enabled'}`)
      load()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setToToggle(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage who can access the console and what they can do."
      >
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Icon name="person_add" size={18} /> New user
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        {users === null ? (
          <div className="divide-y divide-slate-100">
            {[0,1,2].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
            <Icon name="group" size={40} className="text-slate-300" />
            <p>No users found</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="hidden px-4 py-3 sm:table-cell">Role</th>
                <th className="hidden px-4 py-3 md:table-cell">Bucket access</th>
                <th className="hidden px-4 py-3 lg:table-cell">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-slate-50 ${!u.active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                        {(u.full_name || u.username)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.username}</p>
                        {u.full_name && <p className="text-xs text-slate-400">{u.full_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={u.role === 'admin' ? 'badge badge-blue' : 'badge badge-slate'}>
                      {u.role}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell text-slate-500">
                    {u.role === 'admin'
                      ? <span className="text-xs text-slate-400">All (admin)</span>
                      : u.allowed_buckets === null
                        ? <span className="text-xs text-slate-400">All buckets</span>
                        : <span className="text-xs">{u.allowed_buckets.length} bucket{u.allowed_buckets.length !== 1 ? 's' : ''}</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">
                    {u.created_at ? formatDate(u.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.active ? 'badge badge-green' : 'badge badge-red'}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost py-1 text-xs" onClick={() => setEditUser(u)}>
                        <Icon name="edit" size={14} /> Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button className="btn-ghost py-1 text-xs" onClick={() => setToToggle(u)}>
                          <Icon name={u.active ? 'block' : 'check_circle'} size={14} />
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                      {u.id !== currentUser?.id && (
                        <button className="btn-danger py-1" onClick={() => setToDelete(u)} aria-label="Delete">
                          <Icon name="delete" size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <UserFormModal buckets={buckets} onSave={load} onClose={() => setShowCreate(false)} />
      )}
      {editUser && (
        <UserFormModal user={editUser} buckets={buckets} onSave={load} onClose={() => setEditUser(null)} />
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Delete user "${toDelete.username}"?`}
          message="This action is irreversible. The user will lose all access."
          busy={busy}
          onConfirm={deleteUser}
          onCancel={() => setToDelete(null)}
        />
      )}
      {toToggle && (
        <ConfirmDialog
          title={`${toToggle.active ? 'Disable' : 'Enable'} user "${toToggle.username}"?`}
          message={toToggle.active ? 'The user will not be able to log in.' : 'The user will regain access to the console.'}
          busy={false}
          onConfirm={toggleActive}
          onCancel={() => setToToggle(null)}
        />
      )}
    </>
  )
}
