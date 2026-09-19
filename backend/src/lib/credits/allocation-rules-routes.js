/**
 * AGN-CRD-004 — Credit allocation rules routes.
 *
 *   GET /api/agency/credits/allocation-rules — owner/admin read
 *   PUT /api/agency/credits/allocation-rules — owner/admin write
 */

import { authMiddleware } from '../../auth.js'
import { getAgencyMembership, listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  listAgencyAgentsForAllocation,
  loadAgencyCreditAllocationRules,
  saveAgencyCreditAllocationRules,
} from './allocation-rules.js'
import { sendCreditError } from './errors.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

async function requireAgencyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const memberships = await listUserAgencyMemberships(req.user.id)
    const member = memberships.find((item) => ADMIN_ROLES.has(item.role))
    if (!member) return res.status(403).json({ error: 'Forbidden: agency admin required' })
    req.agencyId = member.agency_id
    next()
  } catch (err) {
    sendCreditError(res, err)
  }
}

async function assertAgentsInAgency(agencyId, overrides) {
  for (const row of overrides) {
    const member = await getAgencyMembership(agencyId, row.agent_user_id)
    if (!member) {
      return { ok: false, status: 400, error: 'One or more override agents are not in your agency' }
    }
  }
  return { ok: true }
}

export function registerCreditAllocationRulesRoutes(app) {
  app.get('/api/agency/credits/allocation-rules', authMiddleware, requireAgencyAdmin, async (req, res) => {
    try {
      const [rules, agents] = await Promise.all([
        loadAgencyCreditAllocationRules(req.agencyId),
        listAgencyAgentsForAllocation(req.agencyId),
      ])
      res.json({ rules, agents })
    } catch (err) {
      sendCreditError(res, err)
    }
  })

  app.put('/api/agency/credits/allocation-rules', authMiddleware, requireAgencyAdmin, async (req, res) => {
    try {
      const { mode, overrides = [] } = req.body || {}
      const membershipCheck = await assertAgentsInAgency(req.agencyId, overrides)
      if (!membershipCheck.ok) {
        return res.status(membershipCheck.status).json({ error: membershipCheck.error })
      }

      const result = await saveAgencyCreditAllocationRules(
        req.agencyId,
        { mode, overrides },
        req.user.id,
      )
      if (!result.ok) return res.status(400).json({ error: result.error })
      res.json({ rules: result.rules })
    } catch (err) {
      sendCreditError(res, err)
    }
  })
}
