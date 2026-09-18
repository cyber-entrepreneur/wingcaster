import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinAdminGate } from './shell'
import type { VendorDetail, VendorMarginResponse, VendorRateVersion, VendorStatement } from './vendorTypes'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function formatMicroUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0) / 1_000_000)
}

function formatMinor(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number(value || 0) / 100)
}

function parseRates(
  value: VendorRateVersion['rates'],
): Record<string, { unit_cost_minor?: number; currency?: string }> {
  if (typeof value !== 'string') return value || {}
  try {
    return JSON.parse(value) as Record<string, { unit_cost_minor?: number; currency?: string }>
  } catch {
    return {}
  }
}

function statusBadge(status: string) {
  const normalized = status.toUpperCase()
  const badgeStatus =
    normalized === 'ACTIVE' || normalized === 'FINALIZED' || normalized === 'RECONCILED'
      ? 'published'
      : normalized === 'DRAFT'
        ? 'draft'
        : normalized === 'RECEIVED'
          ? 'pending'
          : 'unpublished'
  return <Badge status={badgeStatus}>{status.replaceAll('_', ' ')}</Badge>
}

export function VendorDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [rates, setRates] = useState<VendorRateVersion[]>([])
  const [statements, setStatements] = useState<VendorStatement[]>([])
  const [margin, setMargin] = useState<VendorMarginResponse | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [marginLoading, setMarginLoading] = useState(false)
  const [marginError, setMarginError] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      const [vendorBody, rateBody, statementBody] = await Promise.all([
        api.getAdminVendor(id),
        api.listAdminVendorRates(id),
        api.listAdminVendorStatements(id),
      ])
      setVendor(vendorBody)
      setRates(rateBody.rates || [])
      setStatements(statementBody.statements || [])
    } catch (caught) {
      const status = (caught as { status?: number }).status
      if (status === 404) setNotFound(true)
      else setError(true)
      setVendor(null)
      setRates([])
      setStatements([])
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadMargin = useCallback(async () => {
    if (!id || !/^\d{4}-\d{2}$/.test(month)) return
    setMarginLoading(true)
    setMarginError(false)
    try {
      setMargin(await api.getAdminVendorMargin(id, month))
    } catch {
      setMargin(null)
      setMarginError(true)
    } finally {
      setMarginLoading(false)
    }
  }, [id, month])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadMargin()
  }, [loadMargin])

  const rateRows = useMemo(
    () =>
      rates.flatMap((rate) =>
        Object.entries(parseRates(rate.rates)).map(([productCode, cost]) => ({
          id: `${rate.id}:${productCode}`,
          card: rate.rate_card_name,
          productCode,
          unitCost: Number(cost.unit_cost_minor || 0),
          currency: cost.currency || vendor?.currency || 'USD',
          effectiveFrom: rate.effective_from,
          effectiveTo: rate.effective_to,
          status: rate.status,
          version: rate.version_n,
        })),
      ),
    [rates, vendor],
  )

  const maxMarginAmount = useMemo(
    () =>
      Math.max(
        1,
        ...(margin?.features || []).map((feature) => Math.max(feature.selling_micro_usd, feature.cost_micro_usd)),
      ),
    [margin],
  )

  return (
    <FinAdminGate title={vendor?.name || 'Vendor detail'}>
      <div data-screen="PA-VEN-002" className="flex flex-col gap-[var(--lc-space-lg)]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild type="button" variant="ghost" size="sm" className="mb-2">
              <Link to="/admin/fin/vendor-costs">
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
                Back to vendors
              </Link>
            </Button>
            {vendor ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={vendor.active ? 'published' : 'unpublished'}>
                  {vendor.active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge status={vendor.environment === 'LIVE' ? 'pending' : 'draft'}>{vendor.environment}</Badge>
              </div>
            ) : null}
          </div>
          {vendor ? (
            <p className="text-sm text-[var(--lc-text-muted)]">
              Billing currency <strong>{vendor.currency}</strong>
            </p>
          ) : null}
        </header>

        {loading ? (
          <div role="status" aria-label="Loading vendor detail" className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-28 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : notFound ? (
          <section
            role="status"
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-6 text-center"
          >
            <h2 style={{ font: 'var(--lc-type-heading-2)' }}>Vendor not found</h2>
            <p className="mt-2 text-[var(--lc-text-muted)]">It may not exist in the selected environment.</p>
          </section>
        ) : error || !vendor ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-unpublished-bg)] p-4"
          >
            <span>Couldn&apos;t load vendor details.</span>
            <Button type="button" variant="outline" onClick={() => void load()}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <section aria-label="Vendor summary" className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                <p className="text-sm text-[var(--lc-text-muted)]">Month-to-date cost</p>
                <Numeric as="p" className="mt-1 text-xl">
                  {formatMicroUsd(vendor.mtd_cost_micro_usd)}
                </Numeric>
              </article>
              <article className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                <p className="text-sm text-[var(--lc-text-muted)]">Month-to-date units</p>
                <Numeric as="p" className="mt-1 text-xl">
                  {vendor.mtd_units.toLocaleString()}
                </Numeric>
              </article>
              <article className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                <p className="text-sm text-[var(--lc-text-muted)]">Active rate versions</p>
                <Numeric as="p" className="mt-1 text-xl">
                  {vendor.active_rate_versions}
                </Numeric>
              </article>
            </section>

            <Tabs defaultValue="rates">
              <TabsList aria-label="Vendor detail sections">
                <TabsTrigger value="rates">
                  Rates <Numeric as="span">{rateRows.length}</Numeric>
                </TabsTrigger>
                <TabsTrigger value="statements">
                  Statements <Numeric as="span">{statements.length}</Numeric>
                </TabsTrigger>
                <TabsTrigger value="margin">Margin</TabsTrigger>
              </TabsList>

              <TabsContent value="rates" className="mt-4">
                {rateRows.length === 0 ? (
                  <p
                    role="status"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-5 text-[var(--lc-text-muted)]"
                  >
                    No rate schedule has been recorded for this vendor.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {rateRows.map((rate) => (
                      <article
                        key={rate.id}
                        className="grid gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]"
                      >
                        <div className="min-w-0">
                          <h3 className="break-words font-medium">{rate.productCode}</h3>
                          <p className="break-words text-sm text-[var(--lc-text-muted)]">
                            {rate.card} · version <Numeric as="span">{rate.version}</Numeric>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Unit cost</p>
                          <Numeric>{formatMicroUsd(rate.unitCost)}</Numeric>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Effective</p>
                          <Numeric>{new Date(rate.effectiveFrom).toLocaleDateString()}</Numeric>
                          {rate.effectiveTo ? (
                            <span className="text-xs text-[var(--lc-text-muted)]">
                              {' '}
                              – {new Date(rate.effectiveTo).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                        <div>{statusBadge(rate.status)}</div>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="statements" className="mt-4">
                {statements.length === 0 ? (
                  <p
                    role="status"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-5 text-[var(--lc-text-muted)]"
                  >
                    No monthly statements have been received.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {statements.map((statement) => (
                      <article
                        key={statement.id}
                        className="grid gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
                      >
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Period</p>
                          <Numeric>{statement.statement_period_key}</Numeric>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Total</p>
                          <Numeric>{formatMinor(statement.total_minor, statement.currency)}</Numeric>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Unresolved variances</p>
                          <Numeric>{statement.unresolved_variance_count}</Numeric>
                        </div>
                        <div>{statusBadge(statement.status)}</div>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="margin" className="mt-4">
                <div className="mb-4 max-w-xs">
                  <Label htmlFor="vendor-margin-month">Statement month</Label>
                  <input
                    id="vendor-margin-month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                  />
                </div>
                {marginLoading ? (
                  <p role="status">Loading margin…</p>
                ) : marginError ? (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] p-4"
                  >
                    <span>Couldn&apos;t load margin for this month.</span>
                    <Button type="button" variant="outline" onClick={() => void loadMargin()}>
                      Retry
                    </Button>
                  </div>
                ) : !margin?.features.length ? (
                  <p
                    role="status"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-5 text-[var(--lc-text-muted)]"
                  >
                    No usage or selling-price data exists for this month.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {margin.features.map((feature) => (
                      <article
                        key={feature.feature}
                        className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4"
                      >
                        <header className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="break-words font-medium">{feature.feature}</h3>
                          <Badge
                            status={
                              feature.margin_pct == null
                                ? 'draft'
                                : feature.margin_pct >= 0
                                  ? 'published'
                                  : 'unpublished'
                            }
                          >
                            {feature.margin_pct == null
                              ? 'No selling price'
                              : `${feature.margin_pct.toFixed(1)}% margin`}
                          </Badge>
                        </header>
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <div className="flex justify-between gap-2">
                              <span>Selling</span>
                              <Numeric>{formatMicroUsd(feature.selling_micro_usd)}</Numeric>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-[var(--lc-surface-sunken)]">
                              <div
                                className="h-2 rounded-full bg-[var(--lc-accent-bold-edge)]"
                                style={{
                                  width: `${Math.max(2, (feature.selling_micro_usd / maxMarginAmount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between gap-2">
                              <span>Vendor cost</span>
                              <Numeric>{formatMicroUsd(feature.cost_micro_usd)}</Numeric>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-[var(--lc-surface-sunken)]">
                              <div
                                className="h-2 rounded-full bg-[var(--lc-status-warning-fg)]"
                                style={{
                                  width: `${Math.max(2, (feature.cost_micro_usd / maxMarginAmount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </FinAdminGate>
  )
}
