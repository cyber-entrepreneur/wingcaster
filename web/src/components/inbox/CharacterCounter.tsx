import { Numeric } from '@/components/ui/numeric'
import {
  channelMaxLength,
  counterThreshold,
  smsSegmentInfo,
  type CounterThreshold,
} from '@/lib/channel-limits'
import { channelLabel } from '@/lib/inbox-labels'
import { cn } from '@/lib/utils'

const THRESHOLD_CLASS: Record<Exclude<CounterThreshold, 'hidden'>, string> = {
  muted: 'text-[var(--lc-text-muted)]',
  warning: 'text-[var(--lc-status-warning-fg)]',
  danger: 'text-[var(--lc-status-danger-fg)]',
}

export type CharacterCounterProps = {
  text: string
  channel: string
  className?: string
}

export function CharacterCounter({ text, channel, className }: CharacterCounterProps) {
  const max = channelMaxLength(channel)
  const used = text.length
  const threshold = counterThreshold(used, max)
  if (threshold === 'hidden') return null

  const isSms = String(channel).toLowerCase() === 'sms'
  const segments = isSms ? smsSegmentInfo(text).segments : null

  return (
    <div className={cn('text-end', className)} aria-live="polite">
      <Numeric className={cn('text-[length:var(--lc-type-caption)]', THRESHOLD_CLASS[threshold])}>
        {used} / {max}
      </Numeric>
      {isSms && segments != null ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Numeric>{segments}</Numeric> segment{segments === 1 ? '' : 's'}
        </p>
      ) : null}
      {threshold === 'danger' ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
          Message exceeds {channelLabel(channel)} limit.
        </p>
      ) : null}
    </div>
  )
}

export function isOverChannelLimit(text: string, channel: string): boolean {
  return text.length >= channelMaxLength(channel)
}
