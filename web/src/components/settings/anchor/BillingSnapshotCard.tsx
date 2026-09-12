import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { fillCopy, settingsCopy } from '@/lib/settings-copy'

export function BillingSnapshotCard({
  planName,
  renewsAt,
  locale = 'en',
  hidden,
}: {
  planName?: string | null
  renewsAt?: string | null
  locale?: string
  hidden?: boolean
}) {
  if (hidden) return null
  const copy = settingsCopy(locale)
  return (
    <Card className="shadow-[var(--lc-elevation-sm)]">
      <CardContent className="flex flex-col gap-[var(--lc-space-xs)] p-[var(--lc-space-lg)]">
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
          {copy['anchor.billing.title']}
        </p>
        <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          {planName || '—'}
        </p>
        {renewsAt ? (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {fillCopy(copy['anchor.billing.renewsOn'], { date: renewsAt })}
          </p>
        ) : null}
        <Link
          to="/settings/billing"
          className="text-[var(--lc-text-brand)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          {copy['anchor.billing.action']}
        </Link>
      </CardContent>
    </Card>
  )
}
