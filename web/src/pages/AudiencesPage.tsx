import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { usePageTitle } from '@/lib/usePageTitle'
import { api } from '@/api/client'
import type { Audience } from '@/types/audience'

export function AudiencesPage() {
  usePageTitle('Audiences')
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAudiences()
      .then((rows) => setAudiences(rows as Audience[]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <CrmShell>
      <CmdPageHeader
        title="Audiences"
        subtitle="First-class segments with consent-aware reach breakdown."
        actions={
          <Button asChild>
            <Link to="/audiences/new">
              <Plus className="mr-2 h-4 w-4" /> New audience
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading audiences…</p>
        ) : audiences.length === 0 ? (
          <div className="rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface)] p-8 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No audiences yet. Create one to target journeys and campaigns.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--lc-border)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)]">
            {audiences.map((audience) => (
              <li key={audience.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <Link to={`/audiences/${audience.id}`} className="font-medium text-[var(--lc-text-primary)] hover:underline">
                    {audience.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {audience.type} · {audience.tags_filter?.length ?? 0} tags · {audience.audience_rules?.length ?? 0} rules
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/audiences/${audience.id}`}>Edit</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CrmShell>
  )
}
