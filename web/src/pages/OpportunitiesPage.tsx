import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DollarSign, Loader2, Plus, TrendingUp, Target, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { useUiMode } from '@/hooks/useUiMode'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { CmdKpiStrip } from '@/components/layout/CmdKpiStrip'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'
import { AddOpportunityDialog } from '@/components/opportunities/AddOpportunityDialog'
import {
  OpportunitiesListView,
  type OpportunityRow,
} from '@/components/opportunities/OpportunitiesListView'
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  STAGE_STYLE,
  opportunityStageIndex,
  stageLabel,
} from '@/components/opportunities/opportunity-constants'

interface Opportunity {
  id: string
  contact_id: string
  property_id: string | null
  stage: string
  deal_value: number | null
  currency: string
  probability: number
  expected_close_date: string | null
  lost_reason: string
  closed_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export function OpportunitiesPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { effectiveMode, isProCapable } = useUiMode()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  usePageTitle('Opportunities')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [stageFilter, setStageFilter] = useState<'open' | 'all' | string>('open')

  const wantListView =
    effectiveMode === 'guided' || searchParams.get('view') === 'list' || !isProCapable

  const loadAll = async () => {
    if (!agent) return
    try {
      const [opps, c] = await Promise.all([api.getOpportunities(), api.getContacts()])
      setOpportunities(opps || [])
      setContacts(c || [])
    } catch (e: any) {
      addToast({ title: 'Failed to load opportunities', description: e.message, variant: 'error' })
    }
  }

  useEffect(() => {
    if (!agent?.id) return
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [agent?.id])

  const visibleStages = useMemo(() => {
    if (stageFilter === 'all') return OPPORTUNITY_STAGES
    if (stageFilter === 'open') return OPEN_OPPORTUNITY_STAGES
    return [stageFilter]
  }, [stageFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, Opportunity[]> = {}
    OPPORTUNITY_STAGES.forEach((s) => (groups[s] = []))
    opportunities.forEach((o) => {
      if (!groups[o.stage]) groups[o.stage] = []
      groups[o.stage].push(o)
    })
    return groups
  }, [opportunities])

  const summary = useMemo(() => {
    const open = opportunities.filter((o) =>
      (OPEN_OPPORTUNITY_STAGES as readonly string[]).includes(o.stage),
    )
    const won = opportunities.filter((o) => o.stage === 'closed_won')
    const total = open.reduce((sum, o) => sum + (Number(o.deal_value) || 0), 0)
    const weighted = open.reduce(
      (sum, o) => sum + ((Number(o.deal_value) || 0) * (Number(o.probability) || 0)) / 100,
      0,
    )
    const wonValue = won.reduce((sum, o) => sum + (Number(o.deal_value) || 0), 0)
    return { total, weighted: Math.round(weighted), count: open.length, wonValue }
  }, [opportunities])

  const updateStage = async (opportunity: Opportunity, nextStage: string) => {
    try {
      await api.updateOpportunity(opportunity.id, { stage: nextStage })
      setOpportunities((prev) =>
        prev.map((row) => (row.id === opportunity.id ? { ...row, stage: nextStage } : row)),
      )
    } catch (e: any) {
      addToast({ title: 'Failed to update stage', description: e.message, variant: 'error' })
    }
  }

  const handleStageAdvance = async (opportunity: OpportunityRow) => {
    const idx = opportunityStageIndex(opportunity.stage)
    if (idx < 0 || idx >= OPPORTUNITY_STAGES.length - 1) return
    await updateStage(opportunity as Opportunity, OPPORTUNITY_STAGES[idx + 1])
  }

  const handleStageRetreat = async (opportunity: OpportunityRow) => {
    const idx = opportunityStageIndex(opportunity.stage)
    if (idx <= 0) return
    await updateStage(opportunity as Opportunity, OPPORTUNITY_STAGES[idx - 1])
  }

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.name || 'Unknown'

  return (
    <CrmShell>
      <CmdPageHeader
        title="Opportunities"
        subtitle={`${summary.count} open deals`}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New deal
          </Button>
        }
      />

      <AddOpportunityDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => {
          void loadAll()
          navigate(`/opportunities/${id}`)
        }}
      />

