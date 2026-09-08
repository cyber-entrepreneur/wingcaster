import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { searchMyListings, type ListingSuggestion } from './PortalTrackerScreen/api'
import {
  DEFAULT_PORTAL_OPTIONS,
  TRACKER_STATUS_OPTIONS,
  filtersAreActive,
  type TrackerFilters,
} from './PortalTrackerScreen/types'

export type TrackerFilterBarProps = {
  filters: TrackerFilters
  onChange: (next: TrackerFilters) => void
  onClear: () => void
  disabled?: boolean
  portalOptions?: { value: string; label: string }[]
  className?: string
}

function MultiSelectChip({
  label,
  selected,
  options,
  disabled,
  onToggle,
  onClear,
}: {
  label: string
  selected: string[]
  options: { value: string; label: string }[]
  disabled?: boolean
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = selected.length > 0
  const chipLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || selected[0]
        : `${label} (${selected.length})`

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex min-h-tap items-center gap-1 rounded-[var(--lc-radius-pill)] border px-3',
          'text-xs font-semibold transition-colors duration-fast ease-out motion-reduce:transition-none',
          active
            ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)] text-[var(--lc-text-primary)]'
            : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
        )}
      >
        <Badge variant="outline" className="border-0 bg-transparent p-0 text-xs font-semibold">
          {chipLabel}
        </Badge>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label} filter`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--lc-action-secondary)]"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onClear()
              }
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--lc-text-muted)]" aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`${label} options`}
          className={cn(
            'absolute start-0 z-20 mt-1 min-w-[200px] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] p-2 shadow-[var(--lc-elevation-md)]',
          )}
        >
          <ul className="max-h-60 overflow-y-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt.value)
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full min-h-tap items-center gap-2 rounded-[var(--lc-radius-md)] px-2 text-start text-sm',
                      'hover:bg-[var(--lc-action-secondary)]',
                    )}
                    onClick={() => onToggle(opt.value)}
                  >
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 items-center justify-center rounded-[var(--lc-radius-sm)] border',
                        checked
                          ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                          : 'border-[var(--lc-border-strong)]',
                      )}
                      aria-hidden="true"
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Sticky filter bar — status / portal / listing / date + clear.
 */
export function TrackerFilterBar({
  filters,
  onChange,
  onClear,
  disabled = false,
  portalOptions = DEFAULT_PORTAL_OPTIONS,
  className,
}: TrackerFilterBarProps) {
  const listingId = useId()
  const [listingQuery, setListingQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ListingSuggestion[]>([])
  const [listingOpen, setListingOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!listingQuery.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      void searchMyListings(listingQuery).then(setSuggestions)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [listingQuery])

  const active = filtersAreActive(filters)

  const toggleStatus = (value: string) => {
    const v = value as TrackerFilters['status'][number]
    const next = filters.status.includes(v)
      ? filters.status.filter((s) => s !== v)
      : [...filters.status, v]
    onChange({ ...filters, status: next })
  }

  const togglePortal = (value: string) => {
    const next = filters.portal.includes(value)
      ? filters.portal.filter((p) => p !== value)
      : [...filters.portal, value]
    onChange({ ...filters, portal: next })
  }

  return (
    <div
      role="toolbar"
      aria-label="Filter portal submissions"
      className={cn(
        'sticky top-0 z-10 flex flex-wrap items-center gap-[var(--lc-space-xs)]',
        'border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        'px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        'overflow-x-auto md:overflow-visible',
        className,
      )}
    >
      <MultiSelectChip
        label="Status"
        selected={filters.status}
        options={TRACKER_STATUS_OPTIONS}
        disabled={disabled}
        onToggle={toggleStatus}
        onClear={() => onChange({ ...filters, status: [] })}
      />
      <MultiSelectChip
        label="Portal"
        selected={filters.portal}
        options={portalOptions}
        disabled={disabled}
        onToggle={togglePortal}
        onClear={() => onChange({ ...filters, portal: [] })}
      />

      <div className="relative min-w-[160px] flex-1 md:max-w-xs">
        <label htmlFor={listingId} className="sr-only">
          Search listings
        </label>
        <Input
          id={listingId}
          disabled={disabled}
          placeholder="Search listings…"
          value={filters.listingLabel || listingQuery}
          onChange={(e) => {
            setListingQuery(e.target.value)
            setListingOpen(true)
            if (filters.listingId) {
              onChange({ ...filters, listingId: null, listingLabel: null })
            }
          }}
          onFocus={() => setListingOpen(true)}
          className="border-[var(--lc-border-strong)]"
        />
        {listingOpen && suggestions.length > 0 ? (
          <ul
            className={cn(
              'absolute start-0 z-20 mt-1 w-full rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
              'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-md)]',
            )}
            role="listbox"
          >
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full min-h-tap px-3 text-start text-sm hover:bg-[var(--lc-action-secondary)]"
                  onClick={() => {
                    onChange({ ...filters, listingId: s.id, listingLabel: s.label })
                    setListingQuery('')
                    setSuggestions([])
                    setListingOpen(false)
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <label className="sr-only" htmlFor="tracker-from">
          From date
        </label>
        <Input
          id="tracker-from"
          type="date"
          disabled={disabled}
          value={filters.from?.slice(0, 10) || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              from: e.target.value || null,
            })
          }
          aria-label="Date from"
          className="w-[140px] border-[var(--lc-border-strong)]"
        />
        <label className="sr-only" htmlFor="tracker-to">
          To date
        </label>
        <Input
          id="tracker-to"
          type="date"
          disabled={disabled}
          value={filters.to?.slice(0, 10) || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              to: e.target.value || null,
            })
          }
          aria-label="Date to"
          className="w-[140px] border-[var(--lc-border-strong)]"
        />
      </div>

      {active ? (
        <Button
          type="button"
          variant="link"
          disabled={disabled}
          onClick={onClear}
          className="ms-auto shrink-0"
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
