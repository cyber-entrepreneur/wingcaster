/**
 * Agency first-run onboarding state (welcome / path / checklist).
 * Persisted per agency; concurrent checklist_delta merges via JSONB ||.
 *
 * Checklist keys (clients write boolean or `{done: bool}`):
 * branding, markets, invites, billing, portal, listing, roles, 2FA.
 */

import { query, findOne, findAll } from '../../db.js'

export const AGENCY_CHECKLIST_KEYS = Object.freeze([
  'branding',
  'markets',
  'invites',
  'billing',
  'portal',
  'listing',
  'roles',
  '2FA',
])

export const DEFAULT_AGENCY_ONBOARDING_STATE = Object.freeze({
  step: 'welcome',
  path: null,
  checklist: Object.freeze({}),
  dismissed_forever: false,
})

export function serializeAgencyOnboardingState(row) {
  if (!row) {
    return {
      step: DEFAULT_AGENCY_ONBOARDING_STATE.step,
      path: DEFAULT_AGENCY_ONBOARDING_STATE.path,
      checklist: {},
      dismissed_forever: DEFAULT_AGENCY_ONBOARDING_STATE.dismissed_forever,
    }
  }
  return {
    step: row.step || DEFAULT_AGENCY_ONBOARDING_STATE.step,
    path: row.path ?? null,
    checklist: row.checklist && typeof row.checklist === 'object' && !Array.isArray(row.checklist)
      ? row.checklist
      : {},
    dismissed_forever: Boolean(row.dismissed_forever),
  }
}

/**
 * Derive which checklist tasks are complete from real data, so the card
 * auto-reflects work done anywhere (not just via explicit checklist writes).
 *
 * Best-effort and fail-safe: any signal we can't read resolves to `false`
 * (task shows "to do") — we never mark a task done we can't confirm. Only
 * `true` results are merged over the stored checklist; explicit stored
 * completions (and dismissals) are always preserved.
 */
export async function deriveAgencyChecklist(agencyId) {
  const derived = {}
  try {
    const agency = await findOne('agencies', (a) => a.id === agencyId)
    if (agency) {
      derived.branding = Boolean(agency.logo)
      if (agency.owner_id) {
        const ownerAgent = await findOne('agents', (a) => a.id === agency.owner_id)
        derived.markets =
          Array.isArray(ownerAgent?.based_markets) && ownerAgent.based_markets.length > 0
        const ownerUser =
          (await findOne('users', (u) => u.id === agency.owner_id)) || ownerAgent
        derived['2FA'] = Boolean(ownerUser?.totp_enabled)
      }
    }
    const activeMembers = await findAll(
      'agency_members',
      (m) => m.agency_id === agencyId && m.status === 'active',
    )
    let pendingInvites = []
    try {
      pendingInvites = await findAll('agency_invitations', (i) => i.agency_id === agencyId)
    } catch {
      /* table optional */
    }
    // Owner is one active member; a second member (or any invite) means invites done.
    derived.invites = (activeMembers?.length || 0) > 1 || (pendingInvites?.length || 0) > 0

    const props = await findAll('properties', (p) => p.agency_id === agencyId)
    derived.listing = (props?.length || 0) > 0

    let connections = []
    try {
      connections = await findAll('marketplace_connections', (c) => c.agency_id === agencyId)
    } catch {
      /* table optional */
    }
    derived.portal = (connections?.length || 0) > 0
  } catch {
    /* derivation must never block the read */
  }
  return derived
}

/**
 * @param {string} agencyId
 * @param {{ derive?: boolean }} [opts] When `derive` is true, OR-merge
 *   data-derived task completion over the stored checklist (used by the UI).
 *   Default false keeps the stored-only contract for direct/programmatic callers.
 */
export async function getAgencyOnboardingState(agencyId, { derive = false } = {}) {
  if (!agencyId) throw new Error('agencyId is required')
  const rows = await query(
    `SELECT agency_id, step, path, checklist, dismissed_forever, updated_at
       FROM public.agency_onboarding_state
      WHERE agency_id = $1`,
    [agencyId],
  )
  const stored = serializeAgencyOnboardingState(rows[0] || null)
  if (!derive) return stored
  const derivedFlags = await deriveAgencyChecklist(agencyId)
  const checklist = { ...stored.checklist }
  // OR-merge: a derived-true completes a task; stored completions never regress.
  for (const [key, done] of Object.entries(derivedFlags)) {
    if (done) checklist[key] = true
  }
  return { ...stored, checklist }
}

/**
 * Upsert onboarding state for one agency. Optional fields leave existing
 * values unchanged. checklist_delta is merged with Postgres JSONB || under
 * the row lock so concurrent PATCHes composing different keys do not
 * clobber each other.
 */
export async function patchAgencyOnboardingState(agencyId, {
  step,
  path,
  checklist_delta,
  dismissed_forever,
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const hasStep = step !== undefined
  const hasPath = path !== undefined
  const hasDismissed = dismissed_forever !== undefined
  const delta = checklist_delta && typeof checklist_delta === 'object' && !Array.isArray(checklist_delta)
    ? checklist_delta
    : {}

  const rows = await query(
    `INSERT INTO public.agency_onboarding_state AS s
       (agency_id, step, path, checklist, dismissed_forever, updated_at)
     VALUES (
       $1,
       COALESCE($2, 'welcome'),
       $3,
       COALESCE($4::jsonb, '{}'::jsonb),
       COALESCE($5, false),
       CURRENT_TIMESTAMP
     )
     ON CONFLICT (agency_id) DO UPDATE SET
       step = CASE WHEN $6::boolean THEN EXCLUDED.step ELSE s.step END,
       path = CASE WHEN $7::boolean THEN EXCLUDED.path ELSE s.path END,
       checklist = COALESCE(s.checklist, '{}'::jsonb) || COALESCE(EXCLUDED.checklist, '{}'::jsonb),
       dismissed_forever = CASE WHEN $8::boolean THEN EXCLUDED.dismissed_forever ELSE s.dismissed_forever END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING agency_id, step, path, checklist, dismissed_forever, updated_at`,
    [
      agencyId,
      hasStep ? step : null,
      hasPath ? path : null,
      JSON.stringify(delta),
      hasDismissed ? Boolean(dismissed_forever) : null,
      hasStep,
      hasPath,
      hasDismissed,
    ],
  )
  return serializeAgencyOnboardingState(rows[0])
}
