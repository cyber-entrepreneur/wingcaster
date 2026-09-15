/**
 * Agency AI cost-cap HTTP surface.
 *
 * GET   /api/agency/ai-usage
 * PATCH /api/agency/ai-caps/:userId
 * GET   /api/users/me/ai-usage/today
 */

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne, insert, query } from '../../db.js'
import {
  getAgencyMembership,
  listAgencyMemberships,
  listUserAgencyMemberships,
} from '../../tenant-authorization.js'
import { maskDisplayName } from '../../account-recovery/mask.js'
import { validate } from '../validation.js'
import {
  DEFAULT_DAILY_CAP,
  currentDateUtc,
  getMyAiUsageToday,
  monthStartUtc,
} from '../ai-caps.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

const patchCapsSchema = z.object({
  daily_cap: z.number().int().min(10).max(2000),
  monthly_cap: z.number().int().min(1).max(100_000).nullable().optional(),
})

async function resolveCallerAgencyMembership(req) {
  const memberships = await listUserAgencyMemberships(req.user.id)
  if (!memberships.length) return null

  const activeTenantId = req.user.active_tenant_id || null
  if (activeTenantId && String(activeTenantId).startsWith('agency:')) {
    const match = memberships.find((m) => m.tenant_id === activeTenantId)
    if (match) return match
  }

  const admin = memberships.find((m) => ADMIN_ROLES.has(m.role))
  if (admin) return admin
  return memberships.find((m) => m.role !== 'guest') || memberships[0]
}

