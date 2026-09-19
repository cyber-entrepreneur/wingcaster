/**
 * AGT-CMP-001 — Guided "Choose a goal" pattern for new campaigns.
 */
import { Link } from 'react-router-dom'
import { Calendar, Megaphone, Sparkles, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CAMPAIGN_GOALS, type CampaignGoalId, buildCampaignNewHref } from './campaign-goals'

const GOAL_ICONS: Record<CampaignGoalId, typeof Megaphone> = {
  new_listing: Megaphone,
  price_drop: TrendingDown,
  open_house: Calendar,
  custom: Sparkles,
}

export function CampaignGoalPicker({
  pro = false,
  className,
}: {
  pro?: boolean
  className?: string
}) {
  return (
    <div
      className={cn('space-y-3', className)}
      data-testid="campaign-goal-picker"
      data-screen="AGT-CMP-001"
    >
      <div>
        <p className="text-sm font-semibold">Choose a goal</p>
        <p className="text-xs text-muted-foreground">
          Pick a template to start faster, or build a custom campaign from scratch.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CAMPAIGN_GOALS.map((goal) => {
          const Icon = GOAL_ICONS[goal.id]
          return (
            <Link
              key={goal.id}
              to={buildCampaignNewHref(goal.id, pro)}
              className={cn(
                'flex items-start gap-3 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3',
                'transition-colors hover:border-[var(--lc-action-primary)] hover:bg-[var(--lc-bg-page)]',
              )}
              data-testid={`campaign-goal-${goal.id}`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--lc-surface-sunken)] text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{goal.label}</p>
                <p className="text-xs text-muted-foreground">{goal.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
