/**
 * Wave 2 WF-03 — Shared Prep compositions used as Chromatic / visual targets
 * until Phase A pages land (PublishReceiptPage, PortalTrackerPage,
 * PortalModerationQueuePage, PortalModerationDetailPage).
 *
 * These fixtures mirror brief a11y contracts so quality coverage can land
 * independently of Agent 1–5 screen PRs. When Phase A pages exist, page-level
 * suites import them instead (see wf03-phase-a-discovery.ts).
 */
import type { CSSProperties, ReactNode } from 'react'
import { StatusHero } from '@/components/recipient/StatusHero'
import { PrimaryCtaPerState } from '@/components/recipient/PrimaryCtaPerState'
import { PortalReceiptCard, type PortalErrorClass } from '@/components/portals/PortalReceiptCard'
import { PortalStatusPill, type PortalStatus } from '@/components/ui/portal-status-pill'
import { Numeric } from '@/components/ui/numeric'
import { Button } from '@/components/ui/button'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { EnvWarningStrip } from '@/components/nav/EnvWarningStrip'
import {
  PAQueueFilterStrip,
  PAQueueTable,
  PAQueueBulkBar,
  PAQueueBulkApproveDialog,
  PAQueueBulkReasonDialog,
  PAQueueKeyboardShortcutsPanel,
  type PAQueueColumn,
  type PAQueueRow,
} from '@/components/queue'

export type ReceiptAggregate =
  | 'ALL_SUCCEEDED'
  | 'MIXED'
  | 'ALL_FAILED'
  | 'IN_REVIEW_ONLY'
  | 'PARTIAL'
  | 'CROSS_COUNTRY'
  | 'RETRY_IN_FLIGHT'
  | 'OFFLINE'

const TS = '2026-09-08T14:22:00.000Z'

const PF_AE = {
  portal_code: 'property_finder_ae',
  portal_display_name: 'Property Finder UAE',
  country_code: 'AE',
}

const BAYUT = {
  portal_code: 'bayut_ae',
  portal_display_name: 'Bayut',
  country_code: 'AE',
}

const PF_SA = {
  portal_code: 'property_finder_sa',
  portal_display_name: 'Property Finder KSA',
  country_code: 'SA',
  all_country_codes: ['SA', 'AE', 'EG'],
}

type DestCard = {
  destination: typeof PF_AE | typeof BAYUT | typeof PF_SA
  status: 'succeeded' | 'in_review' | 'failed'
  error_class?: PortalErrorClass
  credit_charged: number
  credit_reserved: number
  live_url?: string
  retry_available?: boolean
  fix_deep_link?: string
  moderation_queue_deep_link?: string
  ariaBusy?: boolean
}

