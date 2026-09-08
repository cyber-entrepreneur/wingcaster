import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Column definition for the shared PA queue table. */
export interface PAQueueColumn<TRow = PAQueueRow> {
  /** Stable column id (also used as React key). */
  id: string
  /** Header label (parent supplies i18n). */
  header: ReactNode
  /** Cell renderer. */
  cell: (row: TRow) => ReactNode
  /** Optional header className. */
  headerClassName?: string
  /** Optional cell className. */
  cellClassName?: string
  /** Hide from screen readers when decorative. */
  srOnlyHeader?: boolean
}

/** Minimal row shape required by the shared table shell. */
export interface PAQueueRow {
  /** Unique row id (submission / case / package id). */
  id: string
  /**
   * When true, row actions that would violate the two-person / own-submission
   * rule should be hidden by the consumer. Stub table does not enforce.
   */
  isOwn?: boolean
}

export interface PAQueueTableProps<TRow extends PAQueueRow = PAQueueRow> {
  columns: PAQueueColumn<TRow>[]
  rows: TRow[]
  /** Currently selected row ids. */
  selectedIds?: ReadonlySet<string> | string[]
  /** Toggle one row. Omitted when selection is disabled (e.g. PA-ACR-001). */
  onSelectionChange?: (ids: string[]) => void
  /** Enable row-select checkboxes. Default true; set false for WF-04 / WF-05 PII-safe queues. */
  selectable?: boolean
  /** Focused row id for J/K keyboard nav visual. */
  focusedId?: string | null
  /** Row click → detail navigation (except checkbox / action buttons). */
  onRowClick?: (row: TRow) => void
  /** Optional empty-state slot. */
  emptyState?: ReactNode
  /** Loading skeleton flag — renders placeholder rows. */
  loading?: boolean
  /** Number of skeleton rows when loading. */
  skeletonRows?: number
  className?: string
  /** Accessible table caption / aria-label. */
  'aria-label'?: string
}

function toIdSet(selected?: ReadonlySet<string> | string[]): Set<string> {
  if (!selected) return new Set()
  return selected instanceof Set ? selected : new Set(selected)
}

/**
 * Shared PA queue table: filterable shell + optional row-selection + row-click-to-detail.
 *
 * Used by: PA-MOD-001, PA-ACR-001, PA-PVA-008, PA-PVA-009, PA-PKG-003.
 * Stub visual + prop types only — no real API / keyboard handlers (parents wire shortcuts).
 */
export function PAQueueTable<TRow extends PAQueueRow = PAQueueRow>({
  columns,
  rows,
  selectedIds,
  onSelectionChange,
  selectable = true,
  focusedId = null,
  onRowClick,
  emptyState,
  loading = false,
  skeletonRows = 8,
  className,
  'aria-label': ariaLabel = 'Approval queue',
}: PAQueueTableProps<TRow>) {
  const selected = toIdSet(selectedIds)
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const setSelected = (next: Set<string>) => {
    onSelectionChange?.(Array.from(next))
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((r) => r.id)))
  }

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: TRow) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick?.(row)
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table role="grid" aria-label={ariaLabel} className="w-full border-collapse text-start">
          <thead>
            <tr className="bg-[var(--lc-surface-sunken)]">
              {selectable ? (
                <th scope="col" className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all visible rows"
                    checked={allVisibleSelected}
                    disabled={loading || rows.length === 0}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 accent-[var(--lc-action-primary)]"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'px-3 py-2 text-start text-[var(--lc-text-muted)]',
                    'font-[family-name:var(--lc-font-sans)] uppercase tracking-[0.08em]',
                    'text-[length:var(--lc-type-overline,0.6875rem)]',
                    col.srOnlyHeader && 'sr-only',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-[var(--lc-border)]">
                    {selectable ? <td className="px-3 py-4" /> : null}
                    {columns.map((col) => (
                      <td key={col.id} className="px-3 py-4">
                        <div
                          className="h-4 animate-pulse rounded bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
                          style={{ animationDuration: 'var(--lc-duration-base)' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : null}

            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(selectable ? 1 : 0) + columns.length}
                  className="px-6 py-12 text-center text-[var(--lc-text-muted)]"
                >
                  {emptyState ?? 'No rows'}
                </td>
              </tr>
            ) : null}

            {!loading
              ? rows.map((row) => {
                  const isSelected = selected.has(row.id)
                  const isFocused = focusedId === row.id
                  return (
                    <tr
                      key={row.id}
                      role="row"
                      tabIndex={0}
                      data-row-id={row.id}
                      data-own={row.isOwn ? 'true' : undefined}
                      aria-selected={selectable ? isSelected : undefined}
                      className={cn(
                        'min-h-[64px] border-b border-[var(--lc-border)] transition-colors',
                        'duration-[var(--lc-duration-fast)] hover:bg-[var(--lc-surface-sunken)]',
                        'cursor-pointer focus-visible:outline-none',
                        isFocused && 'bg-[var(--lc-surface-sunken)]',
                      )}
                      onClick={() => onRowClick?.(row)}
                      onKeyDown={(e) => onRowKeyDown(e, row)}
                    >
                      {selectable ? (
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select row ${row.id}`}
                            checked={isSelected}
                            onChange={() => toggleOne(row.id)}
                            className="h-4 w-4 accent-[var(--lc-action-primary)]"
                          />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            'px-3 py-3 text-sm text-[var(--lc-text-primary)]',
                            col.cellClassName,
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
