import { cn } from '@/lib/utils'

export interface CapabilityChipProps {
  label: string
  /** AGN-ROL-001 R8 renders affirmative "grant" chips only. */
  kind?: 'grant' | 'deny'
  className?: string
}

/**
 * AGN-ROL-001 R8 capability chip. Affirmative, non-interactive summary of one
 * capability a pack unlocks. The "+N more" affordance is a separate button, not
 * a chip (see PackCard).
 */
export function CapabilityChip({ label, kind = 'grant', className }: CapabilityChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--lc-radius-pill)] border px-2 py-0.5',
        'border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]',
        kind === 'deny'
          ? 'text-[var(--lc-text-muted)] line-through'
          : 'text-[var(--lc-text-primary)]',
        className,
      )}
      style={{ font: 'var(--lc-type-caption)' }}
      data-capability-chip={kind}
    >
      {label}
    </span>
  )
}
