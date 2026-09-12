import { Flame, Lock, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChannelMark } from '@/components/ui/channel-mark'
import { SourceMark } from '@/components/ui/source-mark'
import { Numeric } from '@/components/ui/numeric'
import { channelLabel, sourceLabel } from '@/lib/inbox-labels'
import { cn } from '@/lib/utils'

export type InboxRowConversation = {
  id: string
  contact_name: string | null
  contact_masked?: boolean
  channel: string
  source: string
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
  is_unread_by_agent?: boolean
  priority_score?: number | null
  priority_reason?: string | null
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  current_agent_id?: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string | null): string {
  return (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export type InboxRowProps = {
  conversation: InboxRowConversation
  selected?: boolean
  onSelect: (id: string) => void
}

export function InboxRow({ conversation: c, selected, onSelect }: InboxRowProps) {
  const unread = (c.unread_count || 0) > 0 || Boolean(c.is_unread_by_agent)
  const highPriority = (c.priority_score ?? 0) >= 70
  const assignedOther =
    c.assigned_agent_id &&
    c.current_agent_id &&
    c.assigned_agent_id !== c.current_agent_id
  const name = c.contact_name || 'Unknown'
  const aria = [
    name,
    `${channelLabel(c.channel)} from ${sourceLabel(c.source)}`,
    relativeTime(c.last_message_at),
    unread ? 'unread' : 'read',
    highPriority ? 'priority' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      aria-label={aria}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-stretch gap-0 border-b border-[var(--lc-border)] text-start transition-colors',
        'duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'min-h-[72px] md:min-h-[64px] xl:min-h-[56px]',
        'bg-[var(--lc-surface-raised)] hover:bg-[var(--lc-surface-sunken)]',
        selected &&
          'bg-[var(--lc-surface-sunken)] shadow-[var(--lc-elevation-sm)] border-s-[3px] border-s-[var(--lc-action-primary)]',
        'md:rounded-[var(--lc-radius-md)] md:border md:border-[var(--lc-border)] md:mb-1',
      )}
    >
      {/* Unread leading dot */}
      <span className="flex w-2 shrink-0 items-center justify-center md:w-3" aria-hidden={!unread}>
        {unread ? (
          <span className="h-2 w-2 rounded-[var(--lc-radius-pill)] bg-[var(--lc-action-primary)]" />
        ) : null}
      </span>

      {/* Avatar + channel overlay */}
      <span className="relative me-3 flex shrink-0 items-center py-3">
        <Avatar className="h-12 w-12 md:h-10 md:w-10">
          <AvatarFallback className="bg-[var(--lc-surface-sunken)] text-[11px] font-semibold text-[var(--lc-text-primary)]">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <ChannelMark
          channel={c.channel}
          label={channelLabel(c.channel)}
          className="absolute -bottom-0.5 -end-0.5 h-5 w-5 border-2 border-[var(--lc-surface-raised)] md:h-5 md:w-5"
        />
      </span>

      {/* Content */}
      <span className="min-w-0 flex-1 py-3 pe-2">
        <span className="flex items-center gap-1.5">
          {c.contact_masked ? (
            <Lock className="h-3 w-3 shrink-0 text-[var(--lc-text-muted)]" aria-label="Consent pending" />
          ) : null}
          <span
            className={cn(
              'truncate text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]',
              unread ? 'font-semibold' : 'font-normal',
            )}
          >
            {name}
          </span>
          {highPriority ? (
            <Flame
              className="h-3.5 w-3.5 shrink-0 text-[var(--lc-status-danger-fg)]"
              aria-label={c.priority_reason ? `Prioritized: ${c.priority_reason}` : 'Prioritized'}
            />
          ) : null}
          {assignedOther ? (
            <UserRound
              className="h-3.5 w-3.5 shrink-0 text-[var(--lc-text-muted)]"
              aria-label={`Assigned to ${c.assigned_agent_name || 'another agent'}`}
            />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          {c.last_message_preview || 'No messages'}
        </span>
      </span>

      {/* Trailing: time + source */}
      <span className="flex w-[4.5rem] shrink-0 flex-col items-end justify-center gap-1 py-3 pe-3">
        <Numeric className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] tabular-nums">
          {relativeTime(c.last_message_at)}
        </Numeric>
        <SourceMark source={c.source} compact />
      </span>
    </button>
  )
}
