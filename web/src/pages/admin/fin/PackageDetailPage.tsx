import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { FinAction, FinAdminGate, FinTable } from './shell'
import { PackageDeprecateDialog } from './PackageDeprecateDialog'

function stateVariant(state: string) {
  if (state === 'PUBLISHED') return 'default' as const
  if (state === 'DEPRECATED') return 'secondary' as const
  if (state === 'DRAFT' || state === 'PENDING_APPROVAL') return 'outline' as const
  return 'secondary' as const
}

export function PackageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pkg, setPkg] = useState<Record<string, unknown> | null>(null)
  const [deprecateVersion, setDeprecateVersion] = useState<Record<string, unknown> | null>(null)

  function reload() {
    if (!id) return
    void api.finGet(`/packages/${id}`).then((body) => setPkg(body))
  }
  useEffect(() => { reload() }, [id])

  const versions = (pkg?.versions || []) as Array<Record<string, unknown>>
  const tableRows = versions.map((row) => ({
    ...row,
    properties_covered: String(row.properties_covered ?? ''),
    monthly_price_minor: String(row.monthly_price_minor ?? ''),
    subscribers_count: String(row.subscribers_count ?? 0),
  }))

  return (
    <FinAdminGate title="Package">
      <p className="mb-3 text-sm text-muted-foreground">
        {String(pkg?.display_name || '')} · {String(pkg?.code || '')} · {String(pkg?.tier || '')} · {String(pkg?.target_audience || '')}
        {' · '}
        <Numeric>{String(pkg?.subscribers_count ?? 0)}</Numeric>
        {' '}package subscribers
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
      {versions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {versions.filter((v) => v.state === 'PUBLISHED').map((v) => (
            <Button
              key={String(v.id)}
              size="sm"
              variant="outline"
              onClick={() => setDeprecateVersion(v)}
            >
              Deprecate v{String(v.version_number)}
            </Button>
          ))}
        </div>
      )}
      <div className="mb-2 flex flex-wrap gap-2">
        {versions.slice(0, 6).map((v) => (
          <Badge key={String(v.id)} variant={stateVariant(String(v.state))}>
            v{String(v.version_number)} · {String(v.state)}
          </Badge>
        ))}
      </div>
      <FinTable
        columns={['version_number', 'state', 'properties_covered', 'monthly_price_minor', 'subscribers_count', 'effective_from']}
        rows={tableRows}
        onRowClick={(row) => navigate(`/admin/fin/packages/${id}/versions/${String(row.id)}`)}
      />
      {id && (
        <PackageDeprecateDialog
          open={Boolean(deprecateVersion)}
          packageId={id}
          version={deprecateVersion}
          onOpenChange={(open) => { if (!open) setDeprecateVersion(null) }}
          onDeprecated={() => reload()}
        />
      )}
    </FinAdminGate>
  )
}
