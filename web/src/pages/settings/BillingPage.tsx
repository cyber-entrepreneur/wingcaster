import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { api, type TenantInvoice, type TenantSubscription } from '@/api/client'
import { SavedPill, SettingsPaneHeader } from '@/components/settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { isNotFound } from '@/lib/http-status'
import { formatLongDate, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'
import type { NotificationPreferenceRow } from '@/types/subscriptionNotifications'
import { cn } from '@/lib/utils'

const CHANNELS = ['whatsapp', 'email', 'sms', 'push'] as const
type Channel = (typeof CHANNELS)[number]

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
}

const EVENT_LABELS: Record<string, string> = {
  invoice_sent: 'Invoice sent',
  payment_failed: 'Payment failed',
  renewal_approaching: 'Subscription renewing soon',
  credit_low: 'Credit balance low',
  credit_exhausted: 'Credit balance exhausted',
  'subscription.trial_ending': 'Trial ending soon',
  'subscription.trial_ended': 'Trial ended',
  'subscription.renewed': 'Renewal successful',
  'subscription.past_due': 'Past due (action required)',
  'subscription.reactivated': 'Subscription reactivated',
  'subscription.cancelled_at_period_end': 'Cancellation scheduled',
  'subscription.cancelled_immediately': 'Cancellation confirmation',
  'subscription.expired': 'Subscription ended',
  'subscription.paused': 'Subscription paused',
  'subscription.resumed': 'Subscription resumed',
  'subscription.upgraded': 'Plan upgraded',
  'subscription.downgraded': 'Plan downgraded',
  'subscription.migrated_version': 'Plan version migrated',
  'subscription.grandfathered': 'New plan version available',
  'credit_note.issued': 'Credit note issued',
}

type PrefMatrix = Record<string, Record<string, boolean>>

function normalizePrefs(
  prefs: NotificationPreferenceRow[] | Record<string, Record<string, boolean>> | undefined,
  eventKinds: string[],
): PrefMatrix {
  const matrix: PrefMatrix = {}
  const kinds = eventKinds.length ? eventKinds : Object.keys(EVENT_LABELS)
  for (const kind of kinds) matrix[kind] = { whatsapp: false, email: true, sms: false, push: false }

  if (prefs && !Array.isArray(prefs)) {
    for (const [kind, channels] of Object.entries(prefs)) {
      matrix[kind] = { ...(matrix[kind] || {}), ...channels }
    }
    return matrix
  }

  for (const row of prefs || []) {
    if (!matrix[row.event_kind]) matrix[row.event_kind] = { whatsapp: false, email: false, sms: false, push: false }
    const ch = row.channel === 'in_app' ? 'push' : row.channel
    matrix[row.event_kind][ch] = row.enabled
  }
  return matrix
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid' || s === 'issued') return { variant: 'published' as const, glyph: '●', label: 'Paid' }
  if (s === 'failed') return { variant: 'unpublished' as const, glyph: '✕', label: 'Failed' }
  if (s === 'refunded') return { variant: 'archived' as const, glyph: '▢', label: 'Refunded' }
  return { variant: 'draft' as const, glyph: '○', label: 'Pending' }
}

