/**
 * Shared sample payloads for Wave 5 WF-05/WF-06 quality suites.
 * Default states use MASKED reporter identifiers via `<PIIMask>` —
 * plaintext fulls must never appear in Chromatic stand-in snapshots.
 */
import type {
  ComparableReportDetail,
  ComparableReportListItem,
} from '@/pages/admin/valuation/types'
import type {
  PriceReportDetail,
  PriceReportListItem,
  PriceReportListResponse,
} from '@/pages/admin/valuation/priceReportTypes'
import type {
  AgentPriceReportRow,
  ComparableReportRow,
} from '@/pages/agent/reports/outcomeTypes'

export const FIXED_NOW = new Date('2026-09-10T12:00:00.000Z').getTime()

/** Plaintext that must NEVER appear in default-state visual snapshots. */
export const PLAINTEXT_PII_FORBIDDEN = [
  'Ahmed Khan',
  'Sara Al Mansouri',
  'omar.khoury@example.ae',
  '+971 55 123 4512',
] as const

export function assertNoPlaintextPii(html: string, label: string) {
  for (const leak of PLAINTEXT_PII_FORBIDDEN) {
    if (html.includes(leak)) {
      throw new Error(`PII leak in ${label}: found plaintext "${leak}"`)
    }
  }
}

/**
 * Full-page Chromatic stand-in PII gate (visible + sr-only).
 * PA-PVA-009b sr-only heading no longer echoes agent display_name.
 */
export function assertNoVisiblePlaintextPii(root: HTMLElement, label: string) {
  assertNoPlaintextPii(root.innerHTML, label)
}


export function sampleComparableQueueItem(
  overrides: Partial<ComparableReportListItem> = {},
): ComparableReportListItem {
  return {
    id: 'cmr_001',
    created_at: new Date(FIXED_NOW - 3_600_000).toISOString(),
    sla_hours_remaining: 46.9,
    sla_hours_total: 48,
    status: 'pending',
    reason_category: 'already_sold',
    severity: 'high',
    reporter: {
      id: 'usr_ak',
      display_name: 'Ahmed Khan',
      avatar_url: null,
      agency: { id: 'agy_1', name: 'Abu Dhabi Prime' },
      pattern_flag: true,
      pattern_signals: {
        reports_against_agency_last_30d: 4,
        days_window: 21,
        agency_name: 'Saadiyat Homes',
      },
    },
    comparable: {
      id: 'cmp_1',
      title: 'Villa · Saadiyat',
      address_line: 'Saadiyat Beach, Abu Dhabi',
      thumb_url: null,
      source: 'external_scrape',
      source_display: 'OLX',
      owning_agency: { id: 'agy_2', name: 'Saadiyat Homes' },
    },
    market_impact: {
      tier: 'high',
      valuations_affected: 34,
      pct_move_median: -11.2,
      pct_move_max: -18.7,
    },
    evidence: { file_count: 3, files: [] },
    is_own: false,
    requires_two_person: true,
    env: 'live',
    ...overrides,
  }
}

export function sampleComparableDetail(
  overrides: Partial<ComparableReportDetail> = {},
): ComparableReportDetail {
  const base = sampleComparableQueueItem()
  return {
    ...base,
    reporter_claim: {
      reported_field: 'status',
      observed_value: 'sold',
      observed_at: '2026-08-14',
      reason_text: 'Sold per DLD record.',
      field_diffs: [
        { field: 'status', current: 'active', observed: 'sold' },
        { field: 'sale_date', current: null, observed: '2026-08-14' },
      ],
    },
    comparable: {
      ...base.comparable,
      current_fields: {
        price: 5200000,
        status: 'active',
        area_sqm: 380,
      },
      source_url: 'https://example.com/listing',
    },
    market_impact: {
      ...base.market_impact,
      top_markets: [
        { market: 'Saadiyat', count: 22 },
        { market: 'Yas', count: 7 },
      ],
    },
    ...overrides,
  }
}

