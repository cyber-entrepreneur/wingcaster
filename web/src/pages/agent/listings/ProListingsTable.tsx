import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  LISTING_STATUSES,
  normalizeStatus,
  type ListingStatus,
} from '@/lib/listingStatus'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Numeric } from '@/components/ui/numeric'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { useTenant } from '@/hooks/useTenant'
import { useListPrefs, type ListingsColumnId } from '@/hooks/useListPrefs'
import { useSavedViews } from '@/hooks/useSavedViews'
import { TypedConfirmDialog } from '@/components/listings/pro/TypedConfirmDialog'

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
  onRefresh?: () => void
  className?: string
  showOwnerColumn?: boolean
}

type SortState = { key: ProListingsSortKey; dir: 'asc' | 'desc' } | null

type Filters = {
  status: string
  type: string
  areaMin: string
  areaMax: string
  priceMin: string
  priceMax: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  status: '',
  type: '',
  areaMin: '',
  areaMax: '',
  priceMin: '',
  priceMax: '',
  dateFrom: '',
  dateTo: '',
}

function daysOnMarket(listed?: string): number | null {
  if (!listed) return null
  const t = Date.parse(listed)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function listingHrid(p: Property): string {
  return p.reference || p.canonical_id || p.id.slice(0, 8).toUpperCase()
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * AGT-LST-002 — Pro listings table (tablet + desktop ≥768px).
 */
export function ProListingsTable({
  listings,
  totalCount,
  onCreate,
  onShowCards,
  onRefresh,
  className,
  showOwnerColumn = false,
}: ProListingsTableProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { activeTenant } = useTenant()
  const { prefs, savePrefs } = useListPrefs(activeTenant?.id)
  const { views, createView, renameView, deleteView, shareView } = useSavedViews(activeTenant?.id)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focusIndex, setFocusIndex] = useState(0)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null)
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false)
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const [shareWithTenant, setShareWithTenant] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string>('seed-all')
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [priceEditId, setPriceEditId] = useState<string | null>(null)
  const [priceEditValue, setPriceEditValue] = useState('')
  const [statusEditId, setStatusEditId] = useState<string | null>(null)
  const [draftColumns, setDraftColumns] = useState<ListingsColumnId[]>(prefs.columns)

  // URL sync — sort + filters + view
  const sort: SortState = useMemo(() => {
    const raw = searchParams.get('sort')
    if (!raw) return { key: 'updated', dir: 'desc' }
    const [key, dir] = raw.split(':')
    if (!key) return null
    return {
      key: key as ProListingsSortKey,
      dir: dir === 'asc' ? 'asc' : 'desc',
    }
  }, [searchParams])

  const filters: Filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      type: searchParams.get('type') || '',
      areaMin: searchParams.get('area_min') || '',
      areaMax: searchParams.get('area_max') || '',
      priceMin: searchParams.get('price_min') || '',
      priceMax: searchParams.get('price_max') || '',
      dateFrom: searchParams.get('date_from') || '',
      dateTo: searchParams.get('date_to') || '',
    }),
    [searchParams],
  )

  useEffect(() => {
    const view = searchParams.get('view_id')
    if (view) setActiveViewId(view)
  }, [searchParams])

  useEffect(() => {
    setDraftColumns(prefs.columns)
  }, [prefs.columns])

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') next.delete(k)
        else next.set(k, v)
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filters.status && normalizeStatus(l.status) !== filters.status) return false
      if (filters.type && l.type !== filters.type) return false
      const area = Number(l.area) || 0
      if (filters.areaMin && area < Number(filters.areaMin)) return false
      if (filters.areaMax && area > Number(filters.areaMax)) return false
      const price = Number(l.price) || 0
      if (filters.priceMin && price < Number(filters.priceMin)) return false
      if (filters.priceMax && price > Number(filters.priceMax)) return false
      if (filters.dateFrom && (l.listed_date || '') < filters.dateFrom) return false
      if (filters.dateTo && (l.listed_date || '') > filters.dateTo) return false
      return true
    })
  }, [listings, filters])

  const sorted = useMemo(() => {
    const rows = [...filtered]
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
  }, [filtered, sort])

  const total = totalCount ?? listings.length
  const allSelected = sorted.length > 0 && selected.size === sorted.length
  const columns = prefs.columns.filter((c) => (c === 'owner' ? showOwnerColumn : true))

  const toggleSort = (key: ProListingsSortKey) => {
    if (!sort || sort.key !== key) {
      patchParams({ sort: `${key}:asc` })
      return
    }
    if (sort.dir === 'asc') {
      patchParams({ sort: `${key}:desc` })
      return
    }
    patchParams({ sort: null })
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

  const applyView = (viewId: string) => {
    const view = views.find((v) => v.id === viewId)
    setActiveViewId(viewId)
    if (!view) return
    const f = (view.filter || {}) as Record<string, unknown>
    const statusArr = Array.isArray(f.status) ? f.status : []
    patchParams({
      view_id: viewId,
      status: statusArr[0] ? String(statusArr[0]) : null,
      type: f.type ? String(f.type) : null,
      price_min: f.price_min != null ? String(f.price_min) : null,
      price_max: f.price_max != null ? String(f.price_max) : null,
    })
  }

  const runBulk = async (action: 'publish' | 'archive' | 'export' | 'delete', phrase?: string) => {
    const ids = [...selected]
    if (!ids.length) return
    setBulkBusy(true)
    try {
      if (action === 'publish') {
        await api.bulkPublishProperties(ids)
        addToast({ title: `Published ${ids.length} listings`, variant: 'default' })
      } else if (action === 'archive') {
        await api.bulkArchiveProperties(ids)
        addToast({ title: `Archived ${ids.length} listings`, variant: 'default' })
      } else if (action === 'export') {
        const res = await api.bulkExportProperties(ids)
        downloadCsv(res.csv, res.filename)
        addToast({ title: 'Export ready', description: `${res.row_count} rows downloaded`, variant: 'default' })
      } else if (action === 'delete') {
        await api.bulkDeleteProperties(ids, phrase || `delete ${ids.length}`)
        addToast({ title: `Deleted ${ids.length} listings`, variant: 'default' })
        setDeleteOpen(false)
      }
      setSelected(new Set())
      onRefresh?.()
    } catch (err) {
      addToast({
        title: 'Bulk action failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const saveInlinePrice = async (id: string) => {
    const price = Number(priceEditValue)
    if (!Number.isFinite(price) || price < 0) return
    try {
      await api.updateProperty(id, { price })
      addToast({ title: 'Price updated', variant: 'default' })
      setPriceEditId(null)
      onRefresh?.()
    } catch (err) {
      addToast({
        title: 'Could not update price',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    }
  }

  const saveInlineStatus = async (id: string, status: string) => {
    try {
      const mapped =
        status === 'published' ? 'active' : status === 'archived' ? 'archived' : status
      await api.updateProperty(id, { status: mapped })
      addToast({ title: 'Status updated', variant: 'default' })
      setStatusEditId(null)
      onRefresh?.()
    } catch (err) {
      addToast({
        title: 'Could not update status',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    }
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
      setPriceEditId(null)
      setStatusEditId(null)
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault()
      setSaveViewOpen(true)
    }
  }

  const confirmPhrase = singleDeleteId
    ? 'delete 1'
    : `delete ${selected.size}`

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
        <div className="flex flex-wrap gap-1" data-testid="saved-views-bar">
          {views.map((view) => (
            <div key={view.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => applyView(view.id)}
                className="min-h-tap"
              >
                <Badge
                  variant={activeViewId === view.id ? 'default' : 'secondary'}
                  className="rounded-pill"
                >
                  {view.name}
                </Badge>
              </button>
              {!view.id.startsWith('seed-') ? (
                <button
                  type="button"
                  className="inline-flex h-tap w-tap items-center justify-center text-[var(--lc-text-muted)]"
                  aria-label={`Manage ${view.name}`}
                  onClick={() => {
                    setRenameTarget(view.id)
                    setRenameValue(view.name)
                  }}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="min-h-tap rounded-pill border border-dashed border-[var(--lc-border)] px-2 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
            onClick={() => setSaveViewOpen(true)}
          >
            Save current filter as view
          </button>
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

      {/* Filter bar — status / type / area / price / date */}
      <div
        className="flex flex-wrap items-end gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]"
        data-testid="listings-filter-bar"
      >
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Status
          <select
            className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-2"
            value={filters.status}
            onChange={(e) => patchParams({ status: e.target.value || null })}
          >
            <option value="">All</option>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LISTING_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Type
          <select
            className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-2"
            value={filters.type}
            onChange={(e) => patchParams({ type: e.target.value || null })}
          >
            <option value="">All</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </select>
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Area min
          <Input
            type="number"
            className="w-24"
            value={filters.areaMin}
            onChange={(e) => patchParams({ area_min: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Area max
          <Input
            type="number"
            className="w-24"
            value={filters.areaMax}
            onChange={(e) => patchParams({ area_max: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Price min
          <Input
            type="number"
            className="w-28"
            value={filters.priceMin}
            onChange={(e) => patchParams({ price_min: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          Price max
          <Input
            type="number"
            className="w-28"
            value={filters.priceMax}
            onChange={(e) => patchParams({ price_max: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          From
          <Input
            type="date"
            className="w-36"
            value={filters.dateFrom}
            onChange={(e) => patchParams({ date_from: e.target.value || null })}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ font: 'var(--lc-type-caption)' }}>
          To
          <Input
            type="date"
            className="w-36"
            value={filters.dateTo}
            onChange={(e) => patchParams({ date_to: e.target.value || null })}
          />
        </label>
        <button
          type="button"
          className="min-h-tap text-[var(--lc-text-brand)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
          onClick={() =>
            patchParams({
              status: null,
              type: null,
              area_min: null,
              area_max: null,
              price_min: null,
              price_max: null,
              date_from: null,
              date_to: null,
            })
          }
        >
          Clear filters
        </button>
        <span className="ms-auto text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          <Numeric as="span">{sorted.length}</Numeric> of <Numeric as="span">{total}</Numeric> listings
        </span>
        <button
          type="button"
          className="inline-flex min-h-tap items-center gap-1 rounded-md px-2 text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
          aria-label="Customize columns"
          onClick={() => setColumnDrawerOpen(true)}
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
            <button
              type="button"
              className="mt-3 text-[var(--lc-text-brand)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
              onClick={() =>
                patchParams({
                  status: null,
                  type: null,
                  area_min: null,
                  area_max: null,
                  price_min: null,
                  price_max: null,
                  date_from: null,
                  date_to: null,
                })
              }
            >
              Clear filters
            </button>
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
                {columns.includes('hrid') ? (
                  <SortHeader label="ID" sortKey="hrid" sort={sort} onSort={toggleSort} sticky />
                ) : null}
                {columns.includes('title') ? (
                  <SortHeader label="Property" sortKey="title" sort={sort} onSort={toggleSort} sticky />
                ) : null}
                {columns.includes('price') ? (
                  <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} align="end" />
                ) : null}
                {columns.includes('status') ? (
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                ) : null}
                {columns.includes('portals') ? (
                  <th
                    scope="col"
                    className="px-3 py-2 text-start text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  >
                    Portals
                  </th>
                ) : null}
                {columns.includes('inquiries') ? (
                  <th
                    scope="col"
                    className="px-3 py-2 text-end text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  >
                    Inquiries
                  </th>
                ) : null}
                {columns.includes('views') ? (
                  <SortHeader label="Views (MTD)" sortKey="views" sort={sort} onSort={toggleSort} align="end" />
                ) : null}
                {columns.includes('dom') ? (
                  <th
                    scope="col"
                    className="px-3 py-2 text-end text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  >
                    Days on market
                  </th>
                ) : null}
                {columns.includes('updated') ? (
                  <SortHeader label="Updated" sortKey="updated" sort={sort} onSort={toggleSort} />
                ) : null}
                {columns.includes('owner') && showOwnerColumn ? (
                  <th
                    scope="col"
                    className="px-3 py-2 text-start text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  >
                    Owning agent
                  </th>
                ) : null}
                {columns.includes('actions') ? (
                  <th scope="col" className="px-2 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
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
                    {columns.includes('hrid') ? (
                      <td className="sticky start-[44px] z-10 bg-[var(--lc-surface-raised)] px-3 py-2 shadow-[var(--lc-elevation-sm)]">
                        <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{listingHrid(row)}</Numeric>
                      </td>
                    ) : null}
                    {columns.includes('title') ? (
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
                    ) : null}
                    {columns.includes('price') ? (
                      <td
                        className="relative px-3 py-2 text-end"
                        onDoubleClick={() => {
                          setPriceEditId(row.id)
                          setPriceEditValue(String(row.price || ''))
                        }}
                      >
                        <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>
                          {formatPrice(row.price, row.type, row.price_unit)}
                        </Numeric>
                        {priceEditId === row.id ? (
                          <div
                            className="absolute end-0 top-full z-20 mt-1 w-44 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-2 shadow-[var(--lc-elevation-md)]"
                            data-testid="inline-price-popover"
                          >
                            <Input
                              type="number"
                              value={priceEditValue}
                              onChange={(e) => setPriceEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveInlinePrice(row.id)
                                if (e.key === 'Escape') setPriceEditId(null)
                              }}
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="default"
                              className="mt-2 w-full"
                              onClick={() => void saveInlinePrice(row.id)}
                            >
                              Save
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.includes('status') ? (
                      <td
                        className="relative px-3 py-2"
                        onDoubleClick={() => setStatusEditId(row.id)}
                      >
                        <StatusCell status={status} />
                        {statusEditId === row.id ? (
                          <div
                            className="absolute start-0 top-full z-20 mt-1 w-44 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-2 shadow-[var(--lc-elevation-md)]"
                            data-testid="inline-status-popover"
                          >
                            <select
                              className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] px-2"
                              defaultValue={status}
                              autoFocus
                              onChange={(e) => void saveInlineStatus(row.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setStatusEditId(null)
                              }}
                            >
                              {LISTING_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {LISTING_STATUS_META[s].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.includes('portals') ? (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <ChannelMark channel="instagram" />
                          <ChannelMark channel="whatsapp" />
                          <ChannelMark channel="olx" label="Bayut" />
                        </div>
                      </td>
                    ) : null}
                    {columns.includes('inquiries') ? (
                      <td className="px-3 py-2 text-end">
                        <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>0</Numeric>
                      </td>
                    ) : null}
                    {columns.includes('views') ? (
                      <td className="px-3 py-2 text-end">
                        <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{row.views || 0}</Numeric>
                      </td>
                    ) : null}
                    {columns.includes('dom') ? (
                      <td className="px-3 py-2 text-end">
                        <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>{dom ?? '—'}</Numeric>
                      </td>
                    ) : null}
                    {columns.includes('updated') ? (
                      <td className="px-3 py-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        {row.listed_date ? new Date(row.listed_date).toLocaleDateString() : '—'}
                      </td>
                    ) : null}
                    {columns.includes('owner') && showOwnerColumn ? (
                      <td className="px-3 py-2 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        {row.agent_name || '—'}
                      </td>
                    ) : null}
                    {columns.includes('actions') ? (
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          className="inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-status-unpublished-fg)]"
                          aria-label={`Delete ${row.title}`}
                          onClick={() => {
                            setSingleDeleteId(row.id)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
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
          <BulkBtn
            icon={<Send className="h-4 w-4" />}
            label="Publish to channels"
            disabled={bulkBusy}
            onClick={() => void runBulk('publish')}
          />
          <BulkBtn
            icon={<Archive className="h-4 w-4" />}
            label="Archive"
            disabled={bulkBusy}
            onClick={() => void runBulk('archive')}
          />
          <BulkBtn
            icon={<Download className="h-4 w-4" />}
            label="Export CSV"
            disabled={bulkBusy}
            onClick={() => void runBulk('export')}
          />
          <BulkBtn
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete…"
            disabled={bulkBusy}
            onClick={() => {
              setSingleDeleteId(null)
              setDeleteOpen(true)
            }}
          />
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

      <TypedConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setSingleDeleteId(null)
        }}
        title={singleDeleteId ? 'Delete listing?' : `Delete ${selected.size} listings?`}
        description="This cannot be undone. Type the confirmation phrase to proceed."
        confirmPhrase={confirmPhrase}
        confirmLabel="Delete"
        loading={bulkBusy}
        onConfirm={async () => {
          if (singleDeleteId) {
            setBulkBusy(true)
            try {
              await api.bulkDeleteProperties([singleDeleteId], 'delete 1')
              addToast({ title: 'Listing deleted', variant: 'default' })
              setDeleteOpen(false)
              setSingleDeleteId(null)
              onRefresh?.()
            } catch (err) {
              addToast({
                title: 'Delete failed',
                description: err instanceof Error ? err.message : undefined,
                variant: 'error',
              })
            } finally {
              setBulkBusy(false)
            }
            return
          }
          await runBulk('delete', confirmPhrase)
        }}
      />

      {/* Column customization drawer */}
      {columnDrawerOpen ? (
        <div className="fixed inset-0 z-40" data-testid="column-customization-drawer">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--lc-surface-inverse)_40%,transparent)]"
            aria-label="Close column drawer"
            onClick={() => setColumnDrawerOpen(false)}
          />
          <aside className="absolute end-0 top-0 flex h-full w-[320px] flex-col bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-lg)]">
            <header className="flex items-center justify-between border-b border-[var(--lc-border)] px-4 py-3">
              <h2 style={{ font: 'var(--lc-type-heading-3)' }}>Customize columns</h2>
              <Button type="button" variant="ghost" onClick={() => setColumnDrawerOpen(false)}>
                Close
              </Button>
            </header>
            <ul className="flex-1 space-y-1 overflow-auto p-3">
              {draftColumns.map((col, idx) => (
                <li
                  key={col}
                  className="flex min-h-tap items-center gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-2"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (Number.isNaN(from) || from === idx) return
                    setDraftColumns((prev) => {
                      const next = [...prev]
                      const [moved] = next.splice(from, 1)
                      next.splice(idx, 0, moved)
                      return next
                    })
                  }}
                >
                  <Checkbox
                    checked={prefs.columns.includes(col) || draftColumns.includes(col)}
                    onCheckedChange={(checked) => {
                      setDraftColumns((prev) =>
                        checked ? (prev.includes(col) ? prev : [...prev, col]) : prev.filter((c) => c !== col),
                      )
                    }}
                    aria-label={`Show ${col}`}
                  />
                  <span className="flex-1 capitalize" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {col}
                  </span>
                  <span className="text-[var(--lc-text-muted)]" aria-hidden="true">
                    ⋮⋮
                  </span>
                </li>
              ))}
              {(['hrid', 'title', 'price', 'status', 'portals', 'inquiries', 'views', 'dom', 'updated', 'owner', 'actions'] as ListingsColumnId[])
                .filter((c) => !draftColumns.includes(c))
                .map((col) => (
                  <li key={col} className="flex min-h-tap items-center gap-2 px-2 opacity-70">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => setDraftColumns((prev) => [...prev, col])}
                      aria-label={`Show ${col}`}
                    />
                    <span className="capitalize" style={{ font: 'var(--lc-type-body-sm)' }}>
                      {col}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="border-t border-[var(--lc-border)] p-3">
              <Button
                type="button"
                className="w-full"
                onClick={async () => {
                  await savePrefs({ columns: draftColumns })
                  setColumnDrawerOpen(false)
                  addToast({ title: 'Column layout saved', variant: 'default' })
                }}
              >
                Save layout
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Save view dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="save-view-name">Name</Label>
            <Input
              id="save-view-name"
              placeholder="e.g. Below market in JVC"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
            />
            {activeTenant?.kind === 'agency' ? (
              <label className="flex items-center gap-2" style={{ font: 'var(--lc-type-body-sm)' }}>
                <Checkbox
                  checked={shareWithTenant}
                  onCheckedChange={(v) => setShareWithTenant(!!v)}
                />
                Share with tenant
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!saveViewName.trim()}
              onClick={async () => {
                await createView({
                  name: saveViewName.trim(),
                  filter: {
                    status: filters.status ? [filters.status] : undefined,
                    type: filters.type || undefined,
                    price_min: filters.priceMin || undefined,
                    price_max: filters.priceMax || undefined,
                  },
                  sort: sort ? [[sort.key, sort.dir]] : [],
                  shared_with_tenant: shareWithTenant,
                })
                setSaveViewName('')
                setSaveViewOpen(false)
                addToast({ title: 'View saved', variant: 'default' })
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename / delete / share view */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit saved view</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!renameTarget) return
                await shareView(renameTarget, true)
                addToast({ title: 'Shared with tenant', variant: 'default' })
              }}
            >
              Share with tenant
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!renameTarget) return
                if (!window.confirm('Delete this view? Others in your tenant will lose access.')) return
                await deleteView(renameTarget)
                setRenameTarget(null)
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!renameTarget || !renameValue.trim()) return
                await renameView(renameTarget, renameValue.trim())
                setRenameTarget(null)
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  return <Badge status={status}>{meta.label}</Badge>
}

function BulkBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-tap items-center gap-1.5 rounded-[var(--lc-radius-md)] border border-[var(--lc-text-inverse)] px-2.5 text-[var(--lc-text-inverse)] disabled:opacity-50"
      style={{ font: 'var(--lc-type-caption)' }}
    >
      {icon}
      {label}
    </button>
  )
}

// silence unused EMPTY_FILTERS for tree-shaking clarity
void EMPTY_FILTERS
