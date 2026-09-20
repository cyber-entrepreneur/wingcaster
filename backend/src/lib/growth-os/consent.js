/**
 * Growth-OS Wave 0 — consent access layer.
 * checkEligibility implements docs/consent-and-compliance-spec.md §5.
 *
 * History model: append-only rows; current state via consent_current view.
 */

import { randomUUID } from 'node:crypto'
import { insert, query } from '../../persistence/index.js'
import { checkFrequencyCap } from './contact-policy.js'
import { withTenant } from './with-tenant.js'

const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

const CONSENT_STATUSES = new Set(['granted', 'denied', 'withdrawn'])
const CONSENT_PURPOSES = new Set(['marketing', 'transactional', 'nurture'])
const CONSENT_LEGAL_BASES = new Set([
  'explicit_optin',
  'double_optin',
  'contract',
  'legitimate_interest',
  'soft_optin_existing_customer',
])

const ELIGIBILITY_REASON_CODES = {
  OK_TRANSACTIONAL: 'OK_TRANSACTIONAL',
  OK_SERVICE_WINDOW: 'OK_SERVICE_WINDOW',
  OK_TEMPLATE: 'OK_TEMPLATE',
  OK_CONSENT_GRANTED: 'OK_CONSENT_GRANTED',
  DENY_WITHDRAWN: 'DENY_WITHDRAWN',
  DENY_NO_CONSENT: 'DENY_NO_CONSENT',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_OPTED_OUT: 'DENY_OPTED_OUT',
  DENY_WHATSAPP_NO_TEMPLATE: 'DENY_WHATSAPP_NO_TEMPLATE',
  DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE: 'DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE',
  DENY_JURISDICTION_RESTRICTED: 'DENY_JURISDICTION_RESTRICTED',
  DENY_CHANNEL_UNHEALTHY: 'DENY_CHANNEL_UNHEALTHY',
  DENY_FREQUENCY_CAPPED: 'DENY_FREQUENCY_CAPPED',
}

const STRICT_JURISDICTIONS = new Set(['EU', 'UK', 'GB', 'US', 'CA'])

const OWNED_MESSAGING_CHANNELS = new Set(['email', 'sms', 'whatsapp'])

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertStatus(status) {
  if (!CONSENT_STATUSES.has(status)) {
    throw Object.assign(new Error(`Invalid consent.status: ${status}`), {
      code: 'INVALID_CONSENT_STATUS',
    })
  }
}

function assertPurpose(purpose) {
  if (!CONSENT_PURPOSES.has(purpose)) {
    throw Object.assign(new Error(`Invalid consent.purpose: ${purpose}`), {
      code: 'INVALID_CONSENT_PURPOSE',
    })
  }
}

function assertLegalBasis(legalBasis) {
  if (legalBasis != null && !CONSENT_LEGAL_BASES.has(legalBasis)) {
    throw Object.assign(new Error(`Invalid consent.legal_basis: ${legalBasis}`), {
      code: 'INVALID_CONSENT_LEGAL_BASIS',
    })
  }
}

function normalizeChannel(channel) {
  return String(channel || '').toLowerCase()
}

function isExpired(row, now) {
  if (!row?.expires_at) return false
  return new Date(row.expires_at).getTime() <= now.getTime()
}

function isStrictJurisdiction(jurisdiction) {
  if (!jurisdiction) return true
  return STRICT_JURISDICTIONS.has(String(jurisdiction).toUpperCase())
}

function allowedMarketingBases(channel, jurisdiction) {
  const strict = isStrictJurisdiction(jurisdiction)
  if (channel === 'email' && !strict) {
    return new Set(['explicit_optin', 'double_optin', 'soft_optin_existing_customer'])
  }
  return new Set(['explicit_optin', 'double_optin'])
}

function allowedNurtureBases(channel, jurisdiction) {
  const strict = isStrictJurisdiction(jurisdiction)
  if (channel === 'email') {
    return new Set([
      'explicit_optin',
      'double_optin',
      'soft_optin_existing_customer',
      'legitimate_interest',
      'contract',
    ])
  }
  if (!strict) {
    return new Set([
      'explicit_optin',
      'double_optin',
      'soft_optin_existing_customer',
      'legitimate_interest',
      'contract',
    ])
  }
  return new Set(['explicit_optin', 'double_optin'])
}

