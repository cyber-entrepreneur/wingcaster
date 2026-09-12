import { cn } from '@/lib/utils'
import { LC_CHANNEL_SHORT, lcChannelStyle, resolveLcChannel, type LcChannel } from '@/theme/channel'

interface ChannelMarkProps {
  channel: string | LcChannel
  className?: string
  label?: string
}

/** Channel chips, dots, and 20–28px marks only — never large surfaces or body text. */
export function ChannelMark({ channel, className, label }: ChannelMarkProps) {
  const resolved = resolveLcChannel(channel)
  if (!resolved) return null
  const style = lcChannelStyle(resolved)
  const mark = label ? label.slice(0, 2) : LC_CHANNEL_SHORT[resolved]
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold uppercase',
        className,
      )}
      style={style}
      title={label || resolved}
      aria-label={label || resolved}
    >
      {mark}
    </span>
  )
}
