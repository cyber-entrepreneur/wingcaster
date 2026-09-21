/**
 * AGN-PRC-002 — Agency bulk price adjustment with mandatory preview + reversal window.
 */

import { randomUUID } from 'node:crypto'
import { query } from '../../../db.js'
import { listAgencyMemberships, listUserAgencyMemberships } from '../../../tenant-authorization.js'

export const BULK_STRATEGIES = Object.freeze([
  'recommendation',
  'percent_up',
  'percent_down',
  'set_median',
  'fixed_delta',
])

const ADMIN_ROLES = new Set(['owner', 'admin'])
const MAX_LISTINGS_WITHOUT_APPROVAL = 100
const MAX_AGGREGATE_VALUE_CHANGE_PERCENT = 50

export function isBulkStrategy(value) {
  return BULK_STRATEGIES.includes(value)
}

export async function resolveAgencyAdmin(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  const membership = memberships.find((item) => ADMIN_ROLES.has(item.role))
  if (!membership) {
    return { ok: false, status: 403, error: 'Forbidden: agency owner or admin required' }
  }
  return { ok: true, agencyId: membership.agency_id, role: membership.role }
}

export function computeNewPrice(currentPrice, strategy, strategyValue, analysis) {
  const current = Number(currentPrice) || 0
  const median = analysis?.median_price != null ? Number(analysis.median_price) : null

  switch (strategy) {
    case 'recommendation':
    case 'set_median':
      if (median == null || !Number.isFinite(median) || median <= 0) return null
      return Math.max(0, Math.round(median))
    case 'percent_up': {
      const pct = Number(strategyValue)
      if (!Number.isFinite(pct) || pct <= 0) return null
      return Math.max(0, Math.round(current * (1 + pct / 100)))
    }
    case 'percent_down': {
      const pct = Number(strategyValue)
      if (!Number.isFinite(pct) || pct <= 0) return null
      return Math.max(0, Math.round(current * (1 - pct / 100)))
    }
    case 'fixed_delta': {
      const delta = Number(strategyValue)
      if (!Number.isFinite(delta)) return null
      return Math.max(0, Math.round(current + delta))
    }
    default:
      return null
  }
}

export function buildPreviewRows(listings, strategy, strategyValue) {
  const rows = []
  const skipped = []

  for (const listing of listings) {
    const current = Number(listing.price) || 0
    const next = computeNewPrice(current, strategy, strategyValue, listing.pricing_analysis)
    if (next == null || next === current) {
      skipped.push({
        property_id: listing.id,
        reason: next == null ? 'No recommendation available' : 'No price change',
      })
      continue
    }
    const deltaPercent = current > 0 ? ((next - current) / current) * 100 : 0
    rows.push({
      property_id: listing.id,
      agent_id: listing.agent_id || null,
      agent_name: listing.agent_name || listing.agent_id || 'Unassigned',
      title: listing.title || listing.id,
      address: [listing.neighborhood, listing.city].filter(Boolean).join(', ') || null,
      currency: listing.currency || 'USD',
      price_before: current,
      price_after: next,
      delta_percent: Number(deltaPercent.toFixed(2)),
      thumbnail_url: listing.cover_image_url || listing.primary_image_url || null,
    })
  }

  const totalBefore = rows.reduce((sum, row) => sum + row.price_before, 0)
  const totalAfter = rows.reduce((sum, row) => sum + row.price_after, 0)
  const aggregateChangePercent = totalBefore > 0
    ? Math.abs(((totalAfter - totalBefore) / totalBefore) * 100)
    : 0

  return {
    rows,
    skipped,
    totals: {
      listing_count: rows.length,
      total_value_before: totalBefore,
      total_value_after: totalAfter,
      aggregate_change_percent: Number(aggregateChangePercent.toFixed(2)),
    },
  }
}

export function evaluateSafetyCaps(preview) {
  if (preview.totals.listing_count > MAX_LISTINGS_WITHOUT_APPROVAL) {
    return {
      ok: false,
      code: 'SAFETY_CAP_LISTINGS',
      error: `Bulk adjustments over ${MAX_LISTINGS_WITHOUT_APPROVAL} listings require second-approver approval`,
    }
  }
  if (preview.totals.aggregate_change_percent > MAX_AGGREGATE_VALUE_CHANGE_PERCENT) {
    return {
      ok: false,
      code: 'SAFETY_CAP_VALUE',
      error: `Aggregate value change over ${MAX_AGGREGATE_VALUE_CHANGE_PERCENT}% requires second-approver approval`,
    }
  }
  return { ok: true }
}

async function expireActiveAdjustments(agencyId) {
  await query(
    `UPDATE agency_bulk_price_adjustments
     SET status = 'committed', committed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE agency_id = $1
       AND status = 'active'
       AND reversal_deadline_at <= CURRENT_TIMESTAMP`,
    [agencyId],
  )
}

