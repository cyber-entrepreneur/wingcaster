import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type InboundAttachmentType = 'photo' | 'voice' | 'location' | string

export interface InboundAttachment {
  type: InboundAttachmentType
  count?: number
  /** Voice duration seconds, or preformatted `"0:42"`. */
  duration?: number | string
}

export interface InboundMessageSummaryProps {
  /** ISO 8601 timestamp of the inbound WhatsApp message. */
  received_at: string
  attachments: InboundAttachment[]
  /** Deep link back to the WhatsApp thread. */
  wa_me_link: string
  /** Optional relative-time string from the parent (e.g. "2 min ago"). */
  relativeTimeLabel?: string
  className?: string
}

function formatDuration(duration: number | string | undefined): string | null {
  if (duration == null) return null
  if (typeof duration === 'string') return duration
  const mm = Math.floor(duration / 60)
  const ss = String(duration % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function attachmentLabel(att: InboundAttachment): ReactNode {
  if (att.type === 'photo' || att.type === 'photos') {
    return (
      <>
        <Numeric>{att.count ?? 0}</Numeric> photos
      </>
    )
  }
  if (att.type === 'voice') {
    const dur = formatDuration(att.duration)
    return dur ? (
      <>
        Voice note · <Numeric>{dur}</Numeric>
      </>
    ) : (
      'Voice note'
    )
  }
  if (att.type === 'location') return 'Location pin'
  return att.type
}

/**
 * Compact inbound WhatsApp message summary (chat-bubble aesthetic).
 *
 * Used by: AGT-WLB-004 (above / beside `<LiveDraftCanvas>`).
 *
 * Stub visual + prop types only — no real message fetch.
 */
export function InboundMessageSummary({
  received_at,
  attachments,
  wa_me_link,
  relativeTimeLabel,
  className,
}: InboundMessageSummaryProps) {
  return (
    <aside
      className={cn(
        'rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
        className,
      )}
      data-received-at={received_at}
    >
      <p className="mb-[var(--lc-space-sm)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
        Message received {relativeTimeLabel ?? received_at}
      </p>

      <div className="mb-[var(--lc-space-sm)] flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <Badge key={`${att.type}-${i}`} variant="outline">
            {attachmentLabel(att)}
          </Badge>
        ))}
      </div>

      <a
        href={wa_me_link}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
      >
        View original message on WhatsApp
      </a>
    </aside>
  )
}