const RECEIPT_CARDS: Record<ReceiptAggregate, DestCard[]> = {
  ALL_SUCCEEDED: [
    {
      destination: PF_AE,
      status: 'succeeded',
      credit_charged: 2,
      credit_reserved: 2,
      live_url: 'https://www.propertyfinder.ae/en/plp/123',
    },
    {
      destination: BAYUT,
      status: 'succeeded',
      credit_charged: 1,
      credit_reserved: 1,
      live_url: 'https://www.bayut.com/property/123',
    },
  ],
  MIXED: [
    {
      destination: PF_AE,
      status: 'succeeded',
      credit_charged: 2,
      credit_reserved: 2,
      live_url: 'https://www.propertyfinder.ae/en/plp/123',
    },
    {
      destination: BAYUT,
      status: 'in_review',
      credit_charged: 0,
      credit_reserved: 1,
      moderation_queue_deep_link: '/admin/moderation/portals/sub_bayut',
    },
    {
      destination: {
        portal_code: 'dubizzle_ae',
        portal_display_name: 'dubizzle',
        country_code: 'AE',
      },
      status: 'failed',
      error_class: 'PORTAL_RULES_VIOLATION',
      credit_charged: 0,
      credit_reserved: 1,
      fix_deep_link: '/listings/lst_01H8/edit?focus=rules',
      retry_available: true,
    },
  ],
  ALL_FAILED: [
    {
      destination: PF_AE,
      status: 'failed',
      error_class: 'AUTH_EXPIRED',
      credit_charged: 0,
      credit_reserved: 2,
      fix_deep_link: '/settings/portals/property_finder_ae',
      retry_available: true,
    },
    {
      destination: BAYUT,
      status: 'failed',
      error_class: 'PORTAL_DOWN',
      credit_charged: 0,
      credit_reserved: 1,
      retry_available: true,
    },
  ],
  IN_REVIEW_ONLY: [
    {
      destination: PF_AE,
      status: 'in_review',
      credit_charged: 0,
      credit_reserved: 2,
      moderation_queue_deep_link: '/admin/moderation/portals/sub_pf',
    },
    {
      destination: BAYUT,
      status: 'in_review',
      credit_charged: 0,
      credit_reserved: 1,
      moderation_queue_deep_link: '/admin/moderation/portals/sub_bayut',
    },
  ],
  PARTIAL: [
    {
      destination: PF_AE,
      status: 'succeeded',
      credit_charged: 2,
      credit_reserved: 2,
      live_url: 'https://www.propertyfinder.ae/en/plp/123',
    },
    {
      destination: BAYUT,
      status: 'in_review',
      credit_charged: 0,
      credit_reserved: 1,
      moderation_queue_deep_link: '/admin/moderation/portals/sub_bayut',
    },
  ],
  CROSS_COUNTRY: [
    {
      destination: PF_SA,
      status: 'succeeded',
      credit_charged: 3,
      credit_reserved: 3,
      live_url: 'https://www.propertyfinder.sa/en/plp/99',
    },
    {
      destination: PF_AE,
      status: 'failed',
      error_class: 'QUOTA_EXCEEDED',
      credit_charged: 0,
      credit_reserved: 2,
      fix_deep_link: '/billing/credits',
    },
  ],
  RETRY_IN_FLIGHT: [
    {
      destination: PF_AE,
      status: 'failed',
      error_class: 'UNKNOWN_ERROR',
      credit_charged: 0,
      credit_reserved: 2,
      retry_available: true,
      ariaBusy: true,
    },
  ],
  OFFLINE: [
    {
      destination: PF_AE,
      status: 'in_review',
      credit_charged: 0,
      credit_reserved: 2,
      moderation_queue_deep_link: '/admin/moderation/portals/sub_pf',
    },
  ],
}

const HERO: Record<
  ReceiptAggregate,
  { state: 'approved' | 'pending' | 'rejected' | 'more_info'; label: string; emphasis?: 'loud' | 'default' }
> = {
  ALL_SUCCEEDED: { state: 'approved', label: 'Published to all portals', emphasis: 'loud' },
  MIXED: { state: 'more_info', label: 'Mixed publish outcome' },
  ALL_FAILED: { state: 'rejected', label: 'Publish failed on all portals' },
  IN_REVIEW_ONLY: { state: 'pending', label: 'In review on all portals' },
  PARTIAL: { state: 'more_info', label: 'Partially published' },
  CROSS_COUNTRY: { state: 'more_info', label: 'Mixed publish outcome' },
  RETRY_IN_FLIGHT: { state: 'pending', label: 'Retry in progress' },
  OFFLINE: { state: 'pending', label: 'Waiting for connection' },
}

function AggregateCounterRow({
  succeeded,
  inReview,
  failed,
  muteFailed,
}: {
  succeeded: number
  inReview: number
  failed: number
  muteFailed?: boolean
}) {
  return (
    <ul
      className="mx-auto flex max-w-[1200px] flex-wrap gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
      aria-label="Publish outcome counts"
    >
      <li>
        <Numeric aria-label={`${succeeded} succeeded`}>{succeeded} succeeded</Numeric>
      </li>
      <li>
        <Numeric aria-label={`${inReview} in review`}>{inReview} in review</Numeric>
      </li>
      <li className={muteFailed ? 'text-[var(--lc-text-muted)]' : undefined}>
        <Numeric aria-label={`${failed} failed`}>{failed} failed</Numeric>
      </li>
    </ul>
  )
}

function countCards(cards: DestCard[]) {
  return {
    succeeded: cards.filter((c) => c.status === 'succeeded').length,
    inReview: cards.filter((c) => c.status === 'in_review').length,
    failed: cards.filter((c) => c.status === 'failed').length,
  }
}

