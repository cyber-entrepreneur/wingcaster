/**
 * AGT-LST-015 — seller performance report (agent configure + client share).
 *
 *   GET    /api/properties/:id/seller-report
 *   PATCH  /api/properties/:id/seller-report
 *   POST   /api/properties/:id/seller-report/share-tokens
 *   DELETE /api/properties/:id/seller-report/share-tokens/:tokenId
 *   GET    /api/public/seller-reports/:shareToken
 */
import crypto from 'crypto'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, update } from '../db.js'
import { assertOwnsProperty } from '../lib/authz.js'
import { buildSellerReportPayload } from './seller-report-data.js'

const LAYOUTS = ['standard', 'compact', 'executive']
const TERMINAL_LISTING_STATUSES = new Set(['sold', 'archived', 'deleted', 'withdrawn', 'delisted'])

const patchSchema = z.object({
  state_of_play: z.string().trim().max(500).nullable().optional(),
  agent_summary: z.string().trim().max(4000).nullable().optional(),
  show_offer_amounts: z.boolean().optional(),
  show_full_address: z.boolean().optional(),
  layout_template: z.enum(LAYOUTS).optional(),
}).strict()

const shareSchema = z.object({
  recipient_email: z.string().email().max(320).nullable().optional(),
}).strict()

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

function generateShareToken() {
  return `wc_rpt_${crypto.randomBytes(24).toString('base64url')}`
}

function serializeReport(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    agent_id: row.agent_id,
    agency_id: row.agency_id ?? null,
    state_of_play: row.state_of_play ?? null,
    agent_summary: row.agent_summary ?? null,
    show_offer_amounts: Boolean(row.show_offer_amounts),
    show_full_address: Boolean(row.show_full_address),
    layout_template: row.layout_template || 'standard',
    status: row.status || 'live',
    frozen_snapshot: row.frozen_snapshot ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function serializeShareToken(row) {
  return {
    id: row.id,
    report_id: row.report_id,
    token: row.token,
    recipient_email: row.recipient_email ?? null,
    revoked_at: row.revoked_at ?? null,
    created_at: row.created_at,
  }
}

async function getOrCreateReport(property, agentId) {
  const existing = await findOne('seller_reports', (row) => row.property_id === property.id)
  if (existing) return existing

  const now = new Date().toISOString()
  const row = {
    id: uuidv4(),
    property_id: property.id,
    agent_id: agentId,
    agency_id: property.agency_id || null,
    state_of_play: null,
    agent_summary: null,
    show_offer_amounts: false,
    show_full_address: false,
    layout_template: 'standard',
    status: TERMINAL_LISTING_STATUSES.has(String(property.status).toLowerCase()) ? 'frozen' : 'live',
    frozen_snapshot: null,
    created_at: now,
    updated_at: now,
  }
  await insert('seller_reports', row)
  return row
}

async function maybeFreezeReport(report, property, payload) {
  if (report.status === 'frozen' || report.status === 'revoked') return report
  if (!TERMINAL_LISTING_STATUSES.has(String(property.status).toLowerCase())) return report
  const now = new Date().toISOString()
  const next = {
    ...report,
    status: 'frozen',
    frozen_snapshot: payload,
    updated_at: now,
  }
  await update('seller_reports', (row) => row.id === report.id, () => next)
  return next
}

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/properties/:id/seller-report', authMiddleware, async (req, res) => {
    try {
      const property = await assertOwnsProperty(req.user.id, req.params.id)
      const report = await getOrCreateReport(property, req.user.id)
      const payload = await buildSellerReportPayload({
        listing: property,
        agentId: req.user.id,
        report,
        clientSafe: false,
      })
      if (payload.error) return res.status(404).json({ error: payload.error })
      const nextReport = await maybeFreezeReport(report, property, payload)
      const tokens = await findAll('seller_report_share_tokens', (row) => row.report_id === nextReport.id)
      tokens.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      return res.json({
        report: serializeReport(nextReport),
        payload,
        share_tokens: tokens.map(serializeShareToken),
      })
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
  })

  app.patch('/api/properties/:id/seller-report', authMiddleware, async (req, res) => {
    try {
      const property = await assertOwnsProperty(req.user.id, req.params.id)
      const parsed = patchSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid report update', details: parsed.error.flatten() })
      }
      const report = await getOrCreateReport(property, req.user.id)
      if (report.status === 'revoked') {
        return res.status(409).json({ error: 'Report sharing has been revoked' })
      }
      const now = new Date().toISOString()
      const next = {
        ...report,
        ...parsed.data,
        updated_at: now,
      }
      await update('seller_reports', (row) => row.id === report.id, () => next)
      const payload = await buildSellerReportPayload({
        listing: property,
        agentId: req.user.id,
        report: next,
        clientSafe: false,
      })
      return res.json({
        report: serializeReport(next),
        payload,
      })
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
  })

  app.post('/api/properties/:id/seller-report/share-tokens', authMiddleware, async (req, res) => {
    try {
      const property = await assertOwnsProperty(req.user.id, req.params.id)
      const parsed = shareSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid share request', details: parsed.error.flatten() })
      }
      const report = await getOrCreateReport(property, req.user.id)
      if (report.status === 'revoked') {
        return res.status(409).json({ error: 'Report sharing has been revoked' })
      }
      const now = new Date().toISOString()
      const tokenRow = {
        id: uuidv4(),
        report_id: report.id,
        token: generateShareToken(),
        recipient_email: parsed.data.recipient_email ?? null,
        revoked_at: null,
        created_at: now,
      }
      await insert('seller_report_share_tokens', tokenRow)
      return res.status(201).json(serializeShareToken(tokenRow))
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
  })

  app.delete('/api/properties/:id/seller-report/share-tokens/:tokenId', authMiddleware, async (req, res) => {
    try {
      const property = await assertOwnsProperty(req.user.id, req.params.id)
      const report = await findOne('seller_reports', (row) => row.property_id === property.id)
      if (!report) return res.status(404).json({ error: 'Report not found' })
      const token = await findOne(
        'seller_report_share_tokens',
        (row) => row.id === req.params.tokenId && row.report_id === report.id,
      )
      if (!token) return res.status(404).json({ error: 'Share link not found' })
      const now = new Date().toISOString()
      const next = { ...token, revoked_at: now }
      await update('seller_report_share_tokens', (row) => row.id === token.id, () => next)
      return res.json(serializeShareToken(next))
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
  })

  app.get('/api/public/seller-reports/:shareToken', async (req, res) => {
    const token = await findOne(
      'seller_report_share_tokens',
      (row) => row.token === req.params.shareToken,
    )
    if (!token || token.revoked_at) {
      return res.status(404).json({ error: 'This report is no longer available' })
    }
    const report = await findOne('seller_reports', (row) => row.id === token.report_id)
    if (!report || report.status === 'revoked') {
      return res.status(404).json({ error: 'This report is no longer available' })
    }
    const property = await findOne('properties', (row) => row.id === report.property_id)
    if (!property) {
      return res.status(404).json({ error: 'This report is no longer available' })
    }

    if (report.status === 'frozen' && report.frozen_snapshot) {
      return res.json({
        status: 'frozen',
        payload: report.frozen_snapshot,
      })
    }

    const payload = await buildSellerReportPayload({
      listing: property,
      agentId: report.agent_id,
      report,
      clientSafe: true,
    })
    if (payload.error) return res.status(404).json({ error: 'This report is no longer available' })
    return res.json({
      status: report.status,
      payload,
    })
  })
}
