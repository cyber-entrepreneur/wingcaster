import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { COUNTRY_OPTIONS, countryLabel } from '@/lib/countries'
import { cn } from '@/lib/utils'

export type MarketMultiSelectProps = {
  /** Selected ISO alpha-2 country codes. */
  values: string[]
  onChange: (next: string[]) => void
  locale?: 'en' | 'ar'
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  className?: string
  /** Accessible label for the trigger (also used by the field <Label htmlFor>). */
  id?: string
  'aria-invalid'?: boolean
}

/**
 * Global market picker — a searchable dropdown of every country with a
 * checkbox on the left of each row. Select as many as apply.
 */
export function MarketMultiSelect({
  values,
  onChange,
  locale = 'en',
  disabled = false,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  className,
  id,
  'aria-invalid': ariaInvalid,
}: MarketMultiSelectProps) {
  const generatedId = useId()
  const triggerId = id ?? generatedId
  const listboxId = `${triggerId}-listbox`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    // Focus the search box when the panel opens.
    const raf = requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRY_OPTIONS
    return COUNTRY_OPTIONS.filter(
      (o) => o.label[locale].toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    )
  }, [query, locale])

  const toggle = (code: string) => {
    onChange(values.includes(code) ? values.filter((c) => c !== code) : [...values, code])
  }

  const summary =
    values.length === 0
      ? placeholder ?? 'Select markets'
      : values.length <= 3
        ? values.map((c) => countryLabel(c, locale)).join(', ')
        : `${values.length} markets selected`

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-invalid={ariaInvalid}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-tap w-full items-center justify-between gap-2 rounded-[var(--lc-radius-md)] px-3 text-start text-sm',
          'border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] text-[var(--lc-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-action-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className={cn('truncate', values.length === 0 && 'text-[var(--lc-text-muted)]')}>
          {summary}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[var(--lc-text-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {values.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {values.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] py-0.5 ps-2 pe-1 text-xs text-[var(--lc-text-primary)]"
            >
              {countryLabel(code, locale)}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${countryLabel(code, locale)}`}
                onClick={() => toggle(code)}
                className="rounded-full p-0.5 text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          className="absolute z-dropdown mt-1 w-full overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] shadow-lg"
          role="dialog"
        >
          <div className="flex items-center gap-2 border-b border-[var(--lc-border)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? 'Search countries…'}
              className="min-h-tap w-full bg-transparent text-sm text-[var(--lc-text-primary)] placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none"
              aria-label={searchPlaceholder ?? 'Search countries'}
            />
          </div>
          <ul id={listboxId} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--lc-text-muted)]">
                {emptyLabel ?? 'No countries match your search.'}
              </li>
            ) : (
              filtered.map((opt) => {
                const selected = values.includes(opt.code)
                return (
                  <li key={opt.code} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.code)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[var(--lc-radius-sm)] px-2 py-2 text-start text-sm',
                        'hover:bg-[color-mix(in_srgb,var(--lc-action-primary)_8%,var(--lc-surface-raised))]',
                        selected && 'bg-[color-mix(in_srgb,var(--lc-action-primary)_6%,var(--lc-surface-raised))]',
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        // Row button owns the click; checkbox is a visual indicator.
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none size-5 shrink-0 aspect-square"
                      />
                      <span className="flex-1 text-[var(--lc-text-primary)]">{opt.label[locale]}</span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--lc-action-primary)]" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
