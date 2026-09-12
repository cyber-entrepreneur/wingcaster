import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LC_STATUS_GLYPH } from '@/theme/status'

export type AgencyEmptyStateVariant =
  | 'not-accepting'
  | 'invitation-expired'
  | 'invitation-revoked'
  | 'already-applied'

export type AgencyEmptyStateProps = {
  variant: AgencyEmptyStateVariant
  agencyName: string
  /** Existing application status label (already-applied). */
  applicationStatus?: string
  /** Days shown in invitation-expired body (default 14). */
  invitationTtlDays?: number
  /** Slug route for “Apply directly” after expired invite. */
  applyDirectlyHref?: string
  /** Deep-link to AGT-REC-004. */
  applicationStatusHref?: string
  /** mailto: or tel: / WhatsApp for “Contact the agency”. */
  contactHref?: string
  onContact?: () => void
  className?: string
}

const VARIANT_STYLE: Record<
  AgencyEmptyStateVariant,
  { bg: string; fg: string; glyph: string; role: 'alert' | 'status' }
> = {
  'not-accepting': {
    bg: 'bg-[var(--lc-status-closed-bg)]',
    fg: 'text-[var(--lc-status-closed-fg)]',
    glyph: LC_STATUS_GLYPH.closed,
    role: 'alert',
  },
  'invitation-expired': {
    bg: 'bg-[var(--lc-status-archived-bg)]',
    fg: 'text-[var(--lc-status-archived-fg)]',
    glyph: LC_STATUS_GLYPH.archived,
    role: 'alert',
  },
  'invitation-revoked': {
    bg: 'bg-[var(--lc-status-archived-bg)]',
    fg: 'text-[var(--lc-status-archived-fg)]',
    glyph: LC_STATUS_GLYPH.archived,
    role: 'alert',
  },
  'already-applied': {
    bg: 'bg-[var(--lc-status-archived-bg)]',
    fg: 'text-[var(--lc-status-archived-fg)]',
    glyph: LC_STATUS_GLYPH.archived,
    role: 'alert',
  },
}

/**
 * AGN-MEM-005 empty / failure panels — tint + glyph + label (never color alone).
 */
export function AgencyEmptyState({
  variant,
  agencyName,
  applicationStatus = 'pending',
  invitationTtlDays = 14,
  applyDirectlyHref,
  applicationStatusHref,
  contactHref,
  onContact,
  className,
}: AgencyEmptyStateProps) {
  const style = VARIANT_STYLE[variant]

  let heading: string
  let body: string
  if (variant === 'not-accepting') {
    heading = `${agencyName} isn't accepting new applications right now`
    body = 'The agency has paused new applications. You can still explore other agencies on WingCaster.'
  } else if (variant === 'invitation-expired') {
    heading = 'This invitation has expired'
    body = `Invitation links from ${agencyName} expire after ${invitationTtlDays} days. Ask the agency owner to send you a new link, or apply directly.`
  } else if (variant === 'invitation-revoked') {
    heading = 'This invitation has expired'
    body = 'This invitation has been revoked by the agency owner.'
  } else {
    heading = `You've already applied to ${agencyName}`
    body = `Your application is currently ${applicationStatus}. You'll be notified when there's an update.`
  }

  return (
    <div
      role={style.role}
      className={cn(
        'rounded-[var(--lc-radius-lg)] p-[var(--lc-space-xl)]',
        style.bg,
        style.fg,
        className,
      )}
    >
      <h2
        className="flex flex-wrap items-center gap-2"
        style={{ font: 'var(--lc-type-heading-2)' }}
      >
        <span aria-hidden="true">{style.glyph}</span>
        <span>{heading}</span>
      </h2>
      <p className="mt-[var(--lc-space-sm)]" style={{ font: 'var(--lc-type-body)' }}>
        {body}
      </p>

      <div className="mt-[var(--lc-space-lg)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:flex-wrap">
        {variant === 'not-accepting' ? (
          <Button asChild variant="secondary" size="lg">
            <Link to="/agencies">Browse other agencies →</Link>
          </Button>
        ) : null}

        {(variant === 'invitation-expired' || variant === 'invitation-revoked') && applyDirectlyHref ? (
          <Button asChild variant="default" size="lg">
            <Link to={applyDirectlyHref}>Apply directly to {agencyName} →</Link>
          </Button>
        ) : null}

        {(variant === 'invitation-expired' || variant === 'invitation-revoked') ? (
          contactHref ? (
            <Button asChild variant="ghost" size="lg">
              <a href={contactHref}>Contact the agency</a>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="lg" onClick={onContact}>
              Contact the agency
            </Button>
          )
        ) : null}

        {variant === 'already-applied' && applicationStatusHref ? (
          <Button asChild variant="default" size="lg">
            <Link to={applicationStatusHref}>See your application status →</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
