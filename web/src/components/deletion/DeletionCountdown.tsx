import { useEffect, useRef, useState } from 'react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type DeletionCountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

export type DeletionCountdownProps = {
  /** Absolute deletion instant (ISO 8601). */
  deletionAt: string
  /** Optional clock override for tests (ms since epoch). */
  nowMs?: number
  /** Fired once when the countdown reaches zero. */
  onReachZero?: () => void
  /** Fired once when remaining time crosses under 24h. */
  onEnterFinalDay?: () => void
  className?: string
  /** Locale for absolute date line (default en-GB). */
  locale?: string
}

const LABELS = {
  top: 'Deletion scheduled for',
  days: 'DAYS',
  hours: 'HOURS',
  minutes: 'MINUTES',
  seconds: 'SECONDS',
} as const

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function splitRemaining(totalMs: number): DeletionCountdownParts {
  const clamped = Math.max(0, totalMs)
  const days = Math.floor(clamped / DAY_MS)
  const hours = Math.floor((clamped % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((clamped % HOUR_MS) / (60 * 1000))
  const seconds = Math.floor((clamped % (60 * 1000)) / 1000)
  return { days, hours, minutes, seconds, totalMs: clamped }
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0')
}

function formatAbsolute(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

function DigitsBlock({
  value,
  label,
  urgent,
}: {
  value: string
  label: string
  urgent: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-[var(--lc-space-2xs)]">
      <Numeric
        className={cn(
          // Fixed ch-width + tabular-nums → digits never reflow on tick.
          'inline-block min-w-[2.5ch] text-center tabular-nums transition-colors duration-instant',
          'motion-reduce:transition-none',
          urgent
            ? 'text-[var(--lc-status-unpublished-fg)]'
            : 'text-[var(--lc-status-underOffer-fg)]',
        )}
        style={{
          font: 'var(--lc-type-display)',
          letterSpacing: 'var(--lc-tracking-display, -0.03em)',
        }}
        data-countdown-digits={label.toLowerCase()}
      >
        {value}
      </Numeric>
      <span
        className="text-[var(--lc-text-muted)]"
        style={{
          font: 'var(--lc-type-overline)',
          letterSpacing: 'var(--lc-tracking-overline, 0.08em)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * Ticking DD:HH:MM:SS countdown for scheduled account deletion (SHR-AUT-005d).
 *
 * Digits use `<Numeric>` (mono + tabular-nums) with fixed `ch` widths so the
 * layout does not shift as values tick. The timer itself uses `aria-live="off"`;
 * boundary announcements (T-24h) fire via a separate polite live region.
 */
export function DeletionCountdown({
  deletionAt,
  nowMs,
  onReachZero,
  onEnterFinalDay,
  className,
  locale = 'en-GB',
}: DeletionCountdownProps) {
  const target = new Date(deletionAt).getTime()
  const [parts, setParts] = useState<DeletionCountdownParts>(() =>
    splitRemaining(target - (nowMs ?? Date.now())),
  )
  const [announce, setAnnounce] = useState('')
  const reachedZero = useRef(false)
  // Start false so the first tick can announce when already inside the final day.
  const enteredFinalDay = useRef(false)

  useEffect(() => {
    const tick = () => {
      const remaining = splitRemaining(target - (nowMs ?? Date.now()))
      setParts(remaining)

      if (
        remaining.totalMs > 0 &&
        remaining.totalMs <= DAY_MS &&
        !enteredFinalDay.current
      ) {
        enteredFinalDay.current = true
        setAnnounce('Final 24 hours until deletion')
        onEnterFinalDay?.()
      }

      if (remaining.totalMs <= 0 && !reachedZero.current) {
        reachedZero.current = true
        onReachZero?.()
      }
    }

    tick()
    // Controlled clock (tests): no interval — parent drives via nowMs.
    if (nowMs != null) return undefined

    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [target, nowMs, onReachZero, onEnterFinalDay])

  const urgent = parts.totalMs > 0 && parts.totalMs <= DAY_MS
  const absolute = formatAbsolute(deletionAt, locale)
  const ariaLabel = `Time until deletion: ${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes`

  return (
    <div className={cn('w-full px-[var(--lc-space-md)] py-[var(--lc-space-lg)]', className)}>
      <p
        className="text-center text-[var(--lc-text-muted)]"
        style={{
          font: 'var(--lc-type-overline)',
          letterSpacing: 'var(--lc-tracking-overline, 0.08em)',
        }}
      >
        {LABELS.top}
      </p>
      <p
        className="mt-[var(--lc-space-2xs)] text-center text-[var(--lc-text-heading)]"
        style={{
          font: 'var(--lc-type-heading-3)',
          letterSpacing: 'var(--lc-tracking-heading-3)',
        }}
      >
        {absolute}
      </p>

      {/* Countdown digits stay LTR even in RTL pages (international timer convention). */}
      <div
        role="timer"
        aria-live="off"
        aria-atomic="true"
        aria-label={ariaLabel}
        dir="ltr"
        className="mt-[var(--lc-space-md)] flex items-start justify-center gap-[var(--lc-space-sm)]"
        data-deletion-countdown
        data-urgent={urgent ? 'true' : 'false'}
      >
        <DigitsBlock value={pad2(parts.days)} label={LABELS.days} urgent={urgent} />
        <span
          aria-hidden="true"
          className={cn(
            'pt-1',
            urgent
              ? 'text-[var(--lc-status-unpublished-fg)]'
              : 'text-[var(--lc-status-underOffer-fg)]',
          )}
          style={{ font: 'var(--lc-type-display)' }}
        >
          :
        </span>
        <DigitsBlock value={pad2(parts.hours)} label={LABELS.hours} urgent={urgent} />
        <span
          aria-hidden="true"
          className={cn(
            'pt-1',
            urgent
              ? 'text-[var(--lc-status-unpublished-fg)]'
              : 'text-[var(--lc-status-underOffer-fg)]',
          )}
          style={{ font: 'var(--lc-type-display)' }}
        >
          :
        </span>
        <DigitsBlock value={pad2(parts.minutes)} label={LABELS.minutes} urgent={urgent} />
        <span
          aria-hidden="true"
          className={cn(
            'pt-1',
            urgent
              ? 'text-[var(--lc-status-unpublished-fg)]'
              : 'text-[var(--lc-status-underOffer-fg)]',
          )}
          style={{ font: 'var(--lc-type-display)' }}
        >
          :
        </span>
        <DigitsBlock value={pad2(parts.seconds)} label={LABELS.seconds} urgent={urgent} />
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
    </div>
  )
}
