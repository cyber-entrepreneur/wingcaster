/**
 * CmdKpiStrip — Compact KPI bar for Command Center pages.
 * Accepts up to 5 stat cards rendered as a horizontal strip.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'

interface KpiItem {
  label: string
  value: ReactNode
  /** e.g. 'text-[var(--lc-status-unpublished-fg)]' to highlight urgent counts */
  valueClass?: string
  icon?: ReactNode
}

interface CmdKpiStripProps {
  items: KpiItem[]
}

export function CmdKpiStrip({ items }: CmdKpiStripProps) {
  return (
    <div className="flex shrink-0 divide-x divide-[var(--lc-border)] border-b border-[var(--lc-border)] bg-[var(--lc-surface)]">
      {items.map((item, i) => (
        <div key={i} className="flex flex-1 items-center gap-3 px-5 py-3">
          {item.icon && (
            <span className="shrink-0 rounded-md bg-[var(--lc-surface-sunken)] p-1.5">{item.icon}</span>
          )}
          <div className="min-w-0">
            <Numeric as="p" className={cn('text-xl font-bold leading-none', item.valueClass)}>
              {item.value}
            </Numeric>
            <p className="mt-0.5 truncate text-[11px] text-[var(--lc-text-muted)]">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
