import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, MessageSquareText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'
import {
  MESSAGE_TEMPLATE_CATEGORIES,
  MESSAGE_TEMPLATE_CHANNELS,
  categoryLabel,
  channelLabel,
  type MessageTemplateRow,
} from '@/lib/messageTemplates/shared'

/**
 * AGT-TPL-001 — Templates list (agent-scope)
 * Route: `/message-templates`
 */
export function MessageTemplatesPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  usePageTitle('Message Templates')

  const [templates, setTemplates] = useState<MessageTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    if (!agent) return
    setLoading(true)
    const params: Record<string, string> = {}
    if (channelFilter !== 'all') params.channel = channelFilter
    if (categoryFilter !== 'all') params.category = categoryFilter
    void api
      .getMessageTemplates(params)
      .then((rows) => setTemplates((rows as MessageTemplateRow[]) || []))
      .catch((e: unknown) => {
        addToast({
          title: 'Failed to load templates',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'error',
        })
      })
      .finally(() => setLoading(false))
  }, [agent, channelFilter, categoryFilter, addToast])

  return (
    <CrmShell>
      <div data-screen="AGT-TPL-001" data-testid="message-templates-page" className="p-6">
        <CmdPageHeader
          title="Message Templates"
          subtitle="Reusable messages for WhatsApp, SMS, and email. Use {{variable}} placeholders."
          actions={
            <Button asChild className="gap-2 min-h-tap">
              <Link to="/message-templates/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New template
              </Link>
            </Button>
          }
        />

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by channel"
            >
              <option value="all">All channels</option>
              {MESSAGE_TEMPLATE_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {MESSAGE_TEMPLATE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <CmdEmptyState
              icon={<MessageSquareText className="h-8 w-8" />}
              title="No templates yet"
              description="Create your first reusable message template for WhatsApp, SMS, or email."
              action={
                <Button asChild>
                  <Link to="/message-templates/new">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Create template
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => {
                const Icon = MESSAGE_TEMPLATE_CHANNELS.find((c) => c.value === tpl.channel)?.icon || MessageSquareText
                const readOnly = tpl.owner_type === 'agency' || tpl.owner_type === 'platform'
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => navigate(`/message-templates/${tpl.id}`)}
                    className={cn(
                      'rounded-lg border bg-[var(--lc-surface)] p-4 text-left shadow-sm transition-shadow hover:shadow-md',
                      'border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <h3 className="font-medium">{tpl.name}</h3>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {readOnly ? <Badge variant="secondary">Read-only</Badge> : null}
                        {tpl.is_default ? <Badge variant="secondary">Default</Badge> : null}
                        <Badge variant="outline">{channelLabel(tpl.channel)}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{tpl.body}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">{categoryLabel(tpl.category)}</Badge>
                      {tpl.variables.slice(0, 4).map((v) => (
                        <span key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{v}</span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  )
}
