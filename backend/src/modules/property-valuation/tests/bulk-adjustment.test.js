// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerRoleRoutes } from '../interface/role-routes.js'
import {
  buildBulkPreview,
  computeAdjustedPrice,
  confirmPhraseFor,
  clampReversalWindowHours,
  isReversible,
} from '../application/bulk-adjustment.js'
import { listUserAgencyMemberships, listAgencyMemberships } from '../../../tenant-authorization.js'

vi.mock('../../../tenant-authorization.js', () => ({
  listUserAgencyMemberships: vi.fn().mockResolvedValue([]),
  listAgencyMemberships: vi.fn().mockResolvedValue([]),
}))

const logger = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, child: () => logger }

function fakeExpress() {
  const routes = []
  const app = {
    get: (path, ...handlers) => routes.push({ method: 'get', path, handlers }),
    post: (path, ...handlers) => routes.push({ method: 'post', path, handlers }),
    put: (path, ...handlers) => routes.push({ method: 'put', path, handlers }),
    delete: (path, ...handlers) => routes.push({ method: 'delete', path, handlers }),
  }
  return { app, routes }
}

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function makeDal(seed = {}) {
  const store = {
    properties: [...(seed.properties || [])],
    agents: [...(seed.agents || [])],
    property_price_analyses: [...(seed.property_price_analyses || [])],
    pricing_decisions: [],
    bulk_price_adjustments: [...(seed.bulk_price_adjustments || [])],
    bulk_price_adjustment_items: [...(seed.bulk_price_adjustment_items || [])],
  }
  return {
    store,
    findAll: vi.fn(async (collection, filter) => (store[collection] || []).filter(filter || (() => true))),
    findOne: vi.fn(async (collection, filter) => (store[collection] || []).find(filter || (() => true)) || null),
    insert: vi.fn(async (collection, item) => {
      if (!store[collection]) store[collection] = []
      store[collection].push(item)
      return item
    }),
    update: vi.fn(async (collection, filter, updater) => {
      const rows = store[collection] || []
      const idx = rows.findIndex(filter)
      if (idx >= 0) { rows[idx] = updater(rows[idx]); return rows[idx] }
      return null
    }),
  }
}

function makeServices(dal) {
  return {
    dal,
    analysisService: {},
    recalculationJobService: { invalidateForPropertyChange: vi.fn().mockResolvedValue(undefined) },
    logger,
  }
}

function route(routes, method, path) {
  const found = routes.find((r) => r.method === method && r.path === path)
  return found.handlers[found.handlers.length - 1]
}

beforeEach(() => {
  vi.mocked(listUserAgencyMemberships).mockResolvedValue([])
  vi.mocked(listAgencyMemberships).mockResolvedValue([])
})

describe('bulk-adjustment pure helpers', () => {
  it('computes percent up/down and fixed delta', () => {
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'percent_up', percent: 10 })).toEqual({ newPrice: 110000 })
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'percent_down', percent: 25 })).toEqual({ newPrice: 75000 })
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'fixed_delta', delta: -5000 })).toEqual({ newPrice: 95000 })
  })

  it('skips set_to_median without a median and no-op changes', () => {
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'set_to_median', median: null }).skip).toBe(true)
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'set_to_median', median: 120000 })).toEqual({ newPrice: 120000 })
    expect(computeAdjustedPrice({ currentPrice: 100000, strategy: 'fixed_delta', delta: 0 }).skip).toBe(true)
  })

  it('builds a preview with summary + safety flags', () => {
    const preview = buildBulkPreview({
      listings: [
        { id: 'a', price: 100000, currency: 'USD' },
        { id: 'b', price: 200000, currency: 'USD' },
      ],
      strategy: 'percent_up',
      percent: 10,
    })
    expect(preview.summary.changing_count).toBe(2)
    expect(preview.summary.total_value_before).toBe(300000)
    expect(preview.summary.total_value_after).toBe(330000)
    expect(preview.summary.aggregate_delta_percent).toBe(10)
    expect(preview.safety.exceeds_cap).toBe(false)
  })

  it('flags aggregate change over the cap', () => {
    const preview = buildBulkPreview({
      listings: [{ id: 'a', price: 100000, currency: 'USD' }],
      strategy: 'percent_up',
      percent: 90,
    })
    expect(preview.safety.exceeds_cap).toBe(true)
    expect(preview.safety.cap_reasons).toContain('aggregate_change_too_large')
  })

  it('clamps reversal window and derives confirm phrase', () => {
    expect(clampReversalWindowHours(0)).toBe(1)
    expect(clampReversalWindowHours(9999)).toBe(168)
    expect(clampReversalWindowHours(undefined)).toBe(24)
    expect(confirmPhraseFor(3)).toBe('I have reviewed all 3 changes')
  })

  it('treats a batch outside its window as not reversible', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const future = new Date(Date.now() + 100000).toISOString()
    expect(isReversible({ status: 'applied', reversal_deadline: future })).toBe(true)
    expect(isReversible({ status: 'applied', reversal_deadline: past })).toBe(false)
    expect(isReversible({ status: 'reverted', reversal_deadline: future })).toBe(false)
  })
})

