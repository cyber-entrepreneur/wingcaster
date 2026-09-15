/**
 * Two-tier AI suggestion cost caps.
 *
 * Individual agents: hardcoded DEFAULT_DAILY_CAP / day.
 * Agency members: agency_ai_settings.daily_cap (fallback DEFAULT_DAILY_CAP)
 *   + optional monthly_cap.
 */

import { query } from '../db.js'
import { listUserAgencyMemberships, personalTenantId, agencyTenantId } from '../tenant-authorization.js'

export const DEFAULT_DAILY_CAP = 200
export const AI_DAILY_CAP_CODE = 'AI_DAILY_CAP'
export const AI_MONTHLY_CAP_CODE = 'AI_MONTHLY_CAP'

/**
 * @returns {string} YYYY-MM-DD in UTC
 */
export function currentDateUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/**
 * Next midnight UTC as ISO string.
 * @param {Date} [now]
 */
export function nextMidnightUtcIso(now = new Date()) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ))
  return next.toISOString()
}

/**
 * First day of current UTC month as YYYY-MM-DD.
 * @param {Date} [now]
 */
export function monthStartUtc(now = new Date()) {
  return `${now.toISOString().slice(0, 7)}-01`
}

/**
 * Resolve the caller's agency membership used for cap lookup.
 * Prefers active agency tenant; otherwise first non-guest membership.
 *
 * @param {string} userId
 * @param {{ activeTenantId?: string | null, listMemberships?: typeof listUserAgencyMemberships }} [opts]
 * @returns {Promise<{ agencyId: string | null, membership: object | null }>}
 */
export async function resolveUserAgencyContext(userId, opts = {}) {
  const listFn = opts.listMemberships || listUserAgencyMemberships
  const memberships = await listFn(userId)
  if (!memberships?.length) return { agencyId: null, membership: null }

  const activeTenantId = opts.activeTenantId || null
  if (activeTenantId && String(activeTenantId).startsWith('agency:')) {
    const match = memberships.find((m) => m.tenant_id === activeTenantId || m.agency_id === String(activeTenantId).slice('agency:'.length))
    if (match?.agency_id) return { agencyId: match.agency_id, membership: match }
  }

  const preferred = memberships.find((m) => m.role !== 'guest' && m.agency_id) || memberships.find((m) => m.agency_id)
  return preferred?.agency_id
    ? { agencyId: preferred.agency_id, membership: preferred }
    : { agencyId: null, membership: null }
}

/**
 * @param {string} userId
 * @param {{ agencyId?: string | null, queryFn?: typeof query }} [opts]
 */
export async function resolveEffectiveCaps(userId, opts = {}) {
  const agencyId = opts.agencyId !== undefined
    ? opts.agencyId
    : (await resolveUserAgencyContext(userId)).agencyId
  const queryFn = opts.queryFn || query

  if (!agencyId) {
    return {
      agencyId: null,
      dailyCap: DEFAULT_DAILY_CAP,
      monthlyCap: null,
      tenantId: personalTenantId(userId),
    }
  }

  const rows = await queryFn(
    `SELECT daily_cap, monthly_cap
       FROM public.agency_ai_settings
      WHERE agency_id = $1 AND user_id = $2
      LIMIT 1`,
    [agencyId, userId],
  )
  const row = rows[0]
  return {
    agencyId,
    dailyCap: row?.daily_cap != null ? Number(row.daily_cap) : DEFAULT_DAILY_CAP,
    monthlyCap: row?.monthly_cap != null ? Number(row.monthly_cap) : null,
    tenantId: agencyTenantId(agencyId),
  }
}

/**
 * @param {string} userId
 * @param {{ usageDate?: string, queryFn?: typeof query }} [opts]
 */
export async function getTodaySuggestionsUsed(userId, opts = {}) {
  const usageDate = opts.usageDate || currentDateUtc()
  const queryFn = opts.queryFn || query
  const rows = await queryFn(
    `SELECT suggestions_used
       FROM public.ai_usage_daily
      WHERE user_id = $1 AND usage_date = $2::date
      LIMIT 1`,
    [userId, usageDate],
  )
  return Number(rows[0]?.suggestions_used || 0)
}

/**
 * @param {string} userId
 * @param {{ monthStart?: string, queryFn?: typeof query }} [opts]
 */
