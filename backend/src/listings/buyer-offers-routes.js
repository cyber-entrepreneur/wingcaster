/**
 * AGT-LST-010 — Buyer offers on a listing.
 *
 *   GET    /api/properties/:id/buyer-offers      list offers on a listing
 *   POST   /api/properties/:id/buyer-offers      record a new offer
 *   PATCH  /api/buyer-offers/:offerId            update an offer (status/fields)
 *   DELETE /api/buyer-offers/:offerId            remove an offer
 *
 * Auth: caller must own the parent listing (agent_id) or share its agency
 * (via assertOwnsProperty, which is leak-safe → 404 on any denial). Offer
 * rows carry the recording agent's id; edits/deletes re-check the parent
 * listing so an agency colleague with listing access can co-manage offers.
 *
 * NOTE the path is `/buyer-offers`, NOT `/offers` — `POST
 * /api/properties/:id/offers` is a different, pre-existing feature (property
 * listing variants under a canonical_id). These are offers a BUYER made.
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, update, remove } from '../db.js'
import { assertOwnsProperty } from '../lib/authz.js'

const STATUSES = ['received', 'countered', 'accepted', 'rejected', 'withdrawn']
const FINANCING_TYPES = ['cash', 'mortgage', 'mixed']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const createSchema = z
  .object({
    contact_id: z.string().min(1).max(80).nullish(),
    offeror_name: z.string().trim().min(1).max(200),
    amount: z.number().positive().finite(),
    currency: z.string().trim().min(1).max(8).default('USD'),
    offer_date: z.string().regex(DATE_RE, 'offer_date must be YYYY-MM-DD').optional(),
    terms: z.string().max(4000).nullish(),
    financing_type: z.enum(FINANCING_TYPES).nullish(),
    expiry_date: z.string().regex(DATE_RE, 'expiry_date must be YYYY-MM-DD').nullish(),
    conditions: z.string().max(4000).nullish(),
    status: z.enum(STATUSES).default('received'),
    notes: z.string().max(4000).nullish(),
  })
  .strict()

const updateSchema = z
  .object({
    contact_id: z.string().min(1).max(80).nullish(),
    offeror_name: z.string().trim().min(1).max(200).optional(),
    amount: z.number().positive().finite().optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    offer_date: z.string().regex(DATE_RE, 'offer_date must be YYYY-MM-DD').optional(),
    terms: z.string().max(4000).nullish(),
    financing_type: z.enum(FINANCING_TYPES).nullish(),
    expiry_date: z.string().regex(DATE_RE, 'expiry_date must be YYYY-MM-DD').nullish(),
    conditions: z.string().max(4000).nullish(),
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(4000).nullish(),
  })
  .strict()

function serializeOffer(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    agent_id: row.agent_id,
    contact_id: row.contact_id ?? null,
    offeror_name: row.offeror_name,
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
    currency: row.currency || 'USD',
    offer_date: row.offer_date,
    terms: row.terms ?? null,
    financing_type: row.financing_type ?? null,
    expiry_date: row.expiry_date ?? null,
    conditions: row.conditions ?? null,
    status: row.status,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/properties/:id/buyer-offers', authMiddleware, async (req, res) => {
    try {
      await assertOwnsProperty(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
    const offers = await findAll('property_offers', (o) => o.property_id === req.params.id)
    offers.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    res.json({ offers: offers.map(serializeOffer) })
  })

  app.post('/api/properties/:id/buyer-offers', authMiddleware, async (req, res) => {
    try {
      await assertOwnsProperty(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid offer', details: parsed.error.flatten() })
    }
    const body = parsed.data

    // If a contact is linked, verify the caller can see it and snapshot its name.
    let offerorName = body.offeror_name
    if (body.contact_id) {
      const contact = await findOne('contacts', (c) => c.id === body.contact_id)
      if (!contact) return res.status(400).json({ error: 'Linked contact not found' })
      if (!offerorName) offerorName = contact.name
    }

    const now = new Date().toISOString()
    const row = {
      id: uuidv4(),
      property_id: req.params.id,
      agent_id: req.user.id,
      contact_id: body.contact_id ?? null,
      offeror_name: offerorName,
      amount: body.amount,
      currency: body.currency,
      offer_date: body.offer_date || now.split('T')[0],
      terms: body.terms ?? null,
      financing_type: body.financing_type ?? null,
      expiry_date: body.expiry_date ?? null,
      conditions: body.conditions ?? null,
      status: body.status,
      notes: body.notes ?? null,
      created_at: now,
      updated_at: now,
    }
    await insert('property_offers', row)
    res.status(201).json(serializeOffer(row))
  })

  app.patch('/api/buyer-offers/:offerId', authMiddleware, async (req, res) => {
    const offer = await findOne('property_offers', (o) => o.id === req.params.offerId)
    if (!offer) return res.status(404).json({ error: 'Offer not found' })
    try {
      await assertOwnsProperty(req.user.id, offer.property_id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Offer not found' })
      throw err
    }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid offer', details: parsed.error.flatten() })
    }
    const patch = { ...parsed.data }
    if (patch.contact_id) {
      const contact = await findOne('contacts', (c) => c.id === patch.contact_id)
      if (!contact) return res.status(400).json({ error: 'Linked contact not found' })
    }
    patch.updated_at = new Date().toISOString()
    await update('property_offers', (o) => o.id === req.params.offerId, (o) => ({ ...o, ...patch }))
    const updated = await findOne('property_offers', (o) => o.id === req.params.offerId)
    res.json(serializeOffer(updated))
  })

  app.delete('/api/buyer-offers/:offerId', authMiddleware, async (req, res) => {
    const offer = await findOne('property_offers', (o) => o.id === req.params.offerId)
    if (!offer) return res.status(404).json({ error: 'Offer not found' })
    try {
      await assertOwnsProperty(req.user.id, offer.property_id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Offer not found' })
      throw err
    }
    await remove('property_offers', (o) => o.id === req.params.offerId)
    res.json({ success: true })
  })
}