/** AGT-PUB-003 receipt composition (8 aggregate variants). */
export function Wf03ReceiptFixture({
  aggregate,
  viewport = 'mobile',
}: {
  aggregate: ReceiptAggregate
  viewport?: 'mobile' | 'tablet' | 'desktop'
}) {
  const cards = RECEIPT_CARDS[aggregate]
  const hero = HERO[aggregate]
  const counts = countCards(cards)
  const width =
    viewport === 'desktop' ? 1440 : viewport === 'tablet' ? 1024 : 375

  return (
    <div
      data-testid="wf03-receipt-fixture"
      data-aggregate={aggregate}
      data-viewport={viewport}
      style={{ width, maxWidth: '100%' } as CSSProperties}
      className="bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="receipt-live-region">
        {aggregate === 'RETRY_IN_FLIGHT'
          ? 'Property Finder UAE status changed to Retrying.'
          : `Publish outcome: ${hero.label}`}
      </div>
      {/* StatusHero is the labelled landmark (brief §A11y). Do not nest a second section. */}
      <StatusHero
        state={hero.state}
        label={hero.label}
        timestamp={TS}
        emphasis={hero.emphasis ?? 'default'}
      />
      {/* Brief id alias for contract tests that look up publish-outcome-label */}
      <span id="publish-outcome-label" className="sr-only">
        {hero.label}
      </span>
      <AggregateCounterRow
        succeeded={counts.succeeded}
        inReview={counts.inReview}
        failed={counts.failed}
        muteFailed={aggregate === 'PARTIAL'}
      />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] pb-[var(--lc-space-lg)]">
        {cards.map((card) => (
          <div
            key={card.destination.portal_code}
            aria-busy={card.ariaBusy ? true : undefined}
          >
            <PortalReceiptCard
              destination={card.destination}
              status={card.status}
              error_class={card.error_class}
              credit_charged={card.credit_charged}
              credit_reserved={card.credit_reserved}
              timestamp={TS}
              live_url={card.live_url}
              retry_available={card.retry_available}
              fix_deep_link={card.fix_deep_link}
              moderation_queue_deep_link={card.moderation_queue_deep_link}
              onRetry={() => {}}
              onContactSupport={() => {}}
            />
          </div>
        ))}
      </div>
      <PrimaryCtaPerState
        layout={viewport === 'mobile' ? 'stacked' : 'inline'}
        primary={{
          key: 'primary',
          label: aggregate === 'ALL_FAILED' ? 'Fix and retry' : 'View my listings',
          variant: 'default',
          href: '/listings',
        }}
        secondary={{
          key: 'secondary',
          label: 'Publish another',
          variant: 'outline',
          href: '/publish',
        }}
      />
    </div>
  )
}

type TrackerRow = {
  id: string
  listing: string
  portal: string
  status: PortalStatus
  credits: number
  updated: string
}

const TRACKER_ROWS: TrackerRow[] = [
  {
    id: 'tr1',
    listing: 'Marina Gate T2 · 1204',
    portal: 'Property Finder UAE',
    status: 'live',
    credits: 2,
    updated: '2h ago',
  },
  {
    id: 'tr2',
    listing: 'Marina Gate T2 · 1204',
    portal: 'Bayut',
    status: 'in_review',
    credits: 1,
    updated: '45m ago',
  },
  {
    id: 'tr3',
    listing: 'Downtown Views · 802',
    portal: 'Property Finder UAE',
    status: 'failed',
    credits: 0,
    updated: '1h ago',
  },
  {
    id: 'tr4',
    listing: 'Arabian Ranches · Villa 14',
    portal: 'dubizzle',
    status: 'rejected',
    credits: 0,
    updated: '3h ago',
  },
  {
    id: 'tr5',
    listing: 'JLT Cluster W · 504',
    portal: 'Property Finder UAE',
    status: 'submitted',
    credits: 2,
    updated: '12m ago',
  },
  {
    id: 'tr6',
    listing: 'Business Bay · 2101',
    portal: 'Property Finder KSA',
    status: 'expired',
    credits: 0,
    updated: '1d ago',
  },
]

