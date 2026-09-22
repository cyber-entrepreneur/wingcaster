/**
 * Marketing dashboard — agent/agency marketing performance at a glance.
 *
 * Top KPI strip (9 metrics) → two infographics (Impressions & Leads trend,
 * Traffic by channel) → two tables (Active Campaign Performance, Listing
 * Performance). Wired to the existing analytics endpoints; metrics that only
 * exist once paid-ads (Wave 2A) lands — Cost per lead, Marketing ROI — render
 * as ready-to-wire placeholders rather than fabricated numbers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, Eye, HeartHandshake, Layers, Loader2, MousePointerClick,
  Percent, RefreshCw, Target, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { api } from '@/api/client'
import type {
  AgencyCampaignPerformanceRow,
  AgencyListingsPerformanceRow,
} from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { Numeric } from '@/components/ui/numeric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HorizontalBarChart } from '@/components/dashboard/HorizontalBarChart'
import { cn } from '@/lib/utils'

type ChannelDatum = { label: string; value: number }

interface MarketingData {
  listings: number
  impressions: number
  engagements: number
  opportunities: number | null
  qualifiedLeads: number
  costPerLead: number | null
  conversions: number
  conversionRate: number | null
  marketingRoi: number | null
  trafficByChannel: ChannelDatum[]
  campaigns: AgencyCampaignPerformanceRow[]
  listingRows: AgencyListingsPerformanceRow[]
}

const EMPTY: MarketingData = {
  listings: 0, impressions: 0, engagements: 0, opportunities: null, qualifiedLeads: 0,
  costPerLead: null, conversions: 0, conversionRate: null, marketingRoi: null,
  trafficByChannel: [], campaigns: [], listingRows: [],
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString()
}
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}
function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/** Small inline SVG area comparison for Impressions vs Leads (period totals). */
function ImpressionsLeadsViz({ impressions, leads }: { impressions: number; leads: number }) {
  const max = Math.max(impressions, leads, 1)
  const rows: Array<{ label: string; value: number; color: string }> = [
    { label: 'Impressions', value: impressions, color: 'var(--lc-action-primary)' },
    { label: 'Leads', value: leads, color: 'var(--lc-accent-bold-edge, var(--lc-action-primary))' },
  ]
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--lc-text-primary)]">{r.label}</span>
            <Numeric className="text-[var(--lc-text-muted)]">{r.value.toLocaleString()}</Numeric>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--lc-surface-sunken)]">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--lc-text-muted)]">
        Lead-to-impression ratio:{' '}
        <span className="font-medium text-[var(--lc-text-primary)]">
          {impressions > 0 ? `${((leads / impressions) * 100).toFixed(2)}%` : '—'}
        </span>
      </p>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MarketingDashboardPage() {
  usePageTitle('Marketing')
  const [data, setData] = useState<MarketingData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // Each source is optional: a solo agent may not have agency-scoped data.
    const [listingsRes, campaignsRes, sourceRes] = await Promise.all([
      api.getAgencyListingsPerformance().catch(() => null),
      api.getAgencyCampaignPerformance().catch(() => null),
      api.getSourcePerformance().catch(() => null),
    ])

    if (!listingsRes && !campaignsRes && !sourceRes) {
      setError('No marketing data available yet for this account.')
      setData(EMPTY)
      setLoading(false)
      return
    }

    const lo = listingsRes?.overview
    const engagements = (listingsRes?.rows || []).reduce((s, r) => s + (r.engagement || 0), 0)
    const traffic = (listingsRes?.by_channel || []).map((c) => ({ label: c.label, value: c.value }))
    const sourceTotals = sourceRes?.totals

    setData({
      listings: lo?.listings ?? 0,
      impressions: lo?.total_views ?? 0,
      engagements,
      opportunities: sourceTotals?.deals ?? null,
      qualifiedLeads: lo?.total_inquiries ?? sourceTotals?.inquiries ?? 0,
      costPerLead: null, // paid-ads (Wave 2A) — not yet available
      conversions: lo?.total_conversions ?? sourceTotals?.won ?? 0,
      conversionRate: lo?.conversion_rate ?? null,
      marketingRoi: null, // paid-ads (Wave 2A) — not yet available
      trafficByChannel: traffic,
      campaigns: campaignsRes?.rows || [],
      listingRows: listingsRes?.rows || [],
    })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const kpis = useMemo(() => ([
    { label: 'Listings', value: fmtInt(data.listings), icon: <Layers className="h-4 w-4" /> },
    { label: 'Impressions', value: fmtInt(data.impressions), icon: <Eye className="h-4 w-4" /> },
    { label: 'Engagements', value: fmtInt(data.engagements), icon: <MousePointerClick className="h-4 w-4" /> },
    { label: 'Opportunities', value: fmtInt(data.opportunities), icon: <Target className="h-4 w-4" /> },
    { label: 'Qualified leads', value: fmtInt(data.qualifiedLeads), icon: <Users className="h-4 w-4" /> },
    { label: 'Cost per lead', value: fmtMoney(data.costPerLead), icon: <Wallet className="h-4 w-4" />, hint: 'Connects with paid ads' },
    { label: 'Conversions', value: fmtInt(data.conversions), icon: <HeartHandshake className="h-4 w-4" /> },
    { label: 'Conversion rate', value: fmtPct(data.conversionRate), icon: <Percent className="h-4 w-4" /> },
    { label: 'Marketing ROI', value: fmtPct(data.marketingRoi), icon: <TrendingUp className="h-4 w-4" />, hint: 'Connects with paid ads' },
  ]), [data])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-display)' }}>Marketing</h1>
          <p className="text-[var(--lc-text-muted)]">Reach, engagement, and conversion across your listings and campaigns.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {error ? (
        <div role="status" className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-8 text-center text-[var(--lc-text-muted)]">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[var(--lc-text-muted)]">
                  <span className="shrink-0">{k.icon}</span>
                  <span className="truncate text-[11px]">{k.label}</span>
                </div>
                <Numeric as="p" className="text-lg font-bold text-[var(--lc-text-heading)]">
                  {loading ? '…' : k.value}
                </Numeric>
                {k.hint ? <p className="mt-0.5 text-[10px] text-[var(--lc-text-muted)]">{k.hint}</p> : null}
              </div>
            ))}
          </div>

          {/* Infographics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Impressions & Leads">
              <ImpressionsLeadsViz impressions={data.impressions} leads={data.qualifiedLeads} />
            </Card>
            <Card title="Traffic by channel" action={<BarChart3 className="h-4 w-4 text-[var(--lc-text-muted)]" />}>
              <HorizontalBarChart items={data.trafficByChannel} emptyLabel="No channel traffic yet" />
            </Card>
          </div>

          {/* Active Campaign Performance */}
          <Card title="Active campaign performance">
            {data.campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--lc-text-muted)]">No campaigns running yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[var(--lc-text-muted)]">
                    <tr className="border-b border-[var(--lc-border)]">
                      <th className="px-3 py-2 font-medium">Campaign</th>
                      <th className="px-3 py-2 font-medium">Channel</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Enrolled</th>
                      <th className="px-3 py-2 font-medium text-right">Sent</th>
                      <th className="px-3 py-2 font-medium text-right">Delivered</th>
                      <th className="px-3 py-2 font-medium text-right">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-[var(--lc-border)] last:border-0">
                        <td className="px-3 py-2 font-medium">
                          <Link to={c.href || '#'} className="hover:underline">{c.name}</Link>
                        </td>
                        <td className="px-3 py-2 capitalize text-[var(--lc-text-muted)]">{c.channel || (c.channels || []).join(', ')}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{c.status}</Badge></td>
                        <td className="px-3 py-2 text-right"><Numeric>{c.enrollments_total}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{c.messages_sent}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{c.messages_delivered}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{c.completion_rate == null ? '—' : `${c.completion_rate.toFixed(0)}%`}</Numeric></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Listing Performance */}
          <Card title="Listing performance">
            {data.listingRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--lc-text-muted)]">No listing performance data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[var(--lc-text-muted)]">
                    <tr className="border-b border-[var(--lc-border)]">
                      <th className="px-3 py-2 font-medium">Listing</th>
                      <th className="px-3 py-2 font-medium">Location</th>
                      <th className="px-3 py-2 font-medium text-right">Views</th>
                      <th className="px-3 py-2 font-medium text-right">Saves</th>
                      <th className="px-3 py-2 font-medium text-right">Inquiries</th>
                      <th className="px-3 py-2 font-medium text-right">Conversions</th>
                      <th className="px-3 py-2 font-medium text-right">Conv. rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.listingRows.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--lc-border)] last:border-0">
                        <td className="px-3 py-2 font-medium">
                          <Link to={`/listings/${r.id}`} className="hover:underline">{r.title}</Link>
                        </td>
                        <td className="px-3 py-2 text-[var(--lc-text-muted)]">
                          {[r.neighborhood, r.city].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-right"><Numeric>{r.views}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{r.saves}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{r.inquiries}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{r.conversions}</Numeric></td>
                        <td className="px-3 py-2 text-right"><Numeric>{r.conversion_rate == null ? '—' : `${r.conversion_rate.toFixed(1)}%`}</Numeric></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default MarketingDashboardPage
