import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Loader2, MessageCircle, Sparkles } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/http-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const CATEGORY_COLORS: Record<string, string> = {
  hot_lead:    'bg-red-100 text-red-800 border-red-200',
  interest:    'bg-blue-100 text-blue-800 border-blue-200',
  investor:    'bg-indigo-100 text-indigo-800 border-indigo-200',
  question:    'bg-amber-100 text-amber-800 border-amber-200',
  objection:   'bg-orange-100 text-orange-800 border-orange-200',
  complaint:   'bg-rose-100 text-rose-800 border-rose-200',
  testimonial: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reaction:    'bg-slate-100 text-slate-700 border-slate-200',
  referral:    'bg-purple-100 text-purple-800 border-purple-200',
  spam:        'bg-zinc-100 text-zinc-500 border-zinc-200 line-through',
  general:     'bg-slate-100 text-slate-600 border-slate-200',
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-500',
  neutral:  'bg-slate-400',
  negative: 'bg-rose-500',
}

type Resp = Awaited<ReturnType<typeof api.getListingComments>>
type ThreadT = Resp['threads'][number]
type MessageT = ThreadT['messages'][number]

export function ListingCommentsTab({ listingId }: { listingId: string }) {
  const { addToast } = useToast()
  const [threads, setThreads] = useState<ThreadT[]>([])
  const [publishedPosts, setPublishedPosts] = useState(0)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [categoryMeta, setCategoryMeta] = useState<Resp['category_meta']>({})
  const [loading, setLoading] = useState(true)
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [reclassifyOpenFor, setReclassifyOpenFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const opts = categoryFilter.size > 0 ? { category: Array.from(categoryFilter) } : undefined
      const r = await api.getListingComments(listingId, opts)
      setThreads(r.threads)
      setPublishedPosts(r.published_posts)
      setSummary(r.summary || {})
      setCategoryMeta(r.category_meta || {})
    } catch (err: unknown) {
      addToast({ title: 'Could not load comments', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [listingId, addToast, categoryFilter])

  useEffect(() => { load() }, [load])

  async function submitReply(conversationId: string) {
    if (replyBusy || !replyText.trim()) return
    setReplyBusy(true)
    try {
      await api.sendConversationMessage(conversationId, replyText.trim())
      addToast({ title: 'Reply sent', variant: 'success' })
      setReplyText('')
      setReplyOpenFor(null)
      load()
    } catch (err: unknown) {
      addToast({ title: 'Reply failed', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setReplyBusy(false)
    }
  }

  async function sendSuggested(conversationId: string, text: string) {
    if (!text?.trim()) return
    try {
      await api.sendConversationMessage(conversationId, text.trim())
      addToast({ title: 'Suggested reply sent', variant: 'success' })
      load()
    } catch (err: unknown) {
      addToast({ title: 'Reply failed', description: apiErrorMessage(err), variant: 'error' })
    }
  }

  async function reclassify(messageId: string, category: string, sentiment?: string) {
    try {
      await api.reclassifyComment(messageId, category, sentiment)
      addToast({ title: 'Reclassified', variant: 'success' })
      setReclassifyOpenFor(null)
      load()
    } catch (err: unknown) {
      addToast({ title: 'Reclassify failed', description: apiErrorMessage(err), variant: 'error' })
    }
  }

  function toggleCategoryFilter(cat: string) {
    setCategoryFilter((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const channelLabel: Record<string, string> = {
    instagram_comment: 'Instagram',
    facebook_comment: 'Facebook',
    tiktok_comment: 'TikTok',
    x_mention: 'X',
    linkedin_comment: 'LinkedIn',
  }

  const filterOrder = ['hot_lead', 'interest', 'investor', 'question', 'objection', 'complaint', 'testimonial', 'reaction', 'referral', 'general', 'spam']

  return (
    <div data-screen="AGT-LST-012">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Comments on your published posts</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Across {publishedPosts} published post{publishedPosts === 1 ? '' : 's'} · replies use the
              same tenant credentials you set on <Link to="/settings/channels" className="text-primary underline">Settings → Channels</Link>.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(categoryMeta).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter(new Set())}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  categoryFilter.size === 0
                    ? 'bg-slate-900 text-[var(--lc-action-primary-text)] border-slate-900'
                    : 'bg-[var(--lc-surface)] text-muted-foreground hover:bg-muted'
                }`}
              >
                All ({Object.values(summary).reduce((s, n) => s + (n || 0), 0)})
              </button>
              {filterOrder.map((cat) => {
                const meta = categoryMeta[cat]
                if (!meta) return null
                const count = summary[cat] || 0
                if (count === 0 && !categoryFilter.has(cat)) return null
                const active = categoryFilter.has(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoryFilter(cat)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active ? 'ring-2 ring-offset-1 ring-slate-900' : ''
                    } ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.general}`}
                    title={meta.description}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                    <span className="opacity-70">({count})</span>
                  </button>
                )
              })}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
              {categoryFilter.size > 0
                ? 'No comments match the current filter. Clear filters to see everything.'
                : 'No comments yet. Once your published posts start getting engagement, comment threads will appear here — reply inline without leaving Wingcaster.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {threads.map((t) => {
                const displayName = t.contact?.name || t.messages[0]?.author_name || 'Someone'
                const topCat = t.top_category
                const topMeta = topCat ? categoryMeta[topCat] : null
                return (
                  <li key={t.conversation_id} className="rounded-lg border bg-[var(--lc-surface)] p-3">
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{channelLabel[t.channel] || t.channel}</Badge>
                        {topMeta && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[topCat!] || CATEGORY_COLORS.general}`}
                            title={topMeta.description}
                          >
                            {topMeta.emoji} {topMeta.label}
                          </span>
                        )}
                        {t.needs_agent_attention && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 animate-pulse"
                            title="Needs agent attention (flagged by router)"
                          >
                            ⚑ Needs attention
                          </span>
                        )}
                        <span className="text-sm font-medium">{displayName}</span>
                      </div>
                      {t.distribution_url && (
                        <a
                          href={t.distribution_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View post
                        </a>
                      )}
                    </div>
                    <ul className="space-y-1.5 border-t pt-2">
                      {t.messages.map((m) => (
                        <MessageRow
                          key={m.id}
                          message={m}
                          categoryMeta={categoryMeta}
                          reclassifyOpen={reclassifyOpenFor === m.id}
                          onOpenReclassify={() => setReclassifyOpenFor(reclassifyOpenFor === m.id ? null : m.id)}
                          onReclassify={(cat, sent) => reclassify(m.id, cat, sent)}
                          onMarkSpam={() => reclassify(m.id, 'spam')}
                          onSendSuggestedReply={(text) => sendSuggested(t.conversation_id, text)}
                        />
                      ))}
                    </ul>
                    {replyOpenFor === t.conversation_id ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type a reply…"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              submitReply(t.conversation_id)
                            }
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => submitReply(t.conversation_id)} disabled={replyBusy}>
                          {replyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyOpenFor(null); setReplyText('') }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Button size="sm" variant="outline" onClick={() => { setReplyOpenFor(t.conversation_id); setReplyText('') }}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MessageRow({
  message: m,
  categoryMeta,
  reclassifyOpen,
  onOpenReclassify,
  onReclassify,
  onMarkSpam,
  onSendSuggestedReply,
}: {
  message: MessageT
  categoryMeta: Record<string, { label: string; emoji: string; description: string; route: string }>
  reclassifyOpen: boolean
  onOpenReclassify: () => void
  onReclassify: (category: string, sentiment?: string) => void
  onMarkSpam: () => void
  onSendSuggestedReply?: (text: string) => void
}) {
  const meta = m.category ? categoryMeta[m.category] : null
  const bubbleClass = m.direction === 'inbound'
    ? 'rounded-md bg-slate-50 px-2.5 py-1.5 text-sm'
    : 'ml-8 rounded-md bg-slate-900 px-2.5 py-1.5 text-sm text-[var(--lc-action-primary-text)]'
  const sourceLabel = m.category_source
    ? m.category_source === 'manual' ? '· manual' : m.category_source === 'ai' ? '· AI' : '· rules'
    : ''
  const isSpam = m.category === 'spam'

  return (
    <li className={bubbleClass}>
      <div className="whitespace-pre-wrap">{m.content}</div>
      <div className={`mt-0.5 flex items-center gap-2 text-[10px] ${m.direction === 'inbound' ? 'text-muted-foreground' : 'text-[var(--lc-action-primary-text)]/70'}`}>
        <span>{new Date(m.created_at).toLocaleString()}</span>
        {m.direction === 'outbound' && <span>· {m.status}</span>}
        {m.direction === 'inbound' && meta && (
          <span className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium ${CATEGORY_COLORS[m.category!] || CATEGORY_COLORS.general}`}>
              {meta.emoji} {meta.label}
            </span>
            {m.sentiment && (
              <span title={`sentiment: ${m.sentiment}`} className={`inline-block h-1.5 w-1.5 rounded-full ${SENTIMENT_DOT[m.sentiment] || SENTIMENT_DOT.neutral}`} />
            )}
            <span className="opacity-70">{sourceLabel}</span>
          </span>
        )}
        {m.direction === 'inbound' && (
          <div className="ml-auto flex items-center gap-2">
            {!isSpam && (
              <button
                type="button"
                onClick={onMarkSpam}
                className="text-[10px] text-rose-600 hover:text-rose-800 hover:underline"
              >
                Mark spam
              </button>
            )}
            <button
              type="button"
              onClick={onOpenReclassify}
              className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline"
            >
              {reclassifyOpen ? 'cancel' : 'reclassify'}
            </button>
          </div>
        )}
      </div>
      {reclassifyOpen && (
        <div className="mt-1.5 flex flex-wrap gap-1 rounded border border-dashed bg-[var(--lc-surface)] p-1.5">
          {Object.entries(categoryMeta).map(([cat, cm]) => (
            <button
              key={cat}
              type="button"
              onClick={() => onReclassify(cat)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] hover:ring-1 hover:ring-slate-900 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.general}`}
            >
              {cm.emoji} {cm.label}
            </button>
          ))}
        </div>
      )}

      {m.direction === 'inbound' && m.routings && m.routings.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {m.routings.flatMap((r) => r.outcomes.map((o, i) => (
            <RoutingOutcomeChip key={`${r.id}-${i}`} type={o.type} notes={o.notes || undefined} />
          )))}
        </div>
      )}

      {m.direction === 'inbound' && m.suggested_reply && (
        <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-900">
            <Sparkles className="h-3 w-3" />
            Suggested reply (agent review)
          </div>
          <div className="whitespace-pre-wrap text-amber-900">{m.suggested_reply}</div>
          {onSendSuggestedReply && (
            <div className="mt-1 flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={() => onSendSuggestedReply(m.suggested_reply!)}
              >
                Send as-is
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function RoutingOutcomeChip({ type, notes }: { type: string; notes?: string }) {
  const meta: Record<string, { label: string; className: string; icon?: string }> = {
    reply_sent:              { label: 'Reply sent',            className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '↩' },
    reply_drafted:           { label: 'Reply drafted',         className: 'bg-amber-100 text-amber-800 border-amber-200',       icon: '✎' },
    reply_suppressed:        { label: 'Auto-reply suppressed', className: 'bg-slate-100 text-slate-700 border-slate-200',       icon: '⊘' },
    opportunity_created:     { label: 'Opportunity opened',    className: 'bg-blue-100 text-blue-800 border-blue-200',          icon: '⚡' },
    inquiry_created:         { label: 'Inquiry created',       className: 'bg-indigo-100 text-indigo-800 border-indigo-200',    icon: '?' },
    engagement_incremented:  { label: 'Engagement counted',    className: 'bg-slate-100 text-slate-700 border-slate-200',       icon: '+' },
    agent_notified:          { label: 'Agent notified',        className: 'bg-rose-100 text-rose-800 border-rose-200',          icon: '!' },
    agency_owner_notified:   { label: 'Owner notified',        className: 'bg-rose-100 text-rose-800 border-rose-200',          icon: '‼' },
    marketing_queued:        { label: 'Marketing queue',       className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '★' },
    ai_watcher_subscribed:   { label: 'AI watching thread',    className: 'bg-purple-100 text-purple-800 border-purple-200',    icon: '👁' },
    hidden:                  { label: 'Hidden (spam)',         className: 'bg-zinc-100 text-zinc-500 border-zinc-200',          icon: '×' },
    flagged_for_agent:       { label: 'Flagged for agent',     className: 'bg-orange-100 text-orange-800 border-orange-200',    icon: '⚑' },
    skipped:                 { label: 'Skipped',               className: 'bg-slate-100 text-slate-500 border-slate-200',       icon: '·' },
  }
  const m = meta[type] || { label: type, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium ${m.className}`}
      title={notes ? `${m.label} — ${notes}` : m.label}
    >
      {m.icon && <span className="opacity-70">{m.icon}</span>}
      {m.label}
    </span>
  )
}
