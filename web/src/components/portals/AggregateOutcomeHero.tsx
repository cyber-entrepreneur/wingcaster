import type { LucideIcon } from 'lucide-react'
import { AlertCircle, CheckCircle2, Hourglass, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'

/**
 * Aggregate publish-job outcome for the receipt hero.
 *
 * Used by: AGT-PUB-003 (publish outcome / receipt).
 *
 * Adapter around REC-family `<StatusHero>` semantics + a 3-pill counter row.
 * Self-contained stub — does NOT import `recipient/` during shared-components
 * prep (avoids cross-agent race). Downstream waves may recompose onto
 * `<StatusHero>` once both families are merged.
 */
export type AggregateOutcome =
  | 'all_succeeded'
  | 'mixed'
  | 'all_failed'
  | 'in_review_only'
  | 'partial'

export type AggregateOutcomeHeroProps = {
  aggregate: AggregateOutcome
  counts: {
    succeeded: number
    in_review: number
    failed: number
  }
  total_destinations: number
  /** ISO 8601 */
  published_at: string
  /** Short listing reference, e.g. "3BR · Downtown Dubai · AED 4.5M". */
  listing_title?: string
  className?: string
}

type HeroSurface = {
  Glyph: LucideIcon
  bandClass: string
  inkClass: string
  glyphClass: string
  glyphChip: boolean
  /** Maps to StatusHero state for docs / future composition. */
  statusHeroState: 'approved' | 'more_info' | 'rejected' | 'pending'
  emphasis: 'loud' | 'default'
}

function resolveAggregateSurface(aggregate: AggregateOutcome): HeroSurface {
  switch (aggregate) {
    case 'all_succeeded':
      return {
        Glyph: CheckCircle2,
        bandClass: 'bg-[var(--lc-action-primary)]',
        inkClass: 'text-[var(--lc-action-primary-text)]',
        glyphClass: 'text-[var(--lc-action-primary)]',
        glyphChip: true,
        statusHeroState: 'approved',
        emphasis: 'loud',
      }
    case 'all_failed':
      return {
        Glyph: XCircle,
        bandClass:
          'bg-[var(--lc-surface-raised)] border-t-4 border-t-[var(--lc-status-closed-fg)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-status-closed-fg)]',
        glyphChip: false,
        statusHeroState: 'rejected',
        emphasis: 'default',
      }
    case 'in_review_only':
      return {
        Glyph: Hourglass,
        bandClass: cn(
          'bg-[var(--lc-surface-sunken)]',
          'border-t-4 border-t-[var(--lc-accent-bold)]',
          'outline outline-1 outline-[var(--lc-accent-bold-edge)] outline-offset-[-1px]',
        ),
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-accent-bold-edge)]',
        glyphChip: false,
        statusHeroState: 'pending',
        emphasis: 'default',
      }
    case 'mixed':
    case 'partial':
      return {
        Glyph: AlertCircle,
        bandClass:
          'bg-[var(--lc-surface-sunken)] border-t-4 border-t-[var(--lc-status-warning-fg)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-status-warning-fg)]',
        glyphChip: false,
        statusHeroState: 'more_info',
        emphasis: 'default',
      }
  }
}

function buildLabel(
  aggregate: AggregateOutcome,
  succeeded: number,
  total: number,
): string {
  switch (aggregate) {
    case 'all_succeeded':
      return `Published to ${total} of ${total} destinations`
    case 'mixed':
      return `Published to ${succeeded} of ${total} destinations`
    case 'all_failed':
      return "Publish didn't complete"
    case 'in_review_only':
      return 'Awaiting portal moderation'
    case 'partial':
      return 'Published — some destinations still pending'
  }
}

function formatTimestampStub(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type CounterPillProps = {
  count: number
  label: string
  glyph: string
  tone: 'succeeded' | 'in_review' | 'failed'
}

function CounterPill({ count, label, glyph, tone }: CounterPillProps) {
  const toneClass =
    tone === 'succeeded'
      ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
      : tone === 'in_review'
        ? 'bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]'
        : 'bg-[var(--lc-status-closed-bg)] text-[var(--lc-status-closed-fg)]'

  return (
    <li
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2.5 py-0.5 text-xs font-semibold',
        toneClass,
        count === 0 && 'opacity-40',
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      <Numeric>
        {count} {label}
      </Numeric>
    </li>
  )
}

/**
 * One-glance "did I get what I paid for?" hero with three counter pills.
 */
export function AggregateOutcomeHero({
  aggregate,
  counts,
  total_destinations,
  published_at,
  listing_title,
  className,
}: AggregateOutcomeHeroProps) {
  const surface = resolveAggregateSurface(aggregate)
  const Glyph = surface.Glyph
  const label = buildLabel(aggregate, counts.succeeded, total_destinations)
  const labelId = 'publish-outcome-label'

  return (
    <section
      aria-labelledby={labelId}
      data-testid="publish-outcome-hero"
      data-status-hero-state={surface.statusHeroState}
      data-emphasis={surface.emphasis}
      className={cn(
        'w-full px-[var(--lc-space-md)] py-[var(--lc-space-lg)]',
        'transition-colors duration-base ease-out motion-reduce:transition-none',
        surface.bandClass,
        surface.inkClass,
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-start gap-[var(--lc-space-md)]">
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full',
            surface.glyphChip ? 'bg-[var(--lc-action-primary-text)] p-2' : 'p-1',
          )}
          aria-hidden="true"
        >
          <Glyph className={cn('h-7 w-7', surface.glyphClass)} />
        </span>

        <div className="min-w-0 flex-1 text-start">
          <h1
            id={labelId}
            style={{
              font: 'var(--lc-type-heading-2)',
              letterSpacing: 'var(--lc-tracking-heading-2)',
            }}
          >
            {label}
          </h1>

          {listing_title ? (
            <p
              className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {listing_title}
            </p>
          ) : null}

          <ul
            className="mt-[var(--lc-space-sm)] flex flex-wrap gap-[var(--lc-space-xs)]"
            aria-label={`${counts.succeeded} succeeded, ${counts.in_review} in review, ${counts.failed} failed`}
          >
            <CounterPill
              count={counts.succeeded}
              label="succeeded"
              glyph="●"
              tone="succeeded"
            />
            <CounterPill
              count={counts.in_review}
              label="in review"
              glyph="◐"
              tone="in_review"
            />
            <CounterPill count={counts.failed} label="failed" glyph="✕" tone="failed" />
          </ul>

          <Numeric
            className={cn(
              'mt-[var(--lc-space-xs)] block',
              aggregate === 'all_succeeded'
                ? 'text-[var(--lc-action-primary-text)] opacity-90'
                : 'text-[var(--lc-text-muted)]',
            )}
            style={{ font: 'var(--lc-type-caption)' }}
          >
            Published {formatTimestampStub(published_at)}
          </Numeric>
        </div>
      </div>
    </section>
  )
}
