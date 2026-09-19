import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Share2,
  Shield,
} from 'lucide-react'
import {
  api,
  type SellerReportResponse,
  type SellerReportShareToken,
} from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { PerformanceTab } from '@/components/performance/PerformanceTab'
import { apiErrorMessage } from '@/lib/http-status'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'performance', label: 'Performance' },
  { id: 'share', label: 'Share' },
] as const

type SectionId = typeof SECTIONS[number]['id']

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function KpiTile({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border-subtle)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-sm)]">
      <p className="text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">{label}</p>
      <p className="mt-2 text-[length:var(--lc-type-display)] font-semibold text-[var(--lc-text-primary)]">
        <Numeric>{value}</Numeric>
        {suffix ? <span className="ms-1 text-sm font-normal text-[var(--lc-text-muted)]">{suffix}</span> : null}
      </p>
    </div>
  )
}

export function SellerPerformanceReportPage() {
  const { id } = useParams<{ id: string }>()
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const [data, setData] = useState<SellerReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [section, setSection] = useState<SectionId>('overview')
  const [stateOfPlay, setStateOfPlay] = useState('')
  const [agentSummary, setAgentSummary] = useState('')
  const [showOfferAmounts, setShowOfferAmounts] = useState(false)
  const [showFullAddress, setShowFullAddress] = useState(false)

  const payload = data?.payload
  usePageTitle(payload?.property?.title ? `Seller report | ${payload.property.title}` : 'Seller performance report')

  useEffect(() => {
    if (!id || authLoading || !agent) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const response = await api.getSellerReport(id)
        if (cancelled) return
        setData(response)
        setStateOfPlay(response.payload.report.state_of_play || '')
        setAgentSummary(response.payload.report.agent_summary || '')
        setShowOfferAmounts(response.report.show_offer_amounts)
        setShowFullAddress(response.report.show_full_address)
      } catch (err) {
        if (cancelled) return
        addToast({
          title: 'Could not load seller report',
          description: apiErrorMessage(err, 'Please try again.'),
          variant: 'error',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, agent, authLoading])

  const activeTokens = useMemo(
    () => (data?.share_tokens || []).filter((token) => !token.revoked_at),
    [data?.share_tokens],
  )

  async function saveReport() {
    if (!id || saving) return
    setSaving(true)
    try {
      const response = await api.updateSellerReport(id, {
        state_of_play: stateOfPlay.trim() || null,
        agent_summary: agentSummary.trim() || null,
        show_offer_amounts: showOfferAmounts,
        show_full_address: showFullAddress,
      })
      setData((prev) => prev ? {
        ...prev,
        report: response.report,
        payload: response.payload,
      } : prev)
      addToast({ title: 'Report updated', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not save report',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function createShareLink() {
    if (!id || sharing) return
    setSharing(true)
    try {
      const token = await api.createSellerReportShareToken(id)
      setData((prev) => prev ? {
        ...prev,
        share_tokens: [token, ...prev.share_tokens],
      } : prev)
      addToast({ title: 'Share link created', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not create share link',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    } finally {
      setSharing(false)
    }
  }

  async function copyShareUrl(token: SellerReportShareToken) {
    const url = `${window.location.origin}/r/${token.token}`
    try {
      await navigator.clipboard.writeText(url)
      addToast({ title: 'Share link copied', variant: 'success' })
    } catch {
      addToast({ title: 'Copy failed', description: url, variant: 'error' })
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign in to manage the seller report</h1>
        <Link to="/login" className="mt-3 inline-block"><Button>Sign in</Button></Link>
      </div>
    )
  }

  if (!data || !payload) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold">Seller report unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This listing could not be loaded or you do not have access.</p>
        {id && (
          <Link to={`/listings/${id}`} className="mt-4 inline-block">
            <Button variant="outline">Back to listing</Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/listings/${id}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>
      </div>

      <div className="mb-6 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-inverse)] px-5 py-6 text-[var(--lc-text-on-inverse)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--lc-text-on-inverse-muted)]">Seller performance report</p>
            <h1 className="mt-1 text-2xl font-semibold">{payload.property.title}</h1>
            <p className="mt-1 text-sm text-[var(--lc-text-on-inverse-muted)]">{payload.property.location_label}</p>
          </div>
          <Badge variant={data.report.status === 'live' ? 'published' : 'draft'}>
            {data.report.status === 'frozen' ? 'Campaign ended' : data.report.status}
          </Badge>
        </div>
        <p className="mt-4 text-sm sm:text-base">{payload.report.state_of_play}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              section === item.id
                ? 'bg-slate-900 text-[var(--lc-action-primary-text)]'
                : 'bg-muted text-muted-foreground hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-6">
          {payload.is_empty ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Your campaign just started. Metrics will appear here as posts go live and inquiries arrive.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Days on market" value={payload.summary.days_on_market} />
            <KpiTile label="Posts live" value={payload.summary.posts_count} />
            <KpiTile label="Inquiries" value={payload.summary.inquiries_received} />
            <KpiTile label="Qualified leads" value={payload.summary.qualified_inquiries} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Agent summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="state-of-play">State of play</Label>
                  <textarea
                    id="state-of-play"
                    value={stateOfPlay}
                    onChange={(event) => setStateOfPlay(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Strong early interest, priced at market — 2 offers under review."
                  />
                </div>
                <div>
                  <Label htmlFor="agent-summary">Seller-facing commentary</Label>
                  <textarea
                    id="agent-summary"
                    value={agentSummary}
                    onChange={(event) => setAgentSummary(event.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Summarize what you have done this week and what buyers are saying."
                  />
                </div>
                <Button onClick={saveReport} disabled={saving}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  Save commentary
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Property snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Reference:</span> {payload.property.reference}</p>
                <p><span className="text-muted-foreground">Ask:</span> {formatMoney(payload.property.price, payload.property.price_unit)}</p>
                <p><span className="text-muted-foreground">Shielded inquiries:</span> <Numeric>{payload.summary.shielded_inquiries}</Numeric></p>
                {payload.inquiries.untriaged > 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <Numeric>{payload.inquiries.untriaged}</Numeric> leads still untriaged — qualify them to keep this report accurate.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {payload.feedback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buyer feedback highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.feedback.map((item) => (
                  <div key={item.id} className="rounded-md border border-[var(--lc-border-subtle)] px-3 py-2 text-sm">
                    {item.outcome}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {section === 'marketing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Marketing checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payload.marketing.channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published posts yet. Promote the listing to populate this section.</p>
            ) : (
              payload.marketing.channels.map((channel) => (
                <div key={channel.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium capitalize">{channel.platform}</p>
                    <p className="text-xs text-muted-foreground">
                      {channel.published_at ? new Date(channel.published_at).toLocaleDateString() : 'Published'}
                      {' · '}
                      <Numeric>{channel.views}</Numeric> views
                    </p>
                  </div>
                  {channel.post_url ? (
                    <a href={channel.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                      View post <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Badge variant="outline">Live</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {section === 'performance' && id && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Performance dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceTab listingId={id} />
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'share' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Share2 className="h-4 w-4" />
                Share with the seller
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a revocable link the seller can open on mobile. Offer amounts and the full address stay hidden unless you enable them below.
              </p>
              <Button onClick={createShareLink} disabled={sharing}>
                {sharing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Link2 className="me-2 h-4 w-4" />}
                Create share link
              </Button>
              <div className="space-y-2">
                {activeTokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active share links yet.</p>
                ) : (
                  activeTokens.map((token) => (
                    <div key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <code className="text-xs break-all">{token.token}</code>
                      <Button variant="outline" size="sm" onClick={() => copyShareUrl(token)}>
                        <Copy className="me-1 h-3.5 w-3.5" />
                        Copy link
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Client-safe visibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={showOfferAmounts}
                  onChange={(event) => setShowOfferAmounts(event.target.checked)}
                  className="mt-1"
                />
                <span>Show offer amounts on the shared report</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={showFullAddress}
                  onChange={(event) => setShowFullAddress(event.target.checked)}
                  className="mt-1"
                />
                <span>Show the full property address instead of area-only</span>
              </label>
              <Button variant="outline" onClick={saveReport} disabled={saving}>
                Save visibility settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
