import { ChannelMark } from '@/components/ui/channel-mark'
import { SourceMark } from '@/components/ui/source-mark'
import { channelLabel, sourceLabel } from '@/lib/inbox-labels'
import { cn } from '@/lib/utils'

export type ChannelSourceBadgesProps = {
  channel: string
  source: string
  className?: string
  /** Size for ChannelMark overlay (list avatar vs header). */
  channelClassName?: string
  sourceCompact?: boolean
  showSeparator?: boolean
}

/**
 * AGT-INB-005 dual-badge: colored ChannelMark + neutral SourceMark.
 * Never conflate transport (channel) with origin (source).
 */
export function ChannelSourceBadges({
  channel,
  source,
  className,
  channelClassName,
  sourceCompact = false,
  showSeparator = true,
}: ChannelSourceBadgesProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      aria-label={`${channelLabel(channel)} from ${sourceLabel(source)}`}
    >
      <ChannelMark channel={channel} label={channelLabel(channel)} className={channelClassName} />
      {showSeparator ? (
        <span className="text-[var(--lc-text-muted)]" aria-hidden="true">
          ·
        </span>
      ) : null}
      <SourceMark source={source} compact={sourceCompact} />
    </span>
  )
}
