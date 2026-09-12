import { useRef } from 'react'
import { Check, Flame, Lock, UserRound } from 'lucide-react'
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
  channels?: string[]
  sources?: string[]
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
  is_unread_by_agent?: boolean
  priority_score?: number | null
  priority_reason?: string | null
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  current_agent_id?: string | null
  conversation_ids?: string[]
  merged?: boolean
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
  checked?: boolean
  selectionMode?: boolean
  onSelect: (id: string) => void
  onToggleSelect?: (id: string) => void
  onEnterSelection?: (id: string) => void
}

export function InboxRow({
  conversation: c,
  selected,
  checked,
  selectionMode,
  onSelect,
  onToggleSelect,
  onEnterSelection,
}: InboxRowProps) {
  const unread = (c.unread_count || 0) > 0 || Boolean(c.is_unread_by_agent)
  const highPriority = (c.priority_score ?? 0) >= 70
  const assignedOther =
    c.assigned_agent_id &&
    c.current_agent_id &&
    c.assigned_agent_id !== c.current_agent_id
  const name = c.contact_name || 'Unknown'
  const channels = c.channels?.length ? c.channels : [c.channel]
  const overflow = Math.max(0, channels.length - 3)
  const aria = [
    name,
    `${channelLabel(c.channel)} from ${sourceLabel(c.source)}`,
    relativeTime(c.last_message_at),
    unread ? 'unread' : 'read',
    highPriority ? 'priority' : null,
    checked ? 'selected' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const pressTimer = useRef<number | null>(null)
  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handleActivate = () => {
    if (selectionMode) onToggleSelect?.(c.id)
    else onSelect(c.id)
  }

  return (
    <div
      className={cn(
        'group relative flex w-full items-stretch gap-0 border-b border-[var(--lc-border)]',
        'duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'min-h-[72px] md:min-h-[64px] xl:min-h-[56px]',
        'bg-[var(--lc-surface-raised)] hover:bg-[var(--lc-surface-sunken)]',
        selected &&
          'bg-[var(--lc-surface-sunken)] shadow-[var(--lc-elevation-sm)] border-s-[3px] border-s-[var(--lc-action-primary)]',
        checked && 'bg-[var(--lc-surface-selected,var(--lc-surface-sunken))]',
        'md:rounded-[var(--lc-radius-md)] md:border md:border-[var(--lc-border)] md:mb-1',
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-10 shrink-0 items-center justify-center',
          'text-[var(--lc-text-muted)]',
          !selectionMode && 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
          (selectionMode || checked) && 'opacity-100',
        )}
        aria-label={checked ? 'Deselect conversation' : 'Select conversation'}
        aria-checked={checked || false}
        role="checkbox"
        onClick={(e) => {
          e.stopPropagation()
          if (selectionMode) onToggleSelect?.(c.id)
          else onEnterSelection?.(c.id)
        }}
      >
        {checked ? <Check className="h-3 w-3 text-[var(--lc-action-primary)]" /> : null}
      </button>

      <button
        type="button"
        onClick={handleActivate}
        onPointerDown={() => {
          clearPress()
          pressTimer.current = window.setTimeout(() => {
            onEnterSelection?.(c.id)
          }, 500)
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
        aria-label={aria}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-stretch text-start"
      >
        <span className="flex w-2 shrink-0 items-center justify-center md:w-3" aria-hidden={!unread}>
          {unread && !checked ? (
            <span className="h-2 w-2 rounded-[var(--lc-radius-pill)] bg-[var(--lc-action-primary)]" />
          ) : null}
        </span>

        <span className="relative me-3 flex shrink-0 items-center py-3">
          {selectionMode ? (
            <span
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-[var(--lc-radius-pill)] border border-[var(--lc-border-strong)] md:h-10 md:w-10',
                checked && 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
              )}
              aria-hidden
            >
              {checked ? <Check className="h-4 w-4" /> : null}
            </span>
          ) : (
            <>
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
            </>
          )}
        </span>

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
            {c.merged && channels.length > 1 ? (
              <span className="inline-flex items-center gap-0.5" aria-label={`${channels.length} channels`}>
                {channels.slice(0, 3).map((channel) => (
                  <ChannelMark
                    key={channel}
                    channel={channel}
                    label={channelLabel(channel)}
                    className="h-4 w-4 text-[8px]"
                  />
                ))}
                {overflow > 0 ? (
                  <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">+{overflow}</span>
                ) : null}
              </span>
            ) : null}
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

        <span className="flex w-[4.5rem] shrink-0 flex-col items-end justify-center gap-1 py-3 pe-3">
          <Numeric className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] tabular-nums">
            {relativeTime(c.last_message_at)}
          </Numeric>
          <SourceMark source={c.source} compact />
        </span>
      </button>
    </div>
  )
}
