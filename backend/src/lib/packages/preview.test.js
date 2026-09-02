import { describe, expect, it } from 'vitest'
import { previewFromRows } from './preview.js'

describe('previewFromRows', () => {
  it('known quotas × N → known totals and margin warnings', () => {
    const version = { id: 'v1', monthly_price_minor: 100 }
    const quotas = [
      { feature_id: 'a', feature_code: 'a', credits_per_property: 100, credits_per_unit: 100, cost_per_unit_micro_usd: null },
      { feature_id: 'b', feature_code: 'b', credits_per_property: 150, credits_per_unit: 100, cost_per_unit_micro_usd: 5000 },
      { feature_id: 'c', feature_code: 'c', credits_per_property: 250, credits_per_unit: 100, cost_per_unit_micro_usd: null },
    ]
    const at10 = previewFromRows({
      version, quotas, propertiesN: 10,
      cycleStart: '2026-09-01T00:00:00.000Z', cycleEnd: '2026-10-01T00:00:00.000Z',
    })
    expect(at10.total_credits).toBe(5000)
    expect(at10.breakdown).toHaveLength(3)
    expect(at10.monthly_revenue_minor).toBe(1000)
    const at15 = previewFromRows({
      version, quotas, propertiesN: 15,
      cycleStart: '2026-09-01T00:00:00.000Z', cycleEnd: '2026-10-01T00:00:00.000Z',
    })
    expect(at15.total_credits).toBe(7500)
  })
})
