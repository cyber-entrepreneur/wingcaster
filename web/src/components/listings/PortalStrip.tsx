import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { resolveLcChannel } from '@/theme/channel'
import { cn } from '@/lib/utils'

export type SyndicationStatus = 'published' | 'failed' | 'pending' | 'ghost'

export interface SyndicationEntry {
  channel: string
  status: SyndicationStatus | string
  last_synced_at?: string
  error?: string
  url?: string
}

export interface PortalStripProps {
  syndications?: SyndicationEntry[] | null
  /** Max visible marks before "+N" overflow. */
  maxVisible?: number
  className?: string
  onChannelClick?: (entry: SyndicationEntry) => void
}

const DEFAULT_CHANNELS = [
  'bayut',
  'property_finder',
  'dubizzle',
  'olx',
  'instagram',
  'facebook',
] as const

function labelFor(channel: string): string {
  return channel
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function initials(channel: string): string {
  const parts = channel.split(/[_-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return channel.slice(0, 2).toUpperCase()
}

/**
 * Portal syndication chip strip — ChannelMark row with overflow tail.
 * Missing syndications render as ghost outlines (do not fabricate live data).
 */
export function PortalStrip({
  syndications,
  maxVisible = 6,
  className,
  onChannelClick,
}: PortalStripProps) {
  const byChannel = new Map(
    (syndications || []).map((s) => [s.channel.toLowerCase(), s]),
  )

  const channels =
    syndications && syndications.length > 0
      ? syndications.map((s) => s.channel)
      : [...DEFAULT_CHANNELS]

  const visible = channels.slice(0, maxVisible)
  const overflow = Math.max(0, channels.length - maxVisible)

  return (
    <ul
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      aria-label="Portal syndication"
    >
      {visible.map((channel) => {
        const key = channel.toLowerCase()
        const entry = byChannel.get(key)
        const status = (entry?.status || 'ghost') as string
        const failed = status === 'failed'
        const ghost = !entry || status === 'ghost' || status === 'pending'
        const resolved = resolveLcChannel(channel)
        const aria = failed
          ? `${labelFor(channel)}: Failed — tap to fix`
          : ghost
            ? `${labelFor(channel)}: Not syndicated`
            : `${labelFor(channel)}: Published`

        return (
          <li key={key} className="relative">
            <button
              type="button"
              aria-label={aria}
              onClick={() =>
                onChannelClick?.(
                  entry || { channel, status: 'ghost' },
                )
              }
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-[var(--lc-radius-sm)]',
                'min-h-0 min-w-0',
                ghost &&
                  'border border-[var(--lc-border-strong)] bg-transparent opacity-50',
              )}
            >
              {resolved ? (
                <ChannelMark
                  channel={resolved}
                  className={cn(ghost && 'opacity-40')}
                  label={labelFor(channel)}
                />
              ) : (
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-[var(--lc-radius-sm)]',
                    'bg-[var(--lc-surface-sunken)] text-[10px] font-semibold uppercase',
                    'text-[var(--lc-text-muted)]',
                    !ghost && 'bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)]',
                  )}
                  title={labelFor(channel)}
                >
                  {initials(channel)}
                </span>
              )}
            </button>
            {failed && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -end-0.5 h-1.5 w-1.5 rounded-full bg-[var(--lc-status-unpublished-dot)]"
              />
            )}
          </li>
        )
      })}
      {overflow > 0 && (
        <li
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full',
            'bg-[var(--lc-surface-sunken)] text-[10px] text-[var(--lc-text-muted)]',
          )}
          aria-label={`+${overflow} more portals`}
        >
          +<Numeric>{overflow}</Numeric>
        </li>
      )}
    </ul>
  )
}
