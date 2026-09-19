/**
 * Growth-OS Wave 0 — consent access layer.
 * checkEligibility is the gate every future send path must call.
 *
 * Current-state model: one row per (contact_id, channel, purpose) via unique
 * index; setConsent upserts and appends prior status into data.prior_states.
 */

import { randomUUID } from 'node:crypto'
import { findOne, insert, update, query } from '../../persistence/index.js'

const CONSENT_STATUSES = new Set(['granted', 'denied', 'withdrawn'])
const CONSENT_PURPOSES = new Set(['marketing', 'transactional', 'nurture'])

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

function isExpired(row, now = new Date()) {
  if (!row?.expires_at) return false
  return new Date(row.expires_at).getTime() <= now.getTime()
}

/**
 * @returns {{ allowed: boolean, reason: string, consent: object|null }}
 */
export async function checkEligibility({ contactId, channel, purpose, at = null } = {}) {
  if (!contactId) {
    throw Object.assign(new Error('contactId is required'), { code: 'MISSING_CONTACT_ID' })
  }
  if (!channel) {
    throw Object.assign(new Error('channel is required'), { code: 'MISSING_CHANNEL' })
  }
  assertPurpose(purpose)

  const now = at ? new Date(at) : new Date()
  const consent = await findOne(
    'consent',
    (row) => row.contact_id === contactId && row.channel === channel && row.purpose === purpose,
  )

  if (!consent) {
    return { allowed: false, reason: 'missing_consent', consent: null }
  }
  if (consent.status === 'denied') {
    return { allowed: false, reason: 'denied', consent }
  }
  if (consent.status === 'withdrawn') {
    return { allowed: false, reason: 'withdrawn', consent }
  }
  if (consent.status === 'granted' && isExpired(consent, now)) {
    return { allowed: false, reason: 'expired', consent }
  }
  if (consent.status === 'granted') {
    return { allowed: true, reason: 'granted', consent }
  }
  return { allowed: false, reason: 'unknown_status', consent }
}

/**
 * Upsert current consent. Prior status is appended to data.prior_states.
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

  const existing = await findOne(
    'consent',
    (row) => row.contact_id === contactId && row.channel === channel && row.purpose === purpose,
  )

  if (!existing) {
    return insert('consent', {
      id: id || prefixedId('cns_'),
      contact_id: contactId,
      channel,
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
    })
  }

  const prior = Array.isArray(existing.data?.prior_states) ? [...existing.data.prior_states] : []
  prior.push({
    status: existing.status,
    captured_at: existing.captured_at,
    expires_at: existing.expires_at,
    legal_basis: existing.legal_basis,
    source: existing.source,
    recorded_at: new Date().toISOString(),
  })

  const changed = await update(
    'consent',
    (row) => row.id === existing.id,
    (row) => ({
      ...row,
      status,
      legal_basis: legalBasis ?? row.legal_basis,
      source: source ?? row.source,
      captured_at: capturedAt || new Date().toISOString(),
      expires_at: expiresAt,
      jurisdiction: jurisdiction ?? row.jurisdiction,
      proof_ref: proofRef ?? row.proof_ref,
      agency_id: agencyId ?? row.agency_id,
      agent_id: agentId ?? row.agent_id,
      data: { ...(row.data || {}), ...data, prior_states: prior },
    }),
  )
  if (!changed) {
    throw Object.assign(new Error(`consent not found: ${existing.id}`), { code: 'CONSENT_NOT_FOUND' })
  }
  return getConsent({ contactId, channel, purpose })
}

export async function getConsent({ contactId, channel, purpose }) {
  return findOne(
    'consent',
    (row) => row.contact_id === contactId && row.channel === channel && row.purpose === purpose,
  )
}

/**
 * Direct SQL upsert used by tests / bulk paths; mirrors unique index.
 */
export async function upsertConsentSql(row) {
  const result = await query(
    `INSERT INTO public.consent (
       id, contact_id, channel, purpose, status, legal_basis, source,
       captured_at, expires_at, jurisdiction, proof_ref, agency_id, agent_id, data
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
     )
     ON CONFLICT (contact_id, channel, purpose) DO UPDATE SET
       status = EXCLUDED.status,
       legal_basis = EXCLUDED.legal_basis,
       source = EXCLUDED.source,
       captured_at = EXCLUDED.captured_at,
       expires_at = EXCLUDED.expires_at,
       jurisdiction = EXCLUDED.jurisdiction,
       proof_ref = EXCLUDED.proof_ref,
       agency_id = COALESCE(EXCLUDED.agency_id, public.consent.agency_id),
       agent_id = COALESCE(EXCLUDED.agent_id, public.consent.agent_id),
       updated_at = CURRENT_TIMESTAMP,
       data = public.consent.data || EXCLUDED.data
     RETURNING *`,
    [
      row.id || prefixedId('cns_'),
      row.contact_id,
      row.channel,
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
}

export { CONSENT_STATUSES, CONSENT_PURPOSES }
