/**
 * Standalone audience builder — embeddable via AudienceBuilderForm (embedded prop).
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { AudienceBuilderForm } from '@/components/audiences/AudienceBuilderForm'
import { usePageTitle } from '@/lib/usePageTitle'
import { api } from '@/api/client'
import type { Audience } from '@/types/audience'

export function AudienceBuilderPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const embedded = searchParams.get('embedded') === '1'
  const [audience, setAudience] = useState<Audience | null>(null)
  const [loading, setLoading] = useState(Boolean(id))

  usePageTitle(id ? 'Edit audience' : 'New audience')

  useEffect(() => {
    if (!id) return
    api.getAudience(id)
      .then((row) => setAudience(row as Audience))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <CrmShell>
        <p className="p-6 text-sm text-muted-foreground">Loading audience…</p>
      </CrmShell>
    )
  }

  return (
    <CrmShell>
      {!embedded && (
        <CmdPageHeader
          title={id ? 'Edit audience' : 'New audience'}
          subtitle="Build a consent-aware segment for journeys and campaigns."
          actions={
            <Button asChild variant="ghost">
              <Link to="/audiences">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          }
        />
      )}
      <div className="p-6">
        <AudienceBuilderForm
          initial={audience ?? undefined}
          audienceId={id}
          embedded={embedded}
          onSaved={(saved) => {
            if (!id) navigate(`/audiences/${saved.id}`)
          }}
        />
      </div>
    </CrmShell>
  )
}
