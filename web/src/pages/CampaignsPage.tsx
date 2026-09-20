/**
 * CampaignsPage — Journeys list (renamed from campaigns; component name kept for compat).
 * AGT-CMP-001 — Guided mode uses template-first goal picker; Pro links to full builder.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2,
  Megaphone,
  Plus,
  Play,
  Pause,
  Trash2,
  Users,
  Mail,
  MessageSquare,
  Phone,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { CmdKpiStrip } from '@/components/layout/CmdKpiStrip'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'
import { CampaignGoalPicker } from '@/components/campaigns/CampaignGoalPicker'
import { buildCampaignNewHref } from '@/components/campaigns/campaign-goals'
import { useUiMode } from '@/hooks/useUiMode'

interface Campaign {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger: string
  target_channel: string
  steps: any[]
  tags_filter: string[]
  created_at: string
  updated_at: string
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  active: 'border-green-200 bg-green-50 text-green-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-50 text-slate-400',
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
  sms: <Phone className="h-3.5 w-3.5" />,
}

export function CampaignsPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { effectiveMode } = useUiMode()
  const isPro = effectiveMode === 'pro'
  usePageTitle('Journeys')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Campaign['status']>('all')

  useEffect(() => {
    if (!agent) return
    setLoading(true)
    api.getJourneys()
      .then((data: Campaign[]) => setCampaigns(data || []))
      .catch((e: any) => addToast({ title: 'Failed to load journeys', description: e.message, variant: 'error' }))
      .finally(() => setLoading(false))
  }, [agent])

  const handleToggle = async (c: Campaign) => {
    const next = c.status === 'active' ? 'paused' : 'active'
    setToggling(c.id)
    try {
      await api.updateJourney(c.id, { status: next })
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next as Campaign['status'] } : x)))
    } catch (e: any) {
      addToast({ title: 'Failed to update journey', description: e.message, variant: 'error' })
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this journey?')) return
    try {
      await api.updateJourney(id, { status: 'archived' })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      addToast({ title: 'Journey archived', variant: 'success' })
    } catch (e: any) {
      addToast({ title: 'Failed to archive journey', description: e.message, variant: 'error' })
    }
  }

  const counts = {
    active: campaigns.filter((c) => c.status === 'active').length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    total: campaigns.length,
  }

  const visibleCampaigns = useMemo(() => {
    if (statusFilter === 'all') return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const newCampaignHref = buildCampaignNewHref('custom', isPro)

  return (
    <CrmShell>
      <CmdPageHeader
        title="Journeys"
        subtitle="Versioned drip sequences and nurture orchestration"
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link to="/settings/saved-searches">
              <Button size="sm" variant="outline" className="gap-1.5">
                Saved searches
              </Button>
            </Link>
            {isPro ? (
              <Link to={newCampaignHref}>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> New journey
                </Button>
              </Link>
            ) : null}
          </div>
        )}
      />

      <CmdKpiStrip
        items={[
          { label: 'Total journeys', value: counts.total, icon: <Megaphone className="h-4 w-4 text-muted-foreground" /> },
          {
            label: 'Active',
            value: counts.active,
            valueClass: counts.active > 0 ? 'text-green-700' : undefined,
            icon: <Play className="h-4 w-4 text-muted-foreground" />,
          },
          { label: 'Draft', value: counts.draft, icon: <Pause className="h-4 w-4 text-muted-foreground" /> },
          {
            label: 'Contacts enrolled',
            value: '—',
            icon: <Users className="h-4 w-4 text-muted-foreground" />,
          },
        ]}
      />

      {!isPro && (
        <div className="border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-4 sm:px-6">
          <CampaignGoalPicker />
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2 sm:px-6">
          {(['all', 'active', 'draft', 'paused', 'archived'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                statusFilter === status
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'bg-[var(--lc-surface-sunken)] text-muted-foreground hover:text-foreground',
              )}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      )}

      {/* Campaign list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <CmdEmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No campaigns yet"
            description={
              isPro
                ? 'Create your first campaign to start nurturing leads automatically.'
                : 'Choose a goal above to launch your first nurture sequence.'
            }
            action={undefined}
          />
        ) : visibleCampaigns.length === 0 ? (
          <CmdEmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No campaigns match this filter"
            description="Try another status filter or create a new campaign."
          />
        ) : (
          <div className="divide-y divide-[var(--lc-border)]">
            {visibleCampaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 bg-[var(--lc-surface)] px-6 py-4 transition-colors hover:bg-[var(--lc-bg-page)]"
              >
                {/* Channel icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--lc-surface-sunken)] text-muted-foreground">
                  {CHANNEL_ICON[c.target_channel] ?? <Megaphone className="h-3.5 w-3.5" />}
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_STYLE[c.status])}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{c.steps.length} step{c.steps.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span className="capitalize">{c.trigger.replace(/_/g, ' ')}</span>
                    {c.tags_filter.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{c.tags_filter.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {c.status !== 'archived' && (
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={toggling === c.id}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--lc-action-secondary)]"
                      title={c.status === 'active' ? 'Pause' : 'Activate'}
                    >
                      {toggling === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : c.status === 'active' ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    to={`/journeys/${c.id}/edit?mode=pro`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--lc-action-secondary)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrmShell>
  )
}
