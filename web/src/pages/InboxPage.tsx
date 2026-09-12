import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api, type InboxConversation, type InboxConversationMessage } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { cn } from '@/lib/utils'
import { readChannel, readSource } from '@/lib/channel-source'
import { groupConversationsForInbox, type InboxMergeMode } from '@/lib/inbox-merge'
import { collectInboxAttachments } from '@/lib/inbox-media'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import {
  AISuggestedReplyRow,
  ComposeBar,
  ConversationHeader,
  DayGroupSeparator,
  InboxBulkActionBar,
  InboxEmptyState,
  InboxFilterChipRow,
  InboxOfflineBanner,
  InboxRow,
  MessageBubble,
  type ComposeAttachment,
  type ComposeTemplate,
  type InboxFilters,
  type InboxMessage,
} from '@/components/inbox'

type SortMode = 'newest' | 'oldest' | 'priority'

function formatDateLabel(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function groupMessagesByDay(messages: InboxMessage[]) {
  const groups: Record<string, InboxMessage[]> = {}
  messages.forEach((m) => {
    const label = formatDateLabel(m.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(m)
  })
  return Object.entries(groups)
}

function toInboxMessage(m: InboxConversationMessage, index: number, all: InboxConversationMessage[]): InboxMessage {
  const isFirstInbound =
    m.direction === 'inbound' &&
    all.findIndex((x) => x.direction === 'inbound') === index
  const attachments = collectInboxAttachments(m)
  return {
    id: m.id,
    direction: m.direction === 'system' ? 'system' : m.direction,
    channel: m.channel || readChannel(m),
    content: m.content || m.body || '',
    status: (m.status || m.delivery_status || 'sent') as InboxMessage['status'],
    created_at: m.created_at || m.sent_at || new Date().toISOString(),
    failed_reason: m.failed_reason ?? null,
    is_first_inbound: m.is_first_inbound ?? isFirstInbound,
    system_event_type: m.system_event_type ?? null,
    image_url: m.image_url ?? null,
    audio_url: m.audio_url ?? null,
    content_type: m.content_type ?? null,
    attachments,
  }
}

function normalizeConversation(raw: InboxConversation): InboxConversation & { channel: string; source: string } {
  return {
    ...raw,
    channel: readChannel(raw),
    source: readSource(raw),
  }
}

function substituteTemplate(body: string, conversation: InboxConversation | null): string {
  const first = (conversation?.contact_name || '').split(' ')[0] || ''
  return body
    .split('{contact.first_name}').join(first)
    .split('{contact.name}').join(conversation?.contact_name || '')
    .split('{listing.address}').join(conversation?.linked_listing_label || '')
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function InboxPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const online = useOnlineStatus()
  usePageTitle('Inbox')

  const initialId = routeConversationId || searchParams.get('conversation')

  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<
    Array<InboxConversation & { channel: string; source: string }>
  >([])
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [threadLoading, setThreadLoading] = useState(false)
  const [activeConversation, setActiveConversation] = useState<
    (InboxConversation & { channel: string; source: string }) | null
  >(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [draft, setDraft] = useState(searchParams.get('draft') || '')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [sort, setSort] = useState<SortMode>((searchParams.get('sort') as SortMode) || 'newest')
  const [filters, setFilters] = useState<InboxFilters>({
    unread: searchParams.get('unread') === '1',
    assignedMe: searchParams.get('assigned') === 'me',
    channel: searchParams.get('channel'),
    source: searchParams.get('source'),
  })
  const [mergeMode, setMergeMode] = useState<InboxMergeMode>('separate')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [composeAttachments, setComposeAttachments] = useState<ComposeAttachment[]>([])
  const [templates, setTemplates] = useState<ComposeTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const loadConversations = async () => {
    try {
      const data = (await api.getConversations()) as InboxConversation[]
      setConversations((Array.isArray(data) ? data : []).map(normalizeConversation))
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to load inbox',
        description: err.message || 'Could not load conversations',
        variant: 'error',
      })
    }
  }

  const loadThread = async (id: string) => {
    setThreadLoading(true)
    try {
      const data = (await api.getConversation(id)) as InboxConversation & {
        messages?: InboxConversationMessage[]
        contact?: { name?: string; email?: string; phone?: string } | null
      }
      const normalized = normalizeConversation(data)
      setActiveConversation(normalized)
      const rawMessages = data.messages || []
      setMessages(rawMessages.map((m, i) => toInboxMessage(m, i, rawMessages)))
      if (routeConversationId) {
        navigate(`/inbox/${id}`, { replace: true })
      } else {
        const next = new URLSearchParams(searchParams)
        next.set('conversation', id)
        setSearchParams(next, { replace: true })
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to load conversation',
        description: err.message || 'Could not open thread',
        variant: 'error',
      })
    } finally {
      setThreadLoading(false)
    }
  }

  const loadAiSuggestions = async (id: string) => {
    setAiLoading(true)
    try {
      const res = await api.getConversationAiSuggestions(id)
      setAiEnabled(Boolean(res?.enabled))
      setAiSuggestions(Array.isArray(res?.suggestions) ? res.suggestions : [])
    } catch {
      setAiEnabled(false)
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      loadConversations(),
      api.getAgentPreferences().then((prefs) => {
        if (mounted && (prefs?.inbox_merge_mode === 'merged' || prefs?.inbox_merge_mode === 'separate')) {
          setMergeMode(prefs.inbox_merge_mode)
        }
      }).catch(() => undefined),
    ]).then(() => {
      if (!mounted) return
      setLoading(false)
      if (initialId) loadThread(initialId)
    })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (routeConversationId && routeConversationId !== selectedId) {
      setSelectedId(routeConversationId)
    }
  }, [routeConversationId, selectedId])

  useEffect(() => {
    if (!selectedId) return
    loadThread(selectedId)
    loadAiSuggestions(selectedId)
    const interval = setInterval(() => {
      if (!navigator.onLine) return
      loadThread(selectedId)
      loadConversations()
    }, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (filters.unread) next.set('unread', '1')
    else next.delete('unread')
    if (filters.assignedMe) next.set('assigned', 'me')
    else next.delete('assigned')
    if (filters.channel) next.set('channel', filters.channel)
    else next.delete('channel')
    if (filters.source) next.set('source', filters.source)
    else next.delete('source')
    if (search.trim()) next.set('q', search.trim())
    else next.delete('q')
    if (sort !== 'newest') next.set('sort', sort)
    else next.delete('sort')
    if (selectedId && !routeConversationId) next.set('conversation', selectedId)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, sort, selectedId])

  const groupedConversations = useMemo(
    () => groupConversationsForInbox(conversations, mergeMode),
    [conversations, mergeMode],
  )

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = groupedConversations.filter((c) => {
      if (filters.unread && !(c.unread_count > 0 || c.is_unread_by_agent)) return false
      if (filters.assignedMe && agent && c.assigned_agent_id !== agent.id) return false
      if (filters.channel && !c.channels.includes(filters.channel) && readChannel(c) !== filters.channel) return false
      if (filters.source && !c.sources.includes(filters.source) && readSource(c) !== filters.source) return false
      if (!q) return true
      return (
        (c.contact_name || '').toLowerCase().includes(q) ||
        (c.contact_email || '').toLowerCase().includes(q) ||
        (c.contact_phone || '').toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q)
      )
    })

    list = [...list].sort((a, b) => {
      if (sort === 'priority') {
        return (b.priority_score ?? 0) - (a.priority_score ?? 0)
      }
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return sort === 'oldest' ? ta - tb : tb - ta
    })
    return list
  }, [groupedConversations, search, filters, sort, agent])

  const unreadCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations],
  )
  const assignedToMe = useMemo(
    () =>
      agent ? conversations.filter((c) => c.assigned_agent_id === agent.id).length : 0,
    [conversations, agent],
  )

  const hasActiveFilters =
    filters.unread || filters.assignedMe || Boolean(filters.channel) || Boolean(filters.source)

  const activeMergedRow = filteredConversations.find(
    (row) => row.id === selectedId || row.conversation_ids.includes(selectedId || ''),
  )
  const channelOptions = (activeMergedRow?.conversation_ids || []).map((id) => {
    const row = conversations.find((c) => c.id === id)
    return { id, channel: row ? readChannel(row) : readChannel(activeConversation) }
  })

  const handleSelect = (id: string) => {
    setSelectedId(id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      navigate(`/inbox/${id}`)
    }
  }

  const handleEnterSelection = (id: string) => {
    setSelectionMode(true)
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const clearSelection = () => {
    setSelectionMode(false)
    setSelectedIds([])
  }

  const expandSelectionIds = (ids: string[]) => {
    const expanded = new Set<string>()
    for (const id of ids) {
      const row = filteredConversations.find((c) => c.id === id)
      if (row?.conversation_ids?.length) row.conversation_ids.forEach((cid) => expanded.add(cid))
      else expanded.add(id)
    }
    return [...expanded]
  }

  const handleBack = () => {
    setSelectedId(null)
    setActiveConversation(null)
    navigate('/inbox')
  }

  const handleMergeModeChange = async (mode: InboxMergeMode) => {
    const previous = mergeMode
    setMergeMode(mode)
    try {
      await api.patchAgentPreferences({ inbox_merge_mode: mode })
    } catch (e: unknown) {
      setMergeMode(previous)
      const err = e as { message?: string }
      addToast({
        title: 'Could not save inbox display',
        description: err.message || 'Merge preference was not saved',
        variant: 'error',
      })
    }
  }

  const handleSend = async () => {
    if (!activeConversation || (!draft.trim() && composeAttachments.length === 0)) return
    const content = draft.trim()
    const queued = composeAttachments
    setDraft('')
    setComposeAttachments([])
    setSending(true)
    const image = queued.find((item) => item.kind === 'image')
    let imageUrl = image?.url && image.url.startsWith('http') ? image.url : undefined
    if (image?.file) {
      try {
        imageUrl = await fileToDataUrl(image.file)
      } catch {
        imageUrl = undefined
      }
    }
    const attachments = queued.map((item) => ({
      url: item.url,
      mime: item.mime,
      filename: item.filename,
      size_bytes: item.size_bytes,
    }))
    try {
      await api.sendConversationMessage(activeConversation.id, content, {
        image_url: imageUrl,
        attachments,
        content_type: imageUrl ? 'image' : 'text',
      })
      await loadThread(activeConversation.id)
      await loadConversations()
      await loadAiSuggestions(activeConversation.id)
    } catch (e: unknown) {
      if (!online) {
        setMessages((prev) => [
          ...prev,
          {
            id: `queued-${Date.now()}`,
            direction: 'outbound',
            channel: readChannel(activeConversation),
            content,
            status: 'queued',
            created_at: new Date().toISOString(),
            attachments: queued.map((item) => ({
              url: item.url,
              mime: item.mime,
              filename: item.filename,
              size_bytes: item.size_bytes,
              kind: item.kind,
            })),
          },
        ])
        addToast({ title: 'Queued — will send when back online.', variant: 'success' })
      } else {
        const err = e as { message?: string }
        setDraft(content)
        setComposeAttachments(queued)
        addToast({
          title: 'Failed to send message',
          description: err.message || 'Message could not be sent',
          variant: 'error',
        })
      }
    } finally {
      setSending(false)
    }
  }

  const handleMarkRead = async () => {
    if (!activeConversation) return
    try {
      await api.markConversationRead(activeConversation.id)
      await loadThread(activeConversation.id)
      await loadConversations()
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to mark read',
        description: err.message || 'Could not update read status',
        variant: 'error',
      })
    }
  }

  const handleClose = async () => {
    if (!activeConversation) return
    setClosing(true)
    try {
      await api.closeConversation(activeConversation.id, 'Closed by agent')
      await loadThread(activeConversation.id)
      await loadConversations()
      addToast({ title: 'Conversation closed', variant: 'success' })
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to close',
        description: err.message || 'Could not close conversation',
        variant: 'error',
      })
    } finally {
      setClosing(false)
    }
  }

  const handleReopen = async () => {
    if (!activeConversation) return
    try {
      await api.updateConversation(activeConversation.id, { status: 'open' })
      await loadThread(activeConversation.id)
      await loadConversations()
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to reopen',
        description: err.message || 'Could not reopen conversation',
        variant: 'error',
      })
    }
  }

  const handleAssignMe = async () => {
    if (!activeConversation || !agent) return
    try {
      await api.assignConversation(activeConversation.id, agent.id)
      await loadThread(activeConversation.id)
      await loadConversations()
      addToast({ title: 'Conversation assigned', variant: 'success' })
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Failed to assign',
        description: err.message || 'Could not assign conversation',
        variant: 'error',
      })
    }
  }

  const runBulk = async (action: 'mark_read' | 'mark_unread' | 'assign' | 'archive') => {
    const ids = expandSelectionIds(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    const snapshot = conversations
    try {
      await api.bulkConversations({
        conversation_ids: ids,
        action,
        assign_to_agent_id: action === 'assign' ? agent?.id : undefined,
      })
      await loadConversations()
      clearSelection()
    } catch (e: unknown) {
      setConversations(snapshot)
      const err = e as { message?: string }
      addToast({
        title: 'Bulk action failed',
        description: err.message || 'Could not update conversations',
        variant: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const rows = (await api.getMessageTemplates({
        channel: activeConversation ? readChannel(activeConversation) : undefined,
      })) as Array<{ id: string; name: string; body: string; channel?: string }>
      setTemplates(
        (Array.isArray(rows) ? rows : []).map((row) => ({
          id: row.id,
          name: row.name,
          body: row.body,
          channel: row.channel,
          preview: row.body,
        })),
      )
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }

  const contactFirstName = (activeConversation?.contact_name || '').split(' ')[0] || null
  const showDetail = Boolean(selectedId && activeConversation)

  return (
    <CrmShell badges={{ inbox: unreadCount }}>
      <CmdPageHeader
        title="Inbox"
        subtitle={
          unreadCount > 0 ? (
            <span>
              <Numeric>{unreadCount}</Numeric> unread
              {assignedToMe > 0 ? (
                <>
                  {' '}
                  · <Numeric>{assignedToMe}</Numeric> assigned to you
                </>
              ) : null}
            </span>
          ) : (
            'All conversations'
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                loadConversations()
                if (selectedId) loadThread(selectedId)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="hidden gap-1.5 lg:inline-flex" disabled aria-label="Compose new conversation">
              <Plus className="h-3.5 w-3.5" /> Compose
            </Button>
          </div>
        }
      />

      {!online ? <InboxOfflineBanner queuedSend={Boolean(selectedId)} /> : null}

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            'flex w-full shrink-0 flex-col border-e border-[var(--lc-border)] bg-[var(--lc-surface)] lg:w-[min(40%,480px)] lg:min-w-[380px]',
            selectedId && 'hidden lg:flex',
          )}
        >
          {selectionMode && selectedIds.length > 0 ? (
            <InboxBulkActionBar
              count={selectedIds.length}
              busy={bulkBusy}
              onMarkRead={() => runBulk('mark_read')}
              onMarkUnread={() => runBulk('mark_unread')}
              onAssign={() => runBulk('assign')}
              onArchive={() => runBulk('archive')}
              onCancel={clearSelection}
            />
          ) : null}

          <div className="space-y-2 border-b border-[var(--lc-border)] px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]" />
              <Input
                placeholder="Search messages, contacts, listings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 ps-9 text-sm border-[var(--lc-border-strong)]"
                aria-label="Search inbox"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]" aria-live="polite">
                {search.trim() ? (
                  <>
                    <Numeric>{filteredConversations.length}</Numeric> conversations found
                  </>
                ) : (
                  <>
                    <Numeric>{unreadCount}</Numeric> unread
                    {assignedToMe > 0 ? (
                      <>
                        {' '}
                        · <Numeric>{assignedToMe}</Numeric> assigned to you
                      </>
                    ) : null}
                  </>
                )}
              </p>
              <label className="inline-flex items-center gap-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                <select
                  className="bg-transparent font-medium text-[var(--lc-text-primary)]"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label="Sort inbox"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="priority">Highest priority first</option>
                </select>
              </label>
            </div>
          </div>

          <InboxFilterChipRow
            filters={filters}
            onChange={setFilters}
            mergeMode={mergeMode}
            onMergeModeChange={handleMergeModeChange}
          />

          <div className="flex-1 overflow-y-auto" aria-label="Conversations">
            {loading ? (
              <div className="space-y-2 p-4" aria-label="Loading your inbox…">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[72px] animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]"
                  />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <InboxEmptyState
                variant={
                  search.trim().length >= 2
                    ? 'search'
                    : hasActiveFilters
                      ? 'filtered'
                      : 'first-run'
                }
                query={search}
                onClearSearch={() => setSearch('')}
                onClearFilters={() =>
                  setFilters({ unread: false, assignedMe: false, channel: null, source: null })
                }
              />
            ) : (
              <div className="md:p-2">
                {filteredConversations.map((c) => (
                  <InboxRow
                    key={c.id}
                    conversation={{
                      id: c.id,
                      contact_name: c.contact_name,
                      contact_masked: c.contact_masked,
                      channel: c.channel,
                      source: c.source,
                      channels: c.channels,
                      sources: c.sources,
                      last_message_at: c.last_message_at,
                      last_message_preview: c.last_message_preview,
                      unread_count: c.unread_count,
                      is_unread_by_agent: c.is_unread_by_agent,
                      priority_score: c.priority_score,
                      priority_reason: c.priority_reason,
                      assigned_agent_id: c.assigned_agent_id,
                      assigned_agent_name: c.assigned_agent_name,
                      current_agent_id: agent?.id ?? null,
                      conversation_ids: c.conversation_ids,
                      merged: c.merged,
                    }}
                    selected={c.id === selectedId || c.conversation_ids.includes(selectedId || '')}
                    checked={selectedIds.includes(c.id)}
                    selectionMode={selectionMode}
                    onSelect={handleSelect}
                    onToggleSelect={handleToggleSelect}
                    onEnterSelection={handleEnterSelection}
                  />
                ))}
              </div>
            )}
          </div>

          <Button
            size="icon"
            className="fixed bottom-24 end-6 z-20 h-14 w-14 rounded-[var(--lc-radius-pill)] shadow-[var(--lc-elevation-lg)] lg:hidden"
            aria-label="Compose new conversation"
            disabled
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <div
          className={cn(
            'flex flex-1 flex-col bg-[var(--lc-surface-sunken)]',
            !selectedId && 'hidden lg:flex',
          )}
        >
          {!showDetail ? (
            <InboxEmptyState variant="preview" />
          ) : (
            <>
              <ConversationHeader
                contactName={activeConversation!.contact_name || 'Unknown'}
                contactPhone={activeConversation!.contact_phone}
                contactEmail={activeConversation!.contact_email}
                channel={readChannel(activeConversation!)}
                source={readSource(activeConversation!)}
                status={activeConversation!.status === 'closed' ? 'closed' : 'open'}
                unreadCount={activeConversation!.unread_count || 0}
                showBack
                onBack={handleBack}
                onMarkRead={handleMarkRead}
                onAssignMe={handleAssignMe}
                onClose={handleClose}
                onReopen={handleReopen}
                closing={closing}
                channelOptions={channelOptions}
                selectedConversationId={selectedId}
                onSelectChannel={handleSelect}
              />

              <div className="flex-1 overflow-y-auto p-4" aria-live="polite" aria-label="Message thread">
                {threadLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--lc-text-muted)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <InboxEmptyState variant="preview" />
                ) : (
                  <div className="mx-auto max-w-3xl space-y-4">
                    {groupMessagesByDay(messages).map(([label, dayMessages]) => (
                      <div key={label} className="space-y-3">
                        <DayGroupSeparator label={label} />
                        {dayMessages.map((m) => (
                          <MessageBubble
                            key={m.id}
                            message={m}
                            conversationChannel={readChannel(activeConversation!)}
                            conversationSource={readSource(activeConversation!)}
                            showPortalChip={Boolean(m.is_first_inbound)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {aiEnabled ? (
                <AISuggestedReplyRow
                  suggestions={aiSuggestions}
                  loading={aiLoading}
                  disabled={activeConversation!.status === 'closed'}
                  onInsert={(text) => setDraft(text)}
                />
              ) : null}

              <ComposeBar
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                channel={readChannel(activeConversation!)}
                contactFirstName={contactFirstName}
                sending={sending}
                closed={activeConversation!.status === 'closed'}
                onReopen={handleReopen}
                offline={!online}
                attachments={composeAttachments}
                onAttachmentsChange={setComposeAttachments}
                templates={templates}
                templatesLoading={templatesLoading}
                onRequestTemplates={loadTemplates}
                onInsertTemplate={(template) => {
                  setDraft(substituteTemplate(template.body, activeConversation))
                }}
              />
            </>
          )}
        </div>
      </div>
    </CrmShell>
  )
}

export function InboxConversationPage() {
  return <InboxPage />
}
