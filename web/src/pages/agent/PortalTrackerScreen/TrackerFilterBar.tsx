import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  TRACKER_PORTAL_OPTIONS,
  TRACKER_STATUS_OPTIONS,
  type PortalTrackerFilters,
} from '@/hooks/publishing/types'
import type { PortalStatus } from '@/components/ui/portal-status-pill'

export type TrackerFilterBarProps = {
  filters: PortalTrackerFilters
  onChange: (next: PortalTrackerFilters) => void
  onClear: () => void
  filtersActive: boolean
  className?: string
}

const WITHIN_OPTIONS: { value: PortalTrackerFilters['submittedWithin']; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
]

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/**
 * Sticky filter bar — status / portal multi-select chips, submittedWithin, search.
 * URL sync is owned by `usePortalTrackerList`.
 */
export function TrackerFilterBar({
  filters,
  onChange,
  onClear,
  filtersActive,
  className,
}: TrackerFilterBarProps) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)

  return (
    <div
      role="toolbar"
      aria-label="Filter portal submissions"
      className={cn(
        'sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] py-[var(--lc-space-sm)]',
        className,
      )}
    >
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={statusOpen}
          className={cn(
            'min-h-tap',
            filters.status.length > 0 &&
              'border-[var(--lc-action-primary)] bg-[var(--lc-surface-selected)]',
          )}
          onClick={() => {
            setStatusOpen((o) => !o)
            setPortalOpen(false)
          }}
        >
          Status{filters.status.length ? ` (${filters.status.length})` : ''}
        </Button>
        {statusOpen ? (
          <ul
            role="listbox"
            aria-label="Status filters"
            className="absolute start-0 z-20 mt-1 min-w-[12rem] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-1 shadow-[var(--lc-elevation-md)]"
          >
            {TRACKER_STATUS_OPTIONS.map((opt) => {
              const selected = filters.status.includes(opt.value)
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex min-h-tap w-full items-center gap-2 rounded-[var(--lc-radius-sm)] px-2 text-start text-sm hover:bg-[var(--lc-surface-selected)]"
                    onClick={() =>
                      onChange({
                        ...filters,
                        status: toggleValue(filters.status, opt.value as PortalStatus),
                      })
                    }
                  >
                    <span aria-hidden="true">{selected ? '✓' : ''}</span>
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={portalOpen}
          className={cn(
            'min-h-tap',
            filters.portal.length > 0 &&
              'border-[var(--lc-action-primary)] bg-[var(--lc-surface-selected)]',
          )}
          onClick={() => {
            setPortalOpen((o) => !o)
            setStatusOpen(false)
          }}
        >
          Portal{filters.portal.length ? ` (${filters.portal.length})` : ''}
        </Button>
        {portalOpen ? (
          <ul
            role="listbox"
            aria-label="Portal filters"
            className="absolute start-0 z-20 mt-1 min-w-[12rem] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-1 shadow-[var(--lc-elevation-md)]"
          >
            {TRACKER_PORTAL_OPTIONS.map((opt) => {
              const selected = filters.portal.includes(opt.value)
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex min-h-tap w-full items-center gap-2 rounded-[var(--lc-radius-sm)] px-2 text-start text-sm hover:bg-[var(--lc-surface-selected)]"
                    onClick={() =>
                      onChange({
                        ...filters,
                        portal: toggleValue(filters.portal, opt.value),
                      })
                    }
                  >
                    <span aria-hidden="true">{selected ? '✓' : ''}</span>
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <label className="sr-only" htmlFor="tracker-within">
        Submitted within
      </label>
      <select
        id="tracker-within"
        className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
        value={filters.submittedWithin}
        onChange={(e) =>
          onChange({
            ...filters,
            submittedWithin: e.target.value as PortalTrackerFilters['submittedWithin'],
          })
        }
      >
        {WITHIN_OPTIONS.map((opt) => (
          <option key={opt.value || 'any'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <Input
        aria-label="Search listings or portals"
        placeholder="Search…"
        value={filters.q}
        className="min-h-tap max-w-[16rem] border-[var(--lc-border-strong)]"
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
      />

      {filtersActive ? (
        <Button type="button" variant="link" className="min-h-tap ms-auto" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
