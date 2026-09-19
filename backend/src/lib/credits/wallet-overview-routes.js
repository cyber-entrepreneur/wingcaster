/**
 * AGN-CRD-001 — Agency wallet overview routes.
 *
 *   GET  /api/agency/credits/wallet-overview — wallet read (owner/admin/finance/read_only)
 *   GET  /api/agency/credits/wallet-settings — wallet settings read
 *   PUT  /api/agency/credits/wallet-settings — wallet settings write (owner/admin)
 */

import { authMiddleware } from '../../auth.js'
import {
  membershipCanManageWalletSettings,
  requireAgencyWalletRead,
  requireAgencyWalletSettingsWrite,
} from './wallet-access.js'
import { buildAgencyWalletOverview, loadAgencyWalletSettings, saveAgencyWalletSettings } from './wallet-overview.js'
import { sendCreditError } from './errors.js'

export function registerAgencyWalletOverviewRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/agency/credits/wallet-overview', auth, requireAgencyWalletRead, async (req, res) => {
    try {
      const overview = await buildAgencyWalletOverview(req.agencyId)
      res.json({
        ...overview,
        permissions: {
          can_manage_settings: membershipCanManageWalletSettings(req.membership),
          can_top_up: false,
          can_allocate: membershipCanManageWalletSettings(req.membership),
        },
      })
    } catch (err) {
      sendCreditError(res, err)
    }
  })

  app.get('/api/agency/credits/wallet-settings', auth, requireAgencyWalletRead, async (req, res) => {
    try {
      const settings = await loadAgencyWalletSettings(req.agencyId)
      res.json({ settings })
    } catch (err) {
      sendCreditError(res, err)
    }
  })

  app.put('/api/agency/credits/wallet-settings', auth, requireAgencyWalletSettingsWrite, async (req, res) => {
    try {
      const { low_balance_alert_threshold } = req.body || {}
      const result = await saveAgencyWalletSettings(
        req.agencyId,
        { low_balance_alert_threshold },
        req.user.id,
      )
      if (!result.ok) return res.status(400).json({ error: result.error })
      res.json({ settings: result.settings })
    } catch (err) {
      sendCreditError(res, err)
    }
  })
}
