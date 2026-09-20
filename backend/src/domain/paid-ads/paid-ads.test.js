/**
 * Wave 2A — unit tests for paid ads (approval gate, objectives, adapters with mock HTTP).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertBudget,
  assertPaidAdObjective,
  assertProviderApproved,
  createPaidAdsAdapter,
  isProviderApproved,
  mapObjectiveForProvider,
  normalizeTargeting,
  PROVIDER_NOT_APPROVED,
  providerApprovalState,
} from './index.js'

describe('paid-ads objectives', () => {
  it('accepts canonical objectives and maps per provider', () => {
    expect(assertPaidAdObjective('leads')).toBe('leads')
    expect(mapObjectiveForProvider('meta_ads', 'conversions')).toBe('OUTCOME_SALES')
    expect(mapObjectiveForProvider('google_ads', 'awareness')).toBe('BRAND_AWARENESS')
  })

  it('rejects invalid objective / budget', () => {
    expect(() => assertPaidAdObjective('viral')).toThrow(/Invalid paid ad objective/)
    expect(() => assertBudget(0, 'USD')).toThrow(/budget_micros/)
    expect(() => assertBudget(1000, 'US')).toThrow(/currency/)
  })

  it('forces Gmail into Demand Gen format (not owned email)', () => {
    expect(() => normalizeTargeting({ format: 'gmail' })).toThrow(/Demand Gen/)
    expect(() => normalizeTargeting({ format: 'owned_email' })).toThrow(/Demand Gen/)
    expect(normalizeTargeting({ format: 'demand_gen_gmail' }).format).toBe('demand_gen_gmail')
  })
})

describe('paid-ads provider approval gate', () => {
  afterEach(() => {
    delete process.env.META_ADS_PROVIDER_APPROVED
    delete process.env.GOOGLE_ADS_PROVIDER_APPROVED
  })

  it('defaults OFF and returns PROVIDER_NOT_APPROVED', () => {
    expect(isProviderApproved('meta_ads')).toBe(false)
    expect(isProviderApproved('google_ads')).toBe(false)
    expect(providerApprovalState('meta_ads').state).toBe('pending_approval')
    expect(() => assertProviderApproved('meta_ads')).toThrow(
      expect.objectContaining({ code: PROVIDER_NOT_APPROVED }),
    )
  })

  it('enables when env approval flags are set', () => {
    process.env.META_ADS_PROVIDER_APPROVED = 'true'
    process.env.GOOGLE_ADS_PROVIDER_APPROVED = '1'
    expect(isProviderApproved('meta_ads')).toBe(true)
    expect(isProviderApproved('google_ads')).toBe(true)
  })
})

describe('paid-ads adapters (mock HTTP)', () => {
  afterEach(() => {
    delete process.env.META_ADS_PROVIDER_APPROVED
    delete process.env.GOOGLE_ADS_PROVIDER_APPROVED
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  })

  it('meta adapter refuses without approval and does not call fetch', async () => {
    const fetchImpl = vi.fn()
    const adapter = createPaidAdsAdapter('meta_ads', { fetchImpl })
    await expect(
      adapter.createCampaign({
        name: 'Test',
        objective: 'traffic',
        budgetMicros: 5_000_000,
        currency: 'USD',
        targeting: {},
        accessToken: 'tok',
        adAccountId: '123',
      }),
    ).rejects.toMatchObject({ code: PROVIDER_NOT_APPROVED })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('meta adapter posts to Marketing API when approved', async () => {
    process.env.META_ADS_PROVIDER_APPROVED = 'true'
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'camp_meta_1' }),
    }))
    const adapter = createPaidAdsAdapter('meta_ads', { fetchImpl })
    const result = await adapter.createCampaign({
      name: 'Test Meta',
      objective: 'leads',
      budgetMicros: 10_000_000,
      currency: 'USD',
      targeting: { geography: { countries: ['AE'] } },
      accessToken: 'tok_meta',
      adAccountId: 'act_999',
    })
    expect(result.provider_campaign_id).toBe('camp_meta_1')
    expect(result.provider_ref).toContain('meta_ads:campaign:camp_meta_1')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/act_999/campaigns')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain('OUTCOME_LEADS')
  })

  it('google adapter uses Demand Gen for gmail format when approved', async () => {
    process.env.GOOGLE_ADS_PROVIDER_APPROVED = 'true'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'devtok'
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [{ resourceName: 'customers/1234567890/campaigns/42' }],
      }),
    }))
    const adapter = createPaidAdsAdapter('google_ads', { fetchImpl })
    const result = await adapter.createCampaign({
      name: 'Gmail Demand Gen',
      objective: 'traffic',
      budgetMicros: 20_000_000,
      currency: 'USD',
      targeting: { format: 'demand_gen_gmail' },
      format: 'demand_gen_gmail',
      accessToken: 'tok_google',
      adAccountId: '123-456-7890',
      developerToken: 'devtok',
    })
    expect(result.provider_campaign_id).toBe('42')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/customers/1234567890/campaigns:mutate')
    const body = JSON.parse(init.body)
    expect(body.operations[0].create.advertisingChannelType).toBe('DEMAND_GEN')
  })

  it('google adapter rejects owned-email format even when approved', async () => {
    process.env.GOOGLE_ADS_PROVIDER_APPROVED = 'true'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'devtok'
    const fetchImpl = vi.fn()
    const adapter = createPaidAdsAdapter('google_ads', { fetchImpl })
    await expect(
      adapter.createCampaign({
        name: 'Bad email',
        objective: 'traffic',
        budgetMicros: 1_000_000,
        currency: 'USD',
        targeting: {},
        format: 'owned_email',
        accessToken: 'tok',
        adAccountId: '111',
        developerToken: 'devtok',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_GMAIL_FORMAT' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
