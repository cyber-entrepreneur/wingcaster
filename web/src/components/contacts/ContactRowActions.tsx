import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus, Facebook, GitMerge, Instagram, Linkedin, Mail, MessageCircle,
  MessageSquare, MoreHorizontal, Music2, Pencil, Phone, Send, SquareArrowOutUpRight,
  Trash2, TrendingUp, Twitter, UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildContactActions, type ContactActionKey, type QuickActionContact } from '@/components/contacts/contactQuickActions'

const ACTION_ICON: Record<ContactActionKey, LucideIcon> = {
  email: Mail,
  call: Phone,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  telegram: Send,
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  tiktok: Music2,
  linkedin: Linkedin,
}

export type ContactRowActionsProps = {
  contact: QuickActionContact & { name?: string | null }
  onNewDeal: () => void
  onSchedule: (type: 'meeting' | 'follow_up') => void
  onMerge: () => void
  onDelete: () => void
}

/**
 * Per-row "⋯" quick-actions menu for the Contacts table. Contact channels are
 * pure deep links (only shown when the data exists); everything else reuses the
 * page-level dialogs / routes.
 */
export function ContactRowActions({ contact, onNewDeal, onSchedule, onMerge, onDelete }: ContactRowActionsProps) {
  const navigate = useNavigate()
  const contactActions = buildContactActions(contact)
  const label = contact.name || 'contact'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--lc-text-muted)] transition-colors hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-text-primary)] focus-visible:outline-none"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {contactActions.length > 0 && (
          <>
            <DropdownMenuLabel>Contact</DropdownMenuLabel>
            {contactActions.map((a) => {
              const Icon = ACTION_ICON[a.key]
              return (
                <DropdownMenuItem key={a.key} asChild>
                  <a
                    href={a.href}
                    {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" />
                    {a.label}
                  </a>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem className="gap-2" onSelect={() => onSchedule('meeting')}>
          <CalendarPlus className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> Schedule meeting
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => onSchedule('follow_up')}>
          <CalendarPlus className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> Add task
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onNewDeal}>
          <TrendingUp className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> New deal
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2" onSelect={() => navigate(`/contacts/${contact.id}`)}>
          <UserRound className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> View contact
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => navigate(`/contacts/${contact.id}/edit`)}>
          <Pencil className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => navigate(`/contacts/${contact.id}/relationships`)}>
          <SquareArrowOutUpRight className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> Relationships
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onMerge}>
          <GitMerge className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" /> Merge duplicate
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-[var(--lc-status-unpublished-fg)] focus:text-[var(--lc-status-unpublished-fg)]"
          onSelect={onDelete}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
