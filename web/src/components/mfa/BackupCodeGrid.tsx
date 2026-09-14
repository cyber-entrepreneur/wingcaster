import { cn } from '@/lib/utils'

export interface BackupCodeGridProps {
  /** Plaintext codes shown once (Mode A first-view / post-regen). */
  codes: string[]
  /**
   * Layout:
   * - `responsive` (default): 2×5 desktop / 1×10 mobile per SHR-MFA-005
   * - `single`: force 1 column
   * - `double`: force 2 columns
   */
  columns?: 'responsive' | 'single' | 'double'
  /** Mark the grid for print stylesheet targeting. */
  printTarget?: boolean
  className?: string
}

/**
 * Monospace backup-code grid (2×5 desktop / 1×10 mobile).
 *
 * Used by: SHR-MFA-005 Mode A first-view. Add `data-backup-codes-grid` for
 * `web/src/print.css` print rules.
 * Stub visual only — parent owns copy / download / regenerate.
 */
export function BackupCodeGrid({
  codes,
  columns = 'responsive',
  printTarget = true,
  className,
}: BackupCodeGridProps) {
  return (
    <ul
      data-backup-codes-grid={printTarget ? '' : undefined}
      className={cn(
        'grid gap-[var(--lc-space-sm)]',
        columns === 'single' && 'grid-cols-1',
        columns === 'double' && 'grid-cols-2',
        columns === 'responsive' && 'grid-cols-1 sm:grid-cols-2',
        className,
      )}
      aria-label="Backup codes"
    >
      {codes.map((code, index) => (
        <li
          key={`${code}-${index}`}
          className={cn(
            'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
            'font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-body)]',
            'tracking-[0.05em] tabular-nums text-[var(--lc-text-primary)]',
          )}
        >
          <span className="me-2 text-[var(--lc-text-muted)]" aria-hidden>
            {String(index + 1).padStart(2, '0')}.
          </span>
          {code}
        </li>
      ))}
    </ul>
  )
}
