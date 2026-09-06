import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  CACHE_CONTROL,
  PricingTiersResponseSchema,
  handlePricingTiers,
  registerPublicPricingRoutes,
} from './public-pricing-routes.js'
import { BROKERAGE_TIER, SEMSAR_TIER } from './tier-config.fixtures.js'

const CATALOG = [SEMSAR_TIER, BROKERAGE_TIER]

function makeApp(loadCatalog = async () => CATALOG) {
  const app = express()
  registerPublicPricingRoutes(app, { loadCatalog })
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message })
  })
  return app
}

describe('PricingTiersResponseSchema', () => {
  it('accepts the public endpoint envelope', () => {
    const parsed = PricingTiersResponseSchema.parse({
      tiers: CATALOG,
      currency: 'USD',
      generated_at: '2026-09-06T00:00:00.000Z',
    })
    expect(parsed.tiers).toHaveLength(2)
    expect(parsed.currency).toBe('USD')
  })

  it('rejects a non-USD currency', () => {
    expect(() => PricingTiersResponseSchema.parse({
      tiers: CATALOG,
      currency: 'AED',
      generated_at: '2026-09-06T00:00:00.000Z',
    })).toThrow(ZodError)
  })
})

describe('GET /api/public/pricing-tiers', () => {
  it('returns 200 with Cache-Control, ETag, and the catalog body', async () => {
    const res = await request(makeApp()).get('/api/public/pricing-tiers')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL)
    expect(res.headers.etag).toMatch(/^"[a-f0-9]{64}"$/)
    expect(res.body.currency).toBe('USD')
    expect(res.body.tiers).toEqual(CATALOG)
    expect(res.body.generated_at).toEqual(expect.any(String))
    expect(PricingTiersResponseSchema.parse(res.body).tiers[0].code).toBe('semsar')
  })

  it('returns 304 when If-None-Match matches, ignoring generated_at', async () => {
    const app = makeApp()
    const first = await request(app).get('/api/public/pricing-tiers')
    const again = await request(app)
      .get('/api/public/pricing-tiers')
      .set('If-None-Match', first.headers.etag)
    expect(again.status).toBe(304)
    expect(again.headers['cache-control']).toBe(CACHE_CONTROL)
    expect(again.headers.etag).toBe(first.headers.etag)
    expect(again.body).toEqual({})
  })

  it('handlePricingTiers sets Cache-Control on the handler itself', async () => {
    const headers = {}
    const res = {
      setHeader(name, value) { headers[name.toLowerCase()] = value },
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
      end() { return this },
    }
    const req = { get: () => undefined }
    await handlePricingTiers(req, res, { loadCatalog: async () => CATALOG })
    expect(headers['cache-control']).toBe(CACHE_CONTROL)
    expect(res.statusCode).toBe(200)
    expect(res.body.tiers[1].agent_cap).toBeNull()
    expect(res.body.tiers[1].feature_quotas.push_notifications).toBe(-1)
  })
})
