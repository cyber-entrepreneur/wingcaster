import type { AudienceResolveResult } from '@/types/audience'

const ROWS: { key: keyof AudienceResolveResult; label: string; tone: string }[] = [
  { key: 'matched', label: 'Matched', tone: 'text-[var(--lc-text-primary)]' },
  { key: 'contactable', label: 'Contactable', tone: 'text-[var(--lc-status-success)]' },
  { key: 'frequency_capped', label: 'Frequency capped', tone: 'text-[var(--lc-text-secondary)]' },
  { key: 'opted_out', label: 'Opted out', tone: 'text-[var(--lc-status-warning)]' },
  { key: 'conflicting', label: 'Conflicting', tone: 'text-[var(--lc-status-danger)]' },
]

export function AudienceBreakdown({ result }: { result: AudienceResolveResult | null }) {
  if (!result) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="audience-breakdown-empty">
        Resolve the audience to see reach and suppression breakdown.
      </p>
    )
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      data-testid="audience-breakdown"
      role="region"
      aria-label="Audience resolution breakdown"
    >
      {ROWS.map(({ key, label, tone }) => (
        <div
          key={key}
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4 text-center"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${tone}`}>{result[key] as number}</p>
        </div>
      ))}
    </div>
  )
}