/** High-impact remove awaiting second PA — surfaces `<TwoPersonProgress>`. */
export function sampleComparableTwoPersonDetail(
  overrides: Partial<ComparableReportDetail> = {},
): ComparableReportDetail {
  return sampleComparableDetail({
    status: 'pending_second_approval',
    requires_two_person: true,
    proposal: {
      proposed_by: { id: 'pa_1', display_name: 'PA Layla', initials: 'PL' },
      proposed_at: new Date(FIXED_NOW - 1_800_000).toISOString(),
      approval_request_id: 'apr_req_wf05',
    },
    ...overrides,
  })
}

export function mockComparableQueueList(reports: ComparableReportListItem[]) {
  return {
    reports,
    pagination: { page: 1, page_size: 25, total: reports.length, has_next: false },
    counts: {
      pending: reports.filter((r) => r.status === 'pending').length,
      pending_at_risk: 0,
      high_impact_awaiting_two_person: reports.filter((r) => r.requires_two_person).length,
      confirmed_removed_this_week: 0,
      confirmed_quarantined_this_week: 0,
      rejected_this_week: 0,
    },
  }
}

export function samplePriceQueueItem(
  overrides: Partial<PriceReportListItem> = {},
): PriceReportListItem {
  return {
    id: 'aprt_1',
    submitted_at: new Date(FIXED_NOW - 2 * 3600_000).toISOString(),
    agent: {
      id: 'usr_1',
      display_name: 'Sara Al Mansouri',
      tier: 'pro_elite',
      tenure_days: 1888,
    },
    agency: { id: 'agy_1', name: 'Elite Real Estate Dubai' },
    subject: {
      segment_label: 'Dubai Marina · 2-3BR apartments',
      segment_id: 'seg_dxb_marina',
      country_code: 'AE',
      country_flag_emoji: 'AE',
      comparable_listings_count: 18,
    },
    recommendation: { price_point: 1_850_000, currency: 'AED' },
    benchmark_delta: {
      benchmark_price_point: 1_562_500,
      benchmark_currency: 'AED',
      delta_pct: 18.4,
      delta_direction: 'above',
      delta_tier: 'high',
      stale: false,
    },
    sources: { comparable_count: 12, evidence_file_count: 5 },
    tenure_risk: { tier: 'low', score: 0.09 },
    composite_risk_tier: 'high',
    status: 'pending_review',
    is_own: false,
    step_up_required: true,
    two_person_required: true,
    env: 'live',
    ...overrides,
  }
}

export function mockPriceQueueList(reports: PriceReportListItem[]): PriceReportListResponse {
  return {
    reports,
    pagination: { page: 1, page_size: 25, total: reports.length, has_next: false },
    counts: {
      pending: reports.filter((r) => r.status === 'pending_review').length,
      pending_high_delta: reports.filter((r) => Math.abs(r.benchmark_delta?.delta_pct || 0) >= 10)
        .length,
      incorporated_this_month: 12,
      signal_only_this_month: 21,
      rejected_this_month: 4,
    },
  }
}

export function samplePriceDetail(overrides: Partial<PriceReportDetail> = {}): PriceReportDetail {
  const base = samplePriceQueueItem()
  return {
    ...base,
    subject: {
      ...base.subject,
      property_type: 'apartment',
      bedroom_range: '2-3',
    },
    recommendation: {
      price_low: 1_750_000,
      price_point: 1_850_000,
      price_high: 1_950_000,
      currency: 'AED',
    },
    benchmark_delta: {
      ...base.benchmark_delta,
      benchmark_computed_at: new Date(FIXED_NOW - 3 * 3600_000).toISOString(),
    },
    sources: { comparable_count: 2, evidence_file_count: 1 },
    parameters: {
      segment_definition: 'Dubai Marina neighborhood, buildings completed post-2015',
      time_window: 'Q2-Q3 2026 (6 months)',
      analysis_basis: 'mix_transactions_and_active_listings',
      recommendation_type: 'band',
    },
    analysis: { format: 'markdown', body: 'Post-Expo demand shift remains strong in Marina Gate.' },
    cited_comparables: [
      {
        id: 'cmp_1',
        address: 'Marina Gate 2, Apt 1204',
        price: 1_875_000,
        currency: 'AED',
        price_per_sqft: 2050,
        beds: 3,
        baths: 3,
        status: 'active',
        source_portal: 'property_finder',
        source_url: 'https://example.com/listing',
      },
    ],
    evidence_files: [
      {
        id: 'ev_1',
        filename: 'transaction_export_q3_2026.pdf',
        mime: 'application/pdf',
        size_bytes: 2_411_520,
        uploaded_at: new Date(FIXED_NOW - 2 * 3600_000).toISOString(),
      },
    ],
    // Avoid plaintext reporter name in audit trail (not wrapped by PIIMask).
    audit_trail: [
      {
        actor: { id: 'usr_1', name: 'Reporter', role: 'agent' },
        action: 'submitted',
        at: new Date(FIXED_NOW - 2 * 3600_000).toISOString(),
      },
    ],
    ...overrides,
  }
}

