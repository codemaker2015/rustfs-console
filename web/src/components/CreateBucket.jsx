import { useState } from 'react'
import { api } from '../api'
import { useApp } from '../context'
import Icon from './Icon'

export default function CreateBucket({ onCreated }) {
  const { notify } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.createBucket(name)
      notify(`Created bucket ${name.trim()}`)
      setName('')
      onCreated()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className="input w-56" placeholder="new-bucket-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Bucket name" />
      <button className="btn-primary" disabled={busy || !name.trim()}>
        <Icon name="add" size={18} /> Create bucket
      </button>
    </form>
  )
}
