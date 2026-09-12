import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { PortalSourceChip } from '@/components/inbox/PortalSourceChip'
import { channelLabel } from '@/lib/inbox-labels'
import { cn } from '@/lib/utils'

export type MessageDeliveryStatus = 'received' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'queued'

export type InboxMessage = {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  channel?: string
  content: string
  status: MessageDeliveryStatus
  created_at: string
  failed_reason?: string | null
  is_first_inbound?: boolean
  system_event_type?: string | null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function DeliveryGlyph({ status }: { status: MessageDeliveryStatus }) {
  if (status === 'failed') {
    return <AlertCircle className="h-3 w-3 text-[var(--lc-status-danger-fg)]" aria-label="Failed" />
  }
  if (status === 'queued' || status === 'pending') {
    return <Clock className="h-3 w-3 text-[var(--lc-text-muted)]" aria-label="Queued" />
  }
  if (status === 'read') {
    return <CheckCheck className="h-3 w-3 text-[var(--lc-accent-bold-edge)]" aria-label="Read" />
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3 w-3 text-[var(--lc-text-muted)]" aria-label="Delivered" />
  }
  return <Check className="h-3 w-3 text-[var(--lc-text-muted)]" aria-label="Sent" />
}

export type MessageBubbleProps = {
  message: InboxMessage
  conversationChannel: string
  conversationSource: string
  showPortalChip?: boolean
  onRetry?: (id: string) => void
  retrying?: boolean
}

export function MessageBubble({
  message: m,
  conversationChannel,
  conversationSource,
  showPortalChip,
  onRetry,
  retrying,
}: MessageBubbleProps) {
  if (m.direction === 'system') {
    return (
      <div className="flex justify-center py-1">
        <p className="text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          {m.content}
        </p>
      </div>
    )
  }

  const isInbound = m.direction === 'inbound'
  const showChannelMeta =
    m.channel && m.channel.toLowerCase() !== conversationChannel.toLowerCase()

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[78%]', isInbound ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'px-4 py-2 text-[length:var(--lc-type-body)] shadow-[var(--lc-elevation-sm)]',
            isInbound
              ? 'rounded-[var(--lc-radius-lg)] rounded-ss-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]'
              : 'rounded-[var(--lc-radius-lg)] rounded-se-[var(--lc-radius-sm)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
          )}
          role="article"
          aria-label={`${isInbound ? 'Contact' : 'You'} at ${formatTime(m.created_at)}: ${m.content}`}
        >
          {showPortalChip && isInbound ? (
            <PortalSourceChip source={conversationSource} />
          ) : null}
          <p className="whitespace-pre-wrap" dir="auto">
            {m.content}
          </p>
        </div>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]',
            isInbound ? 'justify-start' : 'justify-end',
          )}
        >
          {!isInbound ? <DeliveryGlyph status={m.status} /> : null}
          <Numeric>{formatTime(m.created_at)}</Numeric>
          {showChannelMeta ? <span>· via {channelLabel(m.channel)}</span> : null}
          {!isInbound && m.status === 'failed' && onRetry ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1 py-0 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]"
              onClick={() => onRetry(m.id)}
              disabled={retrying}
            >
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retry'}
            </Button>
          ) : null}
        </div>
        {m.failed_reason ? (
          <p className="mt-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
            {m.failed_reason}
          </p>
        ) : null}
      </div>
    </div>
  )
}
