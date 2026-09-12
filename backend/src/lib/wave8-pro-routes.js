/**
 * Wave 8 Pro surface APIs (AGT-DSH-002 / AGT-LST-002 / AGT-SET-002).
 *
 * Preference + layout JSON lives on tenant_memberships.data (no schema migration).
 * Saved views: tenants.data.saved_views JSONB array (MVP path per LST-002 brief).
 */

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { findAll, findOne, remove, update } from '../db.js'
import { findUserById, updateUser } from '../identity.js'
import { personalTenantId } from '../tenant-authorization.js'
import { assertOwnsProperty } from './authz.js'
import { validate } from './validation.js'

const DENSITIES = ['compact', 'comfortable', 'spacious']

const layoutItemSchema = z.object({
  i: z.string().min(1).max(80),
  x: z.number().int().min(0).max(24),
  y: z.number().int().min(0).max(200),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(40),
  minW: z.number().int().min(1).max(12).optional(),
  minH: z.number().int().min(1).max(40).optional(),
})

const dashboardLayoutPatchSchema = z.object({
  tenant_id: z.string().min(1).max(200).optional(),
  layout: z.array(layoutItemSchema).max(40).optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
}).refine((body) => body.layout !== undefined || body.density !== undefined, {
  message: 'layout or density required',
})

const listPrefsPatchSchema = z.object({
  tenant_id: z.string().min(1).max(200).optional(),
  listings: z.object({
    columns: z.array(z.string().min(1).max(40)).max(30).optional(),
    widths: z.record(z.string(), z.number().int().min(40).max(800)).optional(),
    density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    default_sort: z.array(z.tuple([z.string(), z.enum(['asc', 'desc'])])).max(5).optional(),
    default_filter: z.record(z.any()).optional(),
  }),
})

const savedViewSchema = z.object({
  resource: z.enum(['listings']).default('listings'),
  name: z.string().min(1).max(120),
  shared_with_tenant: z.boolean().optional().default(false),
  filter: z.record(z.any()).optional().default({}),
  sort: z.array(z.any()).optional().default([]),
  column_prefs: z.record(z.any()).optional().default({}),
})

const savedViewPatchSchema = savedViewSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: 'At least one field is required' },
)

const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1).max(80)).min(1).max(500),
})

const bulkPublishSchema = bulkIdsSchema.extend({
  channels: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
})

const bulkPriceSchema = bulkIdsSchema.extend({
  mode: z.enum(['fixed', 'percent']),
  value: z.number(),
})

const bulkOwnerSchema = bulkIdsSchema.extend({
  owner_user_id: z.string().min(1).max(80),
})

const bulkBazaarSchema = bulkIdsSchema.extend({
  enabled: z.boolean(),
})

const bulkDeleteSchema = bulkIdsSchema.extend({
  confirmed_phrase: z.string().min(1).max(80),
})

const bulkExportSchema = z.object({
  ids: z.array(z.string().min(1).max(80)).max(2000).nullable().optional(),
  format: z.enum(['csv']).optional().default('csv'),
})

function membershipDataBag(row) {
  const raw = row?.data
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
}

function tenantDataBag(row) {
  return membershipDataBag(row)
}

function normalizeDensity(value) {
  return DENSITIES.includes(value) ? value : 'comfortable'
}

async function resolveActiveTenantId(user) {
  if (user?.active_tenant_id) return user.active_tenant_id
  return personalTenantId(user.id)
}

async function loadActiveMembership(userId, tenantIdHint) {
  const user = await findUserById(userId)
  if (!user) return null
  const tenantId = tenantIdHint || (await resolveActiveTenantId(user))
  const membership = await findOne(
    'tenant_memberships',
    (row) => row.user_id === userId && row.tenant_id === tenantId && row.status === 'active',
  )
  if (!membership) return null
  return { user, tenantId, membership, data: membershipDataBag(membership) }
}

async function persistMembershipData(membership, nextData) {
  const now = new Date().toISOString()
  await update(
    'tenant_memberships',
    (row) => row.id === membership.id,
    (row) => ({
      ...row,
      data: nextData,
      updated_at: now,
    }),
  )
  return now
}

