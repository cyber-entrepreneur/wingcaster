import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export interface PAQueueBulkBarProps {
  /**
   * When false, the bar never renders (WF-04 PA-ACR-001 / WF-05 PA-PVA-008
   * omit bulk for PII / market-impact safety). Default `true`.
   */
  showBulk?: boolean
  /** Number of selected rows. Bar hidden when 0 even if showBulk. */
  selectedCount: number
  /** Optional aggregate: distinct portals / categories in selection. */
  acrossCount?: number
  /** High-risk rows in selection — surfaces step-up notice when > 0. */
  highRiskCount?: number
  onClearSelection?: () => void
  onApprove?: () => void
  onReject?: () => void
  onRequestInfo?: () => void
  /** Hide request-info for queues that lack that action. */
  showRequestInfo?: boolean
  /** Extra trailing actions slot. */
  extraActions?: ReactNode
  className?: string
  /** Override selected-count label prefix (i18n). */
  selectedLabel?: string
}

/**
 * Floating / sliding bulk-action bar for PA queues.
 *
 * Used by: PA-MOD-001, PA-PKG-003, PA-PVA-009 (when bulk enabled).
 * Omitted via `showBulk={false}` for: PA-ACR-001 (WF-04), PA-PVA-008 (WF-05).
 * Stub visual + prop types only — no real API.
 */
export function PAQueueBulkBar({
  showBulk = true,
  selectedCount,
  acrossCount,
  highRiskCount = 0,
  onClearSelection,
  onApprove,
  onReject,
  onRequestInfo,
  showRequestInfo = true,
  extraActions,
  className,
  selectedLabel = 'selected',
}: PAQueueBulkBarProps) {
  if (!showBulk || selectedCount < 1) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)]',
        'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        'transition-[height,opacity] duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--lc-text-primary)]">
        <span>
          <Numeric>{selectedCount}</Numeric> {selectedLabel}
        </span>
        <Button type="button" variant="link" size="sm" onClick={onClearSelection}>
          Clear selection
        </Button>
        {typeof acrossCount === 'number' ? (
          <span className="text-[var(--lc-text-muted)]">
            <Numeric>{selectedCount}</Numeric> across <Numeric>{acrossCount}</Numeric>
            {highRiskCount > 0 ? (
              <>
                {' '}
                · <Numeric>{highRiskCount}</Numeric> High-risk
              </>
            ) : null}
          </span>
        ) : null}
        {highRiskCount > 0 ? (
          <span className="text-sm text-[var(--lc-status-warning-fg)]">
            Step-up required for high-risk decisions.
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="default" size="sm" onClick={onApprove}>
          Approve <Numeric className="ms-1">{selectedCount}</Numeric>
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReject}>
          Reject <Numeric className="ms-1">{selectedCount}</Numeric>
        </Button>
        {showRequestInfo ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRequestInfo}>
            Request info <Numeric className="ms-1">{selectedCount}</Numeric>
          </Button>
        ) : null}
        {extraActions}
      </div>
    </div>
  )
}
