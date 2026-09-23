/**
 * Contact insight read endpoints for the contact card:
 *  - GET /api/contacts/:id/interested-listings — listings the contact is tied to
 *    via inquiries + viewings, with the current state per listing.
 *  - GET /api/contacts/:id/engagement — last contact per channel + last deal.
 *
 * Read-only, auth + ownership gated (cross-tenant → 404, like GET /api/contacts).
 * Pure builders are exported for unit testing; deps are injectable.
 */

import { authMiddleware as defaultAuth } from '../../auth.js'
import { assertOwnsContact as defaultAssertOwnsContact, NotFoundError } from '../authz.js'
import { findAll as defaultFindAll } from '../../db.js'

function iso(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
function maxIso(a, b) {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}
function latestBy(rows, tsOf) {
  let best = null
  for (const r of rows) {
    if (!best || new Date(tsOf(r) || 0).getTime() > new Date(tsOf(best) || 0).getTime()) best = r
  }
  return best
}

/** Build the "interested listings" view from a contact's inquiries + viewings. */
export function buildInterestedListings({ inquiries, viewings, properties }) {
  const propById = new Map((properties || []).map((p) => [p.id, p]))
  const ids = new Set()
  for (const i of inquiries || []) if (i.property_id) ids.add(i.property_id)
  for (const v of viewings || []) if (v.property_id) ids.add(v.property_id)

  const listings = [...ids].map((pid) => {
    const p = propById.get(pid) || {}
    const propInquiries = (inquiries || []).filter((i) => i.property_id === pid)
    const propViewings = (viewings || []).filter((v) => v.property_id === pid)
    const lastInquiry = latestBy(propInquiries, (r) => r.created_at || r.updated_at)
    const lastViewing = latestBy(propViewings, (r) => r.scheduled_at || r.created_at)
    const lastActivity = maxIso(
      iso(lastInquiry?.created_at || lastInquiry?.updated_at),
      iso(lastViewing?.scheduled_at || lastViewing?.created_at),
    )
    return {
      property_id: pid,
      title: p.title || null,
      address_display: p.address_display || p.address || null,
      price: p.price ?? null,
      currency: p.currency ?? null,
      listing_status: p.status || null,
      inquiry_status: lastInquiry ? (lastInquiry.stage || lastInquiry.status || null) : null,
      viewing_status: lastViewing ? (lastViewing.outcome || lastViewing.status || null) : null,
      viewing_scheduled_at: iso(lastViewing?.scheduled_at),
      last_activity_at: lastActivity,
    }
  })
  listings.sort((a, b) => new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime())
  return listings
}

/** Build the engagement summary: last contact per channel + last deal. */
export function buildEngagement({ conversations, opportunities }) {
  const lastByChannel = {}
  for (const c of conversations || []) {
    const ch = c.source_channel || c.channel || 'unknown'
    const ts = iso(c.last_message_at || c.updated_at || c.created_at)
    if (!ts) continue
    lastByChannel[ch] = maxIso(lastByChannel[ch], ts)
  }
  const lastDealRow = latestBy(opportunities || [], (o) => o.updated_at || o.created_at)
  const last_deal = lastDealRow
    ? {
        id: lastDealRow.id,
        stage: lastDealRow.stage || null,
        property_id: lastDealRow.property_id || null,
        deal_value: lastDealRow.deal_value ?? null,
        currency: lastDealRow.currency ?? null,
        expected_close_date: iso(lastDealRow.expected_close_date),
        updated_at: iso(lastDealRow.updated_at || lastDealRow.created_at),
      }
    : null
  const last_contact_at = Object.values(lastByChannel).reduce((acc, ts) => maxIso(acc, ts), null)
  return {
    channels: Object.keys(lastByChannel),
    last_by_channel: lastByChannel,
    last_contact_at,
    last_deal,
  }
}

export function registerRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || defaultAuth
  const assertOwnsContact = deps.assertOwnsContact || defaultAssertOwnsContact
  const findAll = deps.findAll || defaultFindAll

  async function ownedOr404(req, res) {
    try {
      await assertOwnsContact(req.user.id, req.params.id)
      return true
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: 'Not found' })
        return false
      }
      throw err
    }
  }

  app.get('/api/contacts/:id/interested-listings', auth, async (req, res, next) => {
    try {
      if (!await ownedOr404(req, res)) return undefined
      const id = req.params.id
      const [inquiries, viewings] = await Promise.all([
        findAll('inquiries', (i) => i.contact_id === id),
        findAll('viewings', (v) => v.contact_id === id),
      ])
      const propertyIds = new Set()
      for (const i of inquiries) if (i.property_id) propertyIds.add(i.property_id)
      for (const v of viewings) if (v.property_id) propertyIds.add(v.property_id)
      const properties = propertyIds.size
        ? await findAll('properties', (p) => propertyIds.has(p.id))
        : []
      return res.json({ listings: buildInterestedListings({ inquiries, viewings, properties }) })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/contacts/:id/engagement', auth, async (req, res, next) => {
    try {
      if (!await ownedOr404(req, res)) return undefined
      const id = req.params.id
      const [conversations, opportunities] = await Promise.all([
        findAll('conversations', (c) => c.contact_id === id),
        findAll('opportunities', (o) => o.contact_id === id),
      ])
      return res.json(buildEngagement({ conversations, opportunities }))
    } catch (err) {
      return next(err)
    }
  })
}