export function samplePriceTwoPersonDetail(
  overrides: Partial<PriceReportDetail> = {},
): PriceReportDetail {
  return samplePriceDetail({
    status: 'pending_second_approval',
    two_person_required: true,
    review: {
      decided_at: new Date(FIXED_NOW - 900_000).toISOString(),
      decided_by: 'PA Priya',
      incorporated: true,
      weight: 100,
    },
    approval_request_id: 'apr_req_1',
    ...overrides,
  })
}

export function sampleComparableOutcomeRemoved(): ComparableReportRow {
  return {
    id: 'cmr_1',
    status: 'confirmed_removed',
    comparable_id: 'cmp_1',
    submitted_at: '2026-09-01T10:00:00Z',
    decided_at: '2026-09-03T09:00:00Z',
    reviewed_at: '2026-09-03T09:00:00Z',
    data: {
      comparable: {
        address_label: 'The Address Downtown, unit 2312',
        market_label: 'Downtown Dubai',
        source_label: 'Bayut',
      },
      decision: {
        action: 'removed',
        notes: 'Removed after verification.',
        market_impact: { valuations_affected: 4 },
        resolver: { display_name: 'PA-Layla', avatar_url: null },
      },
    },
  }
}

export function sampleComparableOutcomeQuarantined(): ComparableReportRow {
  return {
    id: 'cmr_2',
    status: 'confirmed_quarantined',
    comparable_id: 'cmp_2',
    submitted_at: '2026-09-01T10:00:00Z',
    decided_at: '2026-09-03T09:00:00Z',
    reviewed_at: '2026-09-03T09:00:00Z',
    data: {
      comparable: {
        address_label: 'Marina Gate, unit 1204',
        market_label: 'Dubai Marina',
        source_label: 'Property Finder',
      },
      decision: {
        action: 'quarantined',
        notes: 'Held for further verification.',
        market_impact: { valuations_affected: 2 },
        resolver: { display_name: 'PA-Layla', avatar_url: null },
      },
    },
  }
}

export function samplePriceOutcomeIncorporated(): AgentPriceReportRow {
  return {
    id: 'apr_1',
    status: 'incorporated',
    incorporated: true,
    incorporated_at: '2026-09-05T00:00:00Z',
    reviewed_at: '2026-09-04T09:00:00Z',
    created_at: '2026-09-01T10:00:00Z',
    external_property_title: '2-3BR apartments · Dubai Marina · Sep 2026',
    segment_label: 'Dubai Marina · 2-3BR apartments',
    review_notes: 'Methodology is sound.',
    data: { resolver: { display_name: 'PA-Priya', avatar_url: null } },
  }
}

export function samplePriceOutcomeSignalOnly(): AgentPriceReportRow {
  return {
    id: 'apr_2',
    status: 'verified',
    incorporated: false,
    reviewed_at: '2026-09-04T09:00:00Z',
    created_at: '2026-09-01T10:00:00Z',
    external_property_title: '2-3BR apartments · Dubai Marina · Sep 2026',
    segment_label: 'Dubai Marina · 2-3BR apartments',
    data: {
      signal_weight: 50,
      resolver: { display_name: 'PA-Priya', avatar_url: null },
    },
  }
}
