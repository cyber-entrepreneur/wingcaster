import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type InboxBulkActionBarProps = {
  count: number
  busy?: boolean
  onMarkRead: () => void
  onMarkUnread: () => void
  onAssign: () => void
  onArchive: () => void
  onCancel: () => void
}

export function InboxBulkActionBar({
  count,
  busy,
  onMarkRead,
  onMarkUnread,
  onAssign,
  onArchive,
  onCancel,
}: InboxBulkActionBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2',
        'bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]',
        'duration-[var(--lc-duration-slow)] ease-[var(--lc-easing-out)]',
      )}
      role="toolbar"
      aria-live="assertive"
      aria-label={`Selection mode. ${count} conversations selected.`}
    >
      <p className="me-auto text-[length:var(--lc-type-body-sm)] font-medium">
        <Numeric>{count}</Numeric> selected
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-[var(--lc-text-inverse)] hover:bg-white/10 hover:text-[var(--lc-text-inverse)]"
        onClick={onMarkRead}
      >
        Mark read
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-[var(--lc-text-inverse)] hover:bg-white/10 hover:text-[var(--lc-text-inverse)]"
        onClick={onMarkUnread}
      >
        Mark unread
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-[var(--lc-text-inverse)] hover:bg-white/10 hover:text-[var(--lc-text-inverse)]"
        onClick={onAssign}
      >
        Assign…
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-[var(--lc-text-inverse)] hover:bg-white/10 hover:text-[var(--lc-text-inverse)]"
        onClick={onArchive}
      >
        Archive
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="text-[var(--lc-text-inverse)] hover:bg-white/10 hover:text-[var(--lc-text-inverse)]"
        onClick={onCancel}
        aria-label="Cancel"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        <span className="ms-1 hidden sm:inline">Cancel</span>
      </Button>
    </div>
  )
}
