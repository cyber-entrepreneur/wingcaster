import { useState } from 'react'
import { cn } from '@/lib/utils'

export type OwnerNoteCalloutProps = {
  body: string
  /** Attribution line without leading em dash, e.g. "Rashid A., Owner". */
  attribution: string
  /** Lines before clamp toggle (default 3). */
  clampLines?: number
  className?: string
}

/**
 * Agency-owner note callout for AGN-MEM-005 (and reusable on SHR-PUB-003).
 * Left orange border + sunken surface; Read more when body exceeds clamp.
 */
export function OwnerNoteCallout({
  body,
  attribution,
  clampLines = 3,
  className,
}: OwnerNoteCalloutProps) {
  const [expanded, setExpanded] = useState(false)
  const needsToggle = body.trim().length > 180

  return (
    <blockquote
      className={cn(
        'border-s-[3px] border-s-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]',
        'rounded-e-[var(--lc-radius-md)] ps-[var(--lc-space-md)] pe-[var(--lc-space-md)] py-[var(--lc-space-md)]',
        className,
      )}
    >
      <p
        className={cn(
          'italic text-[var(--lc-text-primary)]',
          !expanded && needsToggle ? 'line-clamp-3' : null,
        )}
        style={{
          font: 'var(--lc-type-body-lg)',
          ...( !expanded && needsToggle
            ? { WebkitLineClamp: clampLines }
            : null),
        }}
      >
        {body}
      </p>
      {needsToggle ? (
        <button
          type="button"
          className="mt-2 min-h-[var(--lc-tap-target-min)] text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
          style={{ font: 'var(--lc-type-caption)' }}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      ) : null}
      <cite
        className="mt-[var(--lc-space-sm)] block not-italic text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        — {attribution}
      </cite>
    </blockquote>
  )
}
