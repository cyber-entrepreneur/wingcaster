import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode2, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PIIMask } from '@/components/security/PIIMask'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import {
  AttachmentsPicker,
  type ComposeAttachment,
  type ComposeTemplate,
} from '@/components/inbox/ComposeBar'
import { channelLabel } from '@/lib/inbox-labels'
import { formatFileSize } from '@/lib/inbox-media'
import { cn } from '@/lib/utils'

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
] as const

type ContactOption = {
  id: string
  name?: string
  email?: string
  phone?: string
}

export type ComposeNewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates?: ComposeTemplate[]
  templatesLoading?: boolean
  onRequestTemplates?: () => void
}

export function ComposeNewDialog({
  open,
  onOpenChange,
  templates = [],
  templatesLoading,
  onRequestTemplates,
}: ComposeNewDialogProps) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [contactId, setContactId] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['value']>('whatsapp')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([])
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = () => {
    setQuery('')
    setContactId('')
    setBody('')
    setTemplateId(null)
    setAttachments([])
    setCreatingNew(false)
    setNewName('')
    setNewPhone('')
    setNewEmail('')
    setChannel('whatsapp')
  }

  const searchContacts = async (q: string) => {
    setLoading(true)
    try {
      const rows = await api.getContacts(q.trim() ? { q: q.trim() } : undefined)
      setContacts(Array.isArray(rows) ? (rows as ContactOption[]) : [])
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Could not load contacts',
        description: err.message || 'Try again',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void searchContacts('')
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void searchContacts(query)
    }, 250)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  const applyTemplate = (template: ComposeTemplate) => {
    setBody(template.body)
    setTemplateId(template.id)
    setTemplateOpen(false)
  }

  const submit = async () => {
    if (!creatingNew && !contactId) {
      addToast({ title: 'Pick a contact', variant: 'error' })
      return
    }
    if (creatingNew && !newName.trim()) {
      addToast({ title: 'Enter a contact name', variant: 'error' })
      return
    }
    if (creatingNew && !newPhone.trim() && !newEmail.trim()) {
      addToast({ title: 'Enter a phone or email', variant: 'error' })
      return
    }
    if (!body.trim() && attachments.length === 0) {
      addToast({ title: 'Write a message or attach a file', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const payloadAttachments = attachments.map((item) => ({
        url: item.url,
        mime: item.mime,
        filename: item.filename,
        size_bytes: item.size_bytes,
      }))
      const created = await api.createConversation({
        ...(creatingNew
          ? {
              new_contact: {
                name: newName.trim() || undefined,
                phone: newPhone.trim() || undefined,
                email: newEmail.trim() || undefined,
              },
            }
          : { contact_id: contactId }),
        channel,
        body: body.trim(),
        template_id: templateId || undefined,
        attachments: payloadAttachments.length ? payloadAttachments : undefined,
      })
      onOpenChange(false)
      reset()
      navigate(`/inbox/${created.id}`)
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Could not start conversation',
        description: err.message || 'Try again',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              Contact
            </span>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCreatingNew(false)
              }}
              placeholder="Search contacts…"
              aria-label="Search contacts"
              className="min-h-11"
            />
          </label>

          <div className="max-h-48 overflow-y-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
            <button
              type="button"
              className={cn(
                'flex min-h-11 w-full items-center px-3 py-2 text-start text-[length:var(--lc-type-body-sm)] font-medium',
                'hover:bg-[var(--lc-surface-sunken)]',
                creatingNew ? 'bg-[var(--lc-surface-sunken)]' : '',
              )}
              onClick={() => {
                setCreatingNew(true)
                setContactId('')
              }}
            >
              Create new contact
            </button>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--lc-text-muted)]" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="px-3 py-4 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                No contacts found.
              </p>
            ) : (
              <ul>
                {contacts.slice(0, 40).map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full min-h-11 px-3 py-2 text-start text-[length:var(--lc-type-body-sm)] hover:bg-[var(--lc-surface-sunken)]',
                        !creatingNew && contactId === contact.id ? 'bg-[var(--lc-surface-sunken)]' : '',
                      )}
                      onClick={() => {
                        setContactId(contact.id)
                        setCreatingNew(false)
                      }}
                    >
                      <span className="block font-medium">{contact.name || 'Unnamed contact'}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                        {contact.phone ? (
                          <PIIMask
                            value={contact.phone}
                            kind="phone"
                            auditContext={{ caseId: contact.id, field: 'phone' }}
                            onReveal={async (ctx) => {
                              await api.revealContactPii(ctx.caseId, ctx.field)
                            }}
                          />
                        ) : null}
                        {contact.email ? (
                          <PIIMask
                            value={contact.email}
                            kind="email"
                            auditContext={{ caseId: contact.id, field: 'email' }}
                            onReveal={async (ctx) => {
                              await api.revealContactPii(ctx.caseId, ctx.field)
                            }}
                          />
                        ) : null}
                        {!contact.phone && !contact.email ? contact.id : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {creatingNew ? (
            <div className="space-y-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-3">
              <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                New contact details
              </p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                aria-label="New contact name"
                className="min-h-11"
              />
              <div className="space-y-1">
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone number"
                  aria-label="New contact phone"
                  className="min-h-11"
                />
                {newPhone.trim() ? (
                  <PIIMask
                    value={newPhone.trim()}
                    kind="phone"
                    auditContext={{ caseId: 'compose-new', field: 'phone' }}
                  />
                ) : null}
              </div>
              <div className="space-y-1">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email address"
                  aria-label="New contact email"
                  className="min-h-11"
                />
                {newEmail.trim() ? (
                  <PIIMask
                    value={newEmail.trim()}
                    kind="email"
                    auditContext={{ caseId: 'compose-new', field: 'email' }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              Channel
            </span>
            <select
              className="min-h-11 h-11 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]"
              value={channel}
              onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number]['value'])}
              aria-label="Channel"
            >
              {CHANNELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 gap-2"
              onClick={() => {
                onRequestTemplates?.()
                setTemplateOpen(true)
              }}
            >
              <FileCode2 className="h-4 w-4" />
              {templateId
                ? templates.find((t) => t.id === templateId)?.name || 'Template'
                : 'Template'}
            </Button>
            <AttachmentsPicker
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              triggerClassName="min-h-11 flex-1"
            />
          </div>

          {attachments.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto" aria-label="Queued attachments">
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]"
                >
                  {item.kind === 'image' ? (
                    <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center px-1 text-center text-[10px] text-[var(--lc-text-muted)]">
                      {item.filename}
                      {item.size_bytes ? <span>{formatFileSize(item.size_bytes)}</span> : null}
                    </span>
                  )}
                  <button
                    type="button"
                    className="absolute end-0.5 top-0.5 flex min-h-11 min-w-11 items-center justify-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]"
                    aria-label="Remove attachment"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== item.id))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              Message
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your first message…"
              aria-label="Message body"
              rows={4}
              className={cn(
                'min-h-24 w-full resize-y rounded-[var(--lc-radius-lg)]',
                'border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2',
                'text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]',
                'placeholder:text-[var(--lc-text-muted)]',
              )}
            />
          </label>

          <Button
            className="min-h-11 w-full"
            disabled={submitting}
            onClick={() => {
              void submit()
            }}
          >
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </div>

        <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert template</DialogTitle>
            </DialogHeader>
            {templatesLoading ? (
              <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                Loading templates…
              </p>
            ) : templates.length === 0 ? (
              <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                No templates yet. Save one from Settings to insert it here.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {templates.map((template) => {
                  const declared = String(template.channel || '').toLowerCase()
                  const mismatch =
                    declared && declared !== 'all' && declared !== channel.toLowerCase()
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        className="min-h-11 w-full rounded-[var(--lc-radius-md)] px-3 py-2 text-start hover:bg-[var(--lc-surface-sunken)]"
                        onClick={() => applyTemplate(template)}
                      >
                        <span className="block font-medium">{template.name}</span>
                        <span className="block truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                          {template.preview || template.body}
                          {mismatch ? ` · tuned for ${channelLabel(declared)}` : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
