import { useCallback, useEffect, useMemo, useState } from 'react'
import { HandCoins, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type BuyerOffer, type BuyerOfferInput, type BuyerOfferStatus } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
export function OffersPanel({ propertyId, currency = 'USD', onOfferAccepted }: OffersPanelProps) {
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

  const amountNum = Number(form.amount)
  const valid = form.offeror_name.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0

  const submit = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const payload: BuyerOfferInput = {
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
          <label className="block">
            <Label className="text-xs">Offeror name *</Label>
            <Input
              value={form.offeror_name}
              onChange={(e) => setField('offeror_name', e.target.value)}
              placeholder="Buyer or their agent"
              maxLength={200}
            />
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
