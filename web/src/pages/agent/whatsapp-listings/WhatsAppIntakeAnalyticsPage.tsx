import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  api,
  type WhatsAppIntakeAnalytics,
  type WhatsAppIntakeAnalyticsRange,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useUiMode } from '@/hooks/useUiMode'
import { usePageTitle } from '@/lib/usePageTitle'

const RANGE_OPTIONS: Array<{ value: WhatsAppIntakeAnalyticsRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

interface ActivityBucket {
  label: string
  drafts: number
  approved: number
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  )
}

export function bucketActivity(
  activity: WhatsAppIntakeAnalytics['activity'],
  maxBuckets = 12,
): ActivityBucket[] {
  if (!activity.length) return []
  const size = Math.max(1, Math.ceil(activity.length / maxBuckets))
  const buckets: ActivityBucket[] = []
  for (let index = 0; index < activity.length; index += size) {
    const slice = activity.slice(index, index + size)
    const first = slice[0]
    const last = slice.at(-1) ?? first
    buckets.push({
      label:
        first.date === last.date
          ? shortDate(first.date)
          : `${shortDate(first.date)}–${shortDate(last.date)}`,
      drafts: slice.reduce((sum, point) => sum + point.drafts, 0),
      approved: slice.reduce((sum, point) => sum + point.approved, 0),
    })
  }
  return buckets
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function analyticsCsv(data: WhatsAppIntakeAnalytics) {
  const rows: Array<Array<string | number>> = [
    ['Metric', 'Value'],
    ['Period', `${data.range.days} days`],
    ['Drafts', data.summary.total_drafts],
    ['Approved', data.summary.approved],
    ['Approval rate', `${data.summary.approval_rate}%`],
    ['Average approval time (minutes)', data.summary.avg_approval_minutes ?? ''],
    ['Estimated AI cost (USD)', data.summary.ai_cost_estimate_usd],
    [],
    ['Field', 'Model confidence', 'Samples'],
    ...data.field_accuracy.map((field) => [
      field.label,
      `${field.accuracy}%`,
      field.sample_size,
    ]),
    [],
    ['Date', 'Drafts', 'Approved'],
    ...data.activity.map((point) => [point.date, point.drafts, point.approved]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function MetricCard({
  label,
  children,
  detail,
  proOnly = false,
  shouldRenderPro,
}: {
  label: string
  children: ReactNode
  detail: string
  proOnly?: boolean
  shouldRenderPro: boolean
}) {
  if (proOnly && !shouldRenderPro) return null
  return (
    <article className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {label}
      </p>
      <div
        className="mt-[var(--lc-space-xs)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-2)' }}
      >
        {children}
      </div>
      <p
        className="mt-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        {detail}
      </p>
    </article>
  )
}

export function WhatsAppIntakeAnalyticsPage() {
  const { addToast } = useToast()
  const { shouldRenderPro } = useUiMode()
  const [range, setRange] = useState<WhatsAppIntakeAnalyticsRange>('30d')
  const [data, setData] = useState<WhatsAppIntakeAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  usePageTitle('WhatsApp intake analytics')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.getWhatsAppListingsAgentAnalytics(range))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Analytics could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const activity = useMemo(() => bucketActivity(data?.activity ?? []), [data?.activity])
  const activityMax = Math.max(1, ...activity.map((point) => point.drafts))

  function downloadCsv() {
    if (!data || data.summary.total_drafts === 0) return
    const blob = new Blob([analyticsCsv(data)], { type: 'text/csv;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `whatsapp-intake-${data.range.key}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    addToast({ title: 'Analytics exported', description: 'Your CSV download is ready.' })
  }

  return (
    <main
      className="min-h-screen bg-[var(--lc-bg-page)] px-[var(--lc-space-md)] pb-[var(--lc-space-3xl)] pt-[var(--lc-space-md)] sm:px-[var(--lc-space-lg)]"
      data-testid="whatsapp-intake-analytics"
    >
      <div className="mx-auto max-w-[1120px]">
        <header className="flex flex-col gap-[var(--lc-space-md)] border-b border-[var(--lc-border)] pb-[var(--lc-space-md)] sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" asChild className="-ms-3 mb-[var(--lc-space-xs)]">
              <Link to="/agent/whatsapp-listings">
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
                Intake inbox
              </Link>
            </Button>
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{
                font: 'var(--lc-type-heading-1)',
                letterSpacing: 'var(--lc-tracking-heading-1)',
              }}
            >
              WhatsApp intake analytics
            </h1>
            <p
              className="mt-[var(--lc-space-xs)] max-w-2xl text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body)' }}
            >
              Monitor draft volume, review speed, and the confidence of AI-extracted listing
              fields.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-tap w-full sm:w-auto"
            disabled={!data || data.summary.total_drafts === 0 || loading}
            onClick={downloadCsv}
          >
            <Download className="me-2 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </header>

        <section
          className="mt-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center sm:justify-between"
          aria-label="Analytics filters"
        >
          <div>
            <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Reporting period
            </p>
            <div
              className="mt-[var(--lc-space-xs)] inline-flex w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-1 sm:w-auto"
              role="group"
              aria-label="Reporting period"
            >
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range === option.value}
                  className={`min-h-tap flex-1 rounded-[var(--lc-radius-sm)] px-4 text-center transition-colors sm:flex-none ${
                    range === option.value
                      ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                      : 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]'
                  }`}
                  onClick={() => setRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {data ? (
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              Updated from live intake records
            </p>
          ) : null}
        </section>

        {loading && !data ? (
          <section
            className="mt-[var(--lc-space-lg)] space-y-[var(--lc-space-md)]"
            aria-busy="true"
            aria-label="Loading intake analytics"
          >
            <div className="grid grid-cols-2 gap-[var(--lc-space-sm)] lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
                />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
          </section>
        ) : error && !data ? (
          <section
            className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] p-[var(--lc-space-lg)] text-center"
            role="alert"
          >
            <h2
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              Analytics are unavailable
            </h2>
            <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]">{error}</p>
            <Button type="button" className="mt-[var(--lc-space-md)]" onClick={() => void load()}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden />
              Try again
            </Button>
          </section>
        ) : data?.summary.total_drafts === 0 ? (
          <section
            className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] text-center"
            role="status"
          >
            <h2
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              No intake activity in this period
            </h2>
            <p className="mx-auto mt-[var(--lc-space-xs)] max-w-lg text-[var(--lc-text-secondary)]">
              Send property photos and details to your WingCaster WhatsApp number. New drafts will
              appear here automatically.
            </p>
            <Button className="mt-[var(--lc-space-md)]" asChild>
              <Link to="/agent/whatsapp-listings">Open intake inbox</Link>
            </Button>
          </section>
        ) : data ? (
          <>
            <section
              className="mt-[var(--lc-space-lg)] grid grid-cols-2 gap-[var(--lc-space-sm)] lg:grid-cols-4"
              aria-label="Key performance indicators"
            >
              <MetricCard
                label="Drafts"
                detail={`Created in the last ${data.range.days} days`}
                shouldRenderPro={shouldRenderPro}
              >
                <Numeric>{data.summary.total_drafts.toLocaleString()}</Numeric>
              </MetricCard>
              <MetricCard
                label="Approval rate"
                detail={`${data.summary.approved.toLocaleString()} drafts approved`}
                shouldRenderPro={shouldRenderPro}
              >
                <Numeric>{data.summary.approval_rate}%</Numeric>
              </MetricCard>
              <MetricCard
                label="Average approval time"
                detail="From draft creation to approval"
                proOnly
                shouldRenderPro={shouldRenderPro}
              >
                {data.summary.avg_approval_minutes === null ? (
                  '—'
                ) : (
                  <>
                    <Numeric>{data.summary.avg_approval_minutes.toLocaleString()}</Numeric>
                    <span className="ms-1 text-[length:var(--lc-type-body)]">min</span>
                  </>
                )}
              </MetricCard>
              <MetricCard
                label="Estimated AI cost"
                detail="Directional estimate, not your bill"
                proOnly
                shouldRenderPro={shouldRenderPro}
              >
                <Numeric>
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  }).format(data.summary.ai_cost_estimate_usd)}
                </Numeric>
              </MetricCard>
            </section>

            <section className="mt-[var(--lc-space-lg)] grid gap-[var(--lc-space-md)] lg:grid-cols-[1.35fr_1fr]">
              <article className="min-w-0 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
                <div className="flex items-start justify-between gap-[var(--lc-space-sm)]">
                  <div>
                    <h2
                      className="text-[var(--lc-text-heading)]"
                      style={{ font: 'var(--lc-type-heading-3)' }}
                    >
                      Draft activity
                    </h2>
                    <p
                      className="mt-1 text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      Total drafts by period; approved drafts are shown inside each bar.
                    </p>
                  </div>
                  {loading ? (
                    <Loader2
                      className="h-5 w-5 shrink-0 animate-spin text-[var(--lc-action-primary)]"
                      aria-label="Refreshing"
                    />
                  ) : null}
                </div>
                <div className="mt-[var(--lc-space-lg)] flex h-56 items-end gap-1 sm:gap-2">
                  {activity.map((point) => {
                    const totalHeight = Math.max(6, Math.round((point.drafts / activityMax) * 100))
                    const approvedHeight = point.drafts
                      ? Math.round((point.approved / point.drafts) * 100)
                      : 0
                    return (
                      <div
                        key={point.label}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        aria-label={`${point.label}: ${point.drafts} drafts, ${point.approved} approved`}
                      >
                        <Numeric className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                          {point.drafts}
                        </Numeric>
                        <div
                          className="relative w-full min-w-1 overflow-hidden rounded-t-[var(--lc-radius-sm)] bg-[var(--lc-surface-selected)]"
                          style={{ height: `${totalHeight}%` }}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 bg-[var(--lc-action-primary)]"
                            style={{ height: `${approvedHeight}%` }}
                          />
                        </div>
                        <span className="max-w-full truncate text-[10px] text-[var(--lc-text-muted)]">
                          {point.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-[var(--lc-space-sm)] flex flex-wrap gap-[var(--lc-space-md)] text-[var(--lc-text-secondary)]">
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[var(--lc-surface-selected)]" />
                    Drafts
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[var(--lc-action-primary)]" />
                    Approved
                  </span>
                </div>
              </article>

              <article className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
                <h2
                  className="text-[var(--lc-text-heading)]"
                  style={{ font: 'var(--lc-type-heading-3)' }}
                >
                  Extraction confidence
                </h2>
                <p
                  className="mt-1 text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-caption)' }}
                >
                  Model confidence by field. This is a quality signal, not verified accuracy.
                </p>
                {data.field_accuracy.length ? (
                  <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-sm)]">
                    {data.field_accuracy.map((field) => (
                      <div key={field.field}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-[var(--lc-text-primary)]">
                            {field.label}
                          </span>
                          <span className="shrink-0 text-sm text-[var(--lc-text-secondary)]">
                            <Numeric>{field.accuracy}%</Numeric>
                            <span className="ms-2 text-[var(--lc-text-muted)]">
                              n=<Numeric>{field.sample_size}</Numeric>
                            </span>
                          </span>
                        </div>
                        <div
                          className="h-2.5 overflow-hidden rounded-full bg-[var(--lc-surface-sunken)]"
                          role="progressbar"
                          aria-label={`${field.label} confidence`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={field.accuracy}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--lc-action-primary)]"
                            style={{ inlineSize: `${field.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-[var(--lc-space-lg)] text-center text-sm text-[var(--lc-text-muted)]">
                    Confidence data is not available for these drafts.
                  </p>
                )}
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}

export default WhatsAppIntakeAnalyticsPage
