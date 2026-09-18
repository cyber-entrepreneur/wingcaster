import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import type {
  BulkAdjustmentPreview,
  BulkAdjustmentStrategy,
  BulkPriceAdjustment,
} from '@/types/marketPricing'

export interface BulkPriceAdjustSelection {
  id: string
  title: string
  price?: number
  currency?: string
  agent_name?: string
}

export interface BulkPriceAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selection: BulkPriceAdjustSelection[]
  onApplied: (batch: BulkPriceAdjustment) => void
}

const STRATEGY_OPTIONS: { value: BulkAdjustmentStrategy; label: string }[] = [
  { value: 'percent_down', label: 'Reduce by percentage' },
  { value: 'percent_up', label: 'Increase by percentage' },
  { value: 'fixed_delta', label: 'Apply a fixed amount' },
  { value: 'set_to_median', label: 'Set to comparables median' },
]

const WINDOW_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 4, label: '4 hours' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
]

const SKIP_REASONS: Record<string, string> = {
  no_change: 'No change',
  no_median: 'No comparables median',
  no_current_price: 'No current price',
  invalid_percent: 'Percentage required',
  invalid_delta: 'Amount required',
  non_positive_result: 'Result would be ≤ 0',
}

function formatMoney(value?: number | null, currency = 'USD') {
  if (value == null || !Number.isFinite(Number(value))) return 'N/A'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(Number(value))
  } catch {
    return `${Number(value).toLocaleString()} ${currency}`
  }
}

