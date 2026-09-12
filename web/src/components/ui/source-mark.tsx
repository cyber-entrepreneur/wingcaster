import { cn } from '@/lib/utils'
import { sourceLabel } from '@/lib/inbox-labels'

export type SourceMarkProps = {
  source: string | null | undefined
  /** Override display label (defaults to humanized source code). */
  label?: string
  className?: string
  /** Compact mark without text — short code only (AGT-INB-001 trailing chip). */
  compact?: boolean
}

/**
 * Portal/source origin chip (AGT-INB-005 dual-badge treatment).
 * Neutral shell: `--lc-surface-sunken` + `--lc-border` — brand color only inside logo/wordmark.
 * Complements `<ChannelMark>` (transport) — never conflate the two.
 */
export function SourceMark({ source, label, className, compact = false }: SourceMarkProps) {
  const code = String(source || 'direct').toLowerCase()
  const text = label || sourceLabel(code)
  const short = text.length <= 3 ? text.toUpperCase() : text.slice(0, 2).toUpperCase()

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
        'rounded-[var(--lc-radius-sm)] font-semibold uppercase tracking-wide',
        compact
          ? 'h-5 w-5 text-[9px]'
          : 'h-5 gap-1 px-1.5 text-[10px] leading-none',
        className,
      )}
      title={text}
      aria-label={text}
      data-source={code}
    >
      {compact ? short : text}
    </span>
  )
}
