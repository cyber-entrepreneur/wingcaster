/**
 * AGT-PUB-005 — create a publishing_jobs parent + N distribution_jobs
 * destinations for selected portal_registry codes.
 *
 * Destinations land in `pending_moderation` so AGT-PUB-003 receipts show
 * in_review and PA-MOD-001 can pick them up. Does not call portal adapters
 * (push happens after PA approval).
 */
import { randomUUID } from 'node:crypto'
import { query, transaction } from '../../db.js'
import { listPortalRegistry, getPortalByCode } from '../portals/store.js'
import { getPublishingJob } from './jobs.js'

/**
 * Serialize a portal_registry row for the agent picker.
 * @param {object} row
 */
export function serializePortalForPicker(row) {
  if (!row) return null
  const config = row.publisher_config && typeof row.publisher_config === 'object'
    ? row.publisher_config
    : {}
  return {
    code: row.code,
    display_name: row.display_name,
    description: row.description || null,
    logo_url: row.logo_url || null,
    country_codes: Array.isArray(row.country_codes) ? row.country_codes : [],
    primary_language: row.primary_language || null,
    is_active: Boolean(row.is_active),
    deprecated_at: row.deprecated_at || null,
    sla_hours: typeof config.sla_hours === 'number' ? config.sla_hours : null,
  }
}

/**
 * List portals available for agent submit (dynamic registry, no hardcode).
 * Includes inactive stubs so Phase-1 pickers are not empty; excludes deprecated.
 */
export async function listPortalsForSubmit() {
  const rows = await listPortalRegistry({ activeOnly: false })
  return rows
    .filter((row) => !row.deprecated_at)
    .map(serializePortalForPicker)
}

/**
 * Normalize body.portals into { code, country_code }[].
 * @param {unknown} portals
 */
export function normalizePortalSelections(portals) {
  if (!Array.isArray(portals) || portals.length === 0) {
    const err = new Error('Select at least one portal')
    err.status = 400
    err.code = 'PORTALS_REQUIRED'
    throw err
  }
  const seen = new Set()
  const out = []
  for (const item of portals) {
    let code
    let countryCode = null
    if (typeof item === 'string') {
      code = item.trim().toLowerCase()
    } else if (item && typeof item === 'object') {
      code = String(item.code || item.portal || item.platform || '').trim().toLowerCase()
      const rawCountry = item.country_code || item.countryCode || null
      countryCode = rawCountry ? String(rawCountry).trim().toUpperCase() : null
    } else {
      continue
    }
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({ code, country_code: countryCode })
  }
  if (!out.length) {
    const err = new Error('Select at least one portal')
    err.status = 400
    err.code = 'PORTALS_REQUIRED'
    throw err
  }
  return out
}

/**
 * Create a publishing job + destinations for a listing.
 *
 * @param {object} opts
 * @param {string} opts.propertyId
 * @param {string} opts.agentId
 * @param {string|null} [opts.agencyId]
 * @param {unknown} opts.portals
 * @param {string} [opts.message]
 * @returns {Promise<{ jobId: string, job: object, destinations: object[] }>}
 */
export async function submitPortalPublishingJob({
  propertyId,
  agentId,
  agencyId = null,
  portals,
  message = '',
} = {}) {
  if (!propertyId) {
    const err = new Error('property_id is required')
    err.status = 400
    throw err
  }
  if (!agentId) {
    const err = new Error('agent_id is required')
    err.status = 401
    throw err
  }

  const selections = normalizePortalSelections(portals)
  const resolved = []
  for (const sel of selections) {
    const row = await getPortalByCode(sel.code)
    if (!row || row.deprecated_at) {
      const err = new Error(`Unknown or deprecated portal: ${sel.code}`)
      err.status = 400
      err.code = 'PORTAL_NOT_FOUND'
      throw err
    }
    const countries = Array.isArray(row.country_codes) ? row.country_codes : []
    let countryCode = sel.country_code
    if (countryCode && countries.length && !countries.includes(countryCode)) {
      const err = new Error(
        `Portal ${row.code} does not cover country ${countryCode}`,
      )
      err.status = 400
      err.code = 'COUNTRY_NOT_SUPPORTED'
      throw err
    }
    if (!countryCode && countries.length === 1) {
      countryCode = countries[0]
    }
    resolved.push({ row, country_code: countryCode || null })
  }

  const jobId = randomUUID()
  const destinationIds = []

  await transaction(async () => {
    // Ambient query() participates in this transaction (see postgres-adapter).
    await query(
      `INSERT INTO public.publishing_jobs
         (id, property_id, agent_id, agency_id, submitted_at, data)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5::jsonb)`,
      [
        jobId,
        propertyId,
        agentId,
        agencyId,
        JSON.stringify({
          source: 'agt_pub_005',
          message: message || '',
          portal_codes: resolved.map((r) => r.row.code),
        }),
      ],
    )

    for (const { row, country_code } of resolved) {
      const destId = randomUUID()
      destinationIds.push(destId)
      await query(
        `INSERT INTO public.distribution_jobs
           (id, property_id, agent_id, agency_id, platform, status,
            publishing_job_id, payload, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending_moderation', $6,
                 $7::jsonb, $8::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          destId,
          propertyId,
          agentId,
          agencyId,
          row.code,
          jobId,
          JSON.stringify({
            portal_code: row.code,
            country_code,
            message: message || '',
          }),
          JSON.stringify({
            portal_code: row.code,
            country_code,
            portal_display_name: row.display_name,
            source: 'agt_pub_005',
          }),
        ],
      )
    }
  })

  // Prefer aggregated payload when readable; fall back to ids on empty JOIN.
  let payload = null
  try {
    payload = await getPublishingJob({ jobId, agentId, agencyId })
  } catch {
    payload = null
  }

  return {
    jobId,
    job: payload?.job || {
      id: jobId,
      listing_id: propertyId,
      aggregate: 'in_review_only',
      submitted_at: new Date().toISOString(),
      completed_at: null,
      counts: {
        succeeded: 0,
        in_review: destinationIds.length,
        failed: 0,
        total: destinationIds.length,
      },
    },
    destinations: payload?.destinations || destinationIds.map((id, i) => ({
      id,
      portal: serializePortalForPicker(resolved[i].row),
      status: 'in_review',
    })),
  }
}
