import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  Building2,
  Eye,
  Filter,
  MapPin,
  Plus,
  Search,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { formatPrice } from '@/lib/format'
import {
  LISTING_STATUSES,
  LISTING_STATUS_META,
  normalizeStatus,
  type ListingStatus,
} from '@/lib/listingStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListingFormModal } from '@/components/ListingFormModal'
import {
  FabActionSheet,
  ListingCard,
  ProListingsTable,
  StatusPill,
  ViewToggleGroup,
  type ListingCardProperty,
  type ViewMode,
} from '@/components/listings'
import { cn } from '@/lib/utils'
import type { Property } from '@/types'

type StatusFilter = 'all' | ListingStatus
type TypeFilter = 'all' | 'sale' | 'rent'
type SortKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'price:desc'
  | 'price:asc'
  | 'inquiries_new_count:desc'
  | 'last_activity_at:asc'

const VIEW_STORAGE_KEY = 'wc.listings.viewMode'
const VALID_VIEWS: ViewMode[] = ['card', 'list', 'gallery']

const SORT_LABELS: Record<SortKey, string> = {
  'created_at:desc': 'Newest first',
  'created_at:asc': 'Oldest first',
  'price:desc': 'Price: high to low',
  'price:asc': 'Price: low to high',
  'inquiries_new_count:desc': 'Most inquiries',
  'last_activity_at:asc': 'Least activity',
}

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    if (v && VALID_VIEWS.includes(v)) return v
  } catch {
    /* ignore */
  }
  return 'card'
}

