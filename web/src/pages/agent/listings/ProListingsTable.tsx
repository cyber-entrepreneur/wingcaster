import { useMemo, useState, type ReactNode, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns,
  Download,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import type { Property } from '@/types'
import { formatPrice } from '@/lib/format'
import {
  LISTING_STATUS_META,
  normalizeStatus,
  type ListingStatus,
} from '@/lib/listingStatus'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Numeric } from '@/components/ui/numeric'
import { ChannelMark } from '@/components/ui/channel-mark'

export type ProListingsSortKey =
  | 'hrid'
  | 'title'
  | 'price'
  | 'status'
  | 'views'
  | 'updated'

export interface ProListingsTableProps {
  listings: Property[]
  totalCount?: number
  onCreate?: () => void
  onShowCards?: () => void
  className?: string
  /** Agency tenant context shows owning-agent column. */
  showOwnerColumn?: boolean
}

type SortState = { key: ProListingsSortKey; dir: 'asc' | 'desc' } | null

function daysOnMarket(listed?: string): number | null {
  if (!listed) return null
  const t = Date.parse(listed)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function listingHrid(p: Property): string {
  return p.reference || p.canonical_id || p.id.slice(0, 8).toUpperCase()
}

/**
 * AGT-LST-002 — Pro listings table (tablet + desktop ≥768px).
 * Additive to Guided `viewMode: 'card' | 'list' | 'gallery'` — do not rename that union.
 */
export function ProListingsTable({
  listings,
  totalCount,
  onCreate,
  onShowCards,
  className,
  showOwnerColumn = false,
}: ProListingsTableProps) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortState>({ key: 'updated', dir: 'desc' })
  const [focusIndex, setFocusIndex] = useState(0)

  const sorted = useMemo(() => {
    const rows = [...listings]
    if (!sort) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      switch (sort.key) {
        case 'hrid':
          return listingHrid(a).localeCompare(listingHrid(b)) * dir
        case 'title':
          return String(a.title || '').localeCompare(String(b.title || '')) * dir
        case 'price':
          return ((a.price || 0) - (b.price || 0)) * dir
        case 'status':
          return normalizeStatus(a.status).localeCompare(normalizeStatus(b.status)) * dir
        case 'views':
          return ((a.views || 0) - (b.views || 0)) * dir
        case 'updated':
        default: {
          const av = Date.parse(a.listed_date || '') || 0
          const bv = Date.parse(b.listed_date || '') || 0
          return (av - bv) * dir
        }
      }
    })
    return rows
  }, [listings, sort])

  const total = totalCount ?? listings.length
  const allSelected = sorted.length > 0 && selected.size === sorted.length

  const toggleSort = (key: ProListingsSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePage = () => {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(sorted.map((r) => r.id)))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex((i) => Math.min(sorted.length - 1, i + 1))
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex((i) => Math.max(0, i - 1))
    } else if (event.key === ' ' && sorted[focusIndex]) {
      event.preventDefault()
      toggleRow(sorted[focusIndex].id)
    } else if (event.key === 'Enter' && sorted[focusIndex]) {
      event.preventDefault()
      navigate(`/listings/${sorted[focusIndex].id}`)
    } else if (event.key === 'Escape') {
      setSelected(new Set())
    }
  }

  return (
    <div
      className={cn('flex flex-col gap-[var(--lc-space-md)]', className)}
      data-testid="pro-listings-table"
      data-screen="AGT-LST-002"
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Listings table"
    >
      <div className="flex flex-wrap items-center gap-[var(--lc-space-sm)]">
        <h1
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
        >
          Listings
        </h1>
        <div className="flex flex-wrap gap-1">
          {['All', 'My active drafts', 'Below market price', 'Expiring soon'].map((view, i) => (
            <Badge
              key={view}
              variant={i === 0 ? 'default' : 'secondary'}
              className="rounded-pill"
            >
              {view}
            </Badge>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <div
            role="group"
            aria-label="View mode"
            className="flex rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-0.5"
          >
            <button
              type="button"
              className="min-h-tap rounded-[var(--lc-radius-sm)] bg-[var(--lc-action-primary)] px-3 text-[var(--lc-action-primary-text)]"
              style={{ font: 'var(--lc-type-caption)' }}
              aria-pressed="true"
            >
              Table
            </button>
            <button
              type="button"
              className="min-h-tap rounded-[var(--lc-radius-sm)] px-3 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
              aria-pressed="false"
              onClick={onShowCards}
            >
              Cards
            </button>
          </div>
          <Button type="button" onClick={onCreate} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New listing
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">
        <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          <Numeric as="span">{sorted.length}</Numeric> of <Numeric as="span">{total}</Numeric> listings
        </span>
        <button
          type="button"
          className="ms-auto inline-flex min-h-tap items-center gap-1 rounded-md px-2 text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
          aria-label="Customize columns"
        >
          <Columns className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {selected.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-selected)] px-[var(--lc-space-sm)] py-2"
          aria-live="polite"
        >
          <span style={{ font: 'var(--lc-type-body-sm)' }}>
            <Numeric as="span">{selected.size}</Numeric> selected
          </span>
          <button type="button" className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }} onClick={() => setSelected(new Set())}>
            Deselect all
          </button>
          <button type="button" className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }} onClick={togglePage}>
            Select page ({sorted.length})
          </button>
        </div>
      ) : null}

      <div className="overflow-auto rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]">
        {sorted.length === 0 ? (
          <div className="px-[var(--lc-space-xl)] py-[var(--lc-space-3xl)] text-center">
            <p style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
              No listings match these filters.
            </p>
            <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Save this filter as a view for later
            </p>
          </div>
        ) : (
          <table className="min-w-full border-collapse">
            <thead className="bg-[var(--lc-surface-sunken)]">
              <tr className="border-b border-[var(--lc-border)]">
                <th scope="col" className="sticky start-0 z-10 bg-[var(--lc-surface-sunken)] px-2 py-2 shadow-[var(--lc-elevation-sm)]">
                  <span className="inline-flex min-h-tap min-w-tap items-center justify-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={togglePage}
                      aria-label="Select all on page"
                    />
                  </span>
                </th>
                <SortHeader label="ID" sortKey="hrid" sort={sort} onSort={toggleSort} sticky />
                <SortHeader label="Property" sortKey="title" sort={sort} onSort={toggleSort} sticky />
                <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} align="end" />
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                <th
                  scope="col"
                  className="px-3 py-2 text-start text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                >
                  Portals
                </th>
                <SortHeader label="Views (MTD)" sortKey="views" sort={sort} onSort={toggleSort} align="end" />
                <th
                  scope="col"
                  className="px-3 py-2 text-end text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                >
                  Days on market
                </th>
                <SortHeader label="Updated" sortKey="updated" sort={sort} onSort={toggleSort} />
                {showOwnerColumn ? (
                  <th
                    scope="col"
                    className="px-3 py-2 text-start text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  >
                    Owning agent
                  </th>
                ) : null}
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => {
                const status = normalizeStatus(row.status)
                const isSelected = selected.has(row.id)
                const isFocused = index === focusIndex
                const dom = daysOnMarket(row.listed_date)
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-[var(--lc-border)]',
                      index % 2 === 1 && 'bg-[color-mix(in_srgb,var(--lc-surface-sunken)_40%,transparent)]',
                      'hover:bg-[var(--lc-surface-selected)]',
                      isSelected && 'bg-[var(--lc-surface-selected)] shadow-[inset_2px_0_0_var(--lc-action-primary)]',
                      isFocused && 'outline outline-2 outline-[var(--lc-focus-ring)] outline-offset-[-2px]',
                    )}
                    onClick={() => setFocusIndex(index)}
                    onDoubleClick={() => navigate(`/listings/${row.id}`)}
                  >
                    <td className="sticky start-0 z-10 bg-[var(--lc-surface-raised)] px-2 py-1 shadow-[var(--lc-elevation-sm)]">
                      <span className="inline-flex min-h-tap min-w-tap items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.title}`}
                        />
                      </span>
                    </td>
                    <td className="sticky start-[44px] z-10 bg-[var(--lc-surface-raised)] px-3 py-2 shadow-[var(--lc-elevation-sm)]">
                      <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{listingHrid(row)}</Numeric>
                    </td>
                    <td className="sticky start-[116px] z-10 max-w-[240px] bg-[var(--lc-surface-raised)] px-3 py-2 shadow-[var(--lc-elevation-sm)]">
                      <Link
                        to={`/listings/${row.id}`}
                        className="line-clamp-1 font-medium text-[var(--lc-text-primary)] hover:text-[var(--lc-text-brand)]"
                        style={{ font: 'var(--lc-type-body-sm)' }}
                      >
                        {row.title}
                      </Link>
                      <div className="line-clamp-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                        {row.location || row.city}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>
                        {formatPrice(row.price, row.type, row.price_unit)}
                      </Numeric>
                    </td>
                    <td className="px-3 py-2">
                      <StatusCell status={status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <ChannelMark channel="instagram" />
                        <ChannelMark channel="whatsapp" />
                        <ChannelMark channel="olx" label="Bayut" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{row.views || 0}</Numeric>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{dom ?? '—'}</Numeric>
                    </td>
                    <td className="px-3 py-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                      {row.listed_date ? new Date(row.listed_date).toLocaleDateString() : '—'}
                    </td>
                    {showOwnerColumn ? (
                      <td className="px-3 py-2 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        {row.agent_name || '—'}
                      </td>
                    ) : null}
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        className="inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
                        aria-label={`Actions for ${row.title}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-6 bottom-6 z-30 flex flex-wrap items-center gap-2 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-inverse)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-text-inverse)] shadow-[var(--lc-elevation-md)]"
          data-testid="bulk-actions-bar"
        >
          <span style={{ font: 'var(--lc-type-body-sm)' }}>
            <Numeric as="span">{selected.size}</Numeric> selected
          </span>
          <BulkBtn icon={<Send className="h-4 w-4" />} label="Publish to channels" />
          <BulkBtn icon={<Archive className="h-4 w-4" />} label="Archive" />
          <BulkBtn icon={<Download className="h-4 w-4" />} label="Export CSV" />
          <BulkBtn icon={<Trash2 className="h-4 w-4" />} label="Delete…" />
          <button
            type="button"
            className="ms-auto min-h-tap underline"
            style={{ font: 'var(--lc-type-body-sm)' }}
            onClick={() => setSelected(new Set())}
          >
            Deselect all
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'start',
  sticky,
}: {
  label: string
  sortKey: ProListingsSortKey
  sort: SortState
  onSort: (key: ProListingsSortKey) => void
  align?: 'start' | 'end'
  sticky?: boolean
}) {
  const active = sort?.key === sortKey
  const ariaSort = !active ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending'
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'px-3 py-2',
        align === 'end' ? 'text-end' : 'text-start',
        sticky && 'sticky z-10 bg-[var(--lc-surface-sunken)] shadow-[var(--lc-elevation-sm)]',
        sticky && sortKey === 'hrid' && 'start-[44px]',
        sticky && sortKey === 'title' && 'start-[116px]',
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex min-h-tap items-center gap-1',
          active ? 'text-[var(--lc-text-brand)]' : 'text-[var(--lc-text-muted)]',
        )}
        style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  )
}

function StatusCell({ status }: { status: ListingStatus }) {
  const meta = LISTING_STATUS_META[status]
  return (
    <Badge status={status}>
      {meta.label}
    </Badge>
  )
}

function BulkBtn({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-tap items-center gap-1.5 rounded-[var(--lc-radius-md)] border border-[var(--lc-text-inverse)] px-2.5 text-[var(--lc-text-inverse)]"
      style={{ font: 'var(--lc-type-caption)' }}
    >
      {icon}
      {label}
    </button>
  )
}
