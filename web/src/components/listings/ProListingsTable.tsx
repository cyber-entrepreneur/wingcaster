/**
 * Optional Pro table mount point for AGT-LST-002 (Agent 1 — feat/wave-8-pro).
 * When that PR lands, replace this stub with the real ProListingsTable import.
 * Mount only when ui_mode === 'pro' && viewport ≥ 768px.
 */
import type { Property } from '@/types'

export interface ProListingsTableProps {
  items: Property[]
  onOpen?: (id: string) => void
  className?: string
}

export function ProListingsTable({ items, onOpen, className }: ProListingsTableProps) {
  return (
    <div
      className={className}
      data-testid="pro-listings-table-stub"
      role="status"
      aria-label="Pro listings table unavailable"
    >
      <p className="rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-4 py-8 text-center text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
        Pro table lands with Wave 8 Pro ({items.length} listings ready).
        {onOpen ? ' Tap Guided list view meanwhile.' : null}
      </p>
    </div>
  )
}
