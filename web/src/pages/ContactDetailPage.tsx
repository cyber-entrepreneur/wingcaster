import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Building2, Check, Clock, Download, FileText, Loader2, Mail,
  Phone, Plus, Sparkles, Tag, User,
} from 'lucide-react'
import { MergeContactsDialog } from '@/components/contacts/MergeContactsDialog'
import { Contact360Panel } from '@/components/contact-360/Contact360Panel'
import { ContactQuickActionBar } from '@/components/contacts/ContactQuickActionBar'
import { QuickTaskDialog } from '@/components/contacts/QuickTaskDialog'
import { AddOpportunityDialog } from '@/components/opportunities/AddOpportunityDialog'
import { CONTACT_ROLE_OPTIONS } from '@/components/contacts/contactForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api, getAuthToken } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  status: string
  source: string
  tags: string[]
  assigned_agent_id: string | null
  first_touch_channel: string
  first_touch_at: string
  last_activity_at: string | null
  created_at: string
  updated_at?: string
  // Full-form fields (present via the data-JSONB merge).
  contact_role?: string
  organization_name?: string
  title?: string
  emails?: Array<{ label?: string; address?: string }>
  phones?: Array<{ label?: string; number?: string }>
  socials?: Record<string, string>
}

interface TimelineEventData { content?: string; notes?: string; message?: string }
interface TimelineEvent { id: string; type: string; title: string; timestamp: string; actor: string; data?: TimelineEventData }
interface ContactNote { id: string; content: string; author_name: string; created_at: string }
interface ContactTask { id: string; contact_id: string; title: string; status: string; due_at: string; type: string }
interface ContactOpportunity {
  id: string; contact_id: string; stage: string; probability: number
  deal_value: number | null; currency?: string | null; expected_close_date: string | null; notes?: string
}
interface ContactAttachment {
  id: string; kind: string; filename: string | null; content_type: string | null
  size_bytes: number | null; created_at?: string
}
interface TasksListResponse { items?: ContactTask[] }
interface TimelineResponse { events?: TimelineEvent[] }

const TYPE_COLORS: Record<string, string> = {
  note: 'bg-purple-100 text-purple-700',
  task: 'bg-amber-100 text-amber-700',
  task_completed: 'bg-green-100 text-green-700',
  viewing: 'bg-blue-100 text-blue-700',
  opportunity: 'bg-emerald-100 text-emerald-700',
  stage_change: 'bg-indigo-100 text-indigo-700',
  message: 'bg-cyan-100 text-cyan-700',
  activity: 'bg-slate-100 text-slate-700',
}

const CLOSED_STAGES = new Set(['closed_won', 'closed_lost'])
const CLOSED_TASK_STATUSES = new Set(['completed', 'cancelled'])
const TASK_BUCKET_LABEL: Record<'open' | 'upcoming' | 'closed', string> = {
  open: 'Open', upcoming: 'Upcoming', closed: 'Closed',
}
const ATTACHMENT_KIND_LABEL: Record<string, string> = {
  pre_approval_letter: 'Pre-approval letter',
  voice_note: 'Voice note',
  other: 'Attachment',
}

function roleLabel(value?: string) {
  if (!value) return ''
  return CONTACT_ROLE_OPTIONS.find((o) => o.value === value)?.label || value
}