function isLegalBasisAllowed({ purpose, channel, legalBasis, jurisdiction }) {
  if (!legalBasis) return false
  if (purpose === 'marketing') {
    return allowedMarketingBases(channel, jurisdiction).has(legalBasis)
  }
  if (purpose === 'nurture') {
    return allowedNurtureBases(channel, jurisdiction).has(legalBasis)
  }
  return false
}

function requiredActionFor(reasonCode) {
  switch (reasonCode) {
    case ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE:
      return 'use_approved_utility_or_auth_template'
    case ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_NO_TEMPLATE:
      return 'use_approved_marketing_template'
    case ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT:
    case ELIGIBILITY_REASON_CODES.DENY_OPTED_OUT:
      return 'obtain_consent'
    case ELIGIBILITY_REASON_CODES.DENY_CHANNEL_UNHEALTHY:
      return 'reconnect_channel'
    case ELIGIBILITY_REASON_CODES.DENY_EXPIRED:
      return 'refresh_consent'
    case ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN:
      return 'respect_opt_out'
    case ELIGIBILITY_REASON_CODES.DENY_JURISDICTION_RESTRICTED:
      return 'adjust_legal_basis'
    case ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED:
      return 'wait_for_frequency_cap'
    default:
      return undefined
  }
}

function deny(reasonCode, extra = {}) {
  return {
    allowed: false,
    reason_code: reasonCode,
    required_action: requiredActionFor(reasonCode),
    ...extra,
  }
}

function allow(reasonCode, extra = {}) {
  return {
    allowed: true,
    reason_code: reasonCode,
    ...extra,
  }
}

function isApprovedTemplate(approvedTemplate, categories) {
  if (!approvedTemplate) return false
  if (approvedTemplate === true) return true
  return categories.includes(String(approvedTemplate).toLowerCase())
}

async function getCurrentConsentRow({ contactId, channel, purpose }) {
  const rows = await query(
    `SELECT *
     FROM public.consent_current
     WHERE contact_id = $1 AND channel = $2 AND purpose = $3
     LIMIT 1`,
    [contactId, channel, purpose],
  )
  const list = Array.isArray(rows) ? rows : rows?.rows
  return list?.[0] ?? null
}

async function hasChannelWithdrawal({ contactId, channel }) {
  const rows = await query(
    `SELECT 1
     FROM public.consent_current
     WHERE contact_id = $1
       AND channel = $2
       AND status = 'withdrawn'
     LIMIT 1`,
    [contactId, channel],
  )
  const list = Array.isArray(rows) ? rows : rows?.rows
  return Boolean(list?.length)
}

async function hasHealthyChannelConnection(channel, { agencyId = null, agentId = null } = {}) {
  const rows = await query(
    `SELECT 1
     FROM public.channel_connections cc
     JOIN public.channel_definitions cd ON cd.id = cc.channel_definition_id
     WHERE cc.health = 'connected'
       AND lower(cd.platform) = lower($1)
       AND ($2::text IS NULL OR cc.agency_id = $2)
       AND ($3::text IS NULL OR cc.agent_id = $3)
     LIMIT 1`,
    [channel, agencyId, agentId],
  )
  const list = Array.isArray(rows) ? rows : rows?.rows
  return Boolean(list?.length)
}

