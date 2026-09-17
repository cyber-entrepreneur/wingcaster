/**
 * FIDO Metadata Service integration (H4 — #197 v2).
 *
 * The FIDO Alliance publishes a signed JWT ("MDS BLOB") that describes
 * every certified authenticator by its AAGUID. Loading it at registration
 * lets us:
 *   - Show a real name in the UI ("iPhone Touch ID" vs raw AAGUID)
 *   - Enforce an allowlist / denylist of authenticator models
 *   - Prove to an auditor that the enrolled credential came from a real
 *     device, not a rogue software authenticator
 *
 * ---------------------------------------------------------------------------
 * Runtime model
 * ---------------------------------------------------------------------------
 *
 * Tests mock this whole module — we never hit the FIDO server in CI.
 * In production, `refreshMdsBlob()` runs on server startup + daily. Each
 * `lookupAaguid` call reads from the local `fido_mds_metadata` table cache
 * so registration latency doesn't depend on FIDO Alliance uptime.
 *
 * The signed BLOB verification is out of scope for this file — we trust
 * the network-fetched JWT payload after decoding. A production hardening
 * step would add JWS verification against the FIDO root cert; that ships
 * once we have the root cert bundled.
 */

import { query } from '../../db.js'
import logger from '../logger.js'

/** Official FIDO Metadata Service endpoint (public). */
export const MDS_BLOB_URL = process.env.WINGCASTER_FIDO_MDS_URL || 'https://mds.fidoalliance.org/'

/**
 * Fetch and cache the FIDO MDS BLOB. Returns { fetched, cached } counts.
 * Called from `startFidoMdsRefreshJob()` on a daily tick.
 */
export async function refreshMdsBlob({ fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(MDS_BLOB_URL, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`FIDO MDS fetch failed: ${res.status}`)
  }
  const jwtText = await res.text()
  // Decode the middle segment (base64url-encoded JSON). The FIDO spec ships
  // the BLOB as a JWS; we take the payload without verifying the signature
  // for this iteration — a future hardening step adds JWS verify.
  const segments = jwtText.trim().split('.')
  if (segments.length !== 3) {
    throw new Error(`FIDO MDS BLOB malformed (${segments.length} segments)`)
  }
  const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8')
  const payload = JSON.parse(payloadJson)
  const entries = Array.isArray(payload?.entries) ? payload.entries : []

  let cached = 0
  for (const entry of entries) {
    const aaguid = entry?.aaguid || entry?.metadataStatement?.aaguid
    if (!aaguid) continue
    try {
      await query(
        `INSERT INTO fido_mds_metadata (aaguid, metadata, refreshed_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (aaguid) DO UPDATE
           SET metadata = EXCLUDED.metadata,
               refreshed_at = EXCLUDED.refreshed_at`,
        [aaguid, JSON.stringify(entry)],
      )
      cached += 1
    } catch (err) {
      logger.error({ err, aaguid }, 'FIDO MDS cache write failed for entry')
    }
  }
  return { fetched: entries.length, cached }
}

/**
 * Look up an authenticator by AAGUID. Returns the metadata blob or null
 * when unknown. Cheap: hits the local cache table.
 */
export async function lookupAaguid(aaguid) {
  if (!aaguid) return null
  try {
    const rows = await query(
      `SELECT metadata, refreshed_at FROM fido_mds_metadata WHERE aaguid = $1 LIMIT 1`,
      [aaguid],
    )
    if (!rows[0]) return null
    return {
      aaguid,
      metadata: rows[0].metadata,
      refreshed_at: rows[0].refreshed_at,
    }
  } catch (err) {
    logger.error({ err, aaguid }, 'FIDO MDS lookup failed')
    return null
  }
}

/**
 * Extract a human-readable name from an MDS entry.
 * Falls back to a truncated aaguid so the UI always renders something.
 */
export function displayNameForMdsEntry(entry, aaguid) {
  const stmt = entry?.metadata?.metadataStatement || entry?.metadataStatement
  return (
    stmt?.description ||
    stmt?.authenticatorName ||
    stmt?.name ||
    (aaguid ? `Authenticator ${String(aaguid).slice(0, 8)}` : 'Passkey')
  )
}

/**
 * Enforce the agency policy against an aaguid + attestation format.
 * Returns null when accepted, or `{ error, code }` when refused.
 */
export function enforcePasskeyPolicy({ policy, aaguid, attestationFormat }) {
  const denied = Array.isArray(policy?.webauthn_denied_aaguids) ? policy.webauthn_denied_aaguids : []
  const allowed = Array.isArray(policy?.webauthn_allowed_aaguids) ? policy.webauthn_allowed_aaguids : []
  if (aaguid && denied.includes(aaguid)) {
    return {
      code: 'webauthn_aaguid_denied',
      error: 'This authenticator model is not permitted by your agency policy.',
    }
  }
  if (allowed.length > 0 && (!aaguid || !allowed.includes(aaguid))) {
    return {
      code: 'webauthn_aaguid_not_allowlisted',
      error: 'Your agency permits only specific authenticator models; this one is not on the list.',
    }
  }
  if (policy?.webauthn_require_attestation && attestationFormat === 'none') {
    return {
      code: 'webauthn_attestation_required',
      error:
        'Your agency requires verifiable authenticator attestation. This device did not provide one — try a hardware security key or a platform authenticator that supports attestation.',
    }
  }
  return null
}

/** Startup + daily refresh loop. Unref'd so it doesn't hold the process. */
export function startFidoMdsRefreshJob({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  const tick = async () => {
    try {
      const summary = await refreshMdsBlob()
      logger.info(summary, 'FIDO MDS refresh tick')
    } catch (err) {
      logger.error({ err }, 'FIDO MDS refresh tick failed')
    }
  }
  void tick()
  const handle = setInterval(tick, intervalMs)
  handle.unref?.()
  return handle
}

// Exported for tests.
export const __testables = { MDS_BLOB_URL }