/** Bucket a task into the card's Open / Upcoming / Closed columns. */
function taskBucket(t: ContactTask, now: number): 'open' | 'upcoming' | 'closed' {
  if (CLOSED_TASK_STATUSES.has(t.status)) return 'closed'
  const due = t.due_at ? new Date(t.due_at).getTime() : 0
  if (due && due > now) return 'upcoming'
  return 'open'
}

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { agent } = useAuth()
  const authReady = Boolean(agent)
  const { addToast } = useToast()
  usePageTitle('Contact')
  const [contact, setContact] = useState<Contact | null>(null)
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [mergeOpen, setMergeOpen] = useState(false)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [notes, setNotes] = useState<ContactNote[]>([])
  const [tasks, setTasks] = useState<ContactTask[]>([])
  const [opportunities, setOpportunities] = useState<ContactOpportunity[]>([])
  const [attachments, setAttachments] = useState<ContactAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [activeTab, setActiveTab] = useState('contact360')
  const [taskOpen, setTaskOpen] = useState(false)
  const [taskType, setTaskType] = useState<'meeting' | 'follow_up'>('follow_up')
  const [dealOpen, setDealOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadAll = async () => {
    if (!id) return
    try {
      const [c, tl, nt, ts, opps, att] = await Promise.all([
        api.getContact(id) as Promise<Contact>,
        api.getContactTimeline(id).catch(() => ({ events: [] })) as Promise<TimelineResponse>,
        api.getContactNotes(id).catch(() => []) as Promise<ContactNote[]>,
        api.getTasks({ contact_id: id, limit: '50' }).catch(() => ({ items: [] })) as Promise<TasksListResponse>,
        api.getOpportunities().catch(() => []) as Promise<ContactOpportunity[]>,
        api.getContactAttachments(id).catch(() => ({ attachments: [] })) as Promise<{ attachments: ContactAttachment[] }>,
      ])
      setContact(c)
      setTimeline(tl.events || [])
      setNotes(nt || [])
      setTasks((ts.items || []).filter((t) => t.contact_id === id))
      setOpportunities((opps || []).filter((o) => o.contact_id === id))
      setAttachments(att.attachments || [])
    } catch (e: unknown) {
      addToast({ title: 'Failed to load contact', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    }
  }

  useEffect(() => {
    if (!authReady || !id) return
    setLoading(true)
    loadAll().then(() => setLoading(false))
  }, [authReady, id])

  useEffect(() => {
    if (!authReady) return
    api.getContacts().then((rows) => setAllContacts(rows as Contact[])).catch(() => setAllContacts([]))
  }, [authReady])

  const handleAddNote = async () => {
    if (!id || !noteContent.trim()) return
    setSavingNote(true)
    try {
      await api.createContactNote(id, noteContent.trim())
      setNoteContent('')
      await loadAll()
      addToast({ title: 'Note added', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to add note', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setSavingNote(false)
    }
  }

  const handleAddTag = async () => {
    if (!contact || !tagInput.trim()) return
    const nextTags = Array.from(new Set([...contact.tags, tagInput.trim()]))
    try {
      await api.updateContact(contact.id, { tags: nextTags })
      setContact((prev) => (prev ? { ...prev, tags: nextTags } : prev))
      setTagInput('')
    } catch (e: unknown) {
      addToast({ title: 'Failed to add tag', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.completeTask(taskId)
      await loadAll()
      addToast({ title: 'Task completed', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to complete task', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    }
  }

  async function handleDelete() {
    if (!contact) return
    setDeleting(true)
    try {
      await api.deleteContact(contact.id)
      addToast({ title: 'Contact deleted', variant: 'success' })
      navigate('/contacts')
    } catch (e: unknown) {
      addToast({ title: 'Could not delete contact', description: e instanceof Error ? e.message : undefined, variant: 'error' })
      setDeleting(false)
    }
  }

  async function downloadAttachment(att: ContactAttachment) {
    if (!id) return
    try {
      const res = await fetch(api.contactAttachmentDownloadPath(id, att.id), {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename || `attachment-${att.id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      addToast({ title: 'Could not download file', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    }
  }

  const initials = (name: string) =>
    (name || 'U').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      lead: 'bg-blue-100 text-blue-700',
      prospect: 'bg-amber-100 text-amber-700',
      client: 'bg-green-100 text-green-700',
      archived: 'bg-slate-100 text-slate-700',
    }
    return map[status] || 'bg-slate-100'
  }

  const now = Date.now()
  const taskGroups = useMemo(() => {
    const g: Record<'open' | 'upcoming' | 'closed', ContactTask[]> = { open: [], upcoming: [], closed: [] }
    for (const t of tasks) g[taskBucket(t, now)].push(t)
    return g
  }, [tasks, now])
  const dealGroups = useMemo(() => {
    const open: ContactOpportunity[] = []
    const closed: ContactOpportunity[] = []
    for (const o of opportunities) (CLOSED_STAGES.has(o.stage) ? closed : open).push(o)
    return { open, closed }
  }, [opportunities])

  if (loading || !contact) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--lc-bg-page)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const openTaskCount = taskGroups.open.length + taskGroups.upcoming.length

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <Link to="/contacts"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{contact.name || 'Unknown'}</h1>
              <Badge variant="outline" className={cn('capitalize', statusColor(contact.status))}>{contact.status}</Badge>
              {contact.contact_role && <Badge variant="secondary" className="text-[10px]">{roleLabel(contact.contact_role)}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {contact.organization_name ? `${contact.title ? `${contact.title}, ` : ''}${contact.organization_name} · ` : ''}
              Source: {contact.source || contact.first_touch_channel}
            </p>
          </div>
        </div>

        {/* Quick-action bar */}
        <div className="mb-6 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3">
          <ContactQuickActionBar
            contact={contact}
            onNote={() => setActiveTab('notes')}
            onTask={() => { setTaskType('follow_up'); setTaskOpen(true) }}
            onMeeting={() => { setTaskType('meeting'); setTaskOpen(true) }}
            onNewDeal={() => setDealOpen(true)}
            onMerge={() => setMergeOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Identity card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary-faint text-primary text-2xl">{initials(contact.name)}</AvatarFallback>
                </Avatar>
                <h2 className="mt-3 text-lg font-semibold">{contact.name || 'Unknown'}</h2>
                {contact.organization_name && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {contact.organization_name}
                  </p>
                )}
              </div>
              <div className="mt-6 space-y-3 text-sm">
                {contact.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${contact.email}`} className="text-foreground hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${contact.phone}`} className="text-foreground hover:underline">{contact.phone}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Added {new Date(contact.created_at).toLocaleDateString()}</span>
                </div>
                {contact.last_activity_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last activity {new Date(contact.last_activity_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold"><Tag className="h-3.5 w-3.5" /> Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} className="h-8 text-xs" />
                  <Button size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Link to={`/contacts/${contact.id}/edit`}><Button variant="outline" className="w-full">Edit contact</Button></Link>
                <Link to={`/contacts/${contact.id}/relationships`}><Button variant="outline" className="w-full">Relationships</Button></Link>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="contact360" className="gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Overview
              </TabsTrigger>
              <TabsTrigger value="actions">Actions ({openTaskCount})</TabsTrigger>
              <TabsTrigger value="deals">Deals ({opportunities.length})</TabsTrigger>
              <TabsTrigger value="attachments">Attachments ({attachments.length})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="contact360">
              <Contact360Panel contactId={contact.id} />
            </TabsContent>

            <TabsContent value="actions">
              <div className="space-y-4">
                {(['open', 'upcoming', 'closed'] as const).map((bucket) => (
                  <Card key={bucket}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{TASK_BUCKET_LABEL[bucket]} ({taskGroups[bucket].length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {taskGroups[bucket].length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">No {bucket} actions.</p>
                      ) : (
                        <div className="divide-y">
                          {taskGroups[bucket].map((t) => (
                            <div key={t.id} className="flex items-center justify-between px-4 py-3">
                              <div>
                                <p className={cn('text-sm font-medium', bucket === 'closed' && 'text-muted-foreground line-through')}>{t.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.due_at ? `Due ${new Date(t.due_at).toLocaleString()} · ` : ''}{t.type.replace('_', ' ')}
                                </p>
                              </div>
                              {bucket !== 'closed' && (
                                <Button size="sm" variant="outline" onClick={() => handleCompleteTask(t.id)}>
                                  <Check className="mr-1 h-3 w-3" /> Complete
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => { setTaskType('follow_up'); setTaskOpen(true) }}>
                    <Plus className="h-4 w-4" /> Add task
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => { setTaskType('meeting'); setTaskOpen(true) }}>
                    <Plus className="h-4 w-4" /> Schedule meeting
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deals">
              <div className="space-y-4">
                {([['open', 'Open deals'], ['closed', 'Closed deals']] as const).map(([key, label]) => (
                  <Card key={key}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base">{label} ({dealGroups[key].length})</CardTitle>
                      {key === 'open' && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDealOpen(true)}>
                          <Plus className="h-4 w-4" /> New deal
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      {dealGroups[key].length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">No {key} deals.</p>
                      ) : (
                        <div className="divide-y">
                          {dealGroups[key].map((o) => (
                            <Link key={o.id} to={`/opportunities/${o.id}`} className="block px-4 py-3 hover:bg-[var(--lc-bg-page)]">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium capitalize">{o.stage.replace(/_/g, ' ')}</p>
                                <Badge variant="outline">{o.probability}%</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {o.deal_value != null ? `${Number(o.deal_value).toLocaleString()} ${o.currency || ''}` : 'No value'}
                                {o.expected_close_date ? ` · close ${new Date(o.expected_close_date).toLocaleDateString()}` : ''}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="attachments">
              <Card>
                <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {attachments.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">No attachments yet.</p>
                  ) : (
                    <div className="divide-y">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{a.filename || 'Attachment'}</p>
                              <p className="text-xs text-muted-foreground">{ATTACHMENT_KIND_LABEL[a.kind] || a.kind}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void downloadAttachment(a)}>
                            <Download className="h-4 w-4" /> Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader><CardTitle className="text-base">Activity timeline</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {timeline.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">No timeline events yet.</p>
                  ) : (
                    <div className="divide-y">
                      {timeline.map((event) => (
                        <div key={event.id} className="flex gap-3 p-4">
                          <Badge variant="outline" className={cn('h-fit text-[10px]', TYPE_COLORS[event.type] || 'bg-slate-100')}>
                            {event.type.replace(/_/g, ' ')}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.actor} &bull; {new Date(event.timestamp).toLocaleString()}</p>
                            {event.data?.content && <p className="mt-1 text-sm text-muted-foreground">{event.data.content}</p>}
                            {event.data?.notes && <p className="mt-1 text-sm text-muted-foreground">{event.data.notes}</p>}
                            {event.data?.message && <p className="mt-1 text-sm text-muted-foreground">{event.data.message}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
                      placeholder="Add a note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleAddNote} disabled={savingNote || !noteContent.trim()}>
                        {savingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add note
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-3">
                        <p className="text-sm">{n.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{n.author_name} &bull; {new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MergeContactsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        sourceContact={contact}
        contacts={allContacts}
        onMerged={(merged) => navigate(`/contacts/${merged.id}`, { replace: true })}
      />
      <QuickTaskDialog open={taskOpen} onOpenChange={setTaskOpen} contact={contact} defaultType={taskType} onCreated={() => void loadAll()} />
      <AddOpportunityDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        initialContact={{ id: contact.id, name: contact.name, email: contact.email, phone: contact.phone }}
        onCreated={() => void loadAll()}
      />
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!o) setDeleteOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete contact?</DialogTitle>
            <DialogDescription>
              {contact.name || 'This contact'} and their notes, tasks, deals, and conversations will be permanently removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
