import type { ReactNode } from 'react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/**
 * Timeline entry severity / outcome.
 * Dot colors (PA-ACR-002 Broadcast callouts):
 * - `success` / `info` → `--lc-accent-bold-edge`
 * - `failed` → `--lc-status-danger-fg`
 * - `pending` / `warning` → `--lc-status-warning-fg`
 */
export type TimelineEntryStatus = 'info' | 'success' | 'failed' | 'pending' | 'warning'

export interface TimelineEntry {
  /** Stable key; falls back to index when omitted. */
  id?: string
  /** ISO timestamp (rendered mono + tabular via `<Numeric>`). */
  at: string
  /**
   * Optional channel for `<ChannelMark>` (`email` / `sms` / `whatsapp` / …).
   * Unknown / `system` channels omit the mark.
   */
  channel?: string | null
  /** Status drives leading-dot color + glyph. */
  status: TimelineEntryStatus
  /** Primary message body (parent supplies i18n / copy). */
  message: string
  /** Optional short title above the message. */
  title?: string
  /** Optional trailing action / meta slot. */
  meta?: ReactNode
}

export interface TimelineProps {
  /** Ordered entries (oldest → newest or newest → oldest; parent decides). */
  entries: TimelineEntry[]
  /** Optional section heading (e.g. "Automated challenge history"). */
  title?: string
  /** Empty-state copy when `entries` is empty. */
  emptyLabel?: string
  className?: string
}

function statusDotClass(status: TimelineEntryStatus): string {
  switch (status) {
    case 'failed':
      return 'bg-[var(--lc-status-danger-fg)]'
    case 'pending':
    case 'warning':
      return 'bg-[var(--lc-status-warning-fg)]'
    case 'success':
    case 'info':
    default:
      return 'bg-[var(--lc-accent-bold-edge)]'
  }
}

function statusGlyph(status: TimelineEntryStatus): string {
  switch (status) {
    case 'failed':
      return '◆'
    case 'pending':
    case 'warning':
      return '▲'
    case 'success':
      return '●'
    case 'info':
    default:
      return '○'
  }
}

function formatTimestamp(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ms))
  } catch {
    return iso
  }
}

/**
 * Shared audit / event timeline (vertical rail of sunken cards).
 *
 * Used by: PA-ACR-002 contact-attempt history, PA-AUD-001 audit trail,
 * and other PA WF surfaces that need a chronological event log.
 *
 * Stub visual + prop types only — no audit API.
 */
export function Timeline({
  entries,
  title,
  emptyLabel = 'No events yet.',
  className,
}: TimelineProps) {
  const headingId = title ? 'timeline-heading' : undefined

  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex w-full flex-col gap-[var(--lc-space-sm)]', className)}
      data-timeline
    >
      {title ? (
        <h3
          id={headingId}
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          {title}
        </h3>
      ) : null}

      {entries.length === 0 ? (
        <p
          className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          {emptyLabel}
        </p>
      ) : (
        <ol className="relative m-0 flex list-none flex-col gap-[var(--lc-space-sm)] p-0">
          {entries.map((entry, index) => {
            const key = entry.id ?? `${entry.at}-${index}`
            return (
              <li key={key} className="relative flex gap-[var(--lc-space-md)]">
                <div className="flex w-4 shrink-0 flex-col items-center">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-3 h-2.5 w-2.5 shrink-0 rounded-full',
                      statusDotClass(entry.status),
                    )}
                  />
                  {index < entries.length - 1 ? (
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-[var(--lc-border)]"
                    />
                  ) : null}
                </div>

                <article
                  className={cn(
                    'min-w-0 flex-1 rounded-[var(--lc-radius-lg)]',
                    'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
                  )}
                >
                  <header className="mb-1 flex flex-wrap items-center gap-2">
                    <time
                      dateTime={entry.at}
                      className="text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                      title={entry.at}
                    >
                      <Numeric>{formatTimestamp(entry.at)}</Numeric>
                    </time>

                    {entry.channel ? (
                      <ChannelMark channel={entry.channel} className="h-5 w-5" />
                    ) : null}

                    <span
                      aria-hidden
                      className="text-[var(--lc-text-secondary)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      {statusGlyph(entry.status)}
                    </span>

                    <span className="sr-only">Status: {entry.status}</span>
                  </header>

                  {entry.title ? (
                    <p
                      className="mb-0.5 font-medium text-[var(--lc-text-primary)]"
                      style={{ font: 'var(--lc-type-body-sm)' }}
                    >
                      {entry.title}
                    </p>
                  ) : null}

                  <p
                    className="text-[var(--lc-text-secondary)]"
                    style={{ font: 'var(--lc-type-body-sm)' }}
                  >
                    {entry.message}
                  </p>

                  {entry.meta ? (
                    <div className="mt-[var(--lc-space-sm)]">{entry.meta}</div>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