async function assertTenantMember(userId, tenantId) {
  const membership = await findOne(
    'tenant_memberships',
    (row) => row.user_id === userId && row.tenant_id === tenantId && row.status === 'active',
  )
  if (!membership) {
    const err = new Error('Not a member of that tenant')
    err.status = 403
    throw err
  }
  return membership
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function mapOwnedProperties(userId, ids) {
  const owned = []
  const missing = []
  for (const id of ids) {
    try {
      const prop = await assertOwnsProperty(userId, id)
      owned.push(prop)
    } catch {
      missing.push(id)
    }
  }
  return { owned, missing }
}

export function registerWave8ProRoutes(app, deps) {
  const { authMiddleware } = deps
  if (!authMiddleware) throw new Error('registerWave8ProRoutes requires authMiddleware')

  // ── Dashboard layout (AGT-DSH-002) ──────────────────────────────────────
  app.get('/api/users/me/dashboard-layout', authMiddleware, async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id, req.query.tenant_id)
    if (!ctx) return res.status(404).json({ error: 'Active tenant membership not found' })
    const layout = Array.isArray(ctx.data.dashboard_layout) ? ctx.data.dashboard_layout : []
    const density = normalizeDensity(ctx.data.dashboard_density)
    res.json({
      layout,
      density,
      updated_at: ctx.membership.updated_at || null,
      tenant_id: ctx.tenantId,
    })
  })

  app.patch('/api/users/me/dashboard-layout', authMiddleware, validate(dashboardLayoutPatchSchema), async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id, req.validated.tenant_id)
    if (!ctx) return res.status(404).json({ error: 'Active tenant membership not found' })

    const nextData = { ...ctx.data }
    if (req.validated.layout !== undefined) {
      nextData.dashboard_layout = req.validated.layout
    }
    if (req.validated.density !== undefined) {
      nextData.dashboard_density = normalizeDensity(req.validated.density)
    }
    const updatedAt = await persistMembershipData(ctx.membership, nextData)
    res.json({
      layout: Array.isArray(nextData.dashboard_layout) ? nextData.dashboard_layout : [],
      density: normalizeDensity(nextData.dashboard_density),
      updated_at: updatedAt,
      tenant_id: ctx.tenantId,
    })
  })

  // ── List prefs (AGT-LST-002) ────────────────────────────────────────────
  app.get('/api/users/me/list-prefs', authMiddleware, async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id, req.query.tenant_id)
    if (!ctx) return res.status(404).json({ error: 'Active tenant membership not found' })
    const columnPrefs = ctx.data.column_prefs && typeof ctx.data.column_prefs === 'object'
      ? ctx.data.column_prefs
      : {}
    res.json({
      listings: columnPrefs.listings || {},
      updated_at: ctx.membership.updated_at || null,
      tenant_id: ctx.tenantId,
    })
  })

  app.patch('/api/users/me/list-prefs', authMiddleware, validate(listPrefsPatchSchema), async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id, req.validated.tenant_id)
    if (!ctx) return res.status(404).json({ error: 'Active tenant membership not found' })
    const prevPrefs = ctx.data.column_prefs && typeof ctx.data.column_prefs === 'object'
      ? ctx.data.column_prefs
      : {}
    const prevListings = prevPrefs.listings && typeof prevPrefs.listings === 'object'
      ? prevPrefs.listings
      : {}
    const nextListings = {
      ...prevListings,
      ...req.validated.listings,
      widths: {
        ...(prevListings.widths || {}),
        ...(req.validated.listings.widths || {}),
      },
    }
    const nextData = {
      ...ctx.data,
      column_prefs: {
        ...prevPrefs,
        listings: nextListings,
      },
    }
    const updatedAt = await persistMembershipData(ctx.membership, nextData)
    res.json({
      listings: nextListings,
      updated_at: updatedAt,
      tenant_id: ctx.tenantId,
    })
  })

  // ── Try-Pro nudge dismiss (AGT-SET-002) — users.data ────────────────────
  app.post('/api/users/me/pro-nudge/dismiss', authMiddleware, async (req, res) => {
    const user = await findUserById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const prevData = membershipDataBag({ data: user.data })
    const dismissedAt = new Date().toISOString()
    const nextData = { ...prevData, pro_nudge_dismissed_at: dismissedAt }
    await updateUser(user.id, { data: nextData })
    res.json({ pro_nudge_dismissed_at: dismissedAt })
  })

  app.get('/api/users/me/pro-nudge', authMiddleware, async (req, res) => {
    const user = await findUserById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const data = membershipDataBag({ data: user.data })
    const props = await findAll('properties', (p) => p.agent_id === req.user.id)
    const createdAt = user.created_at ? Date.parse(user.created_at) : NaN
    const daysSinceSignup = Number.isFinite(createdAt)
      ? Math.floor((Date.now() - createdAt) / 86_400_000)
      : 999
    const dismissedAt = data.pro_nudge_dismissed_at ? Date.parse(data.pro_nudge_dismissed_at) : null
    const daysSinceDismiss = dismissedAt && Number.isFinite(dismissedAt)
      ? Math.floor((Date.now() - dismissedAt) / 86_400_000)
      : null
    const eligible =
      daysSinceSignup >= 14 &&
      props.length >= 20 &&
      (daysSinceDismiss === null || daysSinceDismiss >= 90)
    res.json({
      eligible,
      listing_count: props.length,
      days_since_signup: daysSinceSignup,
      pro_nudge_dismissed_at: data.pro_nudge_dismissed_at || null,
      days_since_dismiss: daysSinceDismiss,
    })
  })

  // ── Saved views (AGT-LST-002) ───────────────────────────────────────────
  app.get('/api/tenants/:tid/saved-views', authMiddleware, async (req, res) => {
    try {
      await assertTenantMember(req.user.id, req.params.tid)
    } catch (err) {
      return res.status(err.status || 403).json({ error: err.message })
    }
    const tenant = await findOne('tenants', (row) => row.id === req.params.tid)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const data = tenantDataBag(tenant)
    const views = Array.isArray(data.saved_views) ? data.saved_views : []
    const resource = req.query.resource || 'listings'
    const visible = views.filter(
      (v) =>
        v &&
        v.resource === resource &&
        (v.shared_with_tenant || v.owner_user_id === req.user.id),
    )
    res.json({ views: visible })
  })

  app.post('/api/tenants/:tid/saved-views', authMiddleware, validate(savedViewSchema), async (req, res) => {
    try {
      await assertTenantMember(req.user.id, req.params.tid)
    } catch (err) {
      return res.status(err.status || 403).json({ error: err.message })
    }
    const tenant = await findOne('tenants', (row) => row.id === req.params.tid)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const data = tenantDataBag(tenant)
    const views = Array.isArray(data.saved_views) ? [...data.saved_views] : []
    const view = {
      id: `sv_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      resource: req.validated.resource || 'listings',
      name: req.validated.name,
      owner_user_id: req.user.id,
      shared_with_tenant: !!req.validated.shared_with_tenant,
      filter: req.validated.filter || {},
      sort: req.validated.sort || [],
      column_prefs: req.validated.column_prefs || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    views.push(view)
    await update(
      'tenants',
      (row) => row.id === tenant.id,
      (row) => ({
        ...row,
        data: { ...data, saved_views: views },
        updated_at: new Date().toISOString(),
      }),
    )
    res.status(201).json(view)
  })

  app.patch('/api/tenants/:tid/saved-views/:viewId', authMiddleware, validate(savedViewPatchSchema), async (req, res) => {
    try {
      await assertTenantMember(req.user.id, req.params.tid)
    } catch (err) {
      return res.status(err.status || 403).json({ error: err.message })
    }
    const tenant = await findOne('tenants', (row) => row.id === req.params.tid)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const data = tenantDataBag(tenant)
    const views = Array.isArray(data.saved_views) ? [...data.saved_views] : []
    const idx = views.findIndex((v) => v && v.id === req.params.viewId)
    if (idx < 0) return res.status(404).json({ error: 'View not found' })
    const existing = views[idx]
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the view owner can edit it' })
    }
    const next = {
      ...existing,
      ...req.validated,
      id: existing.id,
      owner_user_id: existing.owner_user_id,
      updated_at: new Date().toISOString(),
    }
    views[idx] = next
    await update(
      'tenants',
      (row) => row.id === tenant.id,
      (row) => ({
        ...row,
        data: { ...data, saved_views: views },
        updated_at: new Date().toISOString(),
      }),
    )
    res.json(next)
  })

  app.delete('/api/tenants/:tid/saved-views/:viewId', authMiddleware, async (req, res) => {
    try {
      await assertTenantMember(req.user.id, req.params.tid)
    } catch (err) {
      return res.status(err.status || 403).json({ error: err.message })
    }
    const tenant = await findOne('tenants', (row) => row.id === req.params.tid)
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const data = tenantDataBag(tenant)
    const views = Array.isArray(data.saved_views) ? [...data.saved_views] : []
    const existing = views.find((v) => v && v.id === req.params.viewId)
    if (!existing) return res.status(404).json({ error: 'View not found' })
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the view owner can delete it' })
    }
    const nextViews = views.filter((v) => v.id !== req.params.viewId)
    await update(
      'tenants',
      (row) => row.id === tenant.id,
      (row) => ({
        ...row,
        data: { ...data, saved_views: nextViews },
        updated_at: new Date().toISOString(),
      }),
    )
    res.json({ success: true })
  })

  // ── Bulk property mutations (AGT-LST-002) ───────────────────────────────
  app.post('/api/properties/bulk/archive', authMiddleware, validate(bulkIdsSchema), async (req, res) => {
    const { owned, missing } = await mapOwnedProperties(req.user.id, req.validated.ids)
    for (const prop of owned) {
      await update('properties', (p) => p.id === prop.id, (p) => ({ ...p, status: 'archived' }))
    }
    res.json({ updated: owned.map((p) => p.id), missing })
  })

  app.post('/api/properties/bulk/publish', authMiddleware, validate(bulkPublishSchema), async (req, res) => {
    const { owned, missing } = await mapOwnedProperties(req.user.id, req.validated.ids)
    for (const prop of owned) {
      await update('properties', (p) => p.id === prop.id, (p) => ({
        ...p,
        status: 'active',
        marketplace_syndicated: true,
      }))
    }
    res.json({
      updated: owned.map((p) => p.id),
      missing,
      channels: req.validated.channels || [],
    })
  })

  app.post('/api/properties/bulk/price-adjust', authMiddleware, validate(bulkPriceSchema), async (req, res) => {
    const { owned, missing } = await mapOwnedProperties(req.user.id, req.validated.ids)
    const { mode, value } = req.validated
    const results = []
    for (const prop of owned) {
      const current = Number(prop.price) || 0
      const nextPrice = mode === 'percent'
        ? Math.max(0, Math.round(current * (1 + value / 100)))
        : Math.max(0, Math.round(value))
      await update('properties', (p) => p.id === prop.id, (p) => ({ ...p, price: nextPrice }))
      results.push({ id: prop.id, price: nextPrice })
    }
    res.json({ updated: results, missing })
  })

  app.post('/api/properties/bulk/change-owner', authMiddleware, validate(bulkOwnerSchema), async (req, res) => {
    const { owned, missing } = await mapOwnedProperties(req.user.id, req.validated.ids)
    for (const prop of owned) {
      await update(
        'properties',
        (p) => p.id === prop.id,
        (p) => ({ ...p, agent_id: req.validated.owner_user_id }),
      )
    }
    res.json({ updated: owned.map((p) => p.id), missing })
  })

  app.post('/api/properties/bulk/toggle-bazaar', authMiddleware, validate(bulkBazaarSchema), async (req, res) => {
    const { owned, missing } = await mapOwnedProperties(req.user.id, req.validated.ids)
    for (const prop of owned) {
      await update(
        'properties',
        (p) => p.id === prop.id,
        (p) => ({ ...p, marketplace_syndicated: !!req.validated.enabled }),
      )
    }
    res.json({ updated: owned.map((p) => p.id), missing, enabled: req.validated.enabled })
  })

  app.delete('/api/properties/bulk', authMiddleware, validate(bulkDeleteSchema), async (req, res) => {
    const ids = req.validated.ids
    const expected = `delete ${ids.length}`
    if (String(req.validated.confirmed_phrase).trim().toLowerCase() !== expected.toLowerCase()) {
      return res.status(400).json({
        error: 'Confirmation phrase mismatch',
        expected,
      })
    }
    const { owned, missing } = await mapOwnedProperties(req.user.id, ids)
    for (const prop of owned) {
      await remove('properties', (p) => p.id === prop.id)
    }
    res.json({ deleted: owned.map((p) => p.id), missing })
  })

  app.post('/api/properties/bulk/export', authMiddleware, validate(bulkExportSchema), async (req, res) => {
    let props
    if (req.validated.ids == null) {
      props = await findAll('properties', (p) => p.agent_id === req.user.id)
    } else {
      const mapped = await mapOwnedProperties(req.user.id, req.validated.ids)
      props = mapped.owned
    }
    const header = [
      'id', 'reference', 'title', 'status', 'type', 'price', 'city', 'location',
      'bedrooms', 'bathrooms', 'area', 'views', 'listed_date',
    ]
    const lines = [header.join(',')]
    for (const p of props) {
      lines.push([
        p.id, p.reference, p.title, p.status, p.type, p.price, p.city, p.location,
        p.bedrooms, p.bathrooms, p.area, p.views, p.listed_date,
      ].map(csvEscape).join(','))
    }
    const csv = lines.join('\n')
    const jobId = `exp_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    // Sync path for ≤500 rows — return download inline (brief allows async for >500).
    res.json({
      job_id: jobId,
      status: 'ready',
      format: 'csv',
      row_count: props.length,
      csv,
      filename: `listings-export-${new Date().toISOString().slice(0, 10)}.csv`,
    })
  })
}
