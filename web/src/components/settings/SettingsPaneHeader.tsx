import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SettingsPaneHeader({
  title,
  sub,
  className,
}: {
  title: string
  sub?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-[var(--lc-space-xl)]', className)}>
      <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
        {title}
      </h1>
      {sub ? (
        <p
          className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-lg)' }}
        >
          {sub}
        </p>
      ) : null}
    </header>
  )
}

export function SavedPill({ visible, label = 'Saved ✓' }: { visible: boolean; label?: string }) {
  if (!visible) return null
  return (
    <span
      aria-live="polite"
      className="inline-flex items-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-published-bg)] px-[var(--lc-space-sm)] py-[var(--lc-space-3xs)] text-[var(--lc-status-published-fg)]"
      style={{ font: 'var(--lc-type-caption)' }}
    >
      {label}
    </span>
  )
}
