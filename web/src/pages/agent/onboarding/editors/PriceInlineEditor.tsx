import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { t, type OnboardingLocale } from '../copy'

const CURRENCIES = ['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'USD'] as const

/** Integer minor units (fils/cents) — avoids float drift on save. */
export function majorToMinor(major: number): number {
  if (!Number.isFinite(major)) return 0
  return Math.round(major * 100)
}

export function minorToMajor(minor: number): number {
  return minor / 100
}

export function parseMajorInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export interface PriceInlineEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Major-unit price currently on the draft (may be float historically). */
  price: number | null
  currency: string
  locale: OnboardingLocale
  disabled?: boolean
  onSave: (payload: { price: number; price_cents: number; currency: string }) => Promise<void>
}

export function PriceInlineEditor({
  open,
  onOpenChange,
  price,
  currency,
  locale,
  disabled,
  onSave,
}: PriceInlineEditorProps) {
  const initialMinor = useMemo(() => majorToMinor(price ?? 0), [price])
  const [amount, setAmount] = useState(() => (price != null ? String(minorToMajor(initialMinor)) : ''))
  const [cur, setCur] = useState(currency || 'AED')
  const [busy, setBusy] = useState(false)

  const syncOpen = (next: boolean) => {
    if (next) {
      setAmount(price != null ? String(minorToMajor(majorToMinor(price))) : '')
      setCur(currency || 'AED')
    }
    onOpenChange(next)
  }

  const handleSave = async () => {
    const major = parseMajorInput(amount)
    if (major == null) return
    const price_cents = majorToMinor(major)
    setBusy(true)
    try {
      await onSave({ price: minorToMajor(price_cents), price_cents, currency: cur })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={syncOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('review.edit.price', locale)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--lc-space-md)]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-price-amount">{t('review.price.amount', locale)}</Label>
            <Input
              id="onb-price-amount"
              inputMode="decimal"
              className="min-h-tap font-[family-name:var(--lc-font-mono)]"
              value={amount}
              disabled={busy || disabled}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-price-currency">{t('review.price.currency', locale)}</Label>
            <select
              id="onb-price-currency"
              className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-[var(--lc-text-primary)]"
              value={cur}
              disabled={busy || disabled}
              onChange={(e) => setCur(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('review.edit.cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy || disabled || parseMajorInput(amount) == null}>
            {t('review.edit.save', locale)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
