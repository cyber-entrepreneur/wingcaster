import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { api, type AssignableAgent } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

const COPY: Record<
  'title' | 'note' | 'notePlaceholder' | 'assign' | 'cancel' | 'search' | 'noMatches' | 'success' | 'failed',
  Record<AppLocale, string>
> = {
  title: { en: 'Assign conversations', ar: 'إسناد المحادثات' },
  note: { en: 'Note for assignee (optional)', ar: 'ملاحظة للمُسند إليه (اختياري)' },
  notePlaceholder: { en: 'Context for the teammate…', ar: 'سياق للزميل…' },
  assign: { en: 'Assign', ar: 'إسناد' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  search: { en: 'Search teammates', ar: 'ابحث عن زميل' },
  noMatches: { en: 'No matches', ar: 'لا نتائج' },
  success: { en: 'Conversations assigned', ar: 'تم إسناد المحادثات' },
  failed: { en: 'Could not assign conversations', ar: 'تعذّر إسناد المحادثات' },
}

export interface BulkAssignConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationIds: string[]
  onAssigned?: () => void
}

function displayName(a: AssignableAgent, locale: AppLocale) {
  if (a.is_self) return `${a.name || 'You'} (${locale === 'ar' ? 'أنت' : 'You'})`
  return a.name || a.email || a.id
}

/**
 * AGT-INB-004 — bulk assign picker for inbox selection mode.
 */
export function BulkAssignConversationDialog({
  open,
  onOpenChange,
  conversationIds,
  onAssigned,
}: BulkAssignConversationDialogProps) {
  const { locale } = useLocale()
  const { addToast } = useToast()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [agents, setAgents] = useState<AssignableAgent[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sampleId = conversationIds[0] || null

  const load = useCallback(async () => {
    if (!sampleId) return
    setStatus('loading')
    try {
      const res = await api.getAssignableAgents(sampleId)
      const list = Array.isArray(res?.agents) ? res.agents : []
      setAgents(list)
      setSelectedId(list.find((a) => a.is_self)?.id || list[0]?.id || null)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [sampleId])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setNote('')
      setSelectedId(null)
      setStatus('idle')
      return
    }
    void load()
  }, [open, load])

  const filtered = query
    ? agents.filter((a) => `${a.name || ''} ${a.email || ''}`.toLowerCase().includes(query.toLowerCase()))
    : agents

  const canSubmit = Boolean(selectedId) && conversationIds.length > 0 && agents.length > 1

  const handleAssign = async () => {
    if (!selectedId || !canSubmit) return
    setSubmitting(true)
    try {
      await api.bulkConversations({
        conversation_ids: conversationIds,
        action: 'assign',
        assign_to_agent_id: selectedId,
        assignment_note: note.trim() || undefined,
      })
      addToast({ title: COPY.success[locale], variant: 'success' })
      onOpenChange(false)
      onAssigned?.()
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({ title: COPY.failed[locale], description: err?.message, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (agents.length <= 1 && status === 'ready') return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {COPY.title[locale]} (<Numeric>{conversationIds.length}</Numeric>)
          </DialogTitle>
        </DialogHeader>

        {status === 'loading' ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading" />
          </div>
        ) : status === 'error' ? (
          <p className="text-sm text-[var(--lc-status-unpublished-fg)]">{COPY.failed[locale]}</p>
        ) : (
          <div className="space-y-3">
            {agents.length > 5 ? (
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={COPY.search[locale]}
                aria-label={COPY.search[locale]}
              />
            ) : null}
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-[var(--lc-border)] p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--lc-text-muted)]">{COPY.noMatches[locale]}</li>
              ) : (
                filtered.map((a) => {
                  const active = a.id === selectedId
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm',
                          active
                            ? 'bg-[var(--lc-action-secondary)] text-[var(--lc-text-primary)]'
                            : 'text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]',
                        )}
                      >
                        <span className="truncate">{displayName(a, locale)}</span>
                        {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--lc-text-muted)]">{COPY.note[locale]}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={COPY.notePlaceholder[locale]}
                rows={2}
                className="w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {COPY.cancel[locale]}
          </Button>
          <Button type="button" onClick={() => void handleAssign()} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : COPY.assign[locale]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