async function requireAgencyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const membership = await resolveCallerAgencyMembership(req)
    if (!membership?.agency_id || !ADMIN_ROLES.has(membership.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    req.agency = agency
    req.agencyId = agency.id
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * @param {string} agencyId
 */
async function buildAgencyAiUsage(agencyId) {
  const today = currentDateUtc()
  const monthStart = monthStartUtc()
  const memberships = await listAgencyMemberships(agencyId)
  const userIds = [...new Set(memberships.map((m) => m.user_id).filter(Boolean))]

  /** @type {Map<string, { name: string | null }>} */
  const usersById = new Map()
  if (userIds.length) {
    const userRows = await query(
      `SELECT id, name FROM public.users WHERE id = ANY($1::text[])`,
      [userIds],
    )
    for (const row of userRows) {
      usersById.set(row.id, { name: row.name || null })
    }
  }

  const settingsRows = userIds.length
    ? await query(
      `SELECT user_id, daily_cap, monthly_cap
         FROM public.agency_ai_settings
        WHERE agency_id = $1 AND user_id = ANY($2::text[])`,
      [agencyId, userIds],
    )
    : []
  /** @type {Map<string, { daily_cap: number, monthly_cap: number | null }>} */
  const settingsByUser = new Map(
    settingsRows.map((r) => [
      r.user_id,
      {
        daily_cap: Number(r.daily_cap),
        monthly_cap: r.monthly_cap != null ? Number(r.monthly_cap) : null,
      },
    ]),
  )

  const usageRows = userIds.length
    ? await query(
      `SELECT user_id,
              COALESCE(SUM(suggestions_used) FILTER (WHERE usage_date = $2::date), 0)::int AS today_used,
              COALESCE(SUM(suggestions_used) FILTER (WHERE usage_date >= $3::date), 0)::int AS month_used
         FROM public.ai_usage_daily
        WHERE user_id = ANY($1::text[])
          AND usage_date >= $3::date
        GROUP BY user_id`,
      [userIds, today, monthStart],
    )
    : []
  /** @type {Map<string, { today_used: number, month_used: number }>} */
  const usageByUser = new Map(
    usageRows.map((r) => [
      r.user_id,
      { today_used: Number(r.today_used), month_used: Number(r.month_used) },
    ]),
  )

  const members = userIds.map((userId) => {
    const settings = settingsByUser.get(userId)
    const usage = usageByUser.get(userId) || { today_used: 0, month_used: 0 }
    const name = usersById.get(userId)?.name || ''
    return {
      user_id: userId,
      name_masked: maskDisplayName(name) || 'Member',
      daily_cap: settings?.daily_cap ?? DEFAULT_DAILY_CAP,
      today_used: usage.today_used,
      month_used: usage.month_used,
      month_cap: settings?.monthly_cap ?? null,
    }
  }).sort((a, b) => b.month_used - a.month_used || a.user_id.localeCompare(b.user_id))

  const agencyMonthTotal = members.reduce((sum, m) => sum + m.month_used, 0)

  const topDaysRows = await query(
    `SELECT usage_date::text AS usage_date,
            COALESCE(SUM(suggestions_used), 0)::int AS suggestions_used
       FROM public.ai_usage_daily
      WHERE tenant_id = $1
        AND usage_date >= $2::date
      GROUP BY usage_date
      ORDER BY suggestions_used DESC, usage_date DESC
      LIMIT 14`,
    [`agency:${agencyId}`, monthStart],
  )

  return {
    members,
    agency_month_total: agencyMonthTotal,
    top_days: topDaysRows.map((r) => ({
      usage_date: r.usage_date,
      suggestions_used: Number(r.suggestions_used),
    })),
  }
}

export function registerAgencyAiCapsRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/users/me/ai-usage/today', auth, async (req, res, next) => {
    try {
      const snapshot = await getMyAiUsageToday(req.user.id, {
        activeTenantId: req.user.active_tenant_id || null,
      })
      return res.json(snapshot)
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/agency/ai-usage', auth, requireAgencyAdmin, async (req, res, next) => {
    try {
      const payload = await buildAgencyAiUsage(req.agencyId)
      return res.json(payload)
    } catch (err) {
      return next(err)
    }
  })

  app.patch(
    '/api/agency/ai-caps/:userId',
    auth,
    requireAgencyAdmin,
    validate(patchCapsSchema),
    async (req, res, next) => {
      try {
        const targetUserId = String(req.params.userId || '')
        if (!targetUserId) return res.status(400).json({ error: 'userId required' })

        const targetMembership = await getAgencyMembership(req.agencyId, targetUserId)
        if (!targetMembership) {
          return res.status(404).json({ error: 'Member not found' })
        }

        const dailyCap = req.validated.daily_cap
        const monthlyCap = Object.prototype.hasOwnProperty.call(req.validated, 'monthly_cap')
          ? req.validated.monthly_cap
          : undefined

        const existing = await query(
          `SELECT daily_cap, monthly_cap
             FROM public.agency_ai_settings
            WHERE agency_id = $1 AND user_id = $2
            LIMIT 1`,
          [req.agencyId, targetUserId],
        )
        const prev = existing[0] || null
        const nextMonthly = monthlyCap !== undefined
          ? monthlyCap
          : (prev?.monthly_cap != null ? Number(prev.monthly_cap) : null)

        await query(
          `INSERT INTO public.agency_ai_settings (
             agency_id, user_id, daily_cap, monthly_cap, set_by, set_at
           ) VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (agency_id, user_id) DO UPDATE SET
             daily_cap = EXCLUDED.daily_cap,
             monthly_cap = EXCLUDED.monthly_cap,
             set_by = EXCLUDED.set_by,
             set_at = now()`,
          [req.agencyId, targetUserId, dailyCap, nextMonthly, req.user.id],
        )

        try {
          await insert('audit_log', {
            id: randomUUID(),
            agent_id: req.user.id,
            agency_id: req.agencyId,
            type: 'ai_cap_change',
            action: 'update',
            entity_type: 'agency_ai_settings',
            entity_id: `${req.agencyId}:${targetUserId}`,
            metadata: {
              target_user_id: targetUserId,
              daily_cap: dailyCap,
              monthly_cap: nextMonthly,
              previous_daily_cap: prev?.daily_cap != null ? Number(prev.daily_cap) : DEFAULT_DAILY_CAP,
              previous_monthly_cap: prev?.monthly_cap != null ? Number(prev.monthly_cap) : null,
            },
            created_at: new Date().toISOString(),
          })
        } catch {
          // audit best-effort
        }

        return res.json({
          user_id: targetUserId,
          daily_cap: dailyCap,
          monthly_cap: nextMonthly,
        })
      } catch (err) {
        return next(err)
      }
    },
  )
}

export { registerAgencyAiCapsRoutes as registerRoutes }
