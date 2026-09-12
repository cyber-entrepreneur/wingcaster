import { AlertOctagon, Send, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TrackerEmptyVariant = 'never_published' | 'filters' | 'offline' | 'error'

export type TrackerEmptyStateProps = {
  variant: TrackerEmptyVariant
  onClearFilters?: () => void
  onRetry?: () => void
  onPublishFirst?: () => void
  onContactSupport?: () => void
  className?: string
}

const COPY: Record<
  TrackerEmptyVariant,
  { title: string; body: string; cta: string; Glyph: typeof Send }
> = {
  never_published: {
    title: 'No portal submissions yet',
    body: 'When you publish a listing to Bayut, Property Finder or another portal, its status shows up here.',
    cta: 'Publish your first listing',
    Glyph: Send,
  },
  filters: {
    title: 'No submissions match these filters',
    body: 'Try broadening your date range or clearing a filter.',
    cta: 'Clear filters',
    Glyph: Send,
  },
  offline: {
    title: "You're offline",
    body: 'Reconnect to see up-to-date portal submissions.',
    cta: 'Retry',
    Glyph: WifiOff,
  },
  error: {
    title: 'Something went wrong loading your submissions.',
    body: 'Check your connection and try again.',
    cta: 'Retry',
    Glyph: AlertOctagon,
  },
}

/**
 * Empty / error states for AGT-PUB-006 tracker list region.
 */
export function TrackerEmptyState({
  variant,
  onClearFilters,
  onRetry,
  onPublishFirst,
  onContactSupport,
  className,
}: TrackerEmptyStateProps) {
  const copy = COPY[variant]
  const Glyph = copy.Glyph
  const showIllustration = variant === 'never_published'

  const handleCta = () => {
    if (variant === 'never_published') onPublishFirst?.()
    else if (variant === 'filters') onClearFilters?.()
    else onRetry?.()
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-[var(--lc-space-md)] py-[var(--lc-space-3xl)] text-center',
        className,
      )}
      role="status"
    >
      {showIllustration ? (
        <div
          className={cn(
            'mb-[var(--lc-space-lg)] flex h-28 w-full max-w-sm items-center justify-center',
            'rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)]',
            'bg-gradient-to-br from-[var(--lc-surface-raised)] to-[var(--lc-surface-sunken)]',
            'shadow-[var(--lc-elevation-sm)]',
          )}
        >
          <Glyph className="h-16 w-16 text-[var(--lc-text-muted)]" aria-hidden="true" />
        </div>
      ) : (
        <Glyph
          className="mb-[var(--lc-space-md)] h-10 w-10 text-[var(--lc-text-muted)]"
          aria-hidden="true"
        />
      )}

      <h2
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
      >
        {copy.title}
      </h2>
      <p
        className="mt-[var(--lc-space-xs)] max-w-md text-[var(--lc-text-secondary)]"
        style={{ font: 'var(--lc-type-body)' }}
      >
        {copy.body}
      </p>

      <div className="mt-[var(--lc-space-lg)] flex flex-wrap items-center justify-center gap-[var(--lc-space-sm)]">
        <Button
          variant={variant === 'filters' ? 'secondary' : 'default'}
          onClick={handleCta}
        >
          {copy.cta}
        </Button>
        {variant === 'error' && onContactSupport ? (
          <Button variant="link" onClick={onContactSupport}>
            Something not right? Contact WingCaster support
          </Button>
        ) : null}
      </div>
    </div>
  )
}
