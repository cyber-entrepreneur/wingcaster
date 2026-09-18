/**
 * PA-GOO-001 — Google Maps usage & budget dashboard (admin API).
 *
 * Reads the `google_api_usage_log` (area_intelligence schema, resolved via the
 * table-mapper) and a configurable budget to give a Platform Admin cost
 * governance: month-to-date spend, projected month-end, headroom, per-operation
 * and per-area breakdowns, a daily trend, and an editable budget + alert
 * threshold that drive the over-budget / near-threshold banners.
 *
 * Platform-admin only; the budget PUT additionally requires step-up.
 */
import { z } from 'zod'
import { findAll, findOne, insert, update } from '../../db.js'
import { requirePlatformAdmin, isPlatformAdmin } from '../auth-guards.js'
import { requireElevated } from '../../auth.js'

const CONFIG_ID = 'default'
const DEFAULT_BUDGET_USD_MONTHLY = 500
const DEFAULT_ALERT_THRESHOLD_PCT = 80
const MAX_BUDGET_USD_MONTHLY = 10000000

const budgetSchema = z
  .object({
    budget_usd_monthly: z.number().nonnegative().finite().max(MAX_BUDGET_USD_MONTHLY),
    alert_threshold_pct: z.number().int().gte(1).lte(100),
  })
  .strict()

function serializeBudget(row) {
  const src = row || {}
  const budget = Number(src.budget_usd_monthly)
  const threshold = Number(src.alert_threshold_pct)
  return {
    budget_usd_monthly: Number.isFinite(budget) ? budget : DEFAULT_BUDGET_USD_MONTHLY,
    alert_threshold_pct: Number.isFinite(threshold) ? threshold : DEFAULT_ALERT_THRESHOLD_PCT,
    updated_by: src.updated_by ?? null,
    updated_at: src.updated_at ?? null,
  }
}

async function loadBudgetConfig() {
  try {
    const row = await findOne('google_maps_budget_config', (r) => r.id === CONFIG_ID)
    return serializeBudget(row)
  } catch {
    return serializeBudget(null)
  }
}

function startOfMonth(now = new Date()) {
  const d = new Date(now)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayKey(iso) {
  return String(iso || '').slice(0, 10)
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function buildSummary(rows, budgetConfig, { days, top }, now = new Date()) {
  const monthStart = startOfMonth(now)
  const cost = (r) => Number(r.cost_estimate_usd) || 0
  const reqs = (r) => Number(r.request_count) || 0

  const mtdRows = rows.filter((r) => r.created_at && new Date(r.created_at) >= monthStart)
  const mtdSpend = mtdRows.reduce((s, r) => s + cost(r), 0)
  const mtdRequests = mtdRows.reduce((s, r) => s + reqs(r), 0)

  const byOpMap = new Map()
  for (const r of mtdRows) {
    const key = r.operation || 'unknown'
    const cur = byOpMap.get(key) || { operation: key, requests: 0, cost: 0 }
    cur.requests += reqs(r)
    cur.cost += cost(r)
    byOpMap.set(key, cur)
  }
  const byOperation = [...byOpMap.values()]
    .map((o) => ({ ...o, cost: round2(o.cost) }))
    .sort((a, b) => b.cost - a.cost)

  const byAreaMap = new Map()
  for (const r of mtdRows) {
    const key = r.area_id || 'unattributed'
    const cur = byAreaMap.get(key) || { area_id: key, requests: 0, cost: 0 }
    cur.requests += reqs(r)
    cur.cost += cost(r)
    byAreaMap.set(key, cur)
  }
  const topConsumers = [...byAreaMap.values()]
    .map((a) => ({ ...a, cost: round2(a.cost) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, top)

  // Daily trend for the last `days` days (inclusive of today), ascending.
  const dailyMap = new Map()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    dailyMap.set(dayKey(d.toISOString()), { date: dayKey(d.toISOString()), cost: 0, requests: 0 })
  }
  for (const r of rows) {
    const key = dayKey(r.created_at)
    if (dailyMap.has(key)) {
      const cur = dailyMap.get(key)
      cur.cost += cost(r)
      cur.requests += reqs(r)
    }
  }
  const daily = [...dailyMap.values()].map((d) => ({ ...d, cost: round2(d.cost) }))

  const budget = budgetConfig.budget_usd_monthly
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projectedMonthEnd = dayOfMonth > 0 ? round2((mtdSpend / dayOfMonth) * daysInMonth) : round2(mtdSpend)
  const headroom = round2(budget - mtdSpend)
  const pctConsumed = budget > 0 ? Math.round((mtdSpend / budget) * 1000) / 10 : 0

  return {
    mtd_spend_usd: round2(mtdSpend),
    mtd_requests: mtdRequests,
    budget_usd_monthly: budget,
    alert_threshold_pct: budgetConfig.alert_threshold_pct,
    projected_month_end_usd: projectedMonthEnd,
    headroom_usd: headroom,
    pct_consumed: pctConsumed,
    over_budget: mtdSpend >= budget && budget > 0,
    near_threshold: budget > 0 && pctConsumed >= budgetConfig.alert_threshold_pct && mtdSpend < budget,
    by_operation: byOperation,
    top_consumers: topConsumers,
    daily,
    updated_at: budgetConfig.updated_at,
  }
}

const summaryQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).optional(),
    top: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/admin/google-usage/summary', authMiddleware, async (req, res) => {
    if (!req.user?.id || !(await isPlatformAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const parsed = summaryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid query' })
    }
    const days = parsed.data.days || 30
    const top = parsed.data.top || 5
    const [rows, budgetConfig] = await Promise.all([findAll('google_api_usage_log', () => true), loadBudgetConfig()])
    res.json({ summary: buildSummary(rows, budgetConfig, { days, top }) })
  })

  app.get('/api/admin/google-usage/budget', authMiddleware, async (req, res) => {
    if (!req.user?.id || !(await isPlatformAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const config = await loadBudgetConfig()
    res.json({
      config,
      constraints: { max_budget_usd_monthly: MAX_BUDGET_USD_MONTHLY, min_alert_threshold_pct: 1, max_alert_threshold_pct: 100 },
    })
  })

  app.put(
    '/api/admin/google-usage/budget',
    authMiddleware,
    requirePlatformAdmin,
    requireElevated(),
    async (req, res) => {
      const parsed = budgetSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid budget config' })
      }
      const now = new Date().toISOString()
      const fields = { ...parsed.data, updated_by: req.user.id, updated_at: now }
      const existing = await findOne('google_maps_budget_config', (r) => r.id === CONFIG_ID)
      if (existing) {
        await update('google_maps_budget_config', (r) => r.id === CONFIG_ID, (r) => ({ ...r, ...fields }))
      } else {
        await insert('google_maps_budget_config', { id: CONFIG_ID, created_at: now, ...fields })
      }
      const saved = await findOne('google_maps_budget_config', (r) => r.id === CONFIG_ID)
      res.json({ config: serializeBudget(saved || { id: CONFIG_ID, ...fields }) })
    },
  )
}

export { buildSummary, serializeBudget }
