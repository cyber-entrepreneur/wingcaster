import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { PortalStatusPill } from '@/components/ui/portal-status-pill'
import { cn } from '@/lib/utils'
import {
  absoluteSubmittedLabel,
  formatRelativeSubmittedAt,
  ListingThumb,
  PortalMark,
} from './PortalTrackerScreen/PortalMark'
import { receiptPathForRow, type TrackerRow } from './PortalTrackerScreen/types'

export type PortalTrackerRowProps = {
  row: TrackerRow
  /** Desktop table row vs mobile list item. */
  layout?: 'mobile' | 'desktop'
  onNavigate?: (path: string) => void
  className?: string
  /** Brief live-update cross-fade hook. */
  justUpdated?: boolean
}

/**
 * Single tracker row — mobile card anatomy or desktop table row.
 * Full row is the action; chevron is a redundant a11y affordance.
 */
export function PortalTrackerRow({
  row,
  layout = 'mobile',
  onNavigate,
  className,
  justUpdated = false,
}: PortalTrackerRowProps) {
  const path = receiptPathForRow(row)
  const address = row.listing.address_line || 'Listing'
  const portalName = row.portal.display_name || row.portal.code || 'Portal'
  const relative = formatRelativeSubmittedAt(row.submitted_at)
  const absolute = absoluteSubmittedLabel(row.submitted_at)
  const go = () => onNavigate?.(path)

  if (layout === 'desktop') {
    return (
      <tr
        className={cn(
          'cursor-pointer border-b border-[var(--lc-border)]',
          'transition-colors duration-fast ease-out motion-reduce:transition-none',
          'hover:bg-[var(--lc-action-secondary)] focus-within:bg-[var(--lc-action-secondary)]',
          justUpdated && 'motion-safe:animate-[lc-fade_var(--lc-duration-base)_var(--lc-easing-out)]',
          className,
        )}
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            go()
          }
        }}
        data-attempt-id={row.distribution_attempt_id}
      >
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <div className="flex items-center gap-[var(--lc-space-sm)]">
            <ListingThumb url={row.listing.thumbnail_url} alt="" size={56} />
            <span style={{ font: 'var(--lc-type-body)' }} className="text-[var(--lc-text-primary)]">
              {address}
            </span>
          </div>
        </td>
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <div className="flex items-center gap-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            <PortalMark
              code={row.portal.code}
              displayName={row.portal.display_name}
              channelTokenKey={row.portal.channel_token_key}
              size={24}
            />
            <span>{portalName}</span>
          </div>
        </td>
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <Numeric
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-data-sm)' }}
            title={absolute}
            aria-label={absolute ? `${relative}, ${absolute}` : relative}
          >
            {relative}
          </Numeric>
        </td>
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <PortalStatusPill status={row.status} pulse={false} />
        </td>
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>
            {row.credits_charged} credits
          </Numeric>
        </td>
        <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="View submission details"
            onClick={(e) => {
              e.stopPropagation()
              go()
            }}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <li className={cn('list-none border-b border-[var(--lc-border)]', className)}>
      <a
        role="button"
        href={path}
        data-attempt-id={row.distribution_attempt_id}
        className={cn(
          'flex gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
          'transition-colors duration-fast ease-out motion-reduce:transition-none',
          'hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none',
          justUpdated && 'motion-safe:opacity-100',
        )}
        onClick={(e) => {
          e.preventDefault()
          go()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            go()
          }
        }}
      >
        <ListingThumb url={row.listing.thumbnail_url} alt="" size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className="truncate text-[var(--lc-text-primary)]"
              style={{ font: 'var(--lc-type-body)' }}
            >
              {address}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              tabIndex={-1}
              aria-hidden="true"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                go()
              }}
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
          <div
            className="mt-0.5 flex items-center gap-1.5 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            <span>{portalName}</span>
            <PortalMark
              code={row.portal.code}
              displayName={row.portal.display_name}
              channelTokenKey={row.portal.channel_token_key}
              size={20}
            />
          </div>
          <div className="mt-[var(--lc-space-2xs)] flex flex-wrap items-center gap-x-2 gap-y-1">
            <PortalStatusPill status={row.status} pulse={false} />
            <span className="text-[var(--lc-text-muted)]" aria-hidden="true">
              ·
            </span>
            <Numeric
              className="text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-data-sm)' }}
            >
              {row.credits_charged} credits
            </Numeric>
            <span className="text-[var(--lc-text-muted)]" aria-hidden="true">
              ·
            </span>
            <Numeric
              className="text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-data-sm)' }}
              title={absolute}
              aria-label={absolute ? `${relative}, ${absolute}` : relative}
            >
              {relative}
            </Numeric>
          </div>
        </div>
      </a>
    </li>
  )
}
