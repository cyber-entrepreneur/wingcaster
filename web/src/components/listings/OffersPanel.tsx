import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, HandCoins, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { api, type BuyerOffer, type BuyerOfferInput, type BuyerOfferStatus } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OffersComparisonChart } from './OffersComparisonChart'

interface ContactOption {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

const STATUS_LABELS: Record<BuyerOfferStatus, string> = {
  received: 'Received',
  countered: 'Countered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const STATUS_ORDER: BuyerOfferStatus[] = ['received', 'countered', 'accepted', 'rejected', 'withdrawn']

function statusClasses(status: BuyerOfferStatus): string {
  switch (status) {
    case 'accepted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'rejected':
    case 'withdrawn':
      return 'border-slate-200 bg-slate-50 text-slate-600'
    case 'countered':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

interface OffersPanelProps {
  propertyId: string
  currency?: string
  /** Asking price of this listing — drawn as a reference line on the chart. */
  asking?: number | null
  /** Benchmark = median of similar SOLD comparables (from pricing analysis). */
  benchmark?: number | null
  /** Average asking = mean of comparable listings (from pricing analysis). */
  avgAsking?: number | null
  /** This property's last recorded sale price, when known. */
  lastSale?: number | null
  /** Fired when an offer is set to `accepted` — parent prompts the closure flow (AGT-HTX-002). */
  onOfferAccepted?: (offer: BuyerOffer) => void
}

/**
 * AGT-LST-010 — Buyer offers on a listing.
 *
 * Rendered inside the Overview tab of the listing profile. Lists offers,
 * lets the agent record/edit/withdraw, and inline-advances status. When an
 * offer becomes `accepted`, `onOfferAccepted` fires so the parent can prompt
 * the agent to close the listing (acceptance and closure are deliberately
 * separate — an accepted offer can still fall through).
 */
export function OffersPanel({
  propertyId,
  currency = 'USD',
  asking,
  benchmark,
  avgAsking,
  lastSale,
  onOfferAccepted,
}: OffersPanelProps) {
  const { addToast } = useToast()
  const [offers, setOffers] = useState<BuyerOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BuyerOffer | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.listBuyerOffers(propertyId)
      setOffers(res.offers)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = useCallback(
    async (offer: BuyerOffer, status: BuyerOfferStatus) => {
      if (status === offer.status) return
      setBusyId(offer.id)
      try {
        const updated = await api.updateBuyerOffer(offer.id, { status })
        setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
        if (status === 'accepted') onOfferAccepted?.(updated)
      } catch {
        addToast({ title: 'Could not update the offer', variant: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [addToast, onOfferAccepted],
  )

  const remove = useCallback(
    async (offer: BuyerOffer) => {
      setBusyId(offer.id)
      try {
        await api.deleteBuyerOffer(offer.id)
        setOffers((prev) => prev.filter((o) => o.id !== offer.id))
      } catch {
        addToast({ title: 'Could not remove the offer', variant: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [addToast],
  )

  const summary = useMemo(() => {
    const live = offers.filter((o) => o.status === 'received' || o.status === 'countered')
    if (live.length === 0) return null
    const top = Math.max(...live.map((o) => o.amount))
    return { count: live.length, top }
  }, [offers])

  return (
    <Card data-testid="offers-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-[var(--lc-action-primary)]" />
          <CardTitle className="text-lg">Offers</CardTitle>
          {summary ? (
            <span className="text-xs text-muted-foreground">
              {summary.count} live · top {formatMoney(summary.top, currency)}
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Record offer
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading offers…
          </div>
        ) : error ? (
          <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>Couldn't load offers.</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : offers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No offers recorded yet. Log the first one when a buyer makes an offer.
          </p>
        ) : (
          <>
            {offers.filter((o) => o.amount > 0).length >= 1 ? (
              <div className="mb-4 overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
                <OffersComparisonChart
                  offers={offers}
                  currency={currency}
                  asking={asking}
                  benchmark={benchmark}
                  avgAsking={avgAsking}
                  lastSale={lastSale}
                />
              </div>
            ) : null}
            <ul className="divide-y">
              {offers.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{offer.offeror_name}</span>
                    <Badge variant="outline" className={statusClasses(offer.status)}>
                      {STATUS_LABELS[offer.status]}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {formatMoney(offer.amount, offer.currency)} · {offer.offer_date}
                    {offer.terms ? <> · {offer.terms}</> : null}
                  </div>
                  {offer.notes ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{offer.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="sr-only" htmlFor={`offer-status-${offer.id}`}>
                    Offer status
                  </label>
                  <select
                    id={`offer-status-${offer.id}`}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
                    value={offer.status}
                    disabled={busyId === offer.id}
                    onChange={(e) => void changeStatus(offer, e.target.value as BuyerOfferStatus)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit offer from ${offer.offeror_name}`}
                    disabled={busyId === offer.id}
                    onClick={() => {
                      setEditing(offer)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove offer from ${offer.offeror_name}`}
                    disabled={busyId === offer.id}
                    onClick={() => void remove(offer)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
            </ul>
          </>
        )}
      </CardContent>

      {formOpen ? (
        <OfferFormModal
          propertyId={propertyId}
          defaultCurrency={currency}
          existing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(saved, wasAccepted) => {
            setOffers((prev) => {
              const idx = prev.findIndex((o) => o.id === saved.id)
              if (idx === -1) return [saved, ...prev]
              const next = [...prev]
              next[idx] = saved
              return next
            })
            setFormOpen(false)
            if (wasAccepted) onOfferAccepted?.(saved)
          }}
        />
      ) : null}
    </Card>
  )
}

interface OfferFormModalProps {
  propertyId: string
  defaultCurrency: string
  existing: BuyerOffer | null
  onClose: () => void
  onSaved: (offer: BuyerOffer, wasAccepted: boolean) => void
}

function OfferFormModal({ propertyId, defaultCurrency, existing, onClose, onSaved }: OfferFormModalProps) {
  const { addToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    contact_id: existing?.contact_id ?? (null as string | null),
    offeror_name: existing?.offeror_name ?? '',
    amount: existing?.amount != null ? String(existing.amount) : '',
    currency: existing?.currency ?? defaultCurrency,
    offer_date: existing?.offer_date ?? new Date().toISOString().split('T')[0],
    terms: existing?.terms ?? '',
    status: existing?.status ?? ('received' as BuyerOfferStatus),
    notes: existing?.notes ?? '',
  })

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // CRM contact picker — the agent can link a buyer from their contacts, or
  // type a free-text offeror name. Linking sets contact_id + snapshots the name.
  const [contactQuery, setContactQuery] = useState('')
  const [contactResults, setContactResults] = useState<ContactOption[]>([])
  const [contactOpen, setContactOpen] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!contactOpen) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setContactLoading(true)
      try {
        const rows = await api.getContacts(contactQuery.trim() ? { q: contactQuery.trim() } : undefined)
        const list = Array.isArray(rows)
          ? rows
          : ((rows as { contacts?: unknown[] })?.contacts ?? [])
        setContactResults((list as ContactOption[]).slice(0, 8))
      } catch {
        setContactResults([])
      } finally {
        setContactLoading(false)
      }
    }, 250)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [contactQuery, contactOpen])

  const pickContact = (c: ContactOption) => {
    setForm((f) => ({ ...f, contact_id: c.id, offeror_name: c.name }))
    setContactOpen(false)
    setContactQuery('')
  }

  const amountNum = Number(form.amount)
  const valid = form.offeror_name.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0

  const submit = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const payload: BuyerOfferInput = {
        contact_id: form.contact_id,
        offeror_name: form.offeror_name.trim(),
        amount: amountNum,
        currency: form.currency.trim() || defaultCurrency,
        offer_date: form.offer_date,
        terms: form.terms.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }
      const saved = existing
        ? await api.updateBuyerOffer(existing.id, payload)
        : await api.createBuyerOffer(propertyId, payload)
      const wasAccepted = saved.status === 'accepted' && existing?.status !== 'accepted'
      onSaved(saved, wasAccepted)
    } catch {
      addToast({ title: existing ? 'Could not update the offer' : 'Could not record the offer', variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={existing ? 'Edit offer' : 'Record offer'}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-lg bg-[var(--lc-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{existing ? 'Edit offer' : 'Record offer'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {/* CRM buyer picker */}
          <div className="block">
            <Label className="text-xs">Buyer (from your contacts)</Label>
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]" />
                <Input
                  className="ps-8"
                  value={contactOpen ? contactQuery : ''}
                  placeholder={form.contact_id ? 'Linked — search to change' : 'Search contacts…'}
                  onFocus={() => setContactOpen(true)}
                  onChange={(e) => {
                    setContactQuery(e.target.value)
                    setContactOpen(true)
                  }}
                />
              </div>
              {contactOpen ? (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-md)]">
                  {contactLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--lc-text-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  ) : contactResults.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--lc-text-muted)]">
                      No contacts found — type the offeror name below instead.
                    </div>
                  ) : (
                    contactResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--lc-surface-sunken)]"
                        onClick={() => pickContact(c)}
                      >
                        <span className="truncate font-medium text-[var(--lc-text-primary)]">{c.name}</span>
                        <span className="truncate text-xs text-[var(--lc-text-muted)]">{c.email || c.phone || ''}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <label className="block">
            <Label className="text-xs">Offeror name *</Label>
            <div className="relative">
              <Input
                value={form.offeror_name}
                onChange={(e) => setField('offeror_name', e.target.value)}
                placeholder="Buyer or their agent"
                maxLength={200}
              />
              {form.contact_id ? (
                <span className="absolute end-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--lc-text-muted)]">
                  <Check className="h-3 w-3" /> linked
                  <button
                    type="button"
                    aria-label="Unlink contact"
                    className="ms-0.5"
                    onClick={() => setField('contact_id', null)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
            </div>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <Label className="text-xs">Amount *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder="e.g. 475000"
                min={1}
              />
            </label>
            <label className="block">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={(e) => setField('currency', e.target.value)} maxLength={5} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <Label className="text-xs">Offer date</Label>
              <Input type="date" value={form.offer_date} onChange={(e) => setField('offer_date', e.target.value)} />
            </label>
            <label className="block">
              <Label className="text-xs">Status</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setField('status', e.target.value as BuyerOfferStatus)}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <Label className="text-xs">Terms</Label>
            <Input
              value={form.terms}
              onChange={(e) => setField('terms', e.target.value)}
              placeholder="Financing, closing date, contingencies…"
              maxLength={4000}
            />
          </label>
          <label className="block">
            <Label className="text-xs">Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              maxLength={4000}
            />
          </label>
          {form.status === 'accepted' ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Accepting an offer will prompt you to record the closed transaction.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {existing ? 'Save changes' : 'Record offer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