/** AGT-PUB-006 dense tracker composition. */
export function Wf03TrackerFixture({
  viewport = 'desktop',
}: {
  viewport?: 'mobile' | 'tablet' | 'desktop'
}) {
  const width =
    viewport === 'desktop' ? 1440 : viewport === 'tablet' ? 1024 : 375

  return (
    <div
      data-testid="wf03-tracker-fixture"
      data-viewport={viewport}
      style={{ width, maxWidth: '100%' } as CSSProperties}
      className="bg-[var(--lc-bg-page)] p-[var(--lc-space-md)] text-[var(--lc-text-primary)]"
    >
      <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Portal tracker</h1>
      <div aria-live="polite" className="sr-only" data-testid="tracker-live-region">
        Submission for Marina Gate T2 · 1204 on Bayut is now In review.
      </div>
      <section
        aria-label="Portal submissions summary"
        className="mt-[var(--lc-space-md)] grid grid-cols-2 gap-[var(--lc-space-sm)] md:grid-cols-4"
      >
        {[
          ['Live', 12],
          ['In review', 4],
          ['Failed', 2],
          ['Credits used', 38],
        ].map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-sm)]"
          >
            <h2 className="text-sm text-[var(--lc-text-muted)]">{label}</h2>
            <Numeric className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {value}
            </Numeric>
          </article>
        ))}
      </section>

      <div
        role="toolbar"
        aria-label="Filter portal submissions"
        className="mt-[var(--lc-space-md)] flex flex-wrap gap-2"
      >
        {['All portals', 'Status', 'Last 7 days'].map((chip) => (
          <Button
            key={chip}
            type="button"
            variant="outline"
            size="sm"
            aria-haspopup="dialog"
            aria-expanded={false}
            className="min-h-tap"
          >
            {chip}
          </Button>
        ))}
      </div>

      {viewport === 'mobile' ? (
        <ul className="mt-[var(--lc-space-md)] space-y-2" aria-label="Portal submissions">
          {TRACKER_ROWS.map((row) => (
            <li key={row.id}>
              <a
                role="button"
                href={`/publish/receipt/${row.id}`}
                className="flex min-h-tap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3 focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.listing}</p>
                  <p className="text-sm text-[var(--lc-text-muted)]">{row.portal}</p>
                </div>
                <PortalStatusPill status={row.status} />
                <span aria-hidden="true" className="text-[var(--lc-text-muted)]">
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <table className="mt-[var(--lc-space-md)] w-full border-collapse text-start" aria-label="Portal submissions">
          <thead>
            <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
              <th scope="col" className="px-2 py-2 text-start">
                Listing
              </th>
              <th scope="col" className="px-2 py-2 text-start">
                Portal
              </th>
              <th scope="col" className="px-2 py-2 text-start">
                Status
              </th>
              <th scope="col" className="px-2 py-2 text-start">
                Credits
              </th>
              <th scope="col" className="px-2 py-2 text-start">
                Updated
              </th>
              <th scope="col" className="px-2 py-2 text-start">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {TRACKER_ROWS.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                className="min-h-tap border-b border-[var(--lc-border)] focus-visible:outline-none"
              >
                <td className="px-2 py-3">{row.listing}</td>
                <td className="px-2 py-3">{row.portal}</td>
                <td className="px-2 py-3">
                  <PortalStatusPill status={row.status} />
                </td>
                <td className="px-2 py-3">
                  <Numeric>{row.credits}</Numeric>
                </td>
                <td className="px-2 py-3">
                  <time dateTime={TS} aria-label={`${row.updated}, 08 Sep 2026, 14:22`}>
                    {row.updated}
                  </time>
                </td>
                <td className="px-2 py-3">
                  <Button type="button" variant="ghost" size="sm" aria-label={`Open receipt for ${row.listing}`}>
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button type="button" variant="outline" className="mt-[var(--lc-space-md)] min-h-tap">
        Load more
      </Button>
    </div>
  )
}

type ModRow = PAQueueRow & {
  agent: string
  listing: string
  portal: string
  risk: string
}

const MOD_ROWS: ModRow[] = [
  {
    id: 'sub_01',
    agent: 'Sara Al Mansouri',
    listing: 'Marina Gate T2 · 1204',
    portal: 'Property Finder AE',
    risk: 'Low',
  },
  {
    id: 'sub_02',
    agent: 'Omar Haddad',
    listing: 'Downtown Views · 802',
    portal: 'Bayut',
    risk: 'Medium',
  },
  {
    id: 'sub_03',
    agent: 'Layla Farouk',
    listing: 'Riyadh Off-plan · A12',
    portal: 'Property Finder SA',
    risk: 'High',
  },
]

const MOD_COLUMNS: PAQueueColumn<ModRow>[] = [
  { id: 'agent', header: 'Agent', cell: (r) => r.agent },
  { id: 'listing', header: 'Listing', cell: (r) => r.listing },
  { id: 'portal', header: 'Portal', cell: (r) => r.portal },
  { id: 'risk', header: 'Risk', cell: (r) => r.risk },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    srOnlyHeader: true,
    cell: () => (
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" aria-label="Approve">
          Approve
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="Reject">
          Reject
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="Request info">
          Info
        </Button>
      </div>
    ),
  },
]

/** PA-MOD-001 queue composition (optional bulk-select + shortcuts). */
export function Wf03PaQueueFixture({
  bulkSelect = false,
  shortcutsOpen = false,
  env = 'live',
  viewport = 'desktop',
}: {
  bulkSelect?: boolean
  shortcutsOpen?: boolean
  env?: 'live' | 'test'
  viewport?: 'mobile' | 'tablet' | 'desktop'
}) {
  const width =
    viewport === 'desktop' ? 1440 : viewport === 'tablet' ? 1024 : 375
  const selected = bulkSelect ? new Set(['sub_01', 'sub_02']) : new Set<string>()

  return (
    <div
      data-testid="wf03-pa-queue-fixture"
      data-bulk={bulkSelect ? 'true' : 'false'}
      data-viewport={viewport}
      data-env={env}
      style={{ width, maxWidth: '100%' } as CSSProperties}
      className="bg-[var(--lc-bg-page)] p-[var(--lc-space-md)] text-[var(--lc-text-primary)]"
    >
      <a href="#pa-mod-queue-table" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <div className="mb-2 flex items-center gap-2">
        <EnvBadge env={env} />
        <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Portal moderation queue</h1>
        <Button type="button" variant="ghost" size="icon" aria-label="Show keyboard shortcuts">
          ?
        </Button>
      </div>
      {env === 'test' ? <EnvWarningStrip onSwitchToLive={() => {}} /> : null}

      <PAQueueFilterStrip
        aria-label="Filter portal submissions"
        envBadge={<EnvBadge env={env} />}
        statusOptions={[
          { value: 'pending', label: 'Pending', count: 18 },
          { value: 'approved', label: 'Approved', count: 42 },
          { value: 'rejected', label: 'Rejected', count: 9 },
        ]}
        values={{
          status: 'pending',
          submittedWithin: '7d',
          riskTier: 'any',
          search: '',
        }}
      />

      {bulkSelect ? (
        <div className="my-[var(--lc-space-sm)]">
          <PAQueueBulkBar
            showBulk
            selectedCount={2}
            acrossCount={2}
            highRiskCount={0}
            onClearSelection={() => {}}
            onApprove={() => {}}
            onReject={() => {}}
            onRequestInfo={() => {}}
          />
        </div>
      ) : null}

      <div id="pa-mod-queue-table">
        <PAQueueTable
          aria-label="Portal moderation submissions"
          columns={MOD_COLUMNS}
          rows={MOD_ROWS}
          selectable
          selectedIds={selected}
          focusedId="sub_01"
          onSelectionChange={() => {}}
          onRowClick={() => {}}
        />
      </div>

      <PAQueueKeyboardShortcutsPanel open={shortcutsOpen} onOpenChange={() => {}} />
      <PAQueueBulkApproveDialog open={false} count={2} entityLabel="portal submissions" />
      <PAQueueBulkReasonDialog
        open={false}
        count={2}
        mode="reject"
        reasonOptions={[{ value: 'insufficient_photos', label: 'Insufficient photos' }]}
      />
    </div>
  )
}

/** PA-MOD-002 detail diff panel (desktop 1440 / tablet 1024 readability). */
export function Wf03PaModDetailFixture({
  viewport = 'desktop',
  modalOpen = false,
}: {
  viewport?: 'tablet' | 'desktop'
  modalOpen?: boolean
}) {
  const width = viewport === 'desktop' ? 1440 : 1024

  return (
    <div
      data-testid="wf03-pa-mod-detail-fixture"
      data-viewport={viewport}
      style={{ width, maxWidth: '100%' } as CSSProperties}
      className="bg-[var(--lc-bg-page)] p-[var(--lc-space-md)] text-[var(--lc-text-primary)]"
    >
      <a href="#pa-mod-detail-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <nav aria-label="Submission navigation" className="mb-4 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Previous pending submission">
          ‹
        </Button>
        <span role="status">
          Submission <Numeric>3</Numeric> of <Numeric>18</Numeric> pending
        </span>
        <Button type="button" variant="ghost" size="icon" aria-label="Next pending submission">
          ›
        </Button>
      </nav>

      <div id="pa-mod-detail-main" className="grid gap-[var(--lc-space-md)] lg:grid-cols-[1fr_320px]">
        <div>
          <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Marina Gate T2 · 1204</h1>
          <p className="text-sm text-[var(--lc-text-muted)]">Dubai Marina, Dubai</p>

          <section
            aria-labelledby="payload-diff-heading"
            data-testid="payload-diff-panel"
            className="mt-[var(--lc-space-md)] overflow-x-auto rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]"
          >
            <h2 id="payload-diff-heading" className="border-b border-[var(--lc-border)] px-4 py-3">
              Payload diff
            </h2>
            <table className="w-full min-w-[640px] border-collapse text-start text-sm">
              <thead>
                <tr className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                  <th scope="col" className="px-3 py-2">
                    Field
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Submitted
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Portal canonical
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['title', 'Marina Gate T2 1204', 'Marina Gate Tower 2, Apt 1204'],
                  ['price', 'AED 2,450,000', '2450000 AED'],
                  ['bedrooms', '2', '2'],
                  ['size_sqft', '1,142', '1142'],
                ].map(([field, submitted, canonical]) => (
                  <tr key={field} className="border-t border-[var(--lc-border)]">
                    <th scope="row" className="px-3 py-2 font-medium">
                      {field}
                    </th>
                    <td className="px-3 py-2 font-[family-name:var(--lc-font-mono)]">{submitted}</td>
                    <td className="px-3 py-2 font-[family-name:var(--lc-font-mono)]">{canonical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section
          aria-labelledby="decision-heading"
          className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]"
        >
          <h2 id="decision-heading" className="sr-only">
            Decision
          </h2>
          <div className="flex flex-col gap-2">
            <Button type="button" className="min-h-tap" aria-label="Approve — publish to Property Finder AE">
              Approve
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-tap"
              aria-label="Reject — do not publish to Property Finder AE"
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-tap"
              aria-label="Request more info from agent"
            >
              Request info
            </Button>
          </div>
        </section>
      </div>

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          data-testid="pa-mod-detail-modal"
          className="fixed inset-0 z-modal flex items-center justify-center bg-[color-mix(in_srgb,var(--lc-text-primary)_40%,transparent)] p-4"
        >
          <div className="w-full max-w-md rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-[var(--lc-elevation-lg)]">
            <h2 id="reject-modal-title">Reject submission</h2>
            <label htmlFor="reject-reason" className="mt-3 block text-sm">
              Reason
            </label>
            <select id="reject-reason" className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3">
              <option>Insufficient photos</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="button">Confirm reject</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function wrapFixture(node: ReactNode) {
  return node
}

export const RECEIPT_AGGREGATES: ReceiptAggregate[] = [
  'ALL_SUCCEEDED',
  'MIXED',
  'ALL_FAILED',
  'IN_REVIEW_ONLY',
  'PARTIAL',
  'CROSS_COUNTRY',
  'RETRY_IN_FLIGHT',
  'OFFLINE',
]
