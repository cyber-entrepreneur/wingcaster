import { cn } from '@/lib/utils'
import { channelLabel, sourceLabel, INBOX_CHANNEL_FILTERS, INBOX_SOURCE_FILTERS } from '@/lib/inbox-labels'

export type InboxFilters = {
  unread: boolean
  assignedMe: boolean
  channel: string | null
  source: string | null
}

export type InboxFilterChipRowProps = {
  filters: InboxFilters
  onChange: (next: InboxFilters) => void
  mergeMode?: 'merged' | 'separate'
  onMergeModeChange?: (mode: 'merged' | 'separate') => void
  className?: string
}

function Chip({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-[var(--lc-radius-pill)] px-3',
        'text-[length:var(--lc-type-body-sm)] font-medium transition-colors',
        'duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'min-h-[var(--lc-tap-target-min)] md:min-h-8',
        pressed
          ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]'
          : 'border border-[var(--lc-border)] bg-transparent text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]',
      )}
    >
      {label}
    </button>
  )
}

export function InboxFilterChipRow({
  filters,
  onChange,
  mergeMode = 'separate',
  onMergeModeChange,
  className,
}: InboxFilterChipRowProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="toolbar"
      aria-label="Inbox filters"
    >
      <Chip
        label="Unread"
        pressed={filters.unread}
        onClick={() => onChange({ ...filters, unread: !filters.unread })}
      />
      <Chip
        label="Assigned to me"
        pressed={filters.assignedMe}
        onClick={() => onChange({ ...filters, assignedMe: !filters.assignedMe })}
      />
      <label className="inline-flex items-center">
        <span className="sr-only">Channel filter</span>
        <select
          className={cn(
            'h-8 min-h-[var(--lc-tap-target-min)] md:min-h-8 rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] px-3 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)]',
            filters.channel && 'border-transparent bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
          )}
          value={filters.channel || ''}
          onChange={(e) => onChange({ ...filters, channel: e.target.value || null })}
          aria-label="Filter by channel"
        >
          <option value="">All channels</option>
          {INBOX_CHANNEL_FILTERS.map((c) => (
            <option key={c} value={c}>
              {channelLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center">
        <span className="sr-only">Source filter</span>
        <select
          className={cn(
            'h-8 min-h-[var(--lc-tap-target-min)] md:min-h-8 rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] px-3 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)]',
            filters.source && 'border-transparent bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
          )}
          value={filters.source || ''}
          onChange={(e) => onChange({ ...filters, source: e.target.value || null })}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {INBOX_SOURCE_FILTERS.map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s)}
            </option>
          ))}
        </select>
      </label>
      {onMergeModeChange ? (
        <Chip
          label="Merge conversations across channels per contact"
          pressed={mergeMode === 'merged'}
          onClick={() => onMergeModeChange(mergeMode === 'merged' ? 'separate' : 'merged')}
        />
      ) : null}
    </div>
  )
}
