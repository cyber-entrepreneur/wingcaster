import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../../fin/testing/suite.js'
import { FEATURES } from '../../credits/features.js'
import { grant } from '../../credits/engine.js'
import { ERROR_CLASS } from '../../publishing/error-classifier.js'
import {
  bootPortalRegistry,
  getPortalEntry,
  resetPortalRegistryForTests,
} from './registry.js'
import {
  publishPropertyFinder,
  publishToRealEstatePortal,
} from '../realestate.js'
import { canonicalPfListing as validPfListing } from './property_finder.js'

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

async function seedJob(pool, platform = 'property_finder') {
  const jobId = randomUUID()
  await pool.query(
    `INSERT INTO public.distribution_jobs (id, platform, status, data)
     VALUES ($1, $2, 'pending', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [jobId, platform],
  )
  return jobId
}

function setPfEnv() {
  process.env.PF_API_KEY = 'pg-test-key'
  process.env.PF_CLIENT_ID = 'pg-test-client'
  process.env.PF_CLIENT_SECRET = 'pg-test-secret'
}

function clearPfEnv() {
  delete process.env.PF_API_KEY
  delete process.env.PF_CLIENT_ID
  delete process.env.PF_CLIENT_SECRET
  delete process.env.PF_API_BASE_URL
}

finPostgresSuite('property finder publisher (BE-BLOCKER-01)', { seed: true }, ({ pool }) => {
  beforeEach(async () => {
    resetPortalRegistryForTests()
    setPfEnv()
    await bootPortalRegistry({
      queryFn: (sql, params) => pool().query(sql, params).then((r) => r.rows),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearPfEnv()
    resetPortalRegistryForTests()
  })

  it('publishPropertyFinder meters once with country_code AE and does not write unknown_error', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `pf-meter:${tenantId}`, reason: 'pf group adapter meter' },
    })
    const jobId = await seedJob(pool())
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(201, {
      id: 'pf-live-1',
      url: 'https://www.propertyfinder.ae/en/listing/pf-live-1',
      status: 'live',
    })))

    const result = await publishPropertyFinder({
      tenantId,
      countryCode: 'AE',
      listing: validPfListing({ country_code: 'AE' }),
      agentContext: {
        tenantId,
        countryCode: 'AE',
        distributionJobId: jobId,
      },
    })
    expect(result.externalId).toBe('pf-live-1')
    expect(result.countryCode).toBe('AE')
    expect(result.status).toBe('live')

    const { rows } = await pool().query(
      `SELECT feature, data FROM public.credit_consumptions
        WHERE tenant_id = $1 AND feature = $2`,
      [tenantId, FEATURES.PUBLISHING_REALESTATE_PROPERTY_FINDER],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].feature).toBe('publishing.realestate.property_finder')
    expect(rows[0].data.country_code).toBe('AE')
    expect(rows[0].data.portal).toBe('property_finder')

    const attempts = await pool().query(
      `SELECT status, error_class, error_message FROM public.distribution_attempts
        WHERE distribution_job_id = $1`,
      [jobId],
    )
    expect(attempts.rows).toHaveLength(1)
    expect(attempts.rows[0].error_class).toBeNull()
    expect(attempts.rows[0].error_class).not.toBe(ERROR_CLASS.UNKNOWN_ERROR)
    expect(attempts.rows[0].status).toBe('published')
  })

  it('publishToRealEstatePortal property_finder records auth_expired on mocked 401', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `pf-401:${tenantId}`, reason: 'pf 401' },
    })
    const jobId = await seedJob(pool())
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { message: 'Unauthorized' })))

    await expect(publishToRealEstatePortal('property_finder', {
      tenantId,
      countryCode: 'AE',
      listing: validPfListing({ country_code: 'AE' }),
      agentContext: { tenantId, countryCode: 'AE', distributionJobId: jobId },
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })

    const attempts = await pool().query(
      `SELECT error_class, status FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [jobId],
    )
    expect(attempts.rows[0].error_class).toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(attempts.rows[0].status).toBe('failed')
  })

  it('records portal_down on mocked 503', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `pf-503:${tenantId}`, reason: 'pf 503' },
    })
    const jobId = await seedJob(pool())
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(503, { message: 'Service Unavailable' })))

    await expect(publishPropertyFinder({
      tenantId,
      countryCode: 'AE',
      listing: validPfListing({ country_code: 'AE' }),
      agentContext: { tenantId, countryCode: 'AE', distributionJobId: jobId },
    })).rejects.toMatchObject({ code: 'PORTAL_DOWN', status: 503 })

    const attempts = await pool().query(
      `SELECT error_class FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [jobId],
    )
    expect(attempts.rows[0].error_class).toBe(ERROR_CLASS.PORTAL_DOWN)
  })

  it('does not meter inside the adapter itself (single consumption via realestate.js)', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `pf-once:${tenantId}`, reason: 'pf once' },
    })
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(201, { id: 'pf-2', status: 'submitted' })))

    await publishToRealEstatePortal('property_finder', {
      listing: validPfListing(),
      countryCode: 'AE',
      tenantId,
    })

    const { rows } = await pool().query(
      `SELECT count(*)::int AS n FROM public.credit_consumptions
        WHERE tenant_id = $1 AND feature = $2`,
      [tenantId, 'publishing.realestate.property_finder'],
    )
    expect(rows[0].n).toBe(1)
    expect(getPortalEntry('property_finder').adapter.constructor.name).toBe('PropertyFinderPortalPublisher')
  })
})