      <CmdKpiStrip
        items={[
          {
            label: 'Open pipeline',
            value: `$${summary.total.toLocaleString()}`,
            icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: 'Weighted value',
            value: `$${summary.weighted.toLocaleString()}`,
            icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: 'Open deals',
            value: summary.count,
            icon: <Target className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: 'Won revenue',
            value: `$${summary.wonValue.toLocaleString()}`,
            valueClass: 'text-green-700',
            icon: <TrendingUp className="h-4 w-4 text-green-500" />,
          },
        ]}
      />

      {wantListView ? (
        <OpportunitiesListView
          opportunities={opportunities}
          loading={loading}
          stageFilter={stageFilter}
          onStageFilterChange={setStageFilter}
          contactName={contactName}
          onAdvance={handleStageAdvance}
          onRetreat={handleStageRetreat}
          onAdd={() => setAddOpen(true)}
        />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-6 py-2">
            {[
              { label: 'Open', value: 'open' },
              { label: 'All', value: 'all' },
              ...OPPORTUNITY_STAGES.map((s) => ({ label: stageLabel(s), value: s })),
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStageFilter(f.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                  stageFilter === f.value
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-muted-foreground hover:bg-[var(--lc-action-secondary)] hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : opportunities.length === 0 ? (
              <CmdEmptyState
                icon={<TrendingUp className="h-8 w-8" />}
                title="No deals yet"
                description="Create your first deal above or complete a viewing with 'Interested' outcome."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> New deal
                  </Button>
                }
              />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {visibleStages.map((stage) => {
                  const cards = grouped[stage] || []
                  const style = STAGE_STYLE[stage] || { pill: '', header: '' }
                  return (
                    <div key={stage} className="w-60 shrink-0">
                      <div className={cn('mb-3 flex items-center justify-between rounded-t-md border-t-[3px] bg-[var(--lc-surface)] px-3 py-2.5 shadow-sm', style.header)}>
                        <span className="text-xs font-semibold capitalize">{stageLabel(stage)}</span>
                        <Badge variant="outline" className={cn('text-[10px]', style.pill)}>{cards.length}</Badge>
                      </div>

                      <div className="space-y-2">
                        {cards.length === 0 && (
                          <div className="rounded-md border border-dashed border-[var(--lc-border)] px-3 py-4 text-center">
                            <p className="text-[11px] text-muted-foreground">No deals</p>
                          </div>
                        )}
                        {cards.map((o) => {
                          const isLast = opportunityStageIndex(o.stage) >= OPPORTUNITY_STAGES.length - 1
                          return (
                            <div
                              key={o.id}
                              className="group rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3 shadow-sm transition-shadow hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/opportunities/${o.id}`}
                                  className="text-sm font-medium leading-snug hover:underline"
                                >
                                  {contactName(o.contact_id)}
                                </Link>
                                <Badge variant="outline" className="shrink-0 text-[10px]">{o.probability}%</Badge>
                              </div>
                              {o.deal_value != null && (
                                <p className="mt-1 text-sm font-semibold text-[var(--lc-text-primary)]">
                                  ${Number(o.deal_value).toLocaleString()}
                                  <span className="ms-1 text-[10px] font-normal text-muted-foreground">{o.currency}</span>
                                </p>
                              )}
                              {o.expected_close_date && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  Close: {new Date(o.expected_close_date).toLocaleDateString()}
                                </p>
                              )}
                              {!isLast && (
                                <button
                                  onClick={() => handleStageAdvance(o)}
                                  className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border border-[var(--lc-border)] py-1.5 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--lc-action-secondary)]"
                                >
                                  Advance <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </CrmShell>
  )
}