async function getWhatsAppServiceWindow({ contactId, now }) {
  const rows = await query(
    `SELECT MAX(COALESCE(cm.sent_at, cm.created_at)) AS last_inbound_at
     FROM public.conversation_messages cm
     JOIN public.conversations c ON c.id = cm.conversation_id
     WHERE c.contact_id = $1
       AND cm.direction = 'inbound'
       AND (
         lower(coalesce(cm.channel, '')) = 'whatsapp'
         OR lower(coalesce(c.channel, '')) = 'whatsapp'
         OR lower(coalesce(c.source_channel, '')) LIKE 'whatsapp%'
       )`,
    [contactId],
  )
  const list = Array.isArray(rows) ? rows : rows?.rows
  const lastInboundAt = list?.[0]?.last_inbound_at
  if (!lastInboundAt) {
    return { open: false, expiresAt: null }
  }
  const startedAt = new Date(lastInboundAt).getTime()
  const expiresAt = new Date(startedAt + WHATSAPP_SERVICE_WINDOW_MS)
  return {
    open: expiresAt.getTime() > now.getTime(),
    expiresAt: expiresAt.toISOString(),
  }
}

/**
 * @returns {Promise<{ allowed: boolean, reason_code: string, required_action?: string, window_expires_at?: string }>}
 */
export async function checkEligibility({
  contactId,
  channel,
  purpose,
  now: nowInput = null,
  agencyId = null,
  agentId = null,
  approvedTemplate = false,
  skipChannelHealth = false,
} = {}) {
  if (!contactId) {
    throw Object.assign(new Error('contactId is required'), { code: 'MISSING_CONTACT_ID' })
  }
  if (!channel) {
    throw Object.assign(new Error('channel is required'), { code: 'MISSING_CHANNEL' })
  }
  assertPurpose(purpose)

  const normalizedChannel = normalizeChannel(channel)
  const now = nowInput ? new Date(nowInput) : new Date()

  return withTenant(agencyId, agentId, async () => {
  // 1. Global do-not-contact / withdrawn for (contact, channel).
  if (await hasChannelWithdrawal({ contactId, channel: normalizedChannel })) {
    return deny(ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN)
  }

  // 2. Channel connection unhealthy.
  if (!skipChannelHealth && OWNED_MESSAGING_CHANNELS.has(normalizedChannel)) {
    const healthy = await hasHealthyChannelConnection(normalizedChannel, { agencyId, agentId })
    if (!healthy) {
      return deny(ELIGIBILITY_REASON_CODES.DENY_CHANNEL_UNHEALTHY)
    }
  }

  // 3. Transactional purpose.
  if (purpose === 'transactional') {
    if (normalizedChannel === 'email' || normalizedChannel === 'sms') {
      return allow(ELIGIBILITY_REASON_CODES.OK_TRANSACTIONAL)
    }
    if (normalizedChannel === 'whatsapp') {
      const window = await getWhatsAppServiceWindow({ contactId, now })
      if (window.open) {
        return allow(ELIGIBILITY_REASON_CODES.OK_SERVICE_WINDOW, {
          window_expires_at: window.expiresAt,
        })
      }
      if (isApprovedTemplate(approvedTemplate, ['utility', 'authentication', true])) {
        return allow(ELIGIBILITY_REASON_CODES.OK_TEMPLATE)
      }
      return deny(ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE)
    }
    return allow(ELIGIBILITY_REASON_CODES.OK_TRANSACTIONAL)
  }

  // 4. Nurture / marketing — require granted, non-expired consent.
  const consent = await getCurrentConsentRow({
    contactId,
    channel: normalizedChannel,
    purpose,
  })

  if (!consent || consent.status === 'denied') {
    return deny(
      consent?.status === 'denied'
        ? ELIGIBILITY_REASON_CODES.DENY_OPTED_OUT
        : ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT,
    )
  }

  if (consent.status === 'withdrawn') {
    return deny(ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN)
  }

  if (consent.status !== 'granted') {
    return deny(ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT)
  }

  if (isExpired(consent, now)) {
    return deny(ELIGIBILITY_REASON_CODES.DENY_EXPIRED)
  }

  if (!isLegalBasisAllowed({
    purpose,
    channel: normalizedChannel,
    legalBasis: consent.legal_basis,
    jurisdiction: consent.jurisdiction,
  })) {
    return deny(ELIGIBILITY_REASON_CODES.DENY_JURISDICTION_RESTRICTED)
  }

  if (normalizedChannel === 'whatsapp') {
    const window = await getWhatsAppServiceWindow({ contactId, now })
    if (!window.open && !isApprovedTemplate(approvedTemplate, ['marketing', true])) {
      return deny(ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_NO_TEMPLATE)
    }
    if (window.open) {
      const frequency = await checkFrequencyCap({
        contactId,
        channel: normalizedChannel,
        purpose,
        agencyId,
        agentId,
        now,
      })
      if (frequency.capped) {
        return deny(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED, {
          frequency_detail: frequency.detail,
          frequency_reason: frequency.reason,
        })
      }
      return allow(ELIGIBILITY_REASON_CODES.OK_CONSENT_GRANTED, {
        window_expires_at: window.expiresAt,
      })
    }
  }

  // 5. Frequency / pressure cap via ContactPolicy (Wave 2E).
  const frequency = await checkFrequencyCap({
    contactId,
    channel: normalizedChannel,
    purpose,
    agencyId,
    agentId,
    now,
  })
  if (frequency.capped) {
    return deny(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED, {
      frequency_detail: frequency.detail,
      frequency_reason: frequency.reason,
    })
  }

  return allow(ELIGIBILITY_REASON_CODES.OK_CONSENT_GRANTED)
  })
}

