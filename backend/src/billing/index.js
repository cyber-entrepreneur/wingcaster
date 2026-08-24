/**
 * Billing module — public entrypoint.
 *
 * Fin-only usage ingest + quota ledger helpers. Subscription notification
 * preference routes live under /api/billing/notifications/*.
 */

import { pino } from 'pino'
import { setBillingLogger, emitUsageEvent, emitUsageEventAsync, quotaKeyForAction } from './events.js'
import { grantAllowance, recordConsumption, recordTopup, recordAdjustment, periodSummary, quotaBalance, currentBillingPeriod } from './ledger.js'
import { registerNotificationRoutes } from '../notifications/subscription/index.js'

export const MODULE_NAME = 'billing'

export function createModule() {
  const enabled = process.env.BILLING_MODULE_ENABLED !== 'false'
  const logger = pino({
    name: MODULE_NAME,
    level: process.env.BILLING_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
  })

  if (!enabled) {
    return { enabled: false, registerRoutes: () => {}, prepare: async () => {} }
  }

  setBillingLogger(logger)

  return {
    enabled: true,
    logger,
    async prepare() {
      logger.info('billing module ready — usage ingest + quota ledger + notification preferences')
    },
    registerRoutes(app, { authMiddleware } = {}) {
      registerNotificationRoutes(app, { authMiddleware })
    },
  }
}

export {
  emitUsageEvent,
  emitUsageEventAsync,
  quotaKeyForAction,
  grantAllowance,
  recordConsumption,
  recordTopup,
  recordAdjustment,
  periodSummary,
  quotaBalance,
  currentBillingPeriod,
  setBillingLogger,
}
