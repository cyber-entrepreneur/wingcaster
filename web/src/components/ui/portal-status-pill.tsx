import type { LucideIcon } from 'lucide-react'
import {
  AlertOctagon,
  CheckCircle2,
  Eye,
  Hourglass,
  Send,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Six-status portal submission pill (tint + glyph + label — never colour alone).
 *
 * Used by: AGT-PUB-006 tracker rows, AGT-PUB-003 `<PortalReceiptCard>`
 * (mapped from receipt status), and any surface that renders
 * `distribution_attempts.status`.
 *
 * Token map (AGT-PUB-006 §Broadcast alignment):
 * - `submitted` → draft status tokens + Send
 * - `in_review` → accent-bold fill + edge outline + Eye
 * - `live` → published status tokens + CheckCircle2
 * - `rejected` → closed status tokens + XCircle (decision, not error)
 * - `expired` → archived status tokens + Hourglass
 * - `failed` → danger status tokens + AlertOctagon (technical failure)
 *
 * Invariant: REJECTED and FAILED must stay visually distinct.
 */
export type PortalStatus =
  | 'submitted'
  | 'in_review'
  | 'live'
  | 'rejected'
  | 'expired'
  | 'failed'

export type PortalStatusPillProps = {
  status: PortalStatus
  /** Override default English label (e.g. error-class labels on failed receipt cards). */
  label?: string
  className?: string
  /**
   * When true, IN_REVIEW may show a signal-lamp pulse (AGT-PUB-003 in-flight).
   * AGT-PUB-006 tracker must leave this false.
   */
  pulse?: boolean
}

type PillSpec = {
  Glyph: LucideIcon
  defaultLabel: string
  className: string
  glyphClassName: string
}

const PILL_SPEC: Record<PortalStatus, PillSpec> = {
  submitted: {
    Glyph: Send,
    defaultLabel: 'Submitted',
    className:
      'border-transparent bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]',
    glyphClassName: 'text-[var(--lc-status-draft-dot)]',
  },
  in_review: {
    Glyph: Eye,
    defaultLabel: 'In review',
    className:
      'border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
    glyphClassName: 'text-[var(--lc-accent-bold-text)]',
  },
  live: {
    Glyph: CheckCircle2,
    defaultLabel: 'Live',
    className:
      'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
    glyphClassName: 'text-[var(--lc-status-published-dot)]',
  },
  rejected: {
    Glyph: XCircle,
    defaultLabel: 'Not accepted',
    className:
      'border-transparent bg-[var(--lc-status-closed-bg)] text-[var(--lc-status-closed-fg)]',
    glyphClassName: 'text-[var(--lc-status-closed-dot)]',
  },
  expired: {
    Glyph: Hourglass,
    defaultLabel: 'Timed out',
    className:
      'border-transparent bg-[var(--lc-status-archived-bg)] text-[var(--lc-text-muted)]',
    glyphClassName: 'text-[var(--lc-status-archived-dot)]',
  },
  failed: {
    Glyph: AlertOctagon,
    defaultLabel: 'Delivery failed',
    className:
      'border-transparent bg-[var(--lc-status-danger-bg)] text-[var(--lc-status-danger-fg)]',
    glyphClassName: 'text-[var(--lc-status-danger-fg)]',
  },
}

/**
 * Renders a status pill with glyph + label for every `PortalStatus` value.
 */
export function PortalStatusPill({
  status,
  label,
  className,
  pulse = false,
}: PortalStatusPillProps) {
  const spec = PILL_SPEC[status]
  const Glyph = spec.Glyph
  const text = label ?? spec.defaultLabel
  const showPulse = pulse && status === 'in_review'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2.5 py-0.5',
        'text-xs font-semibold transition-colors duration-base ease-out motion-reduce:transition-none',
        spec.className,
        className,
      )}
      aria-label={text}
    >
      <Glyph
        aria-hidden="true"
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          spec.glyphClassName,
          showPulse &&
            'motion-safe:animate-[lc-signal-pulse_var(--lc-duration-slow)_var(--lc-easing-emphasis)_infinite]',
        )}
      />
      <span>{text}</span>
    </span>
  )
}
