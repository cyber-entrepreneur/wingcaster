/**
 * AGN-CRD-006 — Agency feature quota routes.
 *
 *   GET /api/agency/credits/feature-quotas — agency-wide quota aggregation
 */

import { authMiddleware } from '../../auth.js'
import { requireAgencyWalletRead } from './wallet-access.js'
import { buildAgencyFeatureQuotas } from './agency-feature-quotas.js'
import { sendCreditError } from './errors.js'

export function registerAgencyFeatureQuotaRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/agency/credits/feature-quotas', auth, requireAgencyWalletRead, async (req, res) => {
    try {
      res.json(await buildAgencyFeatureQuotas(req.agencyId))
    } catch (err) {
      sendCreditError(res, err)
    }
  })
}
