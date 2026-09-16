import { Circle, CircleCheck, Coins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  tOnboarding,
  type AgencyTaskDef,
  type OnboardingLocale,
} from '@/pages/agency/onboardingCopy'

export interface AgencyTaskCardProps {
  task: AgencyTaskDef
  done: boolean
  locale: OnboardingLocale
  /** Position for the accessible "Task N of 7" announcement. */
  index: number
  total: number
}

/**
 * AGN-DSH-002 C5/C6 task card. Completed cards keep their place with a sunken
 * wash + strikethrough title + ghost "Review" CTA (visibility of progress
 * motivates). Status is glyph + text, never colour-alone.
 */
export function AgencyTaskCard({ task, done, locale, index, total }: AgencyTaskCardProps) {
  const title = tOnboarding(task.titleKey, locale)
  const statusText = done ? tOnboarding('status.done', locale) : tOnboarding('status.todo', locale)
  return (
    <div
      role="group"
      aria-label={`Task ${index} of ${total}: ${title}, ${statusText}`}
      className={cn(
        'flex min-h-[180px] flex-col gap-2 rounded-[var(--lc-radius-lg)] border p-4',
        'border-[var(--lc-border)] shadow-[var(--lc-elevation-sm)]',
        done ? 'bg-[var(--lc-surface-sunken)]' : 'bg-[var(--lc-surface-raised)]',
      )}
      data-task={task.key}
      data-done={done}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]"
          aria-hidden="true"
        >
          {done ? (
            <CircleCheck className="h-6 w-6 text-[var(--lc-status-published-fg)]" />
          ) : (
            <Circle className="h-6 w-6 text-[var(--lc-border-strong)]" />
          )}
        </span>
        {task.financial ? (
          <Badge variant="outline" className="border-[var(--lc-border)] text-[var(--lc-text-brand)]">
            <Coins className="me-1 h-3 w-3" aria-hidden="true" />
            {tOnboarding('task.billing.badge', locale)}
          </Badge>
        ) : null}
      </div>

      <h3
        className={cn(
          done ? 'text-[var(--lc-text-muted)] line-through' : 'text-[var(--lc-text-heading)]',
        )}
        style={{ font: 'var(--lc-type-heading-3)' }}
      >
        {title}
      </h3>
      <p
        className="flex-1 text-[var(--lc-text-secondary)]"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        {tOnboarding(task.descKey, locale)}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {tOnboarding(task.timeKey, locale)}
        </span>
        <Button asChild variant={done ? 'ghost' : 'default'} size="sm">
          <Link to={task.href}>
            {done ? tOnboarding('cta.review', locale) : tOnboarding(task.ctaKey, locale)}
          </Link>
        </Button>
      </div>
    </div>
  )
}
