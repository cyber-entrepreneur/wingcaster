import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Built-in bulk actions the bar can expose. */
export type PAQueueBulkAction = 'approve' | 'reject' | 'request_info'

const DEFAULT_ACTIONS: PAQueueBulkAction[] = ['approve', 'reject', 'request_info']

export interface PAQueueBulkBarProps {
  /**
   * When false, the bar never renders (WF-04 PA-ACR-001 omits bulk for PII safety).
   * Default `true`. WF-05 PA-PVA-008 keeps the bar but restricts `actions` —
   * see `actions` prop comment.
   */
  showBulk?: boolean
  /**
   * Restrict which built-in buttons render. Default all three.
   *
   * WF-05 PA-PVA-008 MUST pass `['reject', 'request_info']` only — confirm-remove /
   * confirm-quarantine (the "approve" family) are deliberately omitted because
   * removal re-runs valuations market-wide; a wrong bulk confirm could invalidate
   * thousands of valuations. Single-row confirm-remove lives on PA-PVA-008b only.
   */
  actions?: PAQueueBulkAction[]
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
  /**
   * @deprecated Prefer `actions` without `'request_info'`.
   * Hide request-info for queues that lack that action. Ignored when `actions` is set.
   */
  showRequestInfo?: boolean
  /** Extra trailing actions slot. */
  extraActions?: ReactNode
  className?: string
  /** Override selected-count label prefix (i18n). */
  selectedLabel?: string
  /** Override Approve button label (prefix before count). */
  approveLabel?: string
  /** Override Reject button label (prefix before count). */
  rejectLabel?: string
  /** Override Request-info button label (prefix before count). */
  requestInfoLabel?: string
  /** Optional step-up notice copy override. */
  stepUpNotice?: string
}

/**
 * Floating / sliding bulk-action bar for PA queues.
 *
 * Used by: PA-MOD-001, PA-PKG-003, PA-PVA-009 (full actions).
 * Restricted via `actions={['reject','request_info']}` for: PA-PVA-008 (WF-05).
 * Omitted via `showBulk={false}` for: PA-ACR-001 (WF-04).
 * Stub visual + prop types only — no real API.
 */
export function PAQueueBulkBar({
  showBulk = true,
  actions,
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
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  requestInfoLabel = 'Request info',
  stepUpNotice = 'Step-up required for high-risk decisions.',
}: PAQueueBulkBarProps) {
  if (!showBulk || selectedCount < 1) return null

  const resolvedActions =
    actions ??
    (showRequestInfo
      ? DEFAULT_ACTIONS
      : (DEFAULT_ACTIONS.filter((a) => a !== 'request_info') as PAQueueBulkAction[]))

  const showApprove = resolvedActions.includes('approve')
  const showReject = resolvedActions.includes('reject')
  const showRequest = resolvedActions.includes('request_info')

  return (
    <div
      role="status"
      aria-live="polite"
      data-pa-queue-bulk-actions={resolvedActions.join(',')}
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
          <span className="text-sm text-[var(--lc-status-warning-fg)]">{stepUpNotice}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showApprove ? (
          <Button type="button" variant="default" size="sm" onClick={onApprove}>
            {approveLabel} <Numeric className="ms-1">{selectedCount}</Numeric>
          </Button>
        ) : null}
        {showReject ? (
          <Button type="button" variant="secondary" size="sm" onClick={onReject}>
            {rejectLabel} <Numeric className="ms-1">{selectedCount}</Numeric>
          </Button>
        ) : null}
        {showRequest ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRequestInfo}>
            {requestInfoLabel} <Numeric className="ms-1">{selectedCount}</Numeric>
          </Button>
        ) : null}
        {extraActions}
      </div>
    </div>
  )
}
