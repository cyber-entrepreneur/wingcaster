/**
 * Shared sample payloads for Wave 3 WF-04 quality suites.
 * Default states use MASKED identifiers only — plaintext fulls exist solely
 * for reveal/audit tests and must never appear in Chromatic stand-in snapshots.
 */
import type { ScheduledDeletionPayload } from '@/pages/public/ScheduledDeletionConfirmationPage'

export const FIXED_NOW = new Date('2026-09-09T12:00:00.000Z').getTime()

/** Plaintext that must NEVER appear in default-state visual snapshots. */
export const PLAINTEXT_PII_FORBIDDEN = [
  'omar.khoury@example.ae',
  'Omar Khoury',
  '+971 55 123 4512',
  'omar_kh23',
  'sara.mansouri@elitedubai.com',
  '+961 71 456 7841',
  'sara_mansouri',
  '185.104.212.44',
  'Mozilla/5.0 (iPhone)',
] as const

export function assertNoPlaintextPii(html: string, label: string) {
  for (const leak of PLAINTEXT_PII_FORBIDDEN) {
    if (html.includes(leak)) {
      throw new Error(`PII leak in ${label}: found plaintext "${leak}"`)
    }
  }
}

export function pendingDeletionPayload(
  overrides: Partial<ScheduledDeletionPayload> = {},
): ScheduledDeletionPayload {
  return {
    deletion_request_id: 'DEL-01H8XZ4NQR2E9K',
    status: 'scheduled',
    scheduled_for: '2026-10-07T14:22:15Z',
    deletion_date: 'Tuesday, 7 October 2026',
    days_remaining: 28,
    cancelled: false,
    cancel_available: true,
    email_masked: 's•••@p•••.ae',
    purpose: 'scheduled_deletion_view',
    ...overrides,
  }
}

export function sampleAcrQueueCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_1',
    created_at: new Date(FIXED_NOW - 3_600_000).toISOString(),
    sla_hours_remaining: 22.5,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'Lost phone; SMS OTP no longer reaching me on this number.',
    reason_category: 'lost_phone',
    preferred_channel: 'email',
    contact: 'o***@********.ae',
    requested_ip: '185.104.XXX.XXX',
    agent: {
      id: 'usr_1',
      display_name_masked: 'Omar K*****',
      display_name_full: 'Omar Khoury',
      avatar_url: null,
      email_masked: 'o***@********.ae',
      email_full: 'omar.khoury@example.ae',
      phone_masked: '+971 5X XXX XX12',
      phone_full: '+971 55 123 4512',
      username_masked: 'om****23',
      username_full: 'omar_kh23',
      role: 'agent',
      agency: {
        id: 'agy_bluedoor_lb',
        name: 'Blue Door LB',
        tenant_url: '/admin/tenants/agy_bluedoor_lb',
      },
      plan_tier: 'broker',
    },
    evidence: {
      file_count: 2,
      files: [
        { filename: 'id_front.jpg', uploaded_at: '2026-09-07T12:04:20Z' },
        { filename: 'id_back.jpg', uploaded_at: '2026-09-07T12:04:35Z' },
      ],
    },
    account_value_tier: 'standard',
    requires_two_person: false,
    is_own: false,
    env: 'live',
    ...overrides,
  }
}

export function sampleAcrDetailCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acr_b7f3a2',
    created_at: '2026-09-07T11:04:11Z',
    sla_hours_remaining: 22.97,
    sla_hours_total: 24,
    status: 'pending_review',
    reason: 'I lost access after a phishing email.',
    reason_category: 'compromised_account',
    provided: {
      preferred_channel: 'whatsapp',
      contact_masked: '+961 7X XXX XX41',
      contact_full: '+961 71 456 7841',
      request_ip_masked: '185.104.XXX.XXX',
      request_ip_full: '185.104.212.44',
      request_user_agent_masked: 'iPhone · Safari 17',
      request_user_agent_full: 'Mozilla/5.0 (iPhone)',
    },
    on_file: {
      email_masked: 's***@********.com',
      email_full: 'sara.mansouri@elitedubai.com',
      phone_masked: '+961 7X XXX XX41',
      phone_full: '+961 71 456 7841',
      username_masked: 'sa****ri',
      username_full: 'sara_mansouri',
      agency: { id: 'agy_1', name: 'Elite Real Estate Dubai', tenant_url: '/admin/tenants/agy_1' },
      plan_tier: 'enterprise',
      role: 'agency_owner',
      tenure_days: 1240,
      last_successful_login_at: '2026-08-14T09:12:00Z',
    },
    mismatches: [],
    evidence: {
      file_count: 1,
      files: [
        {
          id: 'ev_1',
          filename: 'id_front.jpg',
          uploaded_at: '2026-09-07T11:04:22Z',
          size_bytes: 218430,
          content_type: 'image/jpeg',
        },
      ],
    },
    timeline: [
      {
        at: '2026-09-07T11:10:00Z',
        channel: 'system',
        status: 'info',
        message: 'Case escalated to PA review.',
      },
    ],
    account_value_tier: 'standard',
    requires_two_person: false,
    first_vote: null,
    current_reviewer: {
      id: 'pa_current',
      is_first_reviewer_candidate: true,
      is_second_reviewer_candidate: false,
    },
    decision: null,
    escalation_case_id: null,
    is_own: false,
    env: 'live',
    ...overrides,
  }
}

export function mockQueueListResponse(cases: ReturnType<typeof sampleAcrQueueCase>[]) {
  return {
    cases,
    pagination: { page: 1, page_size: 25, total: cases.length, has_next: false },
    counts: {
      pending_review: cases.filter((c) => c.status === 'pending_review').length,
      pending_at_risk: 1,
      high_value_awaiting_two_person: cases.filter((c) => c.account_value_tier === 'high_value')
        .length,
      approved_this_week: 28,
      rejected_this_week: 4,
      awaiting_info_this_week: 2,
      completed_this_week: 25,
      expired_this_week: 1,
    },
  }
}
