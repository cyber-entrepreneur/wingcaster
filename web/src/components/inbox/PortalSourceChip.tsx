import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'
import { sourceLabel } from '@/lib/inbox-labels'

export type PortalSourceChipProps = {
  source: string
  onClick?: () => void
  className?: string
}

/**
 * Teal accent chip on the FIRST inbound message when source is a portal (AGT-INB-002).
 * accent-bold ALWAYS needs a boundary per Broadcast.
 */
export function PortalSourceChip({ source, onClick, className }: PortalSourceChipProps) {
  const code = String(source || '').toLowerCase()
  if (!code || code === 'direct' || code === 'unknown') return null

  const label = `From ${sourceLabel(code)}`
  const Comp = onClick ? 'button' : 'span'

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'mb-1 inline-flex items-center rounded-[var(--lc-radius-sm)] border px-1.5 py-0.5',
        'border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
        'text-[length:var(--lc-type-overline)] font-semibold uppercase tracking-wide',
        onClick && 'cursor-pointer hover:opacity-90',
        className,
      )}
      aria-label={`Arrived via portal from ${sourceLabel(code)} listing`}
    >
      {label}
    </Comp>
  )
}

export function DayGroupSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 py-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
        <Numeric>{label}</Numeric>
      </span>
    </div>
  )
}
