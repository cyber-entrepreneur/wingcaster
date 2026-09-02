import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { FinAction, FinAdminGate, FinTable } from './shell'

export function PackageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pkg, setPkg] = useState<Record<string, unknown> | null>(null)
  function reload() {
    if (!id) return
    void api.finGet(`/packages/${id}`).then((body) => setPkg(body))
  }
  useEffect(() => { reload() }, [id])
  const versions = (pkg?.versions || []) as Array<Record<string, unknown>>
  return (
    <FinAdminGate title="Package">
      <p className="mb-3 text-sm text-muted-foreground">
        {String(pkg?.display_name || '')} · {String(pkg?.code || '')} · {String(pkg?.tier || '')} · {String(pkg?.target_audience || '')}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <FinAction label="Compose new version" onClick={() => {
          if (!id) return
          void api.finPost(`/packages/${id}/versions`, {}).then((row) => {
            navigate(`/admin/fin/packages/${id}/versions/${String(row.id)}`)
          })
        }} />
        <FinAction label="Copy from latest" onClick={() => {
          if (!id || !versions.length) return
          const last = versions[versions.length - 1]
          void api.finPost(`/packages/${id}/versions`, { copy_from_version_id: last.id }).then((row) => {
            navigate(`/admin/fin/packages/${id}/versions/${String(row.id)}`)
          })
        }} />
      </div>
      <FinTable
        columns={['version_number', 'state', 'properties_covered', 'monthly_price_minor', 'effective_from']}
        rows={versions}
        onRowClick={(row) => navigate(`/admin/fin/packages/${id}/versions/${String(row.id)}`)}
      />
    </FinAdminGate>
  )
}
