import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'

/** Vote cast by an approver slot. */
export type TwoPersonVote = 'approve' | 'reject'

/**
 * One approver slot on the two-person progress bar.
 * Used by PA-ACR-002 decision panel and PA-APR-003 execute modal.
 */
export interface TwoPersonApprover {
  /** Stable user id (optional for pending-you slot). */
  id?: string
  /** Display name for tooltips / SR description. */
  displayName?: string
  /** Initials shown in the step chip (e.g. "SM"). */
  initials: string
  /** ISO timestamp of sign-off; omit / null while pending. */
  signedOffAt?: string | null
  /** Vote recorded at sign-off (informational). */
  vote?: TwoPersonVote | null
}

export type TwoPersonPendingTone = 'draft' | 'warning'

export interface TwoPersonProgressProps {
  /**
   * First approver / reviewer slot.
   * When `signedOffAt` is set the step renders completed (● published).
   */
  firstApprover?: TwoPersonApprover | null
  /**
   * Second approver / reviewer slot (often the current PA).
   * Pending while `signedOffAt` is unset.
   */
  secondApprover?: TwoPersonApprover | null
  /** Overline label above step 1. Default: "First reviewer". */
  firstStepLabel?: string
  /** Overline label above step 2. Default: "Second reviewer". */
  secondStepLabel?: string
  /**
   * Body text under step 2 while pending.
   * Default: "Awaiting second reviewer".
   * PA-APR-003 often passes "Pending — your confirmation".
   */
  pendingSecondLabel?: string
  /**
   * Pending-step color set.
   * - `draft` — PA-ACR-002 (`--lc-status-draft-*`)
   * - `warning` — PA-APR-003 pulse (`--lc-status-warning-*` + accent edge pulse)
   */
  pendingTone?: TwoPersonPendingTone
  className?: string
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.round((Date.now() - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

interface StepProps {
  label: string
  complete: boolean
  initials?: string
  detail: string
  pendingTone: TwoPersonPendingTone
  pulse: boolean
}

function Step({ label, complete, initials, detail, pendingTone, pulse }: StepProps) {
  const pendingBg =
    pendingTone === 'warning'
      ? 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
      : 'bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]'
  const pendingDot =
    pendingTone === 'warning'
      ? 'text-[var(--lc-status-warning-dot)]'
      : 'text-[var(--lc-status-draft-dot)]'

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span
        className="text-[var(--lc-text-muted)] uppercase tracking-wide"
        style={{ font: 'var(--lc-type-overline)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            complete
              ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
              : pendingBg,
            pulse &&
              !complete &&
              'ring-2 ring-[var(--lc-accent-bold-edge)] motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        >
          {initials ?? '·'}
        </span>
        <span
          aria-hidden
          className={cn(
            'text-sm',
            complete ? 'text-[var(--lc-status-published-dot)]' : pendingDot,
          )}
        >
          {complete ? '●' : '○'}
        </span>
        <span className="min-w-0 truncate text-sm text-[var(--lc-text-secondary)]">
          {detail}
        </span>
      </div>
    </div>
  )
}

/**
 * Horizontal two-person / second-approval progress indicator.
 *
 * Used by: PA-ACR-002 (account recovery detail), PA-APR-003 (execute modal),
 * and every WF-07/08/17–25/27–28 second-approval surface.
 *
 * Non-clickable / informational only. Colors: completed
 * `--lc-status-published-*` + ●; pending `--lc-status-draft-*` or warning + ○.
 *
 * Stub visual + prop types only — no vote API.
 */
export function TwoPersonProgress({
  firstApprover = null,
  secondApprover = null,
  firstStepLabel = 'First reviewer',
  secondStepLabel = 'Second reviewer',
  pendingSecondLabel = 'Awaiting second reviewer',
  pendingTone = 'draft',
  className,
}: TwoPersonProgressProps) {
  const firstComplete = Boolean(firstApprover?.signedOffAt)
  const secondComplete = Boolean(secondApprover?.signedOffAt)
  const valueNow = (firstComplete ? 1 : 0) + (secondComplete ? 1 : 0)

  const firstRel = formatRelative(firstApprover?.signedOffAt)
  const secondRel = formatRelative(secondApprover?.signedOffAt)

  const firstDetail = firstComplete
    ? [firstApprover?.initials, firstRel ? `Signed off ${firstRel}` : 'Signed off']
        .filter(Boolean)
        .join(' · ')
    : 'Pending'

  const secondDetail = secondComplete
    ? [secondApprover?.initials, secondRel ? `Signed off ${secondRel}` : 'Signed off']
        .filter(Boolean)
        .join(' · ')
    : pendingSecondLabel

  const srDescription = [
    firstComplete
      ? `First approver ${firstApprover?.displayName ?? firstApprover?.initials ?? ''} signed off${firstRel ? ` ${firstRel}` : ''}.`
      : 'First approver pending.',
    secondComplete
      ? `Second approver ${secondApprover?.displayName ?? secondApprover?.initials ?? ''} signed off${secondRel ? ` ${secondRel}` : ''}.`
      : `${pendingSecondLabel}.`,
  ].join(' ')

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={2}
      aria-valuenow={valueNow}
      aria-label="Two-person approval progress"
      className={cn(
        'flex w-full flex-col gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-lg)]',
        'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
        className,
      )}
      data-two-person-progress
    >
      <span className="sr-only">{srDescription}</span>

      <div className="flex items-stretch gap-[var(--lc-space-md)]">
        <Step
          label={firstStepLabel}
          complete={firstComplete}
          initials={firstApprover?.initials}
          detail={firstDetail}
          pendingTone={pendingTone}
          pulse={false}
        />

        <div
          aria-hidden
          className={cn(
            'mt-6 h-0.5 min-w-[1.5rem] flex-1 self-start',
            firstComplete
              ? 'bg-[var(--lc-status-published-dot)]'
              : 'bg-[var(--lc-border-strong)]',
          )}
        />

        <Step
          label={secondStepLabel}
          complete={secondComplete}
          initials={secondApprover?.initials}
          detail={secondDetail}
          pendingTone={pendingTone}
          pulse={!secondComplete && firstComplete}
        />
      </div>

      {firstApprover?.signedOffAt ? (
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          First sign-off{' '}
          <Numeric as="span" title={firstApprover.signedOffAt}>
            {firstRel ?? firstApprover.signedOffAt}
          </Numeric>
        </p>
      ) : null}
    </div>
  )
}
