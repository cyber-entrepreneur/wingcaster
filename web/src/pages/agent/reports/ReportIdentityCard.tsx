import { ChevronRight } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type ReportIdentityCardProps = {
  title: string
  marketSnippet?: string | null
  submittedAt?: string | null
  onOpenDetails?: () => void
  className?: string
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Report identity card for AGT-REC-003. */
export function ReportIdentityCard({
  title,
  marketSnippet,
  submittedAt,
  onOpenDetails,
  className,
}: ReportIdentityCardProps) {
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
            {title}
          </h2>
          {marketSnippet ? (
            <p
              className="mt-1 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {marketSnippet}
            </p>
          ) : null}
          {submittedAt ? (
            <Numeric
              className="mt-[var(--lc-space-xs)] block text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
              dir="ltr"
            >
              {formatSubmitted(submittedAt)}
            </Numeric>
          ) : null}
        </div>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            aria-label="View this price report"
            className="inline-flex min-h-tap min-w-tap items-center justify-center text-[var(--lc-text-muted)]"
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
