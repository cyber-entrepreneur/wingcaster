import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, UserPlus } from 'lucide-react'
import { api, type AssignableAgent } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

const COPY: Record<
  | 'assign'
  | 'assignedTo'
  | 'unassigned'
  | 'you'
  | 'loading'
  | 'error'
  | 'retry'
  | 'search'
  | 'noMatches'
  | 'assignedToast'
  | 'failedToast'
  | 'note'
  | 'notePlaceholder',
  Record<AppLocale, string>
> = {
  assign: { en: 'Assign', ar: 'إسناد' },
  assignedTo: { en: 'Assigned to', ar: 'مُسند إلى' },
  unassigned: { en: 'Unassigned', ar: 'غير مُسند' },
  you: { en: 'You', ar: 'أنت' },
  loading: { en: 'Loading teammates…', ar: 'جارٍ تحميل الزملاء…' },
  error: { en: "Couldn't load teammates.", ar: 'تعذّر تحميل الزملاء.' },
  retry: { en: 'Try again', ar: 'حاول مرة أخرى' },
  search: { en: 'Search teammates', ar: 'ابحث عن زميل' },
  noMatches: { en: 'No matches', ar: 'لا نتائج' },
  assignedToast: { en: 'Conversation assigned', ar: 'تم إسناد المحادثة' },
  failedToast: { en: 'Could not assign conversation', ar: 'تعذّر إسناد المحادثة' },
  note: { en: 'Note (optional)', ar: 'ملاحظة (اختياري)' },
  notePlaceholder: { en: 'Context for the teammate…', ar: 'سياق للزميل…' },
}

export interface AssignConversationMenuProps {
  conversationId: string
  assignedAgentId?: string | null
  /** Called after a successful assignment with the new assignee id. */
  onAssigned?: (agentId: string) => void
  className?: string
}

/**
 * AGT-INB-004 — Assign conversation.
 *
 * A compact menu in the conversation header that assigns the thread to any
 * teammate (or "you"). Loads assignable teammates lazily on open, shows the
 * current assignee with a check, and calls POST /api/conversations/:id/assign.
 * Tokens-only, RTL via document direction, keyboard/dismiss accessible.
 */
export function AssignConversationMenu({ conversationId, assignedAgentId, onAssigned, className }: AssignConversationMenuProps) {
  const { locale, dir } = useLocale()
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [agents, setAgents] = useState<AssignableAgent[]>([])
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await api.getAssignableAgents(conversationId)
      setAgents(Array.isArray(res?.agents) ? res.agents : [])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [conversationId])

  // Load once, so the trigger can name the current assignee even before opening.
  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const assignedAgent = agents.find((a) => a.id === assignedAgentId) || null
  const displayName = (a: AssignableAgent) => (a.is_self ? `${a.name || COPY.you[locale]} (${COPY.you[locale]})` : a.name || a.email || a.id)

  const triggerLabel = assignedAgent
    ? `${COPY.assignedTo[locale]}: ${assignedAgent.is_self ? COPY.you[locale] : assignedAgent.name || assignedAgent.email || assignedAgent.id}`
    : assignedAgentId
      ? `${COPY.assignedTo[locale]}: —`
      : COPY.assign[locale]

  const filtered = query
    ? agents.filter((a) => `${a.name || ''} ${a.email || ''}`.toLowerCase().includes(query.toLowerCase()))
    : agents

  const onPick = useCallback(
    async (agentId: string) => {
      setAssigningId(agentId)
      try {
        await api.assignConversation(conversationId, agentId, note.trim() || undefined)
        onAssigned?.(agentId)
        addToast({ title: COPY.assignedToast[locale], variant: 'success' })
        setNote('')
        setOpen(false)
      } catch (e: unknown) {
        const err = e as { message?: string }
        addToast({ title: COPY.failedToast[locale], description: err?.message, variant: 'error' })
      } finally {
        setAssigningId(null)
      }
    },
    [conversationId, note, onAssigned, addToast, locale],
  )

  // Solo agents have no teammates to assign to — hide the control entirely.
  if (status === 'ready' && agents.length <= 1) return null

  return (
    <div ref={rootRef} dir={dir} className={cn('relative', className)} data-testid="assign-conversation-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex min-h-[var(--lc-tap-target-min)] items-center gap-[var(--lc-space-2xs)] rounded-[var(--lc-radius-md)]',
          'border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-[var(--lc-space-sm)]',
          'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-focus-ring)]',
        )}
      >
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={COPY.assign[locale]}
          className={cn(
            'absolute z-dropdown mt-[var(--lc-space-2xs)] max-h-80 w-64 overflow-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] p-[var(--lc-space-2xs)] shadow-[var(--lc-elevation-md)] end-0',
          )}
        >
          {status === 'loading' ? (
            <p className="flex items-center gap-[var(--lc-space-2xs)] px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {COPY.loading[locale]}
            </p>
          ) : null}

          {status === 'error' ? (
            <div className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">
              <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-unpublished-fg)]">{COPY.error[locale]}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)] font-semibold text-[var(--lc-text-brand)] underline underline-offset-2"
              >
                {COPY.retry[locale]}
              </button>
            </div>
          ) : null}

          {status === 'ready' ? (
            <>
              {agents.length > 5 ? (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={COPY.search[locale]}
                  aria-label={COPY.search[locale]}
                  className="mb-[var(--lc-space-2xs)] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-[var(--lc-space-sm)] py-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)]"
                />
              ) : null}
              {filtered.length === 0 ? (
                <p className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                  {COPY.noMatches[locale]}
                </p>
              ) : (
                <ul>
                  {filtered.map((a) => {
                    const isCurrent = a.id === assignedAgentId
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={isCurrent}
                          disabled={assigningId !== null}
                          onClick={() => void onPick(a.id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-sm)] px-[var(--lc-space-sm)] py-[var(--lc-space-xs)] text-start',
                            'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]',
                            'disabled:opacity-60',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{displayName(a)}</span>
                          {assigningId === a.id ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                          ) : isCurrent ? (
                            <Check className="h-4 w-4 shrink-0 text-[var(--lc-status-published-fg)]" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <label className="mt-[var(--lc-space-2xs)] block border-t border-[var(--lc-border)] px-[var(--lc-space-sm)] pt-[var(--lc-space-sm)]">
                <span className="text-[length:var(--lc-type-caption)] font-medium text-[var(--lc-text-muted)]">
                  {COPY.note[locale]}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={COPY.notePlaceholder[locale]}
                  rows={2}
                  className="mt-[var(--lc-space-2xs)] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-[var(--lc-space-sm)] py-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)]"
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
