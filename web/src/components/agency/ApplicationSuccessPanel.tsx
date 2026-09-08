import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { LC_STATUS_GLYPH } from '@/theme/status'

export type ApplicationSuccessPanelProps = {
  agencyName: string
  ownerFirstName?: string | null
  applicationId: string
  trackHref?: string
  className?: string
}

/**
 * AGN-MEM-005 success confirmation — published tint + ● glyph + last-6 UUID.
 */
export function ApplicationSuccessPanel({
  agencyName,
  ownerFirstName,
  applicationId,
  trackHref,
  className,
}: ApplicationSuccessPanelProps) {
  const last6 = applicationId.slice(-6)
  const track = trackHref ?? `/applications/${applicationId}`
  const reviewer = ownerFirstName?.trim() || 'The team'

  return (
    <Card
      role="status"
      className={cn(
        'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
        'rounded-[var(--lc-radius-lg)]',
        className,
      )}
    >
      <CardContent className="flex flex-col gap-[var(--lc-space-md)] p-[var(--lc-space-xl)]">
        <h2
          className="flex flex-wrap items-center gap-2"
          style={{ font: 'var(--lc-type-heading-2)' }}
        >
          <span aria-hidden="true">{LC_STATUS_GLYPH.published}</span>
          <CircleCheck className="h-5 w-5" aria-hidden />
          <span>Application sent to {agencyName}</span>
        </h2>
        <p style={{ font: 'var(--lc-type-body)' }}>
          {reviewer} and the team will review your application. You&apos;ll hear back within 2
          business days.
        </p>
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-data-sm)' }}>
          Ref <Numeric>{last6}</Numeric>
        </p>
        <div className="mt-[var(--lc-space-sm)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
          <Button asChild variant="default" size="lg">
            <Link to={track}>Track your application →</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/agencies">Browse other agencies</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
