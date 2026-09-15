import { Home } from 'lucide-react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { cn } from '@/lib/utils'
import { resolveLcChannel } from '@/theme/channel'

/**
 * Portal mark: ChannelMark when a Broadcast channel token exists;
 * otherwise a 2-letter monogram on sunken surface (AGT-PUB-006).
 */
export function PortalMark({
  code,
  displayName,
  channelTokenKey,
  size = 20,
  className,
}: {
  code: string | null | undefined
  displayName?: string | null
  channelTokenKey?: string | null
  size?: 20 | 24
  className?: string
}) {
  const candidates = [
    channelTokenKey,
    code,
    code?.replace(/^publishing\.realestate\./, ''),
    displayName,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const resolved = resolveLcChannel(candidate)
    if (resolved) {
      return (
        <ChannelMark
          channel={resolved}
          label={displayName || code || resolved}
          className={cn(size === 24 ? 'h-6 w-6' : 'h-5 w-5', className)}
        />
      )
    }
  }

  const monogramSource = (displayName || code || '??').trim()
  const letters = monogramSource
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '??'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--lc-radius-sm)]',
        'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]',
        'text-[10px] font-semibold uppercase',
        size === 24 ? 'h-6 w-6' : 'h-5 w-5',
        className,
      )}
      aria-label={displayName || code || 'Portal'}
      title={displayName || code || undefined}
    >
      {letters}
    </span>
  )
}

export function ListingThumb({
  url,
  alt,
  size = 48,
  className,
}: {
  url?: string | null
  alt: string
  size?: 48 | 56
  className?: string
}) {
  const dim = size === 56 ? 'h-14 w-14' : 'h-12 w-12'
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className={cn(
          dim,
          'shrink-0 object-cover rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
          className,
        )}
      />
    )
  }
  return (
    <span
      className={cn(
        dim,
        'inline-flex shrink-0 items-center justify-center rounded-[var(--lc-radius-md)]',
        'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
        className,
      )}
      aria-hidden="true"
    >
      <Home className="h-5 w-5" />
    </span>
  )
}

export function formatRelativeSubmittedAt(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffMs = Math.max(0, now - t)
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function absoluteSubmittedLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
