import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { BROKERAGE_TIER, SEMSAR_TIER } from './tier-config.fixtures.js'
import { MARKETING_PACKAGE_IDS } from './test-support.js'
import { TierConfigSchema, mapTierRow, minorToUsd } from './tier-config.js'

describe('TierConfigSchema', () => {
  it('accepts the Semsar placeholder shape', () => {
    expect(TierConfigSchema.parse(SEMSAR_TIER)).toEqual(SEMSAR_TIER)
  })

  it('accepts null agent_cap and raw -1 quotas', () => {
    const parsed = TierConfigSchema.parse(BROKERAGE_TIER)
    expect(parsed.agent_cap).toBeNull()
    expect(parsed.feature_quotas.push_notifications).toBe(-1)
    expect(parsed.feature_quotas.whatsapp_messages).toBe(-1)
  })

  it('rejects unknown support_level and missing property_cap', () => {
    expect(() => TierConfigSchema.parse({ ...SEMSAR_TIER, support_level: 'phone' })).toThrow(ZodError)
    const { property_cap: _ignored, ...missingCap } = SEMSAR_TIER
    expect(() => TierConfigSchema.parse(missingCap)).toThrow(ZodError)
  })
})

describe('mapTierRow', () => {
  it('converts minor units to USD and keeps null agent_cap', () => {
    expect(minorToUsd(1500)).toBe(15)
    const mapped = mapTierRow({
      package_id: MARKETING_PACKAGE_IDS.brokerage,
      code: 'brokerage',
      display_name: 'Brokerage',
      tagline: 'Regional brokerages across MENA',
      agent_cap: null,
      property_cap: 250,
      price_usd_monthly_minor: 50000,
      price_usd_annual_minor: 500000,
      trial_days: 0,
      sales_led: true,
      feature_quotas: { push_notifications: -1, sms: 3000 },
      feature_toggles: { crm_pipeline: true },
      support_level: 'dedicated',
      sort_order: 5,
      portal_group_id: 'all_mena_phase_1',
      portal_display_name: 'All MENA Phase-1 portals',
      portal_description: 'Every integrated portal across UAE, KSA, Egypt, and Lebanon.',
      portal_scope: 'all_mena_phase_1',
    })
    expect(mapped.agent_cap).toBeNull()
    expect(mapped.price).toEqual({ monthly_usd: 500, annual_usd: 5000, currency: 'USD' })
    expect(mapped.feature_quotas.push_notifications).toBe(-1)
    expect(TierConfigSchema.parse(mapped).code).toBe('brokerage')
  })
})
