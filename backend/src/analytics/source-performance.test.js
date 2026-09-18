/**
 * SHR-INT-002 source-performance aggregation tests.
 *
 * Exercises getSourcePerformance against a mocked DAL: per-source lead /
 * inquiry / deal attribution, deal→source resolution via inquiry_id, the
 * always-present bazaar row, agent + agency scoping, date-window filtering,
 * and lead-share maths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ data: {} }))
const db = vi.hoisted(() => ({
  findAll: vi.fn((collection) => Promise.resolve(store.data[collection] || [])),
}))
vi.mock('../db.js', () => db)

let getSourcePerformance

beforeEach(async () => {
  store.data = { conversations: [], inquiries: [], opportunities: [] }
  db.findAll.mockClear()
  ;({ getSourcePerformance } = await import('./source-performance.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

function findSource(res, source) {
  return res.sources.find((s) => s.source === source)
}

describe('getSourcePerformance', () => {
  it('buckets leads and inquiries by source and always returns a bazaar row', async () => {
    store.data.conversations = [
      { id: 'c1', source: 'bazaar', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', source: 'bazaar', created_at: '2026-01-02T00:00:00Z' },
      { id: 'c3', source: 'direct', created_at: '2026-01-03T00:00:00Z' },
      { id: 'c4', source: null, created_at: '2026-01-04T00:00:00Z' }, // → direct
    ]
    store.data.inquiries = [
      { id: 'i1', source: 'bazaar', created_at: '2026-01-01T00:00:00Z' },
      { id: 'i2', source: 'property_finder', created_at: '2026-01-02T00:00:00Z' },
    ]
    const res = await getSourcePerformance({})
    expect(res.totals.conversations).toBe(4)
    expect(res.totals.inquiries).toBe(2)
    expect(res.bazaar.conversations).toBe(2)
    expect(res.bazaar.inquiries).toBe(1)
    expect(res.bazaar.lead_share).toBe(50) // 2 of 4 leads
    expect(findSource(res, 'direct').conversations).toBe(2)
    expect(findSource(res, 'property_finder').inquiries).toBe(1)
    // sorted by leads desc: bazaar (2) and direct (2) lead; property_finder (0 leads) last
    expect(res.sources[res.sources.length - 1].source).toBe('property_finder')
  })

  it('attributes deals to the source of their inquiry and sums won value', async () => {
    store.data.inquiries = [
      { id: 'i1', source: 'bazaar', created_at: '2026-01-01T00:00:00Z' },
      { id: 'i2', source: 'direct', created_at: '2026-01-01T00:00:00Z' },
    ]
    store.data.opportunities = [
      { id: 'o1', inquiry_id: 'i1', stage: 'closed_won', deal_value: 1000, created_at: '2026-02-01T00:00:00Z' },
      { id: 'o2', inquiry_id: 'i1', stage: 'negotiation', deal_value: 500, created_at: '2026-02-02T00:00:00Z' },
      { id: 'o3', inquiry_id: 'i2', stage: 'closed_won', deal_value: 250, created_at: '2026-02-03T00:00:00Z' },
      { id: 'o4', inquiry_id: null, stage: 'closed_won', deal_value: 99, created_at: '2026-02-04T00:00:00Z' }, // → direct
    ]
    const res = await getSourcePerformance({})
    expect(res.bazaar.deals).toBe(2)
    expect(res.bazaar.won).toBe(1)
    expect(res.bazaar.won_value).toBe(1000)
    expect(findSource(res, 'direct').deals).toBe(2) // o3 + o4
    expect(findSource(res, 'direct').won_value).toBe(349)
    expect(res.totals.won).toBe(3)
    expect(res.totals.won_value).toBe(1349)
  })

  it('returns a zeroed bazaar row when there is no Bazaar activity', async () => {
    store.data.conversations = [{ id: 'c1', source: 'direct', created_at: '2026-01-01T00:00:00Z' }]
    const res = await getSourcePerformance({})
    expect(res.bazaar).toMatchObject({ source: 'bazaar', conversations: 0, inquiries: 0, deals: 0, lead_share: 0 })
  })

  it('scopes to the requesting agent (assigned_agent_id / agent_id)', async () => {
    store.data.conversations = [
      { id: 'c1', source: 'bazaar', assigned_agent_id: 'me', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', source: 'bazaar', assigned_agent_id: 'other', created_at: '2026-01-02T00:00:00Z' },
    ]
    store.data.inquiries = [
      { id: 'i1', source: 'bazaar', agent_id: 'me', created_at: '2026-01-01T00:00:00Z' },
      { id: 'i2', source: 'bazaar', agent_id: 'other', created_at: '2026-01-02T00:00:00Z' },
    ]
    const res = await getSourcePerformance({ agentId: 'me' })
    expect(res.totals.conversations).toBe(1)
    expect(res.bazaar.inquiries).toBe(1)
  })

  it('scopes to an agency', async () => {
    store.data.conversations = [
      { id: 'c1', source: 'bazaar', agency_id: 'a1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', source: 'bazaar', agency_id: 'a2', created_at: '2026-01-02T00:00:00Z' },
    ]
    const res = await getSourcePerformance({ agencyId: 'a1' })
    expect(res.totals.conversations).toBe(1)
  })

  it('filters by date window (end is exclusive)', async () => {
    store.data.conversations = [
      { id: 'c1', source: 'bazaar', created_at: '2026-01-05T00:00:00Z' },
      { id: 'c2', source: 'bazaar', created_at: '2026-03-01T00:00:00Z' },
    ]
    const res = await getSourcePerformance({ startDate: '2026-01-01T00:00:00Z', endDate: '2026-02-01T00:00:00Z' })
    expect(res.totals.conversations).toBe(1)
    expect(res.scope).toMatchObject({ start_date: '2026-01-01T00:00:00Z', end_date: '2026-02-01T00:00:00Z' })
  })
})
