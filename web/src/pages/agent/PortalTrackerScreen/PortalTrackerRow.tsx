import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { PortalStatusPill } from '@/components/ui/portal-status-pill'
import { PIIMask } from '@/components/security/PIIMask'
import { formatRelativeTime } from '@/lib/relative-time'
import { cn } from '@/lib/utils'
import type { PortalTrackerRow as TrackerRowModel } from '@/hooks/publishing/types'

export type PortalTrackerRowProps = {
  row: TrackerRowModel
  fading?: boolean
  className?: string
}

function maskAddress(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return '••••'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return `${parts[0].slice(0, 2)}••••`
  return `${parts[0]} ••••`
}

/**
 * One ledger row — listing (PII-masked) + portal mark + status pill + timestamp.
 * Click → `/publishing/receipts/:distributionAttemptId`.
 * Retry lives on AGT-PUB-003 only — never rendered here.
 */
export function PortalTrackerRow({ row, fading = false, className }: PortalTrackerRowProps) {
  const href = `/publishing/receipts/${row.distribution_attempt_id}`
  const address = row.listing.address_line || 'Listing'
  const portalName = row.portal.display_name || row.portal.code || 'Portal'
  const channel = row.portal.code || portalName
  const when = formatRelativeTime(row.updated_at || row.submitted_at)

  return (
    <Link
      to={href}
      data-testid={`tracker-row-${row.distribution_attempt_id}`}
      data-status={row.status}
      data-fading={fading ? 'true' : undefined}
      className={cn(
        'flex min-h-tap items-center gap-3 border-b border-[var(--lc-border)] px-[var(--lc-space-md)] py-3',
        'text-[var(--lc-text-primary)] transition-colors duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)]',
        'hover:bg-[var(--lc-surface-selected)] motion-reduce:transition-none',
        fading && 'opacity-60 motion-safe:animate-pulse',
        className,
      )}
      aria-label={`View submission details for ${portalName}`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] md:h-14 md:w-14"
        aria-hidden="true"
      >
        {row.listing.thumbnail_url ? (
          <img
            src={row.listing.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Home className="h-5 w-5 text-[var(--lc-text-muted)]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          <PIIMask
            value={address}
            maskedValue={maskAddress(address)}
            kind="name"
            auditContext={{
              caseId: row.listing.id || row.distribution_attempt_id,
              field: 'listing_address',
            }}
            revealDurationMs={30_000}
          />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--lc-text-muted)]">
          <ChannelMark channel={channel} label={portalName} />
          <span className="truncate">{portalName}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <PortalStatusPill status={row.status} pulse={false} />
        <div className="flex items-center gap-2 text-xs text-[var(--lc-text-muted)]">
          <Numeric>{row.credits_charged}</Numeric>
          <span>credits</span>
          {when ? (
            <time dateTime={row.updated_at || row.submitted_at || undefined}>{when}</time>
          ) : null}
        </div>
      </div>

      <span
        className="inline-flex h-tap w-tap shrink-0 items-center justify-center text-[var(--lc-text-muted)]"
        aria-hidden="true"
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </span>
    </Link>
  )
}