export async function getMonthSuggestionsUsed(userId, opts = {}) {
  const monthStart = opts.monthStart || monthStartUtc()
  const queryFn = opts.queryFn || query
  const rows = await queryFn(
    `SELECT COALESCE(SUM(suggestions_used), 0)::int AS month_used
       FROM public.ai_usage_daily
      WHERE user_id = $1 AND usage_date >= $2::date`,
    [userId, monthStart],
  )
  return Number(rows[0]?.month_used || 0)
}

/**
 * Throws a 429-shaped error when the next suggestion would exceed a cap.
 *
 * @param {string} userId
 * @param {{
 *   agencyId?: string | null,
 *   activeTenantId?: string | null,
 *   now?: Date,
 *   queryFn?: typeof query,
 *   resolveCaps?: typeof resolveEffectiveCaps,
 * }} [opts]
 */
export async function assertAiSuggestionAllowed(userId, opts = {}) {
  const now = opts.now || new Date()
  const usageDate = currentDateUtc(now)
  const resetsAt = nextMidnightUtcIso(now)
  const queryFn = opts.queryFn || query

  let agencyId = opts.agencyId
  if (agencyId === undefined) {
    agencyId = (await resolveUserAgencyContext(userId, { activeTenantId: opts.activeTenantId })).agencyId
  }

  const resolveCaps = opts.resolveCaps || resolveEffectiveCaps
  const caps = await resolveCaps(userId, { agencyId, queryFn })
  const used = await getTodaySuggestionsUsed(userId, { usageDate, queryFn })

  if (used + 1 > caps.dailyCap) {
    const err = Object.assign(new Error('AI daily suggestion cap reached'), {
      status: 429,
      code: AI_DAILY_CAP_CODE,
      cap: caps.dailyCap,
      used,
      resets_at: resetsAt,
    })
    throw err
  }

  if (caps.monthlyCap != null) {
    const monthUsed = await getMonthSuggestionsUsed(userId, {
      monthStart: monthStartUtc(now),
      queryFn,
    })
    if (monthUsed + 1 > caps.monthlyCap) {
      const err = Object.assign(new Error('AI monthly suggestion cap reached'), {
        status: 429,
        code: AI_MONTHLY_CAP_CODE,
        cap: caps.monthlyCap,
        used: monthUsed,
        resets_at: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
      })
      throw err
    }
  }

  return { ...caps, used, usageDate, resetsAt }
}

/**
 * UPSERT daily usage after a successful Anthropic call.
 *
 * @param {{
 *   userId: string,
 *   tenantId: string,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   usageDate?: string,
 *   queryFn?: typeof query,
 * }} args
 */
export async function recordAiSuggestionUsage({
  userId,
  tenantId,
  inputTokens = 0,
  outputTokens = 0,
  usageDate = currentDateUtc(),
  queryFn = query,
}) {
  await queryFn(
    `INSERT INTO public.ai_usage_daily (
       user_id, usage_date, tenant_id, suggestions_used,
       input_tokens, output_tokens, last_call_at
     ) VALUES (
       $1, $2::date, $3, 1, $4, $5, now()
     )
     ON CONFLICT (user_id, usage_date) DO UPDATE SET
       suggestions_used = public.ai_usage_daily.suggestions_used + 1,
       input_tokens = public.ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
       output_tokens = public.ai_usage_daily.output_tokens + EXCLUDED.output_tokens,
       last_call_at = now(),
       tenant_id = EXCLUDED.tenant_id`,
    [userId, usageDate, tenantId, Number(inputTokens) || 0, Number(outputTokens) || 0],
  )
}

/**
 * Snapshot for GET /api/users/me/ai-usage/today
 * @param {string} userId
 * @param {{ activeTenantId?: string | null, now?: Date }} [opts]
 */
export async function getMyAiUsageToday(userId, opts = {}) {
  const now = opts.now || new Date()
  const { agencyId } = await resolveUserAgencyContext(userId, { activeTenantId: opts.activeTenantId })
  const caps = await resolveEffectiveCaps(userId, { agencyId })
  const used = await getTodaySuggestionsUsed(userId, { usageDate: currentDateUtc(now) })
  return {
    used,
    cap: caps.dailyCap,
    resets_at: nextMidnightUtcIso(now),
    monthly_cap: caps.monthlyCap,
  }
}
