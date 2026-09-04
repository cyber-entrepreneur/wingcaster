/**
 * CmdPageHeader — Standard Command Center page header.
 * Title + subtitle + right-side action slot.
 */
import type { ReactNode } from 'react'

interface CmdPageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function CmdPageHeader({ title, subtitle, actions }: CmdPageHeaderProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-6">
      <div className="flex items-center gap-3">
        <h1
          className="leading-none"
          style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)', color: 'var(--lc-text-heading)' }}
        >
          {title}
        </h1>
        {subtitle && <span className="hidden text-sm text-[var(--lc-text-muted)] sm:inline">{subtitle}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
