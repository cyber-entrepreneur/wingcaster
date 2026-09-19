import { describe, expect, it } from 'vitest'
import {
  creditCostForPlatform,
  defaultListingCaption,
  totalPublishCredits,
} from './channelPublishHelpers'

describe('channelPublishHelpers', () => {
  it('sums per-platform credit costs from quotas', () => {
    const quotas = [
      { feature_code: 'publishing.social.instagram', typical_credits: 2, enabled: true, registered: true, quota_used_this_cycle: 0, quota_display: 0, typical_monthly: 0, usage_ratio: 0, soft_warning: false },
      { feature_code: 'publishing.social.x', typical_credits: 1, enabled: true, registered: true, quota_used_this_cycle: 0, quota_display: 0, typical_monthly: 0, usage_ratio: 0, soft_warning: false },
    ]
    expect(totalPublishCredits(['instagram', 'x'], quotas)).toBe(3)
    expect(creditCostForPlatform('unknown', quotas)).toBe(1)
  })

  it('builds a default listing caption', () => {
    expect(defaultListingCaption({ title: 'Villa', city: 'Dubai', price: 1200000 })).toContain('Villa')
    expect(defaultListingCaption({ title: 'Villa', city: 'Dubai', price: 1200000 })).toContain('Dubai')
  })
})
