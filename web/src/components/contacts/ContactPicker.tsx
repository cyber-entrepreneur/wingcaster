import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, User, X } from 'lucide-react'
import { api } from '@/api/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

type ContactOption = { id: string; name?: string; email?: string; phone?: string }

export type ContactPickerProps = {
  /** Selected contact id (empty string when none). */
  value: string
  /** Display name of the current selection, shown on the chip. */
  displayName?: string
  /** Called with the chosen id + its display name (both '' when cleared). */
  onChange: (id: string, name: string) => void
  /** A contact id to hide from results (e.g. the record being edited — no self-reference). */
  excludeId?: string
  inputId?: string
  placeholder?: string
}

/**
 * Searchable single-contact picker. Reuses the search-as-you-type pattern from
 * AddOpportunityDialog: debounced `GET /api/contacts?q=` (already tenant-scoped),
 * a results list, and a selected chip with clear. Used for "Reports To".
 */
export function ContactPicker({
  value,
  displayName,
  onChange,
  excludeId,
  inputId,
  placeholder = 'Search contacts by name, email, or phone',
}: ContactPickerProps) {
  const { addToast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContactOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const rows = await api.getContacts(q.trim() ? { q: q.trim() } : undefined)
      setResults(Array.isArray(rows) ? (rows as ContactOption[]) : [])
    } catch (error) {
      addToast({
        title: 'Could not load contacts',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (!open) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(query), 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, open, load])

  const visible = useMemo(
    () => results.filter((r) => r.id !== excludeId).slice(0, 8),
    [results, excludeId],
  )

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-[var(--lc-text-primary)]">
            {displayName || 'Selected contact'}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange('', '')
            setQuery('')
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" /> Clear
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]" aria-hidden="true" />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (!open) {
              setOpen(true)
              void load('')
            }
          }}
          placeholder={placeholder}
          className="ps-9"
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--lc-border)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--lc-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading contacts…
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-[var(--lc-text-muted)]">No contacts match your search.</p>
          ) : (
            visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id, c.name || c.email || c.phone || 'Contact')
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2 border-b border-[var(--lc-border)] px-3 py-2.5 text-start last:border-b-0 hover:bg-[var(--lc-action-secondary)]"
              >
                <User className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--lc-text-primary)]">{c.name || 'Unnamed contact'}</p>
                  <p className="truncate text-xs text-[var(--lc-text-muted)]">{c.email || c.phone || 'No contact method'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