export async function getActiveBulkAdjustment(agencyId) {
  await expireActiveAdjustments(agencyId)
  const rows = await query(
    `SELECT *
     FROM agency_bulk_price_adjustments
     WHERE agency_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [agencyId],
  )
  const adjustment = rows[0]
  if (!adjustment) return null

  const items = await query(
    `SELECT property_id, agent_id, title, address, currency, price_before, price_after
     FROM agency_bulk_price_adjustment_items
     WHERE adjustment_id = $1
     ORDER BY title`,
    [adjustment.id],
  )

  return { adjustment, items }
}

export async function applyBulkPriceAdjustment({
  agencyId,
  actorId,
  strategy,
  strategyValue,
  reversalHours = 24,
  previewRows,
  totals,
  dal,
  recalculationJobService,
}) {
  const adjustmentId = randomUUID()
  const now = new Date()
  const reversalDeadline = new Date(now.getTime() + reversalHours * 60 * 60 * 1000).toISOString()

  await query(
    `INSERT INTO agency_bulk_price_adjustments (
      id, agency_id, created_by, status, strategy, strategy_value, reversal_hours,
      reversal_deadline_at, listing_count, total_value_before, total_value_after,
      created_at, updated_at
    ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [
      adjustmentId,
      agencyId,
      actorId,
      strategy,
      strategyValue ?? null,
      reversalHours,
      reversalDeadline,
      totals.listing_count,
      totals.total_value_before,
      totals.total_value_after,
      now.toISOString(),
    ],
  )

  for (const row of previewRows) {
    await query(
      `INSERT INTO agency_bulk_price_adjustment_items (
        id, adjustment_id, property_id, agent_id, title, address, currency,
        price_before, price_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        adjustmentId,
        row.property_id,
        row.agent_id,
        row.title,
        row.address,
        row.currency,
        row.price_before,
        row.price_after,
        now.toISOString(),
      ],
    )

    const updated = await dal.findOne('properties', (property) => property.id === row.property_id)
    if (updated) {
      const next = { ...updated, price: row.price_after, updated_at: now.toISOString() }
      await dal.update('properties', (property) => property.id === row.property_id, () => next)
      if (recalculationJobService?.invalidateForPropertyChange) {
        await recalculationJobService.invalidateForPropertyChange(next)
      }
    }
  }

  await query(
    `INSERT INTO public.audit_log (id, actor_id, action, resource_type, resource_id, metadata, created_at)
     VALUES ($1, $2, 'agency.bulk_price_adjust.apply', 'agency_bulk_price_adjustment', $3, $4::jsonb, $5)`,
    [
      randomUUID(),
      actorId,
      adjustmentId,
      JSON.stringify({
        agency_id: agencyId,
        strategy,
        listing_count: totals.listing_count,
        reversal_deadline_at: reversalDeadline,
      }),
      now.toISOString(),
    ],
  )

  return {
    id: adjustmentId,
    status: 'active',
    reversal_deadline_at: reversalDeadline,
    listing_count: totals.listing_count,
  }
}

export async function revertBulkPriceAdjustment({
  adjustmentId,
  agencyId,
  actorId,
  dal,
  recalculationJobService,
}) {
  await expireActiveAdjustments(agencyId)
  const rows = await query(
    `SELECT * FROM agency_bulk_price_adjustments
     WHERE id = $1 AND agency_id = $2`,
    [adjustmentId, agencyId],
  )
  const adjustment = rows[0]
  if (!adjustment) return { ok: false, status: 404, error: 'Adjustment not found' }
  if (adjustment.status !== 'active') {
    return { ok: false, status: 400, error: 'This adjustment can no longer be reverted' }
  }

  const items = await query(
    `SELECT property_id, price_before
     FROM agency_bulk_price_adjustment_items
     WHERE adjustment_id = $1`,
    [adjustmentId],
  )

  const now = new Date().toISOString()
  for (const item of items) {
    const property = await dal.findOne('properties', (row) => row.id === item.property_id)
    if (!property) continue
    const next = { ...property, price: Number(item.price_before), updated_at: now }
    await dal.update('properties', (row) => row.id === item.property_id, () => next)
    if (recalculationJobService?.invalidateForPropertyChange) {
      await recalculationJobService.invalidateForPropertyChange(next)
    }
  }

  await query(
    `UPDATE agency_bulk_price_adjustments
     SET status = 'reverted', reverted_at = $2, reverted_by = $3, updated_at = $2
     WHERE id = $1`,
    [adjustmentId, now, actorId],
  )

  await query(
    `INSERT INTO public.audit_log (id, actor_id, action, resource_type, resource_id, metadata, created_at)
     VALUES ($1, $2, 'agency.bulk_price_adjust.revert', 'agency_bulk_price_adjustment', $3, $4::jsonb, $5)`,
    [
      randomUUID(),
      actorId,
      adjustmentId,
      JSON.stringify({ agency_id: agencyId, listing_count: adjustment.listing_count }),
      now,
    ],
  )

  return { ok: true, id: adjustmentId, status: 'reverted', reverted_at: now }
}

export async function loadAgencyListingsForBulk(dal, agencyId, listingIds, analysisService, logger) {
  const members = await listAgencyMemberships(agencyId)
  const memberIds = new Set(members.map((member) => member.user_id))
  const agents = await dal.findAll('agents', (agent) => memberIds.has(agent.id))
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name || agent.email || agent.id]))

  const properties = await dal.findAll('properties', (property) =>
    listingIds.includes(property.id) &&
    property.status !== 'deleted' &&
    (property.agency_id === agencyId || memberIds.has(property.agent_id)),
  )

  const listings = await Promise.all(properties.map(async (property) => {
    let pricing_analysis = null
    try {
      pricing_analysis = await analysisService.getAnalysis(property.id)
    } catch (err) {
      logger?.warn?.({ err: err.message, propertyId: property.id }, 'Bulk adjust analysis unavailable')
    }
    return {
      ...property,
      pricing_analysis,
      agent_name: agentNames.get(property.agent_id) || property.agent_id || 'Unassigned',
    }
  }))

  const missing = listingIds.filter((id) => !listings.some((listing) => listing.id === id))
  return { listings, missing }
}
