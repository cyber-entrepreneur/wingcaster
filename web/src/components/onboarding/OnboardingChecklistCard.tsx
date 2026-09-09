import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProgressRing } from '@/components/onboarding/ProgressRing'
import { SparkleBurst } from '@/components/onboarding/SparkleBurst'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  OnboardingChecklistFlags,
  OnboardingState,
} from '@/components/onboarding/useOnboardingState'
import { cn } from '@/lib/utils'

export interface OnboardingChecklistItem {
  key: keyof OnboardingChecklistFlags
  label: string
  sub: string
  optional?: boolean
  href?: string
}

export interface OnboardingChecklistCardProps {
  /**
   * Full onboarding state from `useOnboardingState().state`.
   * Contract: `<OnboardingChecklistCard state onDismissForever />`.
   */
  state: OnboardingState
  /** Confirm dismiss-forever (parent opens dialog then PATCH). */
  onDismissForever?: () => void
  /** Step row tap — parent routes to the completing screen. */
  onStepTap?: (key: keyof OnboardingChecklistFlags) => void
  /** Override checklist row copy (defaults match AGT-ONB-005 table). */
  items?: OnboardingChecklistItem[]
  /** Title override. */
  title?: string
  /** Start expanded. */
  defaultExpanded?: boolean
  className?: string
}

const DEFAULT_ITEMS: OnboardingChecklistItem[] = [
  {
    key: 'first_listing_published',
    label: 'Publish your first listing',
    sub: '2 min via WhatsApp',
  },
  {
    key: 'channels_connected',
    label: 'Connect a publishing channel',
    sub: 'Instagram, Facebook, Messenger, portals',
  },
  {
    key: 'notifications_enabled',
    label: 'Turn on notifications',
    sub: 'Never miss a new lead',
  },
  {
    key: 'profile_completed',
    label: 'Complete your public profile',
    sub: 'Photo, bio, contact — for your Bazaar profile',
  },
  {
    key: 'subscription_active',
    label: 'Upgrade to paid',
    sub: 'Unlock unlimited listings and portal integrations',
    optional: true,
  },
]

function mainCompletedCount(checklist: OnboardingChecklistFlags): number {
  return [
    checklist.first_listing_published,
    checklist.channels_connected,
    checklist.notifications_enabled,
    checklist.profile_completed,
  ].filter(Boolean).length
}

/**
 * Persistent dashboard onboarding checklist widget.
 *
 * Used by: AGT-ONB-005 (mounted on AGT-DSH-001 Zone 3); Pro collapses to `<OnboardingPill>`.
 * Stub visual + prop types only — no PATCH.
 */
export function OnboardingChecklistCard({
  state,
  onDismissForever,
  onStepTap,
  items = DEFAULT_ITEMS,
  title = 'Finish setting up',
  defaultExpanded = true,
  className,
}: OnboardingChecklistCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showCompleted, setShowCompleted] = useState(false)
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  if (state.dismissed_forever) return null

  const completed = mainCompletedCount(state.checklist)
  const total = 4
  const remaining = total - completed
  const pct = Math.round((completed / total) * 100)
  const allDone = completed >= total

  const incomplete = items.filter((item) => !state.checklist[item.key])
  const complete = items.filter((item) => state.checklist[item.key])
  const visible = showCompleted ? [...incomplete, ...complete] : incomplete

  const sub = allDone
    ? "You're all set. Nice work."
    : `You're ${pct}% there — ${remaining} steps left.`

  return (
    <section
      role="region"
      aria-label="Onboarding progress"
      className={cn(
        'relative rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
        'shadow-[var(--lc-elevation-sm)]',
        className,
      )}
      data-onboarding-checklist
      data-completed={completed}
    >
      {allDone ? (
        <div className="absolute end-3 top-3">
          <SparkleBurst active reducedMotion={reducedMotion} />
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <ProgressRing size={44} completed={completed} total={total} />
        <div className="min-w-0 flex-1">
          <h2
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {title}
          </h2>
          <p
            className="text-[var(--lc-text-secondary)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {sub}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse checklist' : 'Expand checklist'}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {expanded ? (
        <ul className="mt-[var(--lc-space-md)] flex flex-col gap-2">
          {complete.length > 0 && !showCompleted ? (
            <li>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => setShowCompleted(true)}
              >
                Show completed ({complete.length})
              </Button>
            </li>
          ) : null}

          {visible.map((item) => {
            const done = Boolean(state.checklist[item.key])
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={done}
                  aria-checked={done}
                  onClick={() => onStepTap?.(item.key)}
                  className={cn(
                    'flex w-full min-h-tap items-start gap-3 rounded-[var(--lc-radius-md)]',
                    'px-2 py-2 text-start focus-visible:outline-none',
                    !done && 'hover:bg-[var(--lc-surface-sunken)]',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      done
                        ? 'border-[var(--lc-status-published-fg)] bg-[var(--lc-status-published-bg)]'
                        : 'border-[var(--lc-border-strong)]',
                    )}
                  >
                    {done ? (
                      <Check
                        className="h-3 w-3 text-[var(--lc-status-published-fg)]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'flex flex-wrap items-center gap-2',
                        done && 'text-[var(--lc-text-muted)] line-through',
                        !done && 'text-[var(--lc-text-heading)]',
                      )}
                      style={{ font: 'var(--lc-type-body)' }}
                    >
                      {item.label}
                      {item.optional ? (
                        <Badge variant="outline" className="text-[var(--lc-text-muted)]">
                          Optional
                        </Badge>
                      ) : null}
                    </span>
                    <span
                      className="block text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      {item.sub}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {onDismissForever && !allDone ? (
        <div className="mt-[var(--lc-space-md)]">
          <Button type="button" variant="link" className="h-auto p-0" onClick={onDismissForever}>
            Dismiss this checklist
          </Button>
        </div>
      ) : null}
    </section>
  )
}
