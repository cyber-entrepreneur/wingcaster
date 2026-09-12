import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type WidgetCatalogItem = {
  id: string
  title: string
  category: string
  defaultW?: number
  defaultH?: number
}

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  { id: 'kpi-active', title: 'Active listings KPI', category: 'KPIs', defaultW: 3, defaultH: 2 },
  { id: 'kpi-views', title: 'Views KPI', category: 'KPIs', defaultW: 3, defaultH: 2 },
  { id: 'kpi-inquiries', title: 'Inquiries KPI', category: 'KPIs', defaultW: 3, defaultH: 2 },
  { id: 'kpi-pipeline', title: 'Pipeline value', category: 'Pipeline', defaultW: 3, defaultH: 2 },
  { id: 'kpi-bazaar', title: 'Bazaar-driven leads', category: 'KPIs', defaultW: 3, defaultH: 2 },
  { id: 'urgent', title: 'Urgent', category: 'Inbox', defaultW: 8, defaultH: 3 },
  { id: 'quota', title: 'Quota / credits', category: 'Credits', defaultW: 4, defaultH: 3 },
  { id: 'recent-listings', title: 'Recent listings', category: 'Listings', defaultW: 6, defaultH: 3 },
  { id: 'inbox-preview', title: 'Inbox preview', category: 'Inbox', defaultW: 6, defaultH: 3 },
  { id: 'tasks', title: "Today's tasks", category: 'Tasks', defaultW: 6, defaultH: 3 },
  { id: 'funnel', title: 'Funnel', category: 'Funnels', defaultW: 6, defaultH: 3 },
  { id: 'activity', title: 'Recent activity', category: 'Listings', defaultW: 12, defaultH: 3 },
  { id: 'calendar', title: 'Calendar (next 7 days)', category: 'Calendar', defaultW: 6, defaultH: 3 },
]

const CATEGORIES = ['KPIs', 'Funnels', 'Listings', 'Inbox', 'Tasks', 'Calendar', 'Credits', 'Pipeline']

export interface WidgetPaletteDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presentIds: string[]
  onAdd: (id: string, defaults?: { w?: number; h?: number }) => void
  side?: 'right' | 'left'
}

/** AGT-DSH-002 — right-docked widget palette (desktop) / bottom sheet (tablet). */
export function WidgetPaletteDrawer({
  open,
  onOpenChange,
  presentIds,
  onAdd,
  side = 'right',
}: WidgetPaletteDrawerProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40"
      data-testid="widget-palette-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Add a widget"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--lc-surface-inverse)_40%,transparent)]"
        aria-label="Close widget palette"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          'absolute top-0 flex h-full w-[min(320px,100vw)] flex-col bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-lg)]',
          side === 'right' ? 'end-0' : 'start-0',
        )}
        style={{ transition: `transform var(--lc-duration-slow) var(--lc-easing-out)` }}
      >
        <header className="flex items-center justify-between border-b border-[var(--lc-border)] px-[var(--lc-space-lg)] py-[var(--lc-space-md)]">
          <h2
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
          >
            Add a widget
          </h2>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-[var(--lc-space-md)]">
          {CATEGORIES.map((category) => {
            const items = WIDGET_CATALOG.filter((w) => w.category === category)
            if (!items.length) return null
            return (
              <section key={category} className="mb-[var(--lc-space-lg)]">
                <h3
                  className="mb-2 text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                >
                  {category}
                </h3>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const present = presentIds.includes(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={present}
                          onClick={() =>
                            onAdd(item.id, { w: item.defaultW, h: item.defaultH })
                          }
                          className={cn(
                            'flex min-h-tap w-full items-center justify-between rounded-[var(--lc-radius-md)] border px-3 text-start',
                            present
                              ? 'cursor-not-allowed border-[var(--lc-border)] opacity-50'
                              : 'border-[var(--lc-border)] hover:border-[var(--lc-action-primary)] hover:bg-[var(--lc-surface-selected)]',
                          )}
                          style={{ font: 'var(--lc-type-body-sm)' }}
                        >
                          <span>{item.title}</span>
                          {!present ? <Plus className="h-4 w-4" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
