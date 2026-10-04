import { useEffect, useState } from 'react'
import { api, formatDate, formatSize } from '../api'
import { useApp } from '../context'
import CopyField from './CopyField'
import Drawer, { Row } from './Drawer'

export default function BucketDetails({ name, created, onClose }) {
  const { notify } = useApp()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    setStats(null)
    api.bucketStats(name).then(setStats).catch((e) => { notify(e.message, 'error'); onClose() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  return (
    <Drawer title={name} icon="inventory_2" onClose={onClose}>
      {!stats ? (
        <p className="text-sm text-slate-500">Loading bucket details…</p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-semibold">Locations</h3>
            <CopyField label="S3 URI" value={stats.s3_uri} />
            <CopyField label="Bucket URL" value={stats.url} />
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Properties</h3>
            <dl className="divide-y divide-slate-100">
              <Row label="Name">{name}</Row>
              {created && <Row label="Created">{formatDate(created)}</Row>}
              <Row label="Region">{stats.region}</Row>
              <Row label="Objects">{stats.objects.toLocaleString()}</Row>
              <Row label="Total size">{formatSize(stats.size)}</Row>
            </dl>
          </section>
        </div>
      )}
    </Drawer>
  )
}
