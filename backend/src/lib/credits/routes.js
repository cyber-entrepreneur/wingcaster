/**
 * Tenant-facing credit routes: /api/agent/credits/* and /api/agency/credits/*.
 */
import { authMiddleware } from '../../auth.js'
import {
  getAgencyMembership,
  listUserAgencyMemberships,
} from '../../tenant-authorization.js'
import { createCreditService } from './compat.js'

const credits = createCreditService()

async function requireAgencyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const memberships = await listUserAgencyMemberships(req.user.id)
    const member = memberships.find((item) => ['admin', 'owner'].includes(item.role))
    if (!member) return res.status(403).json({ error: 'Forbidden: agency admin required' })
    req.agencyId = member.agency_id
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export function registerCreditRoutes(app, { creditService = credits } = {}) {
  app.get('/api/agency/credits/balance', authMiddleware, requireAgencyAdmin, async (req, res) => {
    try {
      res.json(await creditService.balance('agency', req.agencyId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/agency/credits/top-up', authMiddleware, requireAgencyAdmin, async (req, res, next) => {
    try {
      const { handleCreditsTopUp } = await import('../../fin/funding/http.js')
      return await handleCreditsTopUp(req, res, {
        publicTenantId: req.agencyId,
        reasonCode: 'USER_TOPUP',
      })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/agency/credits/allocate', authMiddleware, requireAgencyAdmin, async (req, res) => {
    try {
      const { agent_id, amount_usd } = req.body
      if (!agent_id || !amount_usd || Number(amount_usd) <= 0) {
        return res.status(400).json({ error: 'agent_id and amount_usd are required' })
      }
      const member = await getAgencyMembership(req.agencyId, agent_id)
      if (!member) return res.status(403).json({ error: 'Agent is not in your agency' })
      const result = await creditService.allocateAgencyToAgent(req.agencyId, agent_id, Number(amount_usd))
      if (!result.ok) return res.status(400).json({ error: result.error })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agency/credits/transactions', authMiddleware, requireAgencyAdmin, async (req, res) => {
    try {
      res.json(await creditService.transactions('agency', req.agencyId, { limit: req.query.limit || 100 }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/credits/balance', authMiddleware, async (req, res) => {
    try {
      res.json(await creditService.balance('agent', req.user.id))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/credits/transactions', authMiddleware, async (req, res) => {
    try {
      res.json(await creditService.transactions('agent', req.user.id, { limit: req.query.limit || 100 }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/agent/credits/top-up', authMiddleware, async (req, res, next) => {
    try {
      const { handleCreditsTopUp } = await import('../../fin/funding/http.js')
      const { query } = await import('../../db.js')
      const tenants = await query(
        `SELECT id FROM public.tenants WHERE personal_owner_user_id = $1 LIMIT 1`,
        [req.user.id],
      )
      const publicTenantId = tenants[0]?.id || req.user.id
      return await handleCreditsTopUp(req, res, { publicTenantId, reasonCode: 'USER_TOPUP' })
    } catch (err) {
      next(err)
    }
  })
}