/**
 * Append a consent state row (never overwrite history).
 */
export async function setConsent({
  contactId,
  channel,
  purpose,
  status,
  legalBasis = null,
  source = null,
  capturedAt = null,
  expiresAt = null,
  jurisdiction = null,
  proofRef = null,
  agencyId = null,
  agentId = null,
  id = null,
  data = {},
} = {}) {
  if (!contactId) {
    throw Object.assign(new Error('contactId is required'), { code: 'MISSING_CONTACT_ID' })
  }
  if (!channel) {
    throw Object.assign(new Error('channel is required'), { code: 'MISSING_CHANNEL' })
  }
  assertPurpose(purpose)
  assertStatus(status)
  assertLegalBasis(legalBasis)

  return withTenant(agencyId, agentId, () =>
    insert('consent', {
      id: id || prefixedId('cns_'),
      contact_id: contactId,
      channel: normalizeChannel(channel),
      purpose,
      status,
      legal_basis: legalBasis,
      source,
      captured_at: capturedAt || new Date().toISOString(),
      expires_at: expiresAt,
      jurisdiction,
      proof_ref: proofRef,
      agency_id: agencyId,
      agent_id: agentId,
      data,
    }),
  )
}

export async function getConsent({ contactId, channel, purpose, agencyId = null, agentId = null }) {
  return withTenant(agencyId, agentId, () =>
    getCurrentConsentRow({
      contactId,
      channel: normalizeChannel(channel),
      purpose,
    }),
  )
}

/**
 * Direct SQL insert used by tests / bulk paths.
 */
export async function insertConsentSql(row) {
  return withTenant(row.agency_id ?? null, row.agent_id ?? null, async () => {
  const result = await query(
    `INSERT INTO public.consent (
       id, contact_id, channel, purpose, status, legal_basis, source,
       captured_at, expires_at, jurisdiction, proof_ref, agency_id, agent_id, data
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
     )
     RETURNING *`,
    [
      row.id || prefixedId('cns_'),
      row.contact_id,
      normalizeChannel(row.channel),
      row.purpose,
      row.status,
      row.legal_basis ?? null,
      row.source ?? null,
      row.captured_at || new Date().toISOString(),
      row.expires_at ?? null,
      row.jurisdiction ?? null,
      row.proof_ref ?? null,
      row.agency_id ?? null,
      row.agent_id ?? null,
      JSON.stringify(row.data ?? {}),
    ],
  )
  return Array.isArray(result) ? result[0] : result?.rows?.[0]
  })
}

/** @deprecated Use insertConsentSql — append-only model. */
export const upsertConsentSql = insertConsentSql

export {
  CONSENT_STATUSES,
  CONSENT_PURPOSES,
  CONSENT_LEGAL_BASES,
  ELIGIBILITY_REASON_CODES,
  WHATSAPP_SERVICE_WINDOW_MS,
  isLegalBasisAllowed,
  getWhatsAppServiceWindow,
}
