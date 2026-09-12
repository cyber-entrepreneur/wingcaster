/**
 * Unit coverage for AGN-MEM-002/002b helpers (no Postgres required).
 * Postgres integration lives in agency-applications.postgres.test.js.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const findOne = vi.fn()
const findAll = vi.fn()
const query = vi.fn()

vi.mock('../../db.js', () => ({
  insert: (...args) => insert(...args),
  findOne: (...args) => findOne(...args),
  findAll: (...args) => findAll(...args),
  query: (...args) => query(...args),
  update: vi.fn(),
}))

vi.mock('../../auth.js', () => ({ authMiddleware: (_req, _res, next) => next() }))
vi.mock('../../platformModel.js', () => ({ assertCanJoinAgency: vi.fn() }))
vi.mock('../../tenant-authorization.js', () => ({
  addAgencyMembership: vi.fn(),
  getAgencyMembership: vi.fn(),
}))
vi.mock('../logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn() } }))
vi.mock('../validation.js', () => ({
  agencyApplicationCreateSchema: {},
  validate: () => (_req, _res, next) => next(),
}))
vi.mock('../../workers/agency-application-expiry.js', () => ({
  agencyApplicationExpiresAt: () => new Date().toISOString(),
}))

const {
  APPLICATION_CSV_COLUMNS,
  ApplicationRevealError,
  applicationToCsvRow,
  filterAgencyApplicationRows,
  recordApplicationContactReveal,
  rowsToApplicationCsv,
} = await import('./applications-routes.js')

describe('agency applications helpers (unit)', () => {
  beforeEach(() => {
    insert.mockReset()
    findOne.mockReset()
    findAll.mockReset()
    query.mockReset()
  })

  it('filterAgencyApplicationRows matches status / within / q', () => {
    const now = Date.now()
    const rows = [
      {
        id: 'a',
        status: 'pending',
        agent_name: 'Sara',
        agent_email: 'sara@x.test',
        created_at: new Date(now - 2 * 3600000).toISOString(),
      },
      {
        id: 'b',
        status: 'pending',
        agent_name: 'Ahmed',
        agent_email: 'ahmed@x.test',
        created_at: new Date(now - 40 * 86400000).toISOString(),
      },
      {
        id: 'c',
        status: 'approved',
        agent_name: 'Sara',
        agent_email: 'sara@x.test',
        created_at: new Date(now - 2 * 3600000).toISOString(),
      },
    ]
    expect(filterAgencyApplicationRows(rows, { status: 'pending', within: 'all', q: '' })).toHaveLength(2)
    expect(filterAgencyApplicationRows(rows, { status: 'pending', within: '7d', q: '' }).map((r) => r.id)).toEqual([
      'a',
    ])
    expect(filterAgencyApplicationRows(rows, { status: 'pending', within: 'all', q: 'sara' }).map((r) => r.id)).toEqual([
      'a',
    ])
  })

  it('rowsToApplicationCsv covers queue export columns', () => {
    const csv = rowsToApplicationCsv(APPLICATION_CSV_COLUMNS, [
      applicationToCsvRow({
        id: 'app_1',
        agent_name: 'Sara',
        city: 'Dubai',
        created_at: '2026-09-01T00:00:00.000Z',
        current_listings_count: 3,
        status: 'pending',
        message: 'Hello, world',
      }),
    ])
    expect(csv.split('\n')[0]).toBe(APPLICATION_CSV_COLUMNS.join(','))
    expect(csv).toContain('app_1')
    expect(csv).toContain('Sara')
    expect(csv).toContain('Hello, world')
  })

  it('recordApplicationContactReveal writes public.audit_log row', async () => {
    findOne.mockResolvedValue({
      id: 'app_1',
      agency_id: 'agc_1',
      status: 'pending',
    })
    query.mockResolvedValue([{ n: 0 }])
    insert.mockResolvedValue({ id: 'audit_1' })

    const result = await recordApplicationContactReveal({
      applicationId: 'app_1',
      agencyId: 'agc_1',
      reviewerId: 'usr_owner',
      field: 'contact',
      ip: '203.0.113.10',
      userAgent: 'vitest',
    })

    expect(result).toMatchObject({
      success: true,
      field: 'contact',
      application_id: 'app_1',
    })
    expect(insert).toHaveBeenCalledTimes(1)
    const [collection, row] = insert.mock.calls[0]
    expect(collection).toBe('audit_log')
    expect(row).toMatchObject({
      agent_id: 'usr_owner',
      agency_id: 'agc_1',
      type: 'agency_application_pii_viewed',
      action: 'reveal',
      entity_type: 'agency_application',
      entity_id: 'app_1',
      ip: '203.0.113.10',
      user_agent: 'vitest',
      metadata: expect.objectContaining({
        field: 'contact',
        application_id: 'app_1',
        reviewer_id: 'usr_owner',
      }),
    })
  })

  it('recordApplicationContactReveal rejects invalid field', async () => {
    await expect(
      recordApplicationContactReveal({
        applicationId: 'app_1',
        agencyId: 'agc_1',
        reviewerId: 'usr_owner',
        field: 'ssn',
      }),
    ).rejects.toBeInstanceOf(ApplicationRevealError)
    expect(insert).not.toHaveBeenCalled()
  })
})
