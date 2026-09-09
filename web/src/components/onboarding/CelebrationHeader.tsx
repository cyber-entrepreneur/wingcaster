import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Celebration intensity — subdued on review, loud after first publish. */
export type CelebrationHeaderTone = 'subdued' | 'loud'

export interface CelebrationHeaderProps {
  /**
   * `subdued` — AGT-ONB-003 first-listing review frame.
   * `loud` — AGT-ONB-004 post-publish (exclamation allowed in title).
   */
  tone: CelebrationHeaderTone
  /** Hero title. Parent supplies i18n. */
  title: string
  /** Supporting body / personal sub-line. */
  body?: string
  /** Optional illustration / confetti slot (parent owns canvas-confetti). */
  illustration?: ReactNode
  /** Optional primary advance CTA. */
  onNext?: () => void
  /** CTA label when `onNext` is provided. */
  nextLabel?: string
  className?: string
}

/**
 * Celebration frame header with tone variant.
 *
 * Used by: AGT-ONB-003 (`tone="subdued"`), AGT-ONB-004 (`tone="loud"`).
 * Reusable for other first-X moments (first inquiry, first close).
 * Stub visual + prop types only — confetti owned by parent / lib.
 */
export function CelebrationHeader({
  tone,
  title,
  body,
  illustration,
  onNext,
  nextLabel = 'Continue',
  className,
}: CelebrationHeaderProps) {
  return (
    <header
      className={cn(
        'relative flex flex-col items-center gap-[var(--lc-space-md)] text-center',
        tone === 'loud' && 'py-[var(--lc-space-xl)]',
        tone === 'subdued' && 'py-[var(--lc-space-md)]',
        className,
      )}
      data-celebration-tone={tone}
    >
      {illustration ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center opacity-80">
          {illustration}
        </div>
      ) : null}

      <h1
        className={cn(
          'text-[var(--lc-text-heading)]',
          tone === 'loud' && 'text-[var(--lc-text-brand)]',
        )}
        style={{
          font:
            tone === 'loud' ? 'var(--lc-type-display)' : 'var(--lc-type-heading-1)',
          letterSpacing: 'var(--lc-tracking-display)',
        }}
      >
        {title}
      </h1>
      {tone === 'loud' ? (
        <span className="sr-only" role="status" aria-live="polite">
          {title}
        </span>
      ) : null}

      {body ? (
        <p
          className="max-w-[52ch] text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body-lg)' }}
        >
          {body}
        </p>
      ) : null}

      {onNext ? (
        <Button type="button" variant="default" size="lg" onClick={onNext}>
          {nextLabel}
        </Button>
      ) : null}
    </header>
  )
}
