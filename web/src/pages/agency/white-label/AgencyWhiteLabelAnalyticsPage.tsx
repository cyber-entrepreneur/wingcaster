/**
 * AGN-WLB-005 — White-label site analytics.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { api, type AgencyWhiteLabelAnalyticsResponse } from '@/api/client'
import { HorizontalBarChart } from '@/components/dashboard/HorizontalBarChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { downloadCsv } from '@/lib/downloadCsv'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'empty'

function defaultDateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function formatPercent(value: number) {
  return `${value}%`
}

export function AgencyWhiteLabelAnalyticsPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('White-label analytics')

  const defaults = useMemo(() => defaultDateRange(), [])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AgencyWhiteLabelAnalyticsResponse | null>(null)
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const load = useCallback(async (filters?: { start_date?: string; end_date?: string }) => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyWhiteLabelAnalytics({
        start_date: filters?.start_date ?? startDate,
        end_date: filters?.end_date ?? endDate,
      })
      setData(response)
      setLoadState(response.total_events > 0 ? 'ready' : 'empty')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({
        title: 'Analytics unavailable',
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }, [addToast, endDate, hasAgency, startDate])

  useEffect(() => {
    if (authLoading) return
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasAgency])

  const exportCsv = useCallback(() => {
    if (!data) return
    const lines = [
      'metric,value',
      `visitors,${data.kpis.visitors}`,
      `pageviews,${data.kpis.pageviews}`,
      `inquiries,${data.kpis.inquiries}`,
      `conversion_rate,${data.kpis.conversion_rate}`,
      `bazaar_referral_share,${data.kpis.bazaar_referral_share}`,
      '',
      'page,views',
      ...data.top_pages.map((row) => `"${row.key.replace(/"/g, '""')}",${row.value}`),
      '',
      'source,views',
      ...data.traffic_sources.map((row) => `"${row.key.replace(/"/g, '""')}",${row.value}`),
      '',
      'listing,views',
      ...data.top_listings.map((row) => `"${row.title.replace(/"/g, '""')}",${row.views}`),
    ]
    downloadCsv(lines.join('\n'), `white-label-analytics-${data.start_date}-to-${data.end_date}.csv`)
  }, [data])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-screen="AGN-WLB-005">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading white-label analytics</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-[var(--lc-space-xl)] py-[var(--lc-space-2xl)]" data-screen="AGN-WLB-005" dir={dir}>
        <h1 className="text-2xl font-bold">White-label analytics</h1>
        <p className="mt-2 text-muted-foreground">Sign in with an agency account to view site analytics.</p>
        <Button asChild className="mt-4">
          <Link to="/login?returnTo=%2Fagency%2Fwhite-label%2Fanalytics">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-WLB-005" dir={dir}>
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
        <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ms-2 gap-2">
              <Link to="/white-label">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to white-label sites
              </Link>
            </Button>
            <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
              White-label analytics
            </h1>
            <p style={{ font: 'var(--lc-type-body-sm)' }} className="mt-1 text-[var(--lc-text-muted)]">
              Site traffic, inquiries, and listing performance for your published white-label sites.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!data?.total_events}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </header>

        <Card className="mb-[var(--lc-space-lg)]">
          <CardHeader>
            <CardTitle>Date range</CardTitle>
            <CardDescription>Filter analytics to a reporting window.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="analytics-start">Start date</Label>
              <Input
                id="analytics-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="analytics-end">End date</Label>
              <Input
                id="analytics-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void load({ start_date: startDate, end_date: endDate })}>Apply</Button>
            </div>
          </CardContent>
        </Card>

        {loadState === 'error' && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 py-6 text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p>Analytics could not be loaded. Try refreshing the page.</p>
            </CardContent>
          </Card>
        )}

        {loadState === 'empty' && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold">No analytics yet</h2>
              <p className="mt-2 text-muted-foreground">
                Publish a white-label site and share it to start collecting visitor and inquiry data.
              </p>
              <Button asChild className="mt-4">
                <Link to="/white-label">Open white-label builder</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {data && loadState === 'ready' && (
          <div className="space-y-[var(--lc-space-lg)]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Visitors</CardDescription>
                  <CardTitle className="text-3xl">
                    <Numeric>{data.kpis.visitors}</Numeric>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Inquiries</CardDescription>
                  <CardTitle className="text-3xl">
                    <Numeric>{data.kpis.inquiries}</Numeric>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Conversion rate</CardDescription>
                  <CardTitle className="text-3xl">{formatPercent(data.kpis.conversion_rate)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Bazaar referral share</CardDescription>
                  <CardTitle className="text-3xl">{formatPercent(data.kpis.bazaar_referral_share)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pageviews</CardDescription>
                  <CardTitle className="text-3xl">
                    <Numeric>{data.kpis.pageviews}</Numeric>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" aria-hidden="true" />
                    Traffic sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={data.traffic_sources.map((row) => ({ label: row.key, value: row.value }))}
                    emptyLabel="No traffic source data in this range"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizontalBarChart
                    items={data.top_pages.map((row) => ({ label: row.key, value: row.value }))}
                    emptyLabel="No page views in this range"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top listings by views</CardTitle>
                <CardDescription>Most viewed property pages on your white-label sites.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top_listings.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
                          <th className="py-2 text-start font-medium">Listing</th>
                          <th className="py-2 text-end font-medium">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_listings.map((row) => (
                          <tr key={row.property_id} className="border-b border-[var(--lc-border)] last:border-0">
                            <td className="py-3 pe-4">{row.title}</td>
                            <td className="py-3 text-end">
                              <Numeric>{row.views}</Numeric>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No listing views in this range.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
