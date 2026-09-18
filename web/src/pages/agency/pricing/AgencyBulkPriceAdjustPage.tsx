import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Undo2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import type { BulkPricePreview, BulkPriceStrategy } from '@/types/marketPricing'

type Step = 1 | 2 | 3 | 4 | 5

const STRATEGIES: Array<{ value: BulkPriceStrategy; label: string; needsValue?: boolean }> = [
  { value: 'recommendation', label: 'Apply recommendation' },
  { value: 'percent_up', label: 'Percent increase', needsValue: true },
  { value: 'percent_down', label: 'Percent decrease', needsValue: true },
  { value: 'set_median', label: 'Set to comparables median' },
  { value: 'fixed_delta', label: 'Fixed amount change', needsValue: true },
]

export function AgencyBulkPriceAdjustPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePageTitle('Bulk price adjustment')

  const role = (agent?.affiliation as { role?: string } | undefined)?.role || null
  const isAdmin = role === 'owner' || role === 'admin'

  const listingIds = useMemo(
    () => searchParams.get('ids')?.split(',').map((id) => id.trim()).filter(Boolean) || [],
    [searchParams],
  )

  const [step, setStep] = useState<Step>(1)
  const [strategy, setStrategy] = useState<BulkPriceStrategy>('recommendation')
  const [strategyValue, setStrategyValue] = useState('')
  const [reversalHours, setReversalHours] = useState(24)
  const [confirmation, setConfirmation] = useState('')
  const [preview, setPreview] = useState<BulkPricePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [safetyBlocked, setSafetyBlocked] = useState('')
  const [applying, setApplying] = useState(false)
  const [activeDeadline, setActiveDeadline] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)

  const loadActive = useCallback(async () => {
    try {
      const { active } = await api.getAgencyBulkPriceAdjustActive()
      if (active?.adjustment) {
        setActiveId(active.adjustment.id)
        setActiveDeadline(active.adjustment.reversal_deadline_at)
      }
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void loadActive()
  }, [isAdmin, loadActive])

  const selectedStrategy = STRATEGIES.find((item) => item.value === strategy)
  const confirmationPhrase = preview ? `I have reviewed all ${preview.rows.length} changes` : ''

  async function runPreview() {
    setPreviewLoading(true)
    setPreviewError('')
    setSafetyBlocked('')
    try {
      const payload = {
        listing_ids: listingIds,
        strategy,
        strategy_value: selectedStrategy?.needsValue ? Number(strategyValue) : null,
      }
      const result = await api.previewAgencyBulkPriceAdjust(payload)
      setPreview(result.preview)
      if (!result.safety.ok) {
        setSafetyBlocked(result.safety.error || 'This adjustment exceeds safety limits.')
      }
      setStep(3)
    } catch (err) {
      setPreview(null)
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function apply() {
    if (!preview || confirmation.trim() !== confirmationPhrase) return
    setApplying(true)
    try {
      const result = await api.applyAgencyBulkPriceAdjust({
        listing_ids: listingIds,
        strategy,
        strategy_value: selectedStrategy?.needsValue ? Number(strategyValue) : null,
        reversal_hours: reversalHours,
        confirmation: confirmation.trim(),
      })
      setActiveId(result.adjustment.id)
      setActiveDeadline(result.adjustment.reversal_deadline_at)
      setStep(5)
      addToast({
        variant: 'success',
        title: 'Bulk adjustment applied',
        description: `${result.adjustment.listing_count} listings updated. Reversal window is open.`,
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk adjustment failed',
        description: err instanceof Error ? err.message : 'Could not apply adjustment',
      })
    } finally {
      setApplying(false)
    }
  }

  async function revertActive() {
    if (!activeId) return
    setReverting(true)
    try {
      await api.revertAgencyBulkPriceAdjust(activeId)
      setActiveId(null)
      setActiveDeadline(null)
      addToast({ variant: 'success', title: 'Bulk adjustment reverted' })
      navigate('/agency/pricing')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Revert failed',
        description: err instanceof Error ? err.message : 'Could not revert adjustment',
      })
    } finally {
      setReverting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-PRC-002">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          Bulk price adjustment
        </h1>
        <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]">
          Only agency owners and admins can run portfolio-wide price adjustments.
        </p>
      </div>
    )
  }

  if (listingIds.length === 0) {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-PRC-002">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          Bulk price adjustment
        </h1>
        <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]">
          Select listings on the agency pricing page first, then open bulk adjustment.
        </p>
        <Button asChild className="mt-[var(--lc-space-md)]">
          <Link to="/agency/pricing">Back to pricing</Link>
        </Button>
      </div>
    )
  }

  return (
    <div
      className="mx-auto max-w-[1100px] space-y-[var(--lc-space-lg)] p-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]"
      data-screen="AGN-PRC-002"
    >
      <header className="space-y-[var(--lc-space-sm)]">
        <Link
          to="/agency/pricing"
          className="inline-flex items-center gap-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to pricing
        </Link>
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          Bulk price adjustment
        </h1>
        <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
          Mandatory preview, typed confirmation, and a reversible 24-hour window.
        </p>
      </header>

      {activeDeadline ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
        >
          <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)]">
            Reversal window active until{' '}
            <Numeric>{new Date(activeDeadline).toLocaleString()}</Numeric>.
          </p>
          <Button type="button" variant="outline" disabled={reverting} onClick={() => void revertActive()}>
            {reverting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="me-2 h-4 w-4" aria-hidden />}
            Undo all changes
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Step 1 — Selection summary
          </h2>
          <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]">
            <Numeric>{listingIds.length}</Numeric> listings selected for adjustment.
          </p>
          <Button type="button" className="mt-[var(--lc-space-md)]" onClick={() => setStep(2)}>
            Continue
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Step 2 — Adjustment strategy
          </h2>
          <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-sm)]">
            {STRATEGIES.map((option) => (
              <label key={option.value} className="flex items-center gap-[var(--lc-space-sm)]">
                <input
                  type="radio"
                  name="bulk-strategy"
                  checked={strategy === option.value}
                  onChange={() => setStrategy(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {selectedStrategy?.needsValue ? (
            <div className="mt-[var(--lc-space-md)]">
              <Label htmlFor="strategy-value">Strategy value</Label>
              <Input
                id="strategy-value"
                type="number"
                value={strategyValue}
                onChange={(event) => setStrategyValue(event.target.value)}
                className="mt-[var(--lc-space-xs)] max-w-xs"
              />
            </div>
          ) : null}
          <div className="mt-[var(--lc-space-md)] flex gap-[var(--lc-space-sm)]">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" disabled={previewLoading || (selectedStrategy?.needsValue && !strategyValue)} onClick={() => void runPreview()}>
              {previewLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Generate preview
            </Button>
          </div>
          {previewError ? (
            <p role="alert" className="mt-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]">{previewError}</p>
          ) : null}
        </section>
      ) : null}

      {step >= 3 && preview ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Step 3 — Mandatory preview
          </h2>
          {safetyBlocked ? (
            <div role="alert" className="mt-[var(--lc-space-sm)] flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{safetyBlocked}</p>
            </div>
          ) : null}
          <div className="mt-[var(--lc-space-md)] overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[length:var(--lc-type-body-sm)]">
              <thead>
                <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                  <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">Listing</th>
                  <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">Agent</th>
                  <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">Current</th>
                  <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">New</th>
                  <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">Delta</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.property_id} className="border-b border-[var(--lc-border)]">
                    <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">{row.title}</td>
                    <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">{row.agent_name}</td>
                    <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]"><Numeric>{row.price_before}</Numeric></td>
                    <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]"><Numeric>{row.price_after}</Numeric></td>
                    <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]"><Numeric>{row.delta_percent}%</Numeric></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {step === 3 ? (
            <Button type="button" className="mt-[var(--lc-space-md)]" disabled={!!safetyBlocked} onClick={() => setStep(4)}>
              Continue to confirmation
            </Button>
          ) : null}
        </section>
      ) : null}

      {step === 4 && preview ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Step 4 — Reversal window and confirmation
          </h2>
          <div className="mt-[var(--lc-space-md)]">
            <Label htmlFor="reversal-hours">Reversal window (hours)</Label>
            <Input
              id="reversal-hours"
              type="number"
              min={1}
              max={168}
              value={reversalHours}
              onChange={(event) => setReversalHours(Number.parseInt(event.target.value, 10) || 24)}
              className="mt-[var(--lc-space-xs)] max-w-xs"
            />
          </div>
          <div className="mt-[var(--lc-space-md)]">
            <Label htmlFor="confirmation">Type "{confirmationPhrase}"</Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-[var(--lc-space-xs)]"
            />
          </div>
          <div className="mt-[var(--lc-space-md)] flex gap-[var(--lc-space-sm)]">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button
              type="button"
              disabled={applying || confirmation.trim() !== confirmationPhrase || !!safetyBlocked}
              onClick={() => void apply()}
            >
              {applying ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Apply adjustment
            </Button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Adjustment applied
          </h2>
          <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]">
            Prices were updated. Use the reversal banner to undo before the window closes.
          </p>
          <Button asChild className="mt-[var(--lc-space-md)]">
            <Link to="/agency/pricing">Return to pricing</Link>
          </Button>
        </section>
      ) : null}
    </div>
  )
}
