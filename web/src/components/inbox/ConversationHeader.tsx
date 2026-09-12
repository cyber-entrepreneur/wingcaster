import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Loader2,
  MoreVertical,
  Phone,
  User,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChannelSourceBadges } from '@/components/inbox/ChannelSourceBadges'
import { channelLabel } from '@/lib/inbox-labels'
import { cn } from '@/lib/utils'

export type ConversationHeaderProps = {
  contactName: string
  contactPhone?: string | null
  contactEmail?: string | null
  channel: string
  source: string
  status: 'open' | 'closed'
  unreadCount: number
  showBack?: boolean
  onBack?: () => void
  onMarkRead?: () => void
  onAssignMe?: () => void
  onClose?: () => void
  onReopen?: () => void
  closing?: boolean
  channelOptions?: Array<{ id: string; channel: string }>
  selectedConversationId?: string | null
  onSelectChannel?: (id: string) => void
  className?: string
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'
}

export function ConversationHeader({
  contactName,
  contactPhone,
  contactEmail,
  channel,
  source,
  status,
  unreadCount,
  showBack,
  onBack,
  onMarkRead,
  onAssignMe,
  onClose,
  onReopen,
  closing,
  channelOptions,
  selectedConversationId,
  onSelectChannel,
  className,
}: ConversationHeaderProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Back to inbox"
          >
            <ArrowLeft className="h-5 w-5 rtl:hidden" />
            <ArrowRight className="hidden h-5 w-5 rtl:inline" />
          </Button>
        ) : null}
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-[var(--lc-surface-sunken)] text-[11px] font-semibold">
            {initials(contactName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-primary)]">
            {contactName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            <Badge
              variant="outline"
              className={cn(
                'h-4 px-1 text-[10px]',
                status === 'open'
                  ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
                  : 'bg-[var(--lc-status-archived-bg)] text-[var(--lc-status-archived-fg)]',
              )}
            >
              {status}
            </Badge>
            {contactPhone ? (
              <span className="inline-flex items-center gap-0.5">
                <Phone className="h-3 w-3" />
                {contactPhone}
              </span>
            ) : null}
            {contactEmail ? <span className="truncate">{contactEmail}</span> : null}
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {unreadCount > 0 && onMarkRead ? (
            <Button variant="ghost" size="sm" onClick={onMarkRead} className="h-8 gap-1 text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> Read
            </Button>
          ) : null}
          {onAssignMe ? (
            <Button variant="ghost" size="sm" onClick={onAssignMe} className="h-8 gap-1 text-xs">
              <User className="h-3.5 w-3.5" /> Assign me
            </Button>
          ) : null}
          {status === 'closed' ? (
            onReopen ? (
              <Button variant="outline" size="sm" onClick={onReopen} className="h-8 text-xs">
                Reopen
              </Button>
            ) : null
          ) : onClose ? (
            <Button variant="outline" size="sm" onClick={onClose} disabled={closing} className="h-8 gap-1 text-xs">
              {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Close
            </Button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Conversation actions" className="sm:hidden">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {unreadCount > 0 && onMarkRead ? (
              <DropdownMenuItem onClick={onMarkRead}>Mark read</DropdownMenuItem>
            ) : null}
            {onAssignMe ? <DropdownMenuItem onClick={onAssignMe}>Assign me</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            {status === 'closed'
              ? onReopen && <DropdownMenuItem onClick={onReopen}>Reopen</DropdownMenuItem>
              : onClose && <DropdownMenuItem onClick={onClose}>Close conversation</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChannelSourceBadges channel={channel} source={source} channelClassName="h-5 w-5" />
      {channelOptions && channelOptions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Channels for this contact">
          {channelOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === selectedConversationId}
              className={cn(
                'rounded-[var(--lc-radius-pill)] px-2 py-1 text-[length:var(--lc-type-caption)]',
                option.id === selectedConversationId
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'border border-[var(--lc-border)] text-[var(--lc-text-primary)]',
              )}
              onClick={() => onSelectChannel?.(option.id)}
            >
              {channelLabel(option.channel)}
            </button>
          ))}
          <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            View {channelOptions.length} channels
          </span>
        </div>
      ) : null}
    </div>
  )
}
