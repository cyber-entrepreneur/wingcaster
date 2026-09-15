import { useId, useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'

/**
 * Credits reconciliation block for a publish-job receipt.
 *
 * Used by: AGT-PUB-003 (publish outcome / receipt).
 *
 * Rules (brief):
 * - Always render — even when `total_charged === total_reserved`
 * - When charged &lt; reserved, show the release explanation row
 * - Info tooltip always available
 * - All numerics via `<Numeric>`
 */
export type CreditsSummaryProps = {
  total_charged: number
  total_reserved: number
  credits_history_deep_link: string
  className?: string
  /**
   * Layout hint. Desktop receipt uses a compact horizontal band;
   * mobile stacks vertically. Stub applies both via CSS.
   */
  variant?: 'stack' | 'horizontal'
}

const TOOLTIP_TITLE = "Why some credits weren't charged"
const TOOLTIP_BODY =
  "You're only charged for successful publishes. Reserved credits for failed or unreachable portals were released back to your balance."

/**
 * "Why some credits weren't charged" reconciliation surface.
 */
export function CreditsSummary({
  total_charged,
  total_reserved,
  credits_history_deep_link,
  className,
  variant = 'stack',
}: CreditsSummaryProps) {
  const released = Math.max(0, total_reserved - total_charged)
  const showRelease = total_charged < total_reserved
  const tipId = useId()
  const [tipOpen, setTipOpen] = useState(false)

  return (
    <section
      aria-label="Credits summary"
      className={cn(
        'rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]',
        variant === 'horizontal' &&
          'md:flex md:items-center md:justify-between md:gap-[var(--lc-space-lg)]',
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[var(--lc-space-sm)]">
          <div>
            <p
              className="text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-overline)' }}
            >
              Total charged
            </p>
            <Numeric
              className="mt-[var(--lc-space-2xs)] block text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)' }}
            >
              {total_charged} credit{total_charged === 1 ? '' : 's'} charged
            </Numeric>
          </div>

          <button
            type="button"
            className={cn(
              'inline-flex h-tap w-tap min-h-tap min-w-tap shrink-0 items-center justify-center',
              'rounded-[var(--lc-radius-md)] text-[var(--lc-text-muted)]',
              'hover:bg-[var(--lc-surface-raised)] hover:text-[var(--lc-text-primary)]',
            )}
            aria-label={TOOLTIP_TITLE}
            aria-expanded={tipOpen}
            aria-controls={tipId}
            onClick={() => setTipOpen((v) => !v)}
            onBlur={(e) => {
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                setTipOpen(false)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setTipOpen(false)
            }}
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {tipOpen ? (
          <div
            id={tipId}
            role="tooltip"
            className={cn(
              'absolute end-0 top-[calc(100%+var(--lc-space-2xs))] z-10',
              'max-w-xs rounded-[var(--lc-radius-lg)] p-[var(--lc-space-md)]',
              'bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
              'shadow-[var(--lc-elevation-md)] border border-[var(--lc-border)]',
            )}
          >
            <p style={{ font: 'var(--lc-type-heading-3)' }}>{TOOLTIP_TITLE}</p>
            <p
              className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {TOOLTIP_BODY}
            </p>
          </div>
        ) : null}

        {showRelease ? (
          <p
            className="mt-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            Reserved{' '}
            <del>
              <Numeric>{total_reserved}</Numeric> credits
            </del>
            {' · '}
            <Numeric>{released}</Numeric> released to your balance
          </p>
        ) : (
          <p
            className="mt-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            Reserved <Numeric>{total_reserved}</Numeric> credits
          </p>
        )}
      </div>

      <a
        href={credits_history_deep_link}
        className={cn(
          'mt-[var(--lc-space-md)] inline-flex min-h-tap items-center text-[var(--lc-text-brand)]',
          'underline-offset-4 hover:underline',
          variant === 'horizontal' && 'md:mt-0 md:shrink-0',
        )}
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        View credits history →
      </a>
    </section>
  )
}
