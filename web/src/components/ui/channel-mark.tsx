import { cn } from '@/lib/utils'
import { channelLabel } from '@/lib/inbox-labels'
import { lcChannelStyle, resolveLcChannel, type LcChannel } from '@/theme/channel'

interface ChannelMarkProps {
  channel: string | LcChannel
  className?: string
  label?: string
}

/** Channel chips, dots, and 20–28px marks only — never large surfaces or body text. */
export function ChannelMark({ channel, className, label }: ChannelMarkProps) {
  const raw = String(channel || '').trim()
  const resolved = resolveLcChannel(raw)
  const display = label || channelLabel(raw) || raw || 'Channel'
  const initials = display.slice(0, 2).toUpperCase()
  const style = resolved
    ? lcChannelStyle(resolved)
    : {
        background: 'var(--lc-surface-sunken)',
        color: 'var(--lc-text-muted)',
      }

  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--lc-radius-sm)]',
        'border border-[var(--lc-border)] text-[10px] font-semibold uppercase',
        className,
      )}
      style={style}
      title={display}
      aria-label={display}
      data-channel={raw || resolved || 'unknown'}
    >
      {initials}
    </span>
  )
}