export function BulkPriceAdjustDialog({ open, onOpenChange, selection, onApplied }: BulkPriceAdjustDialogProps) {
  const { addToast } = useToast()
  const [step, setStep] = useState<'configure' | 'review'>('configure')
  const [strategy, setStrategy] = useState<BulkAdjustmentStrategy>('percent_down')
  const [percent, setPercent] = useState('5')
  const [delta, setDelta] = useState('-10000')
  const [windowHours, setWindowHours] = useState(24)
  const [typed, setTyped] = useState('')
  const [preview, setPreview] = useState<BulkAdjustmentPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep('configure')
      setPreview(null)
      setTyped('')
      setLoading(false)
      setSubmitting(false)
    }
  }, [open])

  const selectionCurrency = selection[0]?.currency || 'USD'
  const selectionTotal = useMemo(
    () => selection.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [selection],
  )

  const needsPercent = strategy === 'percent_up' || strategy === 'percent_down'
  const needsDelta = strategy === 'fixed_delta'

  const payload = useMemo(() => ({
    property_ids: selection.map((item) => item.id),
    strategy,
    ...(needsPercent ? { percent: Number(percent) } : {}),
    ...(needsDelta ? { delta: Number(delta) } : {}),
  }), [selection, strategy, needsPercent, needsDelta, percent, delta])

  async function handlePreview() {
    setLoading(true)
    try {
      const result = await api.previewBulkPriceAdjustment(payload)
      setPreview(result)
      setTyped('')
      setStep('review')
    } catch (err) {
      addToast({ title: 'Preview failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    if (!preview) return
    setSubmitting(true)
    try {
      const { batch } = await api.applyBulkPriceAdjustment({
        ...payload,
        reversal_window_hours: windowHours,
        confirm_phrase: preview.confirm_phrase || '',
      })
      addToast({
        title: 'Prices adjusted',
        description: `${batch.listing_count} listing${batch.listing_count === 1 ? '' : 's'} updated. Undo available during the reversal window.`,
        variant: 'success',
      })
      onApplied(batch)
      onOpenChange(false)
    } catch (err) {
      const error = err as Error & { code?: string }
      addToast({
        title: error.code === 'REQUIRES_SECOND_APPROVAL' ? 'Blocked by safety limits' : 'Adjustment failed',
        description: error.message,
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const changing = preview?.summary.changing_count ?? 0
  const exceedsCap = preview?.safety.exceeds_cap ?? false
  const confirmPhrase = preview?.confirm_phrase || ''
  const phraseMatches = typed.trim() === confirmPhrase && confirmPhrase.length > 0
  const canApply = !!preview && changing > 0 && !exceedsCap && phraseMatches && !submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="bulk-price-adjust-dialog">
        <DialogHeader>
          <DialogTitle>Bulk price adjustment</DialogTitle>
          <DialogDescription>
            {step === 'configure'
              ? 'Choose how to adjust the selected listings. You will review every change before anything is applied.'
              : 'Review each affected listing, then confirm. Changes can be undone during the reversal window.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="space-y-5 py-1">
            <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4">
              <p className="text-sm text-[var(--lc-text-muted)]">Selected listings</p>
              <p className="mt-1 flex items-baseline gap-2">
                <Numeric className="text-2xl font-bold">{selection.length}</Numeric>
                <span className="text-sm text-[var(--lc-text-muted)]">
                  · total list value <Numeric>{formatMoney(selectionTotal, selectionCurrency)}</Numeric>
                </span>
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bulk-strategy">Adjustment strategy</Label>
              <select
                id="bulk-strategy"
                className="h-10 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as BulkAdjustmentStrategy)}
              >
                {STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {needsPercent && (
              <div className="grid gap-2">
                <Label htmlFor="bulk-percent">Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bulk-percent"
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={percent}
                    onChange={(event) => setPercent(event.target.value)}
                    className="max-w-[8rem]"
                  />
                  <span className="text-sm text-[var(--lc-text-muted)]">%</span>
                </div>
              </div>
            )}

            {needsDelta && (
              <div className="grid gap-2">
                <Label htmlFor="bulk-delta">Amount to add (negative to reduce)</Label>
                <Input
                  id="bulk-delta"
                  type="number"
                  inputMode="numeric"
                  value={delta}
                  onChange={(event) => setDelta(event.target.value)}
                  className="max-w-[12rem]"
                />
              </div>
            )}

            {strategy === 'set_to_median' && (
              <p className="text-sm text-[var(--lc-text-muted)]">
                Listings without a comparables median are skipped automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {preview && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryStat label="Changing" value={preview.summary.changing_count} />
                  <SummaryStat label="Skipped" value={preview.summary.skipped_count} />
                  <SummaryStat label="Before" value={formatMoney(preview.summary.total_value_before, selectionCurrency)} />
                  <SummaryStat label="After" value={formatMoney(preview.summary.total_value_after, selectionCurrency)} />
                </div>

                {exceedsCap && (
                  <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <p>
                      This batch exceeds the safety limits ({preview.safety.max_listings} listings or{' '}
                      {preview.safety.max_aggregate_change_percent}% aggregate change) and needs a second approver.
                      Reduce the selection or the adjustment to continue.
                    </p>
                  </div>
                )}

                {changing === 0 && !exceedsCap && (
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p>No listings would change under this strategy. Adjust the settings and preview again.</p>
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--lc-border)]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[var(--lc-surface-sunken)] text-start text-xs text-[var(--lc-text-muted)]">
                      <tr>
                        <th className="p-2 text-start font-medium">Listing</th>
                        <th className="p-2 text-end font-medium">Current</th>
                        <th className="p-2 text-end font-medium">New</th>
                        <th className="p-2 text-end font-medium">Δ%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => (
                        <tr key={item.property_id} className="border-t border-[var(--lc-border)]">
                          <td className="p-2">
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="text-xs text-[var(--lc-text-muted)]">{item.agent_name || 'Unassigned'}</span>
                          </td>
                          <td className="p-2 text-end"><Numeric>{formatMoney(item.old_price, item.currency)}</Numeric></td>
                          <td className="p-2 text-end">
                            {item.skipped
                              ? <span className="text-xs text-[var(--lc-text-muted)]">{SKIP_REASONS[item.skip_reason || ''] || 'Skipped'}</span>
                              : <Numeric className="font-semibold">{formatMoney(item.new_price, item.currency)}</Numeric>}
                          </td>
                          <td className="p-2 text-end">
                            {item.skipped || item.delta_percent == null
                              ? <span className="text-[var(--lc-text-muted)]">—</span>
                              : <Numeric className={item.delta_percent < 0 ? 'text-red-600' : 'text-green-600'}>{item.delta_percent > 0 ? '+' : ''}{item.delta_percent}%</Numeric>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {changing > 0 && !exceedsCap && (
                  <div className="space-y-4 rounded-lg border border-[var(--lc-border)] p-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-window">Reversal window</Label>
                      <select
                        id="bulk-window"
                        className="h-10 w-full max-w-[12rem] rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                        value={windowHours}
                        onChange={(event) => setWindowHours(Number(event.target.value))}
                      >
                        {WINDOW_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--lc-text-muted)]">
                        During this window you can undo the change with one tap. After it, the change is committed.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-confirm">Type “{confirmPhrase}” to confirm</Label>
                      <Input
                        id="bulk-confirm"
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        autoComplete="off"
                        data-testid="bulk-confirm-input"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'configure' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handlePreview()} disabled={loading || selection.length === 0} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Preview changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('configure')} disabled={submitting} className="gap-2">
                <ArrowLeft className="h-4 w-4" />Back
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={!canApply} data-testid="bulk-apply-submit" className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Adjust {changing} listing{changing === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--lc-border)] p-3">
      <p className="text-xs text-[var(--lc-text-muted)]">{label}</p>
      <Numeric className="text-lg font-semibold">{value}</Numeric>
    </div>
  )
}
