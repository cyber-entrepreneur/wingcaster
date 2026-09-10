import { cn } from '@/lib/utils'
import type { ReporterPatternSignals } from './types'
import { QUEUE_COPY } from './copy'

export interface ReporterPatternDotProps {
  /** When false, renders nothing. */
  patternFlag: boolean
  signals?: ReporterPatternSignals | null
  agencyName?: string
  className?: string
}

/**
 * Reporter-pattern amber affordance (WF-05).
 * Informational only — not a policy gate. Uses status/warning tokens, never raw hex.
 */
export function ReporterPatternDot({
  patternFlag,
  signals,
  agencyName,
  className,
}: ReporterPatternDotProps) {
  if (!patternFlag) return null

  const n = signals?.reports_against_agency_last_30d ?? 0
  const d = signals?.days_window ?? 30
  const agency = signals?.agency_name ?? agencyName ?? 'agency'
  const tooltip = QUEUE_COPY.reporterPatternTooltip
    .replace('{N}', String(n))
    .replace('{agency}', agency)
    .replace('{D}', String(d))
  const aria = `Reporter has filed ${n} reports against ${agency} in ${d} days — possible pattern.`

  return (
    <span
      role="img"
      title={tooltip}
      aria-label={aria}
      data-reporter-pattern="true"
      className={cn(
        'inline-flex h-2 w-2 shrink-0 rounded-full',
        'bg-[var(--lc-status-warning-dot)]',
        'ring-2 ring-[var(--lc-status-warning-bg)]',
        className,
      )}
    />
  )
}
