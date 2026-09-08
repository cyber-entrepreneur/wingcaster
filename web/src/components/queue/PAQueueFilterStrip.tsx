import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Risk-tier filter values shared across PA queue consumers. */
export type PAQueueRiskTier = 'any' | 'low' | 'medium' | 'high'

/** Submitted-within window options (PA-MOD-001 default: `7d`). */
export type PAQueueSubmittedWithin = '24h' | '7d' | '30d' | 'all'

/** Status tab option rendered in the filter strip. */
export interface PAQueueStatusOption {
  /** Stable status key written to URL / query (`pending`, `approved`, …). */
  value: string
  /** Visible tab label (parent supplies i18n). */
  label: string
  /** Optional badge counter; rendered via `<Numeric>`. */
  count?: number
}

/** Controlled filter values for the shared strip. */
export interface PAQueueFilterValues {
  status: string
  submittedWithin: PAQueueSubmittedWithin
  riskTier: PAQueueRiskTier
  search: string
}

export interface PAQueueFilterStripProps {
  /**
   * Env badge slot (PA-NAV-001). Pass a ReactNode — do not import from `components/nav/*`
   * until Wave 0 is merged. Invariant: env badge must always be visible while any PA queue renders.
   */
  envBadge?: ReactNode
  /** Status tabs (Pending default for PA-MOD-001). */
  statusOptions: PAQueueStatusOption[]
  /** Controlled filter values. */
  values: PAQueueFilterValues
  /** Called when any built-in filter changes. Stub — no API. */
  onChange?: (next: PAQueueFilterValues) => void
  /**
   * Slot for queue-specific filters (portal/country for PA-MOD-001,
   * account-tier/channel for PA-ACR-001, package type for PA-PKG-003, etc.).
   */
  customFilters?: ReactNode
  /** Optional aria-label for the strip. */
  'aria-label'?: string
  className?: string
  /** Disable all controls (loading / error). */
  disabled?: boolean
}

const WITHIN_OPTIONS: { value: PAQueueSubmittedWithin; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const RISK_OPTIONS: { value: PAQueueRiskTier; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const selectClassName = cn(
  'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
  'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
)

/**
 * Shared PA queue filter strip: env-badge slot + status tabs + submitted-within +
 * risk-tier + search + `customFilters` slot.
 *
 * Used by: PA-MOD-001, PA-ACR-001, PA-PVA-008, PA-PVA-009, PA-PKG-003.
 * Stub visual + prop types only — no real API.
 */
export function PAQueueFilterStrip({
  envBadge,
  statusOptions,
  values,
  onChange,
  customFilters,
  'aria-label': ariaLabel = 'Filter queue',
  className,
  disabled = false,
}: PAQueueFilterStripProps) {
  const patch = (partial: Partial<PAQueueFilterValues>) => {
    onChange?.({ ...values, ...partial })
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'sticky top-0 z-10 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        'px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        className,
      )}
    >
      {envBadge ? (
        <div className="mb-[var(--lc-space-sm)] flex items-center gap-2" data-pa-queue-env-badge>
          {envBadge}
        </div>
      ) : null}

      <Tabs
        value={values.status}
        onValueChange={(status) => patch({ status })}
        className="mb-[var(--lc-space-sm)]"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {statusOptions.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value} disabled={disabled} className="gap-1.5">
              {opt.label}
              {typeof opt.count === 'number' ? (
                <Numeric className="text-[var(--lc-text-muted)]">{opt.count}</Numeric>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-[var(--lc-space-sm)]">
        <div className="flex min-w-[9rem] flex-col gap-1">
          <Label htmlFor="pa-queue-within">Submitted within</Label>
          <select
            id="pa-queue-within"
            className={selectClassName}
            value={values.submittedWithin}
            disabled={disabled}
            onChange={(e) => patch({ submittedWithin: e.target.value as PAQueueSubmittedWithin })}
          >
            {WITHIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[8rem] flex-col gap-1">
          <Label htmlFor="pa-queue-risk">Risk tier</Label>
          <select
            id="pa-queue-risk"
            className={selectClassName}
            value={values.riskTier}
            disabled={disabled}
            onChange={(e) => patch({ riskTier: e.target.value as PAQueueRiskTier })}
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {customFilters}

        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]"
            aria-hidden
          />
          <Input
            type="search"
            disabled={disabled}
            value={values.search}
            placeholder="Search…"
            className="ps-9"
            aria-label="Search queue"
            onChange={(e) => patch({ search: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
