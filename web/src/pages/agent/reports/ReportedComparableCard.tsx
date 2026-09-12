import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ReportedComparableCardProps = {
  addressLabel: string
  marketLabel?: string | null
  sourceLabel?: string | null
  onOpenDetails?: () => void
  className?: string
}

/** Identity card for the reported comparable (AGT-REC-002). */
export function ReportedComparableCard({
  addressLabel,
  marketLabel,
  sourceLabel,
  onOpenDetails,
  className,
}: ReportedComparableCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-[var(--lc-space-md)]">
        <div className="min-w-0 flex-1 text-start">
          <h2
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {addressLabel}
          </h2>
          {marketLabel ? (
            <p
              className="mt-1 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {marketLabel}
            </p>
          ) : null}
          {sourceLabel ? (
            <Badge variant="outline" className="mt-[var(--lc-space-xs)] rounded-pill">
              {sourceLabel}
            </Badge>
          ) : null}
        </div>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            aria-label="View this comparable"
            className="inline-flex min-h-tap min-w-tap items-center justify-center text-[var(--lc-text-muted)]"
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
