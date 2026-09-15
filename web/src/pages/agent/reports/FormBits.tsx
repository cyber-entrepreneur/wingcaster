import type { ReactNode } from 'react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Character counter with Broadcast warning/danger thresholds. */
export function CharacterCounter({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const ratio = max > 0 ? value / max : 0
  const tone =
    ratio > 1
      ? 'text-[var(--lc-status-unpublished-fg)]'
      : ratio >= 0.9
        ? 'text-[var(--lc-status-warning-fg)]'
        : 'text-[var(--lc-text-muted)]'

  return (
    <p
      className={cn('text-end text-[length:var(--lc-type-caption)]', tone, className)}
      aria-hidden
    >
      <Numeric>{value}</Numeric>
      {' / '}
      <Numeric>{max}</Numeric>
    </p>
  )
}

export function SectionCard({
  title,
  helper,
  children,
  muted = false,
  headingId,
}: {
  title: string
  helper?: string
  children: ReactNode
  muted?: boolean
  headingId: string
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]',
        muted && 'opacity-60',
      )}
    >
      <h2
        id={headingId}
        className="text-[length:var(--lc-type-heading-2)] text-[var(--lc-text-heading)]"
      >
        {title}
      </h2>
      {helper ? (
        <p className="mt-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          {helper}
        </p>
      ) : null}
      <div className="mt-[var(--lc-space-lg)] space-y-[var(--lc-space-md)]">{children}</div>
    </section>
  )
}
