import { CalendarPlus, ListTodo, Mail, MessageCircle, Phone, StickyNote, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContactRowActions } from '@/components/contacts/ContactRowActions'
import { buildContactActions, type ContactActionKey, type QuickActionContact } from '@/components/contacts/contactQuickActions'

const PRIMARY_ICON: Partial<Record<ContactActionKey, LucideIcon>> = {
  email: Mail,
  call: Phone,
  whatsapp: MessageCircle,
}
const PRIMARY_LABEL: Partial<Record<ContactActionKey, string>> = {
  email: 'Email',
  call: 'Call',
  whatsapp: 'WhatsApp',
}
const PRIMARY_KEYS: ContactActionKey[] = ['email', 'call', 'whatsapp']

export type ContactQuickActionBarProps = {
  contact: QuickActionContact & { name?: string | null }
  onNote: () => void
  onTask: () => void
  onMeeting: () => void
  onNewDeal: () => void
  onMerge: () => void
  onDelete: () => void
}

/**
 * The card's quick-action bar: primary contact channels as deep-link buttons,
 * the common CRM verbs (Note / Task / Meeting / Deal), and the full ⋯ overflow
 * (reusing ContactRowActions). All backed by existing data/endpoints.
 */
export function ContactQuickActionBar({ contact, onNote, onTask, onMeeting, onNewDeal, onMerge, onDelete }: ContactQuickActionBarProps) {
  const actions = buildContactActions(contact)
  const primary = PRIMARY_KEYS
    .map((k) => actions.find((a) => a.key === k))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary.map((a) => {
        const Icon = PRIMARY_ICON[a.key]!
        return (
          <Button key={a.key} size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={a.href} {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {PRIMARY_LABEL[a.key]}
            </a>
          </Button>
        )
      })}

      <Button size="sm" variant="outline" className="gap-1.5" onClick={onNote}>
        <StickyNote className="h-4 w-4" aria-hidden="true" /> Note
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onTask}>
        <ListTodo className="h-4 w-4" aria-hidden="true" /> Task
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onMeeting}>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Meeting
      </Button>
      <Button size="sm" className="gap-1.5" onClick={onNewDeal}>
        <TrendingUp className="h-4 w-4" aria-hidden="true" /> New deal
      </Button>

      <div className="ms-auto">
        <ContactRowActions
          contact={contact}
          onNewDeal={onNewDeal}
          onSchedule={(type) => (type === 'meeting' ? onMeeting() : onTask())}
          onMerge={onMerge}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