function useMediaMin(px: number): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${px}px)`).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [px])
  return match
}

function readUiMode(): 'guided' | 'pro' {
  try {
    const raw = localStorage.getItem('wc.ui_mode')
    if (raw === 'pro') return 'pro'
  } catch {
    /* ignore */
  }
  return 'guided'
}

export function ListingsPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle('Listings')

  const isDesktop = useMediaMin(1024)
  const isTabletPlus = useMediaMin(768)
  const uiMode = readUiMode()

  const [listings, setListings] = useState<ListingCardProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const viewFromUrl = searchParams.get('view') as ViewMode | null
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    viewFromUrl && VALID_VIEWS.includes(viewFromUrl) ? viewFromUrl : readStoredView(),
  )
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    () => (searchParams.get('status') as StatusFilter) || 'all',
  )
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    () => (searchParams.get('type') as TypeFilter) || 'all',
  )
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [sort, setSort] = useState<SortKey>(
    () => (searchParams.get('sort') as SortKey) || 'created_at:desc',
  )

  const syncParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') next.delete(k)
        else next.set(k, v)
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    const onOff = () => setOffline(!navigator.onLine)
    window.addEventListener('online', onOff)
    window.addEventListener('offline', onOff)
    return () => {
      window.removeEventListener('online', onOff)
      window.removeEventListener('offline', onOff)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!agent) {
      setLoading(false)
      return
    }
    void loadListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, authLoading])

  async function loadListings() {
    setLoading(true)
    try {
      const params: Record<string, string> = { agent_id: agent!.id }
      const data = await api.getProperties(params)
      const rows: ListingCardProperty[] = Array.isArray(data) ? data : []
      const mine = rows.filter((r) => r.agent_id === agent!.id)
      setListings(mine)
    } catch (err: unknown) {
      addToast({
        title: "We couldn't load your listings. Try again?",
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => {
    const c: Record<ListingStatus | 'all', number> = {
      all: listings.length,
      draft: 0,
      published: 0,
      unpublished: 0,
      archived: 0,
    }
    for (const l of listings) c[normalizeStatus(l.status)]++
    return c
  }, [listings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = listings.filter((l) => {
      if (statusFilter !== 'all' && normalizeStatus(l.status) !== statusFilter) return false
      if (typeFilter !== 'all' && l.type !== typeFilter) return false
      if (q) {
        const hay = [l.title, l.location, l.city, l.neighborhood, l.reference, l.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'created_at:asc':
          return (a.listed_date || '').localeCompare(b.listed_date || '')
        case 'price:desc':
          return (b.price || 0) - (a.price || 0)
        case 'price:asc':
          return (a.price || 0) - (b.price || 0)
        case 'inquiries_new_count:desc':
          return (b.inquiries_new_count || 0) - (a.inquiries_new_count || 0)
        case 'last_activity_at:asc':
          return (a.last_activity_at || a.listed_date || '').localeCompare(
            b.last_activity_at || b.listed_date || '',
          )
        case 'created_at:desc':
        default:
          return (b.listed_date || '').localeCompare(a.listed_date || '')
      }
    })
    return rows
  }, [listings, statusFilter, typeFilter, query, sort])

  function selectView(mode: ViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    syncParams({ view: mode })
  }

  const showProTable = uiMode === 'pro' && isTabletPlus && viewMode === 'list'

  if (authLoading || loading) {
    return (
      <div
        className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
          >
            <div className="aspect-video bg-[var(--lc-border)]" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-[var(--lc-border)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--lc-border)]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold text-[var(--lc-text-heading)]">
          Sign in to manage listings
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">Your listings are private to your account.</p>
        <Link to="/login" className="mt-4 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {offline && (
        <div
          role="status"
          className="mb-4 rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]"
        >
          You&apos;re offline. Showing cached listings.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold text-[var(--lc-text-heading)]">
            Listings
          </h1>
          <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            <Numeric>{counts.all}</Numeric> total · <Numeric>{counts.published}</Numeric> published ·{' '}
            <Numeric>{counts.draft}</Numeric> draft · <Numeric>{counts.unpublished}</Numeric> pending
          </p>
        </div>
        {isDesktop && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="min-h-[var(--lc-tap-target-min)] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New listing
          </Button>
        )}
        {!isDesktop && isTabletPlus && (
          <Button
            variant="outline"
            onClick={() => setFabOpen(true)}
            className="min-h-[var(--lc-tap-target-min)] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New listing
          </Button>
        )}
      </div>

      <div
        className={cn(
          'sticky top-0 z-[5] mb-4 space-y-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
          'bg-[var(--lc-surface)] p-3 shadow-[var(--lc-elevation-sm)]',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="listings-search" className="sr-only">
              Search listings
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]"
              aria-hidden
            />
            <Input
              id="listings-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                syncParams({ q: e.target.value || null })
              }}
              placeholder="Search by title, area, or reference"
              className="border-[var(--lc-border-strong)] ps-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[var(--lc-tap-target-min)] gap-1.5"
                aria-label="Sort listings"
              >
                <ArrowUpDown className="h-4 w-4" />
                {SORT_LABELS[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  className="min-h-[var(--lc-tap-target-min)]"
                  onClick={() => {
                    setSort(key)
                    syncParams({ sort: key })
                  }}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ViewToggleGroup active={viewMode} onSelect={selectView} className="ms-auto" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Status filter">
          {(['all', ...LISTING_STATUSES] as StatusFilter[]).map((s) => {
            const isActive = statusFilter === s
            const label = s === 'all' ? 'All' : LISTING_STATUS_META[s].label
            const glyph = s === 'all' ? '' : LISTING_STATUS_META[s].glyph
            return (
              <button
                key={s}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setStatusFilter(s)
                  syncParams({ status: s === 'all' ? null : s })
                }}
                className={cn(
                  'inline-flex min-h-[var(--lc-tap-target-min)] shrink-0 items-center gap-1.5 rounded-[var(--lc-radius-pill)] px-3',
                  'text-[length:var(--lc-type-caption)] font-medium transition-colors duration-[var(--lc-duration-fast)]',
                  isActive
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]'
                    : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                )}
              >
                {glyph && <span aria-hidden>{glyph}</span>}
                {label}
                <span className="opacity-70">
                  (<Numeric>({counts[s]})</Numeric>
                </span>
              </button>
            )
          })}
        </div>

        {(statusFilter !== 'all' || typeFilter !== 'all') && (
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Type filter">
            {(['all', 'sale', 'rent'] as TypeFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={typeFilter === t}
                onClick={() => {
                  setTypeFilter(t)
                  syncParams({ type: t === 'all' ? null : t })
                }}
                className={cn(
                  'inline-flex min-h-[var(--lc-tap-target-min)] shrink-0 items-center rounded-[var(--lc-radius-pill)] px-3',
                  'text-[length:var(--lc-type-caption)] font-medium capitalize',
                  typeFilter === t
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                )}
              >
                {t === 'all' ? 'All' : t === 'sale' ? 'For sale' : 'For rent'}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          hasAny={listings.length > 0}
          onCreate={() => (isDesktop ? setCreateOpen(true) : navigate('/listings/new'))}
          onClearFilters={() => {
            setStatusFilter('all')
            setTypeFilter('all')
            setQuery('')
            syncParams({ status: null, type: null, q: null })
          }}
        />
      ) : showProTable ? (
        <ProListingsTable items={filtered} onOpen={(id) => navigate(`/listings/${id}`)} />
      ) : viewMode === 'card' ? (
        <CardGrid
          items={filtered}
          onInquiries={(id) => navigate(`/inbox?listing=${id}`)}
        />
      ) : viewMode === 'list' ? (
        <ListView items={filtered} onOpen={(id) => navigate(`/listings/${id}`)} />
      ) : (
        <GalleryGrid items={filtered} />
      )}

      {!isDesktop && (
        <button
          type="button"
          aria-label="Add listing"
          disabled={offline}
          onClick={() => setFabOpen(true)}
          className={cn(
            'fixed z-40 inline-flex h-14 w-14 items-center justify-center rounded-full',
            'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
            'shadow-[var(--lc-elevation-lg)]',
            'bottom-[calc(88px+env(safe-area-inset-bottom)+16px)] end-4',
            'disabled:opacity-50',
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <FabActionSheet
        open={fabOpen}
        onOpenChange={setFabOpen}
        onGuided={() => navigate('/listings/new')}
        onPro={() => setCreateOpen(true)}
        onImportUrl={() =>
          addToast({
            title: 'Import coming soon',
            description: 'Portal URL import ships in a later wave.',
            variant: 'default',
          })
        }
      />

      {createOpen && (
        <ListingFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            void loadListings()
          }}
        />
      )}
    </div>
  )
}

function CardGrid({
  items,
  onInquiries,
}: {
  items: ListingCardProperty[]
  onInquiries: (id: string) => void
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6',
        'transition-opacity duration-[var(--lc-duration-slow)] ease-[var(--lc-easing-in-out)]',
      )}
    >
      {items.map((p) => (
        <ListingCard key={p.id} property={p} onInquiriesClick={onInquiries} />
      ))}
    </div>
  )
}

function ListView({
  items,
  onOpen,
}: {
  items: Property[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
      <table className="min-w-full divide-y divide-[var(--lc-border)]">
        <thead className="bg-[var(--lc-surface-sunken)] text-start text-[length:var(--lc-type-overline)] uppercase tracking-[0.08em] text-[var(--lc-text-muted)]">
          <tr>
            <th className="px-4 py-2.5">Listing</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Price</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Views</th>
            <th className="px-4 py-2.5">Listed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--lc-border)] text-[length:var(--lc-type-body-sm)]">
          {items.map((p) => {
            const photo = p.photos?.[0] || '/placeholder-property.svg'
            return (
              <tr
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="cursor-pointer hover:bg-[var(--lc-surface-sunken)]"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={photo}
                      alt=""
                      className="h-14 w-14 rounded-[var(--lc-radius-md)] object-cover"
                    />
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium text-[var(--lc-text-heading)]">
                        {p.title}
                      </div>
                      <div className="line-clamp-1 flex items-center gap-1 text-[var(--lc-text-muted)]">
                        <MapPin className="h-3 w-3" />
                        {p.location}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 capitalize text-[var(--lc-text-muted)]">
                  {p.property_type} · {p.type === 'sale' ? 'Sale' : 'Rent'}
                </td>
                <td className="px-4 py-2.5 font-medium">
                  <Numeric>{formatPrice(p.price, p.type, p.price_unit)}</Numeric>
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={normalizeStatus(p.status)} />
                </td>
                <td className="px-4 py-2.5 text-[var(--lc-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    <Numeric>{(p.views || 0).toLocaleString()}</Numeric>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[var(--lc-text-muted)]">
                  {p.listed_date ? new Date(p.listed_date).toLocaleDateString() : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GalleryGrid({ items }: { items: Property[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((p) => {
        const photo = p.photos?.[0] || '/placeholder-property.svg'
        return (
          <Link
            key={p.id}
            to={`/listings/${p.id}`}
            className="group relative aspect-square overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
          >
            <img src={photo} alt={p.title} className="h-full w-full object-cover" />
            <div className="absolute start-2 top-2">
              <StatusPill status={normalizeStatus(p.status)} compact />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-[color-mix(in_srgb,var(--lc-surface-inverse)_70%,transparent)] p-2">
              <div className="line-clamp-1 text-xs font-medium text-[var(--lc-text-inverse)]">
                {p.title}
              </div>
              <div className="line-clamp-1 text-[11px] text-[var(--lc-text-inverse)]/80">
                <Numeric>{formatPrice(p.price, p.type, p.price_unit)}</Numeric>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function EmptyState({
  hasAny,
  onCreate,
  onClearFilters,
}: {
  hasAny: boolean
  onCreate: () => void
  onClearFilters: () => void
}) {
  if (!hasAny) {
    return (
      <div
        role="status"
        className="mx-auto max-w-md rounded-[var(--lc-radius-lg)] border-2 border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-8 py-16 text-center"
      >
        <Building2 className="mx-auto mb-3 h-10 w-10 text-[var(--lc-text-muted)]" />
        <h3 className="text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-heading)]">
          Your first listing awaits
        </h3>
        <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          Add photos, price, and details — or send us a voice memo on WhatsApp and we&apos;ll draft
          it for you.
        </p>
        <Button onClick={onCreate} className="mt-4 gap-1.5">
          <Plus className="h-4 w-4" />
          Create a listing
        </Button>
        <div className="mt-3">
          <Link
            to="/agent/whatsapp-listings"
            className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
          >
            Start with WhatsApp
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div
      role="status"
      className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-8 py-12 text-center text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]"
    >
      <Filter className="mx-auto mb-2 h-5 w-5" />
      No listings match
      <p className="mt-1">Try widening your filters or clearing search.</p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-2 text-[var(--lc-text-brand)] hover:underline"
      >
        Clear filters
      </button>
    </div>
  )
}
