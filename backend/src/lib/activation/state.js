/**
 * Activation wizard state + onboarding_events (BE-BLOCKER-15).
 *
 * GET  /api/agent/activation_state
 * POST /api/agent/activation_state/complete
 * POST /api/agent/activation_state/defer
 * POST /api/users/me/onboarding-events  (alias: /api/agent/onboarding-events)
 *
 * Distinct from agent_onboarding_state (BE-BLOCKER-20 / AGT-ONB checklist).
 */

import { query, transaction } from '../../db.js'
import {
  ACTIVATION_STEPS,
  ACTIVATION_STEP_BY_ID,
  ACTIVATION_STEP_IDS,
  COMPLETED_VIA_VALUES,
  SIGNUP_PATHS,
  emptyStepProgress,
} from './steps.js'

export class ActivationConflictError extends Error {
  constructor(message, code = 'ACTIVATION_CONFLICT') {
    super(message)
    this.name = 'ActivationConflictError'
    this.code = code
    this.status = 409
  }
}

export class ActivationValidationError extends Error {
  constructor(message, code = 'ACTIVATION_VALIDATION') {
    super(message)
    this.name = 'ActivationValidationError'
    this.code = code
    this.status = 400
  }
}

function isoOrNull(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function normalizeCountryCode(raw) {
  if (raw == null) return null
  const s = String(raw).trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(s)) return s
  return null
}

function readCountryFromData(data) {
  if (!data || typeof data !== 'object') return null
  return normalizeCountryCode(
    data.iso_country
      || data.country_code_iso
      || data.countryCode
      || (typeof data.country_code === 'string' && data.country_code.length === 2
        ? data.country_code
        : null)
      || data.geo_country_code
      || null,
  )
}

/**
 * Derive signup_path from agency ownership / membership.
 * solo | join | agency
 */
export async function deriveSignupPath(userId) {
  const owned = await query(
    `SELECT a.id
       FROM public.agencies a
      WHERE a.owner_id = $1
      LIMIT 1`,
    [userId],
  )
  if (owned[0]) return 'agency'

  const memberOwner = await query(
    `SELECT am.agency_id
       FROM public.agency_members am
      WHERE am.user_id = $1
        AND am.role = 'owner'
        AND (am.status IS NULL OR am.status = 'active')
        AND am.ended_at IS NULL
      LIMIT 1`,
    [userId],
  )
  if (memberOwner[0]) return 'agency'

  const member = await query(
    `SELECT am.agency_id
       FROM public.agency_members am
      WHERE am.user_id = $1
        AND (am.status IS NULL OR am.status = 'active')
        AND am.ended_at IS NULL
      LIMIT 1`,
    [userId],
  )
  if (member[0]) return 'join'

  const agent = await query(
    `SELECT agency_id FROM public.agents WHERE user_id = $1 OR id = $1 LIMIT 1`,
    [userId],
  )
  if (agent[0]?.agency_id) return 'join'

  return 'solo'
}