describe('bulk-adjust route registration', () => {
  it('registers all bulk-adjust endpoints', () => {
    const { app, routes } = fakeExpress()
    registerRoleRoutes(app, makeServices(makeDal()))
    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('POST /api/agency/pricing/bulk-adjust/preview')
    expect(paths).toContain('POST /api/agency/pricing/bulk-adjust')
    expect(paths).toContain('POST /api/agency/pricing/bulk-adjust/:batchId/undo')
    expect(paths).toContain('GET /api/agency/pricing/bulk-adjust')
  })
})

describe('POST /api/agency/pricing/bulk-adjust/preview', () => {
  it('rejects a member without Owner/Admin role', async () => {
    const { app, routes } = fakeExpress()
    registerRoleRoutes(app, makeServices(makeDal()))
    vi.mocked(listUserAgencyMemberships).mockResolvedValueOnce([{ agency_id: 'ag-1', role: 'member', affiliation_mode: 'exclusive' }])
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/preview')(
      { user: { id: 'u-1' }, body: { property_ids: ['p1'], strategy: 'percent_up', percent: 10 } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns a computed preview for agency listings', async () => {
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      properties: [
        { id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 100000, currency: 'USD', title: 'Villa' },
        { id: 'p2', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 200000, currency: 'USD', title: 'Flat' },
      ],
      agents: [{ id: 'a1', name: 'Agent One' }],
    })
    registerRoleRoutes(app, makeServices(dal))
    vi.mocked(listUserAgencyMemberships).mockResolvedValueOnce([{ agency_id: 'ag-1', role: 'owner', affiliation_mode: 'exclusive' }])
    vi.mocked(listAgencyMemberships).mockResolvedValueOnce([{ user_id: 'a1' }])
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/preview')(
      { user: { id: 'u-1' }, body: { property_ids: ['p1', 'p2'], strategy: 'percent_down', percent: 10 } }, res, () => {},
    )
    const payload = res.json.mock.calls[0][0]
    expect(payload.summary.changing_count).toBe(2)
    expect(payload.summary.total_value_after).toBe(270000)
    expect(payload.confirm_phrase).toBe('I have reviewed all 2 changes')
  })

  it('rejects an invalid body', async () => {
    const { app, routes } = fakeExpress()
    registerRoleRoutes(app, makeServices(makeDal()))
    vi.mocked(listUserAgencyMemberships).mockResolvedValueOnce([{ agency_id: 'ag-1', role: 'owner', affiliation_mode: 'exclusive' }])
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/preview')(
      { user: { id: 'u-1' }, body: { property_ids: [], strategy: 'nope' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].code).toBe('INVALID_BODY')
  })
})

