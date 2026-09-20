import { describe, expect, it } from 'vitest'
import { contactMatchesAudienceRules, filterContactsByRules } from './rules-engine.js'

const contacts = [
  { id: 'c1', status: 'lead', source: 'website', tags: ['buyer'], territory: 'dubai' },
  { id: 'c2', status: 'client', source: 'referral', tags: ['seller'], territory: 'abu-dhabi' },
  { id: 'c3', status: 'lead', source: 'website', tags: ['buyer', 'vip'], territory: 'dubai' },
]

describe('audience rules engine', () => {
  it('filters by tags_filter', () => {
    const matched = filterContactsByRules(contacts, { tags_filter: ['buyer'] })
    expect(matched.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('evaluates status is rule', () => {
    expect(contactMatchesAudienceRules(contacts[0], {
      audience_rules: [{ field: 'status', operator: 'is', value: 'lead' }],
    })).toBe(true)
    expect(contactMatchesAudienceRules(contacts[1], {
      audience_rules: [{ field: 'status', operator: 'is', value: 'lead' }],
    })).toBe(false)
  })

  it('evaluates tags contains rule', () => {
    expect(contactMatchesAudienceRules(contacts[2], {
      audience_rules: [{ field: 'tags', operator: 'contains', value: 'vip' }],
    })).toBe(true)
  })

  it('evaluates territory is_not rule', () => {
    expect(contactMatchesAudienceRules(contacts[0], {
      audience_rules: [{ field: 'territory', operator: 'is_not', value: 'abu-dhabi' }],
    })).toBe(true)
  })
})
