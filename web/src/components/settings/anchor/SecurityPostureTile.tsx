import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export function SecurityPostureTile({
  label,
  value,
  actionLabel,
  to,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  actionLabel: string
  to: string
  tone?: 'default' | 'warning' | 'success'
}) {
  const badgeVariant = tone === 'warning' ? 'underOffer' : tone === 'success' ? 'published' : 'secondary'
  return (
    <div
      className={cn(
        'flex min-h-[88px] flex-col gap-[var(--lc-space-2xs)] rounded-[var(--lc-radius-lg)]',
        'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]',
        'shadow-[var(--lc-elevation-sm)]',
      )}
    >
      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
        {label}
      </p>
      <div className="flex items-center gap-[var(--lc-space-xs)]">
        {typeof value === 'string' ? (
          <Badge variant={badgeVariant}>{value}</Badge>
        ) : (
          value
        )}
      </div>
      <Link to={to} className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {actionLabel}
      </Link>
    </div>
  )
}

export function SecurityCountValue({ count }: { count: number }) {
  return (
    <span style={{ font: 'var(--lc-type-heading-2)' }}>
      <Numeric>{count}</Numeric>
    </span>
  )
}
