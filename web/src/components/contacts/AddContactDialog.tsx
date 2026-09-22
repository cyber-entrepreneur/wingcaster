import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export type CreatedContact = { id: string; name?: string }

export type AddContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (contact: CreatedContact) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DRAFT_KEY = 'wc.addContactDraft.v1'

const SOURCE_OPTIONS = [
  'Referral',
  'Website',
  'Portal (Bayut / Property Finder)',
  'Social media',
  'Walk-in',
  'Event',
  'Cold outreach',
  'Other',
] as const

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const

type Priority = (typeof PRIORITIES)[number]['value']

type ListingLite = { id: string; title: string; location?: string; agent_id?: string }

type DraftShape = {
  firstName: string
  lastName: string
  email: string
  phone: string
  listingId: string
  listingLabel: string
  source: string
  note: string
  priority: Priority
  dealProbability: number
}

const EMPTY_DRAFT: DraftShape = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  listingId: '',
  listingLabel: '',
  source: '',
  note: '',
  priority: 'medium',
  dealProbability: 50,
}

function readDraft(): DraftShape | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<DraftShape>) } : null
  } catch {
    return null
  }
}

/** Compact searchable single-select for the agent's listings. */
function ListingPicker({
  listings,
  valueId,
  valueLabel,
  onSelect,
  disabled,
}: {
  listings: ListingLite[]
  valueId: string
  valueLabel: string
  onSelect: (id: string, label: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return listings.slice(0, 50)
    return listings
      .filter((l) => `${l.title} ${l.location ?? ''}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [query, listings])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-tap w-full items-center justify-between gap-2 rounded-[var(--lc-radius-md)] px-3 text-start text-sm',
          'border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] text-[var(--lc-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-action-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className={cn('truncate', !valueId && 'text-[var(--lc-text-muted)]')}>
          {valueId ? valueLabel : 'Select a listing…'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-dropdown mt-1 w-full overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--lc-border)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your listings…"
              aria-label="Search listings"
              className="min-h-tap w-full bg-transparent text-sm text-[var(--lc-text-primary)] placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {valueId ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSelect('', '')
                    setOpen(false)
                  }}
                  className="w-full rounded-[var(--lc-radius-sm)] px-2 py-2 text-start text-sm text-[var(--lc-text-muted)] hover:bg-[var(--lc-surface-sunken)]"
                >
                  Clear selection
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--lc-text-muted)]">No listings match.</li>
            ) : (
              filtered.map((l) => {
                const label = l.location ? `${l.title} — ${l.location}` : l.title
                const selected = l.id === valueId
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(l.id, label)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[var(--lc-radius-sm)] px-2 py-2 text-start text-sm',
                        'hover:bg-[color-mix(in_srgb,var(--lc-action-primary)_8%,var(--lc-surface-raised))]',
                      )}
                    >
                      <span className="flex-1 text-[var(--lc-text-primary)]">{label}</span>
                      {selected ? (
                        <Check className="h-4 w-4 text-[var(--lc-action-primary)]" aria-hidden />
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

/**
 * Shallow "Add contact" form — quick capture with an escape hatch to the full
 * CRM form. Creates a contact via POST /api/contacts.
 */
export function AddContactDialog({ open, onOpenChange, onCreated }: AddContactDialogProps) {
  const { addToast } = useToast()
  const { agent } = useAuth()
  const navigate = useNavigate()

  const [d, setD] = useState<DraftShape>({ ...EMPTY_DRAFT })
  const [listings, setListings] = useState<ListingLite[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  const set = (partial: Partial<DraftShape>) => setD((prev) => ({ ...prev, ...partial }))

  // On open: restore a saved draft (if any) and load the agent's listings.
  useEffect(() => {
    if (!open) return
    const draft = readDraft()
    if (draft) {
      setD(draft)
      setDraftRestored(true)
    }
    let cancelled = false
    api
      .getProperties({})
      .then((rows) => {
        if (cancelled) return
        const list = (Array.isArray(rows) ? rows : []) as ListingLite[]
        const mine = agent?.id ? list.filter((l) => !l.agent_id || l.agent_id === agent.id) : list
        setListings(mine)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, agent?.id])

  const dirty = useMemo(
    () => JSON.stringify(d) !== JSON.stringify(EMPTY_DRAFT),
    [d],
  )
  const emailValid = !d.email || EMAIL_RE.test(d.email.trim())
  const hasIdentity =
    d.firstName.trim() || d.lastName.trim() || d.email.trim() || d.phone.trim()
  const canSubmit = Boolean(hasIdentity) && emailValid && !submitting

  const resetAll = () => {
    setD({ ...EMPTY_DRAFT })
    setError(null)
    setConfirmingCancel(false)
    setDraftRestored(false)
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    } catch {
      /* ignore */
    }
  }

  const requestClose = () => {
    if (dirty) {
      setConfirmingCancel(true)
      return
    }
    onOpenChange(false)
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const created = (await api.createContact({
        first_name: d.firstName.trim(),
        last_name: d.lastName.trim(),
        email: d.email.trim(),
        phone: d.phone.trim(),
        source: d.source || 'manual',
        interested_listing_id: d.listingId || undefined,
        priority: d.priority,
        deal_probability: d.dealProbability,
        note: d.note.trim() || undefined,
      })) as CreatedContact
      addToast({ description: `Contact ${created.name || 'saved'}.`, duration: 4000 })
      clearDraft()
      resetAll()
      onOpenChange(false)
      onCreated?.(created)
    } catch {
      setError("We couldn't save that contact. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const goToFullForm = () => {
    saveDraft() // hand the captured details to the full form
    onOpenChange(false)
    navigate('/contacts/new/full')
  }

  const fieldGap = 'flex flex-col gap-1.5'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Quick capture. You can jump to the full form for the complete record.
          </DialogDescription>
        </DialogHeader>

        {draftRestored ? (
          <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-xs text-[var(--lc-text-muted)]">
            Draft restored.{' '}
            <button
              type="button"
              className="font-medium text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
              onClick={() => {
                clearDraft()
                resetAll()
              }}
            >
              Start fresh
            </button>
          </div>
        ) : null}

        <form
          className="mt-[var(--lc-space-sm)] flex flex-col gap-[var(--lc-space-md)]"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          noValidate
        >
          <div className="grid gap-[var(--lc-space-md)] sm:grid-cols-2">
            <div className={fieldGap}>
              <Label htmlFor="ac-first">First name</Label>
              <Input
                id="ac-first"
                autoFocus
                autoComplete="given-name"
                value={d.firstName}
                disabled={submitting}
                onChange={(e) => set({ firstName: e.target.value })}
              />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="ac-last">Last name</Label>
              <Input
                id="ac-last"
                autoComplete="family-name"
                value={d.lastName}
                disabled={submitting}
                onChange={(e) => set({ lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-[var(--lc-space-md)] sm:grid-cols-2">
            <div className={fieldGap}>
              <Label htmlFor="ac-email">Email</Label>
              <Input
                id="ac-email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                placeholder="you@example.com"
                value={d.email}
                disabled={submitting}
                aria-invalid={!emailValid}
                onChange={(e) => set({ email: e.target.value })}
              />
              {!emailValid ? (
                <p className="text-xs text-[var(--lc-status-unpublished-fg)]" role="alert">
                  Enter a valid email address.
                </p>
              ) : null}
            </div>
            <div className={fieldGap}>
              <Label htmlFor="ac-phone">Phone</Label>
              <Input
                id="ac-phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                placeholder="+971 5X XXX XXXX"
                value={d.phone}
                disabled={submitting}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
          </div>

          <div className={fieldGap}>
            <Label>Listing interested in</Label>
            <ListingPicker
              listings={listings}
              valueId={d.listingId}
              valueLabel={d.listingLabel}
              disabled={submitting}
              onSelect={(id, label) => set({ listingId: id, listingLabel: label })}
            />
          </div>

          <div className={fieldGap}>
            <Label htmlFor="ac-source">Referred by / sourced from</Label>
            <select
              id="ac-source"
              value={d.source}
              disabled={submitting}
              onChange={(e) => set({ source: e.target.value })}
              className="flex h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none disabled:opacity-50"
            >
              <option value="">Select a source…</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldGap}>
            <Label htmlFor="ac-note">Add a note</Label>
            <textarea
              id="ac-note"
              rows={3}
              value={d.note}
              disabled={submitting}
              placeholder="Context, what they're looking for, next steps…"
              onChange={(e) => set({ note: e.target.value })}
              className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-action-primary)] disabled:opacity-50"
            />
            <p className="text-xs text-[var(--lc-text-muted)]">Voice notes are available in the full form.</p>
          </div>

          <div className="grid gap-[var(--lc-space-md)] sm:grid-cols-2">
            <div className={fieldGap}>
              <span className="text-sm font-medium text-[var(--lc-text-primary)]">Priority</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => {
                  const active = d.priority === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={submitting}
                      onClick={() => set({ priority: p.value })}
                      className={cn(
                        'min-h-tap flex-1 rounded-[var(--lc-radius-md)] px-2 text-sm',
                        active
                          ? 'border-2 border-[var(--lc-action-primary)] text-[var(--lc-text-heading)]'
                          : 'border border-[var(--lc-border-strong)] text-[var(--lc-text-primary)]',
                      )}
                      style={
                        active
                          ? { background: 'color-mix(in srgb, var(--lc-action-primary) 8%, var(--lc-surface-raised))' }
                          : undefined
                      }
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="ac-prob">Deal probability — {d.dealProbability}%</Label>
              <input
                id="ac-prob"
                type="range"
                min={0}
                max={100}
                step={5}
                value={d.dealProbability}
                disabled={submitting}
                onChange={(e) => set({ dealProbability: Number(e.target.value) })}
                className="h-tap w-full accent-[var(--lc-action-primary)]"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[var(--lc-status-unpublished-fg)]" role="alert">
              {error}
            </p>
          ) : null}

          {confirmingCancel ? (
            <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
              <p className="text-sm text-[var(--lc-text-primary)]">
                You have unsaved details. Save them as a draft?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    saveDraft()
                    setConfirmingCancel(false)
                    onOpenChange(false)
                    addToast({ description: 'Draft saved.', duration: 3000 })
                  }}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearDraft()
                    resetAll()
                    onOpenChange(false)
                  }}
                >
                  Discard
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
                  Keep editing
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" disabled={submitting} onClick={goToFullForm}>
                Go to full form →
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={submitting} onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {submitting ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