function formatMinor(amount: number | undefined, currency = 'USD') {
  const value = (amount ?? 0) / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

export function BillingPage({ section }: { section?: 'subscription' | 'invoices' | 'channels' } = {}) {
  const { agent } = useAuth()
  const { activeTenant } = useTenant()
  const { addToast } = useToast()
  usePageTitle('Billing & notifications')

  const [tab, setTab] = useState(section || 'subscription')
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)
  const [invoices, setInvoices] = useState<TenantInvoice[]>([])
  const [filter, setFilter] = useState('all')
  const [matrix, setMatrix] = useState<PrefMatrix>({})
  const [eventKinds, setEventKinds] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portalBusy, setPortalBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sub, inv, prefs] = await Promise.all([
        api.getTenantSubscription().catch(() => ({ subscription: null, tenant_id: '' })),
        api.getTenantInvoices().catch(() => ({ invoices: [] as TenantInvoice[] })),
        api.getMyNotificationPreferences().catch(() => ({ preferences: [], event_kinds: [] as string[] })),
      ])
      setSubscription(sub.subscription)
      setInvoices(inv.invoices || [])
      const kinds = prefs.event_kinds?.length ? prefs.event_kinds : Object.keys(EVENT_LABELS)
      setEventKinds(kinds)
      setMatrix(normalizePrefs(prefs.preferences, kinds))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (agent?.id) void load()
  }, [agent?.id, load])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), 1500)
    return () => window.clearTimeout(id)
  }, [saved])

  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices
    return invoices.filter((inv) => String(inv.status).toLowerCase() === filter)
  }, [invoices, filter])

  async function openPortal(sectionHint?: string) {
    setPortalBusy(true)
    try {
      const res = await api.createBillingPortalSession(sectionHint)
      if (res?.url) window.open(res.url, '_blank', 'noopener')
      else throw new Error('No portal URL')
    } catch (err) {
      addToast({
        title: "Couldn't open Paddle portal. Try again.",
        description: isNotFound(err) ? 'Portal session is not available yet.' : undefined,
        variant: 'error',
      })
    } finally {
      setPortalBusy(false)
    }
  }

  async function toggleCell(event: string, channel: Channel) {
    const prev = matrix[event]?.[channel] ?? false
    const next = !prev
    setMatrix((m) => ({ ...m, [event]: { ...m[event], [channel]: next } }))
    try {
      await api.updateMyNotificationPreferences([{ event_kind: event, channel, enabled: next }])
      setSaved(true)
    } catch (err) {
      setMatrix((m) => ({ ...m, [event]: { ...m[event], [channel]: prev } }))
      addToast({
        title: 'Could not save preference',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    }
  }

  async function testSend(channel: Channel) {
    try {
      await api.testBillingNotification(channel)
      addToast({ title: `Test sent — check your ${CHANNEL_LABEL[channel]}.`, variant: 'success' })
    } catch {
      addToast({ title: "Couldn't send test. Try again.", variant: 'error' })
    }
  }

  const tenantName = activeTenant?.name || 'this workspace'
  const priceMinor = subscription?.monthly_price_minor
  const tier = (subscription?.tier || subscription?.status || 'free').toLowerCase()

  if (loading) {
    return (
      <div className="space-y-[var(--lc-space-lg)]" aria-busy="true">
        <div className="h-24 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        <div className="h-48 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </div>
    )
  }

  return (
    <div>
      <SettingsPaneHeader
        title="Billing & notifications"
        sub={
          <>
            For <strong>{tenantName}</strong>. Switch tenant in the top bar to see other subscriptions.
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="md:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="channels">Notification channels</TabsTrigger>
        </TabsList>
        <TabsContent value="subscription">
          <SubscriptionSection
            subscription={subscription}
            priceMinor={priceMinor}
            tier={tier}
            portalBusy={portalBusy}
            onPortal={() => void openPortal()}
          />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoiceSection invoices={filteredInvoices} filter={filter} onFilter={setFilter} />
        </TabsContent>
        <TabsContent value="channels">
          <ChannelMatrix
            matrix={matrix}
            eventKinds={eventKinds}
            saved={saved}
            onToggle={toggleCell}
            onTest={testSend}
          />
        </TabsContent>
      </Tabs>

      <div className="hidden space-y-[var(--lc-space-2xl)] md:block">
        <nav className="sticky top-0 z-10 flex gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] py-[var(--lc-space-sm)]" aria-label="Billing sections">
          <a href="#billing-subscription" className="text-[var(--lc-text-brand)]">Subscription</a>
          <a href="#billing-invoices" className="text-[var(--lc-text-brand)]">Invoices</a>
          <a href="#billing-channels" className="text-[var(--lc-text-brand)]">Notification channels</a>
        </nav>
        <div id="billing-subscription">
          <SubscriptionSection
            subscription={subscription}
            priceMinor={priceMinor}
            tier={tier}
            portalBusy={portalBusy}
            onPortal={() => void openPortal()}
            onPayment={() => void openPortal('payment-methods')}
          />
        </div>
        <div id="billing-invoices">
          <InvoiceSection invoices={filteredInvoices} filter={filter} onFilter={setFilter} />
        </div>
        <div id="billing-channels">
          <ChannelMatrix
            matrix={matrix}
            eventKinds={eventKinds}
            saved={saved}
            onToggle={toggleCell}
            onTest={testSend}
          />
        </div>
      </div>
    </div>
  )
}

function SubscriptionSection({
  subscription,
  priceMinor,
  tier,
  portalBusy,
  onPortal,
  onPayment,
}: {
  subscription: TenantSubscription | null
  priceMinor?: number
  tier: string
  portalBusy: boolean
  onPortal: () => void
  onPayment?: () => void
}) {
  const badge =
    tier.includes('trial') ? 'draft' : tier.includes('free') ? 'draft' : 'published'
  return (
    <section>
      <h2 className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
        Your current plan
      </h2>
      <Card className="shadow-[var(--lc-elevation-sm)]">
        <CardContent className="space-y-[var(--lc-space-sm)] p-[var(--lc-space-lg)]">
          <div className="flex flex-wrap items-center gap-[var(--lc-space-sm)]">
            <h3 style={{ font: 'var(--lc-type-heading-2)' }}>
              {subscription?.display_name || 'No active plan'}
            </h3>
            <Badge variant={badge} status={badge}>
              {tier}
            </Badge>
          </div>
          {priceMinor != null ? (
            <p>
              <Numeric className="text-[length:var(--lc-type-display)]" style={{ font: 'var(--lc-type-display)' }}>
                {formatMinor(priceMinor)}
              </Numeric>{' '}
              <span className="text-[var(--lc-text-muted)]">USD / month</span>
            </p>
          ) : null}
          {subscription?.billing_cycle_end ? (
            <p className="text-[var(--lc-text-muted)]">
              Renews on {formatLongDate(subscription.billing_cycle_end)}
            </p>
          ) : null}
          <Button type="button" onClick={onPortal} disabled={portalBusy} aria-label="Manage in Paddle portal, opens in new tab">
            {portalBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ExternalLink className="me-2 h-4 w-4" />}
            Manage in Paddle portal ↗
          </Button>
        </CardContent>
      </Card>
      <div className="mt-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
        <p style={{ font: 'var(--lc-type-body-sm)' }}>Currency: USD</p>
        {onPayment ? (
          <button type="button" className="mt-2 text-[var(--lc-text-brand)]" onClick={onPayment}>
            Update payment method in Paddle portal ↗
          </button>
        ) : null}
      </div>
    </section>
  )
}

function InvoiceSection({
  invoices,
  filter,
  onFilter,
}: {
  invoices: TenantInvoice[]
  filter: string
  onFilter: (v: string) => void
}) {
  return (
    <section>
      <div className="mb-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          Invoice history
        </h2>
        <select
          aria-label="Filter invoices"
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          className="min-h-[var(--lc-tap-target-min)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      {invoices.length === 0 ? (
        <p className="text-[var(--lc-text-muted)]">
          No invoices yet.
          <span className="mt-1 block">When your first invoice is issued, it will appear here.</span>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
          <table className="w-full text-start">
            <thead className="bg-[var(--lc-surface-sunken)]" style={{ font: 'var(--lc-type-overline)' }}>
              <tr>
                <th className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start">Invoice #</th>
                <th className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start">Date</th>
                <th className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start">Amount</th>
                <th className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusBadge(inv.status)
                return (
                  <tr key={inv.id} className="border-t border-[var(--lc-border)]">
                    <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
                      <Numeric>{inv.invoice_number || inv.id}</Numeric>
                    </td>
                    <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
                      <Numeric>{inv.issued_at ? formatShortDate(inv.issued_at) : '—'}</Numeric>
                    </td>
                    <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]" dir="ltr">
                      <Numeric>{formatMinor(inv.total_minor, inv.currency || 'USD')}</Numeric>
                    </td>
                    <td className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
                      <Badge variant={st.variant}>
                        {st.glyph} {st.label}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ChannelMatrix({
  matrix,
  eventKinds,
  saved,
  onToggle,
  onTest,
}: {
  matrix: PrefMatrix
  eventKinds: string[]
  saved: boolean
  onToggle: (event: string, channel: Channel) => void
  onTest: (channel: Channel) => void
}) {
  const rows = eventKinds.length ? eventKinds : Object.keys(matrix)
  return (
    <section>
      <div className="mb-[var(--lc-space-sm)] flex items-center justify-between gap-[var(--lc-space-md)]">
        <div>
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
            Notification channels
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Choose how you want to be notified for each event. You can test each channel.
          </p>
        </div>
        <SavedPill visible={saved} />
      </div>
      <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
        <table className="w-full">
          <thead className="bg-[var(--lc-surface-sunken)]">
            <tr>
              <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-start">Event</th>
              {CHANNELS.map((ch) => (
                <th key={ch} scope="col" className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-center">
                  <div className="flex flex-col items-center gap-1">
                    {ch === 'whatsapp' ? <ChannelMark channel="whatsapp" /> : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                        {CHANNEL_LABEL[ch].slice(0, 2)}
                      </span>
                    )}
                    {CHANNEL_LABEL[ch]}
                    <Button variant="ghost" size="sm" type="button" onClick={() => onTest(ch)} aria-label={`Test send — ${CHANNEL_LABEL[ch]}`}>
                      Test send
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event} className="border-t border-[var(--lc-border)]">
                <th scope="row" className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
                  {EVENT_LABELS[event] || event}
                </th>
                {CHANNELS.map((ch) => (
                  <td key={ch} className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] text-center">
                    <label className={cn('inline-flex min-h-[var(--lc-tap-target-min)] min-w-[var(--lc-tap-target-min)] items-center justify-center')}>
                      <span className="sr-only">{EVENT_LABELS[event] || event} — {CHANNEL_LABEL[ch]}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(matrix[event]?.[ch])}
                        onChange={() => onToggle(event, ch)}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        Deal-activity notifications coming soon.
      </p>
    </section>
  )
}
