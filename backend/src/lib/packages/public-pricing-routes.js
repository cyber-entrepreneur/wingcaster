/**
 * GET /api/public/pricing-tiers
 *
 * Unauthenticated, ISR-friendly catalog for the marketing site.
 * Rate-limited by the process-wide IP limiter in server.js.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { transaction } from '../../db.js'
import logger from '../logger.js'
import {
  PRICING_CURRENCY,
  TierConfigSchema,
  getActiveTierCatalog,
} from './tier-config.js'

export const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'

export const PricingTiersResponseSchema = z.object({
  tiers: z.array(TierConfigSchema),
  currency: z.literal(PRICING_CURRENCY),
  generated_at: z.string().min(1),
})

function etagFor(tiers) {
  const digest = createHash('sha256')
    .update(JSON.stringify({ tiers, currency: PRICING_CURRENCY }))
    .digest('hex')
  return `"${digest}"`
}

function ifNoneMatchHits(header, etag) {
  if (!header) return false
  return String(header)
    .split(',')
    .map((part) => part.trim())
    .includes(etag)
}

async function defaultLoadCatalog() {
  return transaction((client) => getActiveTierCatalog(client))
}

export async function handlePricingTiers(req, res, { loadCatalog } = {}) {
  const tiers = await (loadCatalog || defaultLoadCatalog)()
  const generated_at = new Date().toISOString()
  const body = PricingTiersResponseSchema.parse({
    tiers,
    currency: PRICING_CURRENCY,
    generated_at,
  })
  const etag = etagFor(body.tiers)
  res.setHeader('Cache-Control', CACHE_CONTROL)
  res.setHeader('ETag', etag)
  if (ifNoneMatchHits(req.get('If-None-Match'), etag)) {
    return res.status(304).end()
  }
  return res.status(200).json(body)
}

export function registerPublicPricingRoutes(app, { loadCatalog } = {}) {
  app.get('/api/public/pricing-tiers', async (req, res, next) => {
    try {
      await handlePricingTiers(req, res, { loadCatalog })
    } catch (error) {
      logger.error({ err: error }, 'pricing-tiers catalog failed')
      next(error)
    }
  })
}
