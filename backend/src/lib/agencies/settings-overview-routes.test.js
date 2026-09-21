// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerAgencySettingsOverviewRoutes } from './settings-overview-routes.js'
import { findOne, findAll } from '../../db.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { loadAgencyMfaPolicy } from './mfa-policy-routes.js'

vi.mock('../../db.js', () => ({
  findOne: vi.fn(),
  findAll: vi.fn(),
}))

vi.mock('../../tenant-authorization.js', () => ({
  listUserAgencyMemberships: vi.fn(),
}))

vi.mock('./mfa-policy-routes.js', () => ({
  loadAgencyMfaPolicy: vi.fn(),
}))

vi.mock('../logger.js', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

function fakeExpress() {
  const routes = []
  const app = {
    get: (path, ...handlers) => routes.push({ method: 'get', path, handlers }),
    post: (path, ...handlers) => routes.push({ method: 'post', path, handlers }),
  }
  return { app, routes }
}

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function handlerFor(routes, path) {
  const found = routes.find((r) => r.path === path)
  return found.handlers[found.handlers.length - 1]
}

const noop = () => {}

beforeEach(() => {
  vi.mocked(findOne).mockReset()
  vi.mocked(findAll).mockReset()
  vi.mocked(listUserAgencyMemberships).mockReset()
  vi.mocked(loadAgencyMfaPolicy).mockReset()
})

describe('registerAgencySettingsOverviewRoutes', () => {
  it('registers the overview endpoint', () => {
    const { app, routes } = fakeExpress()
    registerAgencySettingsOverviewRoutes(app)
    expect(routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)).toContain('GET /api/agency/settings/overview')
  })

  it('returns identity, role, and live stats for an active member', async () => {
    const { app, routes } = fakeExpress()
    registerAgencySettingsOverviewRoutes(app)
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([
      { agency_id: 'ag-1', role: 'owner', affiliation_mode: 'exclusive' },
    ])
    vi.mocked(findOne).mockResolvedValue({ id: 'ag-1', name: 'Acme Realty', slug: 'acme', license_number: 'LIC-9', accepting_applications: true })
    vi.mocked(findAll).mockImplementation(async (collection, filter) => {
      const rows = {
        agency_members: [{ agency_id: 'ag-1', status: 'active' }, { agency_id: 'ag-1', status: 'active' }],
        agency_applications: [{ agency_id: 'ag-1', status: 'pending' }],
        ownership_transfer_requests: [{ agency_id: 'ag-1', status: 'pending' }],
      }[collection] || []
      return rows.filter(filter)
    })
    vi.mocked(loadAgencyMfaPolicy).mockResolvedValue({ required: true })

    const res = mockRes()
    await handlerFor(routes, '/api/agency/settings/overview')({ user: { id: 'u-1' } }, res, noop)

    const payload = res.json.mock.calls[0][0]
    expect(payload.my_role).toBe('owner')
    expect(payload.agency).toMatchObject({ id: 'ag-1', name: 'Acme Realty', accepting_applications: true })
    expect(payload.stats).toEqual({
      member_count: 2,
      pending_applications: 1,
      mfa_required: true,
      pending_ownership_transfer: true,
      accepting_applications: true,
    })
  })

  it('rejects a caller without an exclusive agency membership', async () => {
    const { app, routes } = fakeExpress()
    registerAgencySettingsOverviewRoutes(app)
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([
      { agency_id: 'ag-2', role: 'guest', affiliation_mode: 'non_exclusive' },
    ])
    const res = mockRes()
    await handlerFor(routes, '/api/agency/settings/overview')({ user: { id: 'u-2' } }, res, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(findOne).not.toHaveBeenCalled()
  })

  it('returns 404 when the resolved agency no longer exists', async () => {
    const { app, routes } = fakeExpress()
    registerAgencySettingsOverviewRoutes(app)
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([
      { agency_id: 'ag-gone', role: 'admin', affiliation_mode: 'exclusive' },
    ])
    vi.mocked(findOne).mockResolvedValue(null)
    const res = mockRes()
    await handlerFor(routes, '/api/agency/settings/overview')({ user: { id: 'u-3' } }, res, noop)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('does not leak private agency columns', async () => {
    const { app, routes } = fakeExpress()
    registerAgencySettingsOverviewRoutes(app)
    vi.mocked(listUserAgencyMemberships).mockResolvedValue([
      { agency_id: 'ag-1', role: 'member', affiliation_mode: 'exclusive' },
    ])
    vi.mocked(findOne).mockResolvedValue({ id: 'ag-1', name: 'Acme', owner_id: 'secret-owner', cta_config: { secret: true }, accepting_applications: false })
    vi.mocked(findAll).mockResolvedValue([])
    vi.mocked(loadAgencyMfaPolicy).mockResolvedValue({ required: false })
    const res = mockRes()
    await handlerFor(routes, '/api/agency/settings/overview')({ user: { id: 'u-1' } }, res, noop)
    const payload = res.json.mock.calls[0][0]
    expect(payload.agency).not.toHaveProperty('owner_id')
    expect(payload.agency).not.toHaveProperty('cta_config')
    expect(payload.my_role).toBe('member')
  })
})