describe('POST /api/agency/pricing/bulk-adjust', () => {
  function seedOwner() {
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([{ agency_id: 'ag-1', role: 'owner', affiliation_mode: 'exclusive' }])
    vi.mocked(listAgencyMemberships).mockResolvedValue([{ user_id: 'a1' }])
  }

  it('applies the batch, updates prices, and records items + decisions', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      properties: [
        { id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 100000, currency: 'USD', title: 'Villa' },
        { id: 'p2', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 200000, currency: 'USD', title: 'Flat' },
      ],
      agents: [{ id: 'a1', name: 'Agent One' }],
    })
    const services = makeServices(dal)
    registerRoleRoutes(app, services)
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust')(
      {
        user: { id: 'u-1' },
        body: { property_ids: ['p1', 'p2'], strategy: 'percent_up', percent: 10, confirm_phrase: 'I have reviewed all 2 changes' },
      }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(dal.store.properties.find((p) => p.id === 'p1').price).toBe(110000)
    expect(dal.store.properties.find((p) => p.id === 'p2').price).toBe(220000)
    expect(dal.store.bulk_price_adjustments).toHaveLength(1)
    expect(dal.store.bulk_price_adjustment_items).toHaveLength(2)
    expect(dal.store.pricing_decisions).toHaveLength(2)
    expect(dal.store.pricing_decisions[0].data.kind).toBe('bulk_adjust')
    expect(services.recalculationJobService.invalidateForPropertyChange).toHaveBeenCalledTimes(2)
    const batch = res.json.mock.calls[0][0].batch
    expect(batch.status).toBe('applied')
    expect(batch.reversible).toBe(true)
  })

  it('rejects when the confirmation phrase is wrong', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      properties: [{ id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 100000, currency: 'USD' }],
      agents: [{ id: 'a1', name: 'Agent One' }],
    })
    registerRoleRoutes(app, makeServices(dal))
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust')(
      { user: { id: 'u-1' }, body: { property_ids: ['p1'], strategy: 'percent_up', percent: 10, confirm_phrase: 'wrong' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].code).toBe('CONFIRMATION_MISMATCH')
    expect(dal.store.bulk_price_adjustments).toHaveLength(0)
  })

  it('returns NO_CHANGES when nothing would move', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      properties: [{ id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 100000, currency: 'USD' }],
      agents: [{ id: 'a1', name: 'Agent One' }],
    })
    registerRoleRoutes(app, makeServices(dal))
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust')(
      { user: { id: 'u-1' }, body: { property_ids: ['p1'], strategy: 'set_to_median', confirm_phrase: 'I have reviewed all 0 changes' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].code).toBe('NO_CHANGES')
  })

  it('blocks a batch that exceeds the aggregate safety cap', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      properties: [{ id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 100000, currency: 'USD' }],
      agents: [{ id: 'a1', name: 'Agent One' }],
    })
    registerRoleRoutes(app, makeServices(dal))
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust')(
      { user: { id: 'u-1' }, body: { property_ids: ['p1'], strategy: 'percent_up', percent: 90, confirm_phrase: 'I have reviewed all 1 changes' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json.mock.calls[0][0].code).toBe('REQUIRES_SECOND_APPROVAL')
    expect(dal.store.bulk_price_adjustments).toHaveLength(0)
  })
})

describe('POST /api/agency/pricing/bulk-adjust/:batchId/undo', () => {
  function seedOwner() {
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([{ agency_id: 'ag-1', role: 'admin', affiliation_mode: 'exclusive' }])
    vi.mocked(listAgencyMemberships).mockResolvedValue([{ user_id: 'a1' }])
  }

  it('restores every price and marks the batch reverted', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const future = new Date(Date.now() + 3600 * 1000).toISOString()
    const dal = makeDal({
      properties: [{ id: 'p1', agency_id: 'ag-1', agent_id: 'a1', status: 'active', price: 110000, currency: 'USD' }],
      bulk_price_adjustments: [{ id: 'b1', agency_id: 'ag-1', status: 'applied', reversal_deadline: future }],
      bulk_price_adjustment_items: [{ id: 'i1', batch_id: 'b1', property_id: 'p1', old_price: 100000, new_price: 110000, currency: 'USD' }],
    })
    const services = makeServices(dal)
    registerRoleRoutes(app, services)
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/:batchId/undo')(
      { user: { id: 'u-1' }, params: { batchId: 'b1' } }, res, () => {},
    )
    expect(res.json).toHaveBeenCalled()
    expect(dal.store.properties[0].price).toBe(100000)
    expect(dal.store.bulk_price_adjustments[0].status).toBe('reverted')
    expect(dal.store.pricing_decisions[0].data.kind).toBe('bulk_revert')
  })

  it('returns 404 for a batch owned by a different agency', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const dal = makeDal({
      bulk_price_adjustments: [{ id: 'b1', agency_id: 'other-agency', status: 'applied', reversal_deadline: new Date(Date.now() + 3600000).toISOString() }],
    })
    registerRoleRoutes(app, makeServices(dal))
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/:batchId/undo')(
      { user: { id: 'u-1' }, params: { batchId: 'b1' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('refuses to undo after the window has expired', async () => {
    seedOwner()
    const { app, routes } = fakeExpress()
    const past = new Date(Date.now() - 1000).toISOString()
    const dal = makeDal({
      bulk_price_adjustments: [{ id: 'b1', agency_id: 'ag-1', status: 'applied', reversal_deadline: past }],
    })
    registerRoleRoutes(app, makeServices(dal))
    const res = mockRes()
    await route(routes, 'post', '/api/agency/pricing/bulk-adjust/:batchId/undo')(
      { user: { id: 'u-1' }, params: { batchId: 'b1' } }, res, () => {},
    )
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json.mock.calls[0][0].code).toBe('WINDOW_EXPIRED')
  })
})
