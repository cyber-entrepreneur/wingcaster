import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../db.js', () => db)

let listAgencyRoutingRules
let createAgencyRoutingRule

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findOne.mockReset()
  db.insert.mockReset()
  db.update.mockReset()
  db.remove.mockReset()
  ;({ listAgencyRoutingRules, createAgencyRoutingRule } = await import('./agency-routing-rules.js'))
})

describe('agency routing rules', () => {
  it('lists rules for an agency tenant', async () => {
    db.findAll.mockResolvedValue([
      {
        id: 'rule_1',
        tenant_id: 'agency:agc_1',
        name: 'Bazaar leads',
        priority: 10,
        trigger: 'inquiry',
        strategy: 'round_robin',
        relationship_priority: true,
        filters: { match: 'all', conditions: [{ field: 'source', op: 'eq', value: 'bazaar' }] },
        eligible_members: {},
        strategy_config: {},
        enabled: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ])

    const rules = await listAgencyRoutingRules('agc_1')
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      id: 'rule_1',
      agency_id: 'agc_1',
      trigger: 'inquiry',
      filters: { match: 'all', conditions: [{ field: 'source', op: 'eq', value: 'bazaar' }] },
    })
  })

  it('creates a routing rule with structured filters', async () => {
    db.insert.mockResolvedValue(undefined)
    const created = await createAgencyRoutingRule('agc_1', 'usr_1', {
      name: 'Marina rentals',
      priority: 20,
      trigger: 'inquiry',
      strategy: 'manual',
      filters: {
        match: 'all',
        conditions: [
          { field: 'area', op: 'eq', value: 'Marina' },
          { field: 'property_type', op: 'eq', value: 'apartment' },
        ],
      },
      target: { assign_to_agent_id: 'agt_1' },
    })

    expect(db.insert).toHaveBeenCalled()
    expect(created.name).toBe('Marina rentals')
    expect(created.filters.conditions).toHaveLength(2)
    expect(created.target.assign_to_agent_id).toBe('agt_1')
  })
})