export async function deriveCountryCode(userId) {
  const rows = await query(
    `SELECT u.data AS user_data, a.data AS agent_data
       FROM public.users u
       LEFT JOIN public.agents a ON a.user_id = u.id OR a.id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId],
  )
  const row = rows[0]
  if (!row) return null
  return readCountryFromData(row.user_data) || readCountryFromData(row.agent_data) || null
}

export async function deriveTenantId(userId) {
  const agencyMember = await query(
    `SELECT am.agency_id
       FROM public.agency_members am
      WHERE am.user_id = $1
        AND (am.status IS NULL OR am.status = 'active')
        AND am.ended_at IS NULL
      ORDER BY CASE WHEN am.role = 'owner' THEN 0 ELSE 1 END, am.joined_at NULLS LAST
      LIMIT 1`,
    [userId],
  )
  if (agencyMember[0]?.agency_id) return `agency:${agencyMember[0].agency_id}`
  return `personal:${userId}`
}

async function hasActiveWhatsappBinding(userId) {
  const rows = await query(
    `SELECT 1
       FROM public.user_whatsapp_bindings
      WHERE user_id = $1 AND deactivated_at IS NULL
      LIMIT 1`,
    [userId],
  )
  return Boolean(rows[0])
}

async function hasPublishedListing(userId) {
  const rows = await query(
    `SELECT 1
       FROM public.properties p
      WHERE (p.agent_id = $1 OR p.agent_id IN (
              SELECT id FROM public.agents WHERE user_id = $1
            ))
        AND lower(COALESCE(p.status, '')) IN ('active', 'published', 'live')
      LIMIT 1`,
    [userId],
  )
  return Boolean(rows[0])
}

async function countryHasPortals(countryCode) {
  if (!countryCode) return true
  const rows = await query(
    `SELECT 1
       FROM public.portal_registry
      WHERE $1 = ANY (country_codes)
        AND (deprecated_at IS NULL OR deprecated_at > NOW())
      LIMIT 1`,
    [countryCode],
  )
  return Boolean(rows[0])
}

function parseStoredSteps(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const id of ACTIVATION_STEP_IDS) {
    const entry = raw[id]
    if (!entry || typeof entry !== 'object') continue
    const state = typeof entry.state === 'string' ? entry.state : 'not_started'
    out[id] = {
      state,
      completed_at: isoOrNull(entry.completed_at) || null,
      completed_via: entry.completed_via || null,
    }
  }
  return out
}

async function loadActivationRow(userId) {
  const rows = await query(
    `SELECT user_id, tenant_id, signup_path, country_code, steps, updated_at
       FROM public.agent_activation_state
      WHERE user_id = $1`,
    [userId],
  )
  return rows[0] || null
}

async function ensureActivationRow(userId, { signupPath, countryCode, tenantId } = {}) {
  const existing = await loadActivationRow(userId)
  if (existing) return existing

  const path = SIGNUP_PATHS.includes(signupPath) ? signupPath : await deriveSignupPath(userId)
  const country = countryCode !== undefined
    ? normalizeCountryCode(countryCode)
    : await deriveCountryCode(userId)
  const tenant = tenantId !== undefined ? tenantId : await deriveTenantId(userId)

  const rows = await query(
    `INSERT INTO public.agent_activation_state
       (user_id, tenant_id, signup_path, country_code, steps, updated_at)
     VALUES ($1, $2, $3, $4, '{}'::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       user_id = EXCLUDED.user_id
     RETURNING user_id, tenant_id, signup_path, country_code, steps, updated_at`,
    [userId, tenant, path, country],
  )
  return rows[0]
}

export async function appendOnboardingEvent({
  userId,
  tenantId = null,
  family,
  eventType,
  stepId = null,
  completedVia = null,
  metadata = {},
  client = null,
} = {}) {
  if (!userId) throw new ActivationValidationError('userId is required')
  if (!family) throw new ActivationValidationError('family is required')
  if (!eventType) throw new ActivationValidationError('event_type is required')

  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {}
  const sql = `
    INSERT INTO public.onboarding_events
      (user_id, tenant_id, family, event_type, step_id, completed_via, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, user_id, tenant_id, family, event_type, step_id, completed_via, metadata, created_at`
  const params = [
    userId,
    tenantId,
    String(family),
    String(eventType),
    stepId || null,
    completedVia || null,
    JSON.stringify(meta),
  ]
  if (client) {
    const { rows } = await client.query(sql, params)
    return rows[0]
  }
  const rows = await query(sql, params)
  return rows[0]
}

function lockReasons({ signupPath, countryCode, portalsAvailable }) {
  const locked = new Set()
  if (signupPath === 'solo') locked.add('invite_team')
  if (countryCode && !portalsAvailable) locked.add('portal_credentials')
  return locked
}

/**
 * Merge stored progress + lock rules + auto-complete signals into the public
 * activation_state.steps[] contract.
 */
export function buildActivationSteps({
  storedSteps = {},
  signupPath = 'solo',
  countryCode = null,
  portalsAvailable = true,
  signals = {},
}) {
  const locked = lockReasons({ signupPath, countryCode, portalsAvailable })
  const nowIso = new Date().toISOString()
  const steps = []

  for (const def of ACTIVATION_STEPS) {
    const stored = storedSteps[def.id] || emptyStepProgress()
    let state = stored.state || 'not_started'
    let completedAt = stored.completed_at || null
    let completedVia = stored.completed_via || null

    if (locked.has(def.id)) {
      // Locked wins unless already completed (e.g. path changed after complete).
      if (state !== 'complete') {
        state = 'locked'
        completedAt = null
        completedVia = null
      }
    } else if (state !== 'complete') {
      if (def.id === 'whatsapp' && signals.whatsappBound) {
        state = 'complete'
        completedAt = completedAt || nowIso
        completedVia = completedVia || 'whatsapp_intake'
      } else if (def.id === 'first_listing' && signals.hasPublishedListing) {
        state = 'complete'
        completedAt = completedAt || nowIso
        completedVia = completedVia || 'dashboard_action'
      }
    }

    steps.push({
      id: def.id,
      order: def.order,
      state,
      completed_at: state === 'complete' ? completedAt : null,
      completed_via: state === 'complete' ? completedVia : null,
      sub_route: def.sub_route,
    })
  }

  const completedCount = steps.filter((s) => s.state === 'complete').length
  return {
    steps,
    completed_count: completedCount,
    total_count: ACTIVATION_STEPS.length,
    auto_updates: steps.filter((s) => {
      const prev = storedSteps[s.id]
      return s.state === 'complete' && (!prev || prev.state !== 'complete')
        && ((s.id === 'whatsapp' && signals.whatsappBound)
          || (s.id === 'first_listing' && signals.hasPublishedListing))
    }),
  }
}

async function gatherSignals(userId) {
  const [whatsappBound, published] = await Promise.all([
    hasActiveWhatsappBinding(userId),
    hasPublishedListing(userId),
  ])
  return {
    whatsappBound,
    hasPublishedListing: published,
  }
}

async function persistStepMap(userId, stepMap, extra = {}) {
  const sets = ['steps = $2::jsonb', 'updated_at = NOW()']
  const params = [userId, JSON.stringify(stepMap)]
  let i = 3
  if (extra.signup_path !== undefined) {
    sets.push(`signup_path = $${i}`)
    params.push(extra.signup_path)
    i += 1
  }
  if (extra.country_code !== undefined) {
    sets.push(`country_code = $${i}`)
    params.push(extra.country_code)
    i += 1
  }
  if (extra.tenant_id !== undefined) {
    sets.push(`tenant_id = $${i}`)
    params.push(extra.tenant_id)
    i += 1
  }
  const rows = await query(
    `UPDATE public.agent_activation_state
        SET ${sets.join(', ')}
      WHERE user_id = $1
      RETURNING user_id, tenant_id, signup_path, country_code, steps, updated_at`,
    params,
  )
  return rows[0]
}

function stepMapFromBuilt(steps) {
  const map = {}
  for (const s of steps) {
    map[s.id] = {
      state: s.state === 'locked' ? 'locked' : s.state,
      completed_at: s.completed_at,
      completed_via: s.completed_via,
    }
  }
  return map
}

/**
 * Load (or seed) activation state, apply auto-complete signals, optionally
 * persist newly detected auto-completes as events.
 */
export async function getActivationState(userId, { persistAutoComplete = true } = {}) {
  if (!userId) throw new ActivationValidationError('userId is required')

  const row = await ensureActivationRow(userId)
  const signupPath = SIGNUP_PATHS.includes(row.signup_path) ? row.signup_path : 'solo'
  const countryCode = normalizeCountryCode(row.country_code)
  const [signals, portalsAvailable] = await Promise.all([
    gatherSignals(userId),
    countryHasPortals(countryCode),
  ])

  const storedSteps = parseStoredSteps(row.steps)
  const built = buildActivationSteps({
    storedSteps,
    signupPath,
    countryCode,
    portalsAvailable,
    signals,
  })

  if (persistAutoComplete && built.auto_updates.length > 0) {
    await transaction(async (client) => {
      for (const step of built.auto_updates) {
        await appendOnboardingEvent({
          userId,
          tenantId: row.tenant_id,
          family: 'activation',
          eventType: 'auto_complete',
          stepId: step.id,
          completedVia: step.completed_via,
          metadata: { source: 'signal' },
          client,
        })
      }
      const nextMap = stepMapFromBuilt(built.steps)
      // Keep locked as locked in storage so re-reads stay consistent;
      // unlocked not_started/deferred stay as computed.
      await client.query(
        `UPDATE public.agent_activation_state
            SET steps = $2::jsonb, updated_at = NOW()
          WHERE user_id = $1`,
        [userId, JSON.stringify(nextMap)],
      )
    })
  }

  return {
    user_id: userId,
    tenant_id: row.tenant_id || `personal:${userId}`,
    signup_path: signupPath,
    country_code: countryCode,
    steps: built.steps,
    completed_count: built.completed_count,
    total_count: built.total_count,
  }
}

function assertKnownStep(stepId) {
  if (!ACTIVATION_STEP_BY_ID[stepId]) {
    throw new ActivationValidationError(`Unknown step_id: ${stepId}`, 'UNKNOWN_STEP')
  }
}

function assertCompletedVia(completedVia) {
  if (completedVia == null) return null
  if (!COMPLETED_VIA_VALUES.includes(completedVia)) {
    throw new ActivationValidationError(
      `completed_via must be one of: ${COMPLETED_VIA_VALUES.join(', ')}`,
      'INVALID_COMPLETED_VIA',
    )
  }
  return completedVia
}

/**
 * Mark a step complete and append a step_complete event.
 */
export async function completeActivationStep(userId, {
  step_id: stepId,
  completed_via: completedVia,
  metadata = {},
} = {}) {
  assertKnownStep(stepId)
  const via = assertCompletedVia(completedVia) || 'direct'

  // Ensure row + current derived view (locks / signals).
  const current = await getActivationState(userId, { persistAutoComplete: true })
  const step = current.steps.find((s) => s.id === stepId)
  if (!step) throw new ActivationValidationError(`Unknown step_id: ${stepId}`)

  if (step.state === 'locked') {
    throw new ActivationConflictError(
      `Step ${stepId} is locked for signup_path=${current.signup_path}`,
      'STEP_LOCKED',
    )
  }

  const completedAt = step.state === 'complete' && step.completed_at
    ? step.completed_at
    : new Date().toISOString()

  await transaction(async (client) => {
    await appendOnboardingEvent({
      userId,
      tenantId: current.tenant_id,
      family: 'activation',
      eventType: 'step_complete',
      stepId,
      completedVia: via,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      client,
    })

    const row = await loadActivationRow(userId)
    const map = parseStoredSteps(row?.steps)
    map[stepId] = {
      state: 'complete',
      completed_at: completedAt,
      completed_via: via,
    }
    await client.query(
      `UPDATE public.agent_activation_state
          SET steps = $2::jsonb, updated_at = NOW()
        WHERE user_id = $1`,
      [userId, JSON.stringify(map)],
    )
  })

  return getActivationState(userId, { persistAutoComplete: false })
}

/**
 * Defer a step. Does NOT increment completed_count.
 */
export async function deferActivationStep(userId, { step_id: stepId } = {}) {
  assertKnownStep(stepId)

  const current = await getActivationState(userId, { persistAutoComplete: true })
  const step = current.steps.find((s) => s.id === stepId)
  if (!step) throw new ActivationValidationError(`Unknown step_id: ${stepId}`)

  if (step.state === 'locked') {
    throw new ActivationConflictError(
      `Step ${stepId} is locked for signup_path=${current.signup_path}`,
      'STEP_LOCKED',
    )
  }

  // Already complete — leave complete (defer does not undo completion).
  if (step.state === 'complete') {
    return current
  }

  await transaction(async (client) => {
    await appendOnboardingEvent({
      userId,
      tenantId: current.tenant_id,
      family: 'activation',
      eventType: 'step_defer',
      stepId,
      completedVia: null,
      metadata: {},
      client,
    })

    const row = await loadActivationRow(userId)
    const map = parseStoredSteps(row?.steps)
    map[stepId] = {
      state: 'deferred',
      completed_at: null,
      completed_via: null,
    }
    await client.query(
      `UPDATE public.agent_activation_state
          SET steps = $2::jsonb, updated_at = NOW()
        WHERE user_id = $1`,
      [userId, JSON.stringify(map)],
    )
  })

  return getActivationState(userId, { persistAutoComplete: false })
}

/**
 * Fire-and-forget tour / free-form onboarding event (WLB + ONB).
 * Accepts `{ event, tour_step?, family?, ...rest }` → appends and returns the row.
 */
export async function recordTourOnboardingEvent(userId, body = {}) {
  if (!userId) throw new ActivationValidationError('userId is required')
  const eventType = body.event || body.event_type
  if (!eventType || typeof eventType !== 'string') {
    throw new ActivationValidationError('event is required')
  }

  const family = body.family || 'onboarding'
  const tenantId = body.tenant_id || await deriveTenantId(userId)
  const { event, event_type: _et, family: _f, tenant_id: _t, step_id, tour_step, completed_via, metadata, ...rest } = body

  const meta = {
    ...(typeof metadata === 'object' && metadata && !Array.isArray(metadata) ? metadata : {}),
    ...rest,
  }
  if (tour_step !== undefined) meta.tour_step = tour_step

  return appendOnboardingEvent({
    userId,
    tenantId,
    family,
    eventType,
    stepId: step_id || (typeof tour_step === 'string' ? tour_step : null),
    completedVia: completed_via || null,
    metadata: meta,
  })
}

/** Test / admin helper: seed or overwrite signup_path / country on the row. */
export async function seedActivationContext(userId, {
  signup_path: signupPath,
  country_code: countryCode,
  tenant_id: tenantId,
} = {}) {
  await ensureActivationRow(userId, {
    signupPath,
    countryCode,
    tenantId,
  })
  const extra = {}
  if (signupPath !== undefined) extra.signup_path = signupPath
  if (countryCode !== undefined) extra.country_code = normalizeCountryCode(countryCode)
  if (tenantId !== undefined) extra.tenant_id = tenantId
  const row = await loadActivationRow(userId)
  if (Object.keys(extra).length) {
    return persistStepMap(userId, parseStoredSteps(row.steps), extra)
  }
  return row
}

export {
  ACTIVATION_STEPS,
  ACTIVATION_STEP_IDS,
  COMPLETED_VIA_VALUES,
  SIGNUP_PATHS,
}
