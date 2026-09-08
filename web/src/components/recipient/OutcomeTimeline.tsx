import { Numeric } from '@/components/ui/numeric'

/**
 * One node on the REC-family outcome timeline rail.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006.
 */
export type OutcomeTimelineEvent = {
  /** Stable key for React. */
  key: string
  /** e.g. "Submitted", "Viewed by agency", "Decided". */
  label: string
  /** ISO 8601; omit → "Pending" muted. */
  timestamp?: string
  state: 'complete' | 'current' | 'pending' | 'skipped'
}

/**
 * Vertical `<ol>` event rail with complete / current / pending / skipped dots.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006.
 *
 * Signal-lamp pulse is legal ONLY on `state="current"` and is skipped under
 * `prefers-reduced-motion`.
 */
export type OutcomeTimelineProps = {
  /** Ordered top → bottom. */
  events: OutcomeTimelineEvent[]
}

function formatTimestampStub(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Dot({ state }: { state: OutcomeTimelineEvent['state'] }) {
  if (state === 'complete') {
    return (
      <span
        aria-hidden="true"
        className="relative z-[1] block h-3 w-3 rounded-full bg-[var(--lc-accent-bold)] outline outline-1 outline-[var(--lc-accent-bold-edge)]"
      />
    )
  }

  if (state === 'current') {
    return (
      <span
        aria-hidden="true"
        className="lc-rec-signal-dot relative z-[1] block h-3 w-3 rounded-full border-2 border-[var(--lc-accent-bold-edge)] bg-transparent"
      />
    )
  }

  if (state === 'skipped') {
    return (
      <span
        aria-hidden="true"
        className="relative z-[1] block h-3 w-3 rounded-full border-2 border-dashed border-[var(--lc-border)] bg-transparent"
      />
    )
  }

  // pending
  return (
    <span
      aria-hidden="true"
      className="relative z-[1] block h-3 w-3 rounded-full border-2 border-[var(--lc-border-strong)] bg-transparent"
    />
  )
}

function ruleColorBetween(
  from: OutcomeTimelineEvent['state'],
  to: OutcomeTimelineEvent['state'],
): string {
  // Between two complete dots → accent edge; before pending/current → border.
  if (from === 'complete' && to === 'complete') return 'var(--lc-accent-bold-edge)'
  return 'var(--lc-border)'
}

export function OutcomeTimeline({ events }: OutcomeTimelineProps) {
  return (
    <>
      <style>{`
        @keyframes lc-rec-signal-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.15); }
        }
        .lc-rec-signal-dot {
          animation: lc-rec-signal-pulse var(--lc-duration-slow) var(--lc-easing-emphasis) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .lc-rec-signal-dot { animation: none; }
        }
      `}</style>
      <ol className="relative ms-[var(--lc-space-md)] list-none p-0 pe-[var(--lc-space-md)] ps-0">
        {events.map((event, index) => {
          const isLast = index === events.length - 1
          const next = events[index + 1]
          const segmentColor = next
            ? ruleColorBetween(event.state, next.state)
            : 'var(--lc-border)'

          return (
            <li
              key={event.key}
              className="relative flex min-h-[var(--lc-space-2xl)] gap-[var(--lc-space-md)] pb-[var(--lc-space-md)] last:pb-0"
              aria-current={event.state === 'current' ? 'step' : undefined}
            >
              <div className="relative flex w-3 shrink-0 flex-col items-center">
                <Dot state={event.state} />
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-3 bottom-0 mx-auto w-0.5"
                    style={{ background: segmentColor }}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-start">
                <p
                  className="text-[var(--lc-text-primary)]"
                  style={{ font: 'var(--lc-type-body)' }}
                >
                  {event.label}
                </p>
                {event.timestamp ? (
                  <Numeric
                    className="mt-0.5 block text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-caption)' }}
                  >
                    {formatTimestampStub(event.timestamp)}
                  </Numeric>
                ) : (
                  <p
                    className="mt-0.5 text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-caption)' }}
                  >
                    Pending
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
