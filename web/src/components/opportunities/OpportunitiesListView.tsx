import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Plus, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'
import { cn } from '@/lib/utils'
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  STAGE_STYLE,
  opportunityStageIndex,
  stageLabel,
} from './opportunity-constants'

export interface OpportunityRow {
  id: string
  contact_id: string
  property_id: string | null
  stage: string
  deal_value: number | null
  currency: string
  probability: number
  expected_close_date: string | null
  notes: string
}

interface OpportunitiesListViewProps {
  opportunities: OpportunityRow[]
  loading: boolean
  stageFilter: 'open' | 'all' | string
  onStageFilterChange: (value: 'open' | 'all' | string) => void
  contactName: (contactId: string) => string
  onAdvance: (opportunity: OpportunityRow) => void
  onRetreat: (opportunity: OpportunityRow) => void
  onAdd: () => void
}

/**
 * AGT-OPP-001b — Guided mobile opportunities list (`/opportunities?view=list`).
 */
export function OpportunitiesListView({
  opportunities,
  loading,
  stageFilter,
  onStageFilterChange,
  contactName,
  onAdvance,
  onRetreat,
  onAdd,
}: OpportunitiesListViewProps) {
  const visibleStages =
    stageFilter === 'all'
      ? OPPORTUNITY_STAGES
      : stageFilter === 'open'
        ? OPEN_OPPORTUNITY_STAGES
        : [stageFilter]

  const grouped = OPPORTUNITY_STAGES.reduce<Record<string, OpportunityRow[]>>((acc, stage) => {
    acc[stage] = opportunities.filter((o) => o.stage === stage)
    return acc
  }, {})

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2">
        {[
          { label: 'Open', value: 'open' },
          { label: 'All', value: 'all' },
          ...OPPORTUNITY_STAGES.map((s) => ({ label: stageLabel(s), value: s })),
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onStageFilterChange(filter.value)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
              stageFilter === filter.value
                ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                : 'text-muted-foreground hover:bg-[var(--lc-action-secondary)] hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : opportunities.length === 0 ? (
          <CmdEmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title="No deals yet"
            description="Create your first opportunity to start tracking your pipeline."
            action={
              <Button size="sm" onClick={onAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                New deal
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {visibleStages.map((stage) => {
              const cards = grouped[stage] || []
              if (!cards.length && stageFilter !== stage) return null
              const style = STAGE_STYLE[stage] || { pill: '', header: '' }
              return (
                <section key={stage} role="region" aria-label={stageLabel(stage)}>
                  <div
                    className={cn(
                      'mb-2 flex items-center justify-between rounded-t-md border-t-[3px] bg-[var(--lc-surface)] px-3 py-2',
                      style.header,
                    )}
                  >
                    <h2 className="text-xs font-semibold capitalize">{stageLabel(stage)}</h2>
                    <Badge variant="outline" className={cn('text-[10px]', style.pill)}>
                      <Numeric>{cards.length}</Numeric>
                    </Badge>
                  </div>
                  {cards.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No deals in this stage.</p>
                  ) : (
                    <ul className="space-y-2">
                      {cards.map((opportunity) => {
                        const stageIndex = opportunityStageIndex(opportunity.stage)
                        const canAdvance = stageIndex >= 0 && stageIndex < OPPORTUNITY_STAGES.length - 1
                        const canRetreat = stageIndex > 0
                        return (
                          <li
                            key={opportunity.id}
                            className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/opportunities/${opportunity.id}`}
                                className="text-sm font-medium leading-snug text-[var(--lc-text-heading)] hover:underline"
                              >
                                {contactName(opportunity.contact_id)}
                              </Link>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                <Numeric>{opportunity.probability}</Numeric>%
                              </Badge>
                            </div>
                            {opportunity.deal_value != null && (
                              <p className="mt-1 text-sm font-semibold text-[var(--lc-text-primary)]">
                                <Numeric>{Number(opportunity.deal_value).toLocaleString()}</Numeric>
                                <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                                  {opportunity.currency}
                                </span>
                              </p>
                            )}
                            {opportunity.expected_close_date && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Close: {new Date(opportunity.expected_close_date).toLocaleDateString()}
                              </p>
                            )}
                            <div className="mt-2 flex gap-2">
                              {canRetreat && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 flex-1 gap-1 text-[11px]"
                                  onClick={() => onRetreat(opportunity)}
                                >
                                  <ChevronLeft className="h-3 w-3" aria-hidden />
                                  Back
                                </Button>
                              )}
                              {canAdvance && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 flex-1 gap-1 text-[11px]"
                                  onClick={() => onAdvance(opportunity)}
                                >
                                  Advance
                                  <ChevronRight className="h-3 w-3" aria-hidden />
                                </Button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 end-6 z-sticky h-12 w-12 rounded-full shadow-lg"
        onClick={onAdd}
        aria-label="Add opportunity"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  )
}
