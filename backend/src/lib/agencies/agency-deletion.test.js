import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  getAgencyMembership: vi.fn(),
}))

const credits = vi.hoisted(() => ({
  balance: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../credits/compat.js', () => ({
  createCreditService: () => credits,
}))

let getAgencyDeletionState
let regenerateAgencyDeletionWord
let initiateAgencyDeletion
let cancelAgencyDeletion

const agency = { id: 'agc_1', name: 'Coastal Realty' }
let draftRequest = null

beforeEach(async () => {
  vi.resetModules()
  draftRequest = null
  db.findAll.mockReset()
  db.findOne.mockReset()
  db.insert.mockReset()
  db.update.mockReset()
  db.query.mockReset()
  tenantAuth.getAgencyMembership.mockReset()
  credits.balance.mockReset()

  tenantAuth.getAgencyMembership.mockResolvedValue({ agency_id: 'agc_1', role: 'owner', user_id: 'usr_owner' })
  credits.balance.mockResolvedValue({ balance_usd: 120 })
  db.query.mockResolvedValue({ rows: [{ count: 0 }] })
  db.findOne.mockImplementation(async (collection, filter) => {
    if (collection === 'agencies' && filter(agency)) return agency
    return null
  })
  db.findAll.mockImplementation(async (collection, filter) => {
    if (collection === 'agency_members') {
      return [{ agency_id: 'agc_1', role: 'owner', status: 'active' }]
    }
    if (collection === 'properties') {
      return [{ id: 'prop_1', agency_id: 'agc_1', status: 'active' }]
    }
    if (collection === 'agency_deletion_requests') {
      return draftRequest && filter(draftRequest) ? [draftRequest] : []
    }
    return []
  })
  db.insert.mockImplementation(async (_collection, row) => {
    draftRequest = row
    return row
  })
  db.update.mockImplementation(async (collection, match, updater) => {
    if (collection === 'agency_deletion_requests' && draftRequest && match(draftRequest)) {
      draftRequest = updater(draftRequest)
      return 1
    }
    if (collection === 'agencies' && match(agency)) {
      return 1
    }
    return 0
  })

  ;({
    getAgencyDeletionState,
    regenerateAgencyDeletionWord,
    initiateAgencyDeletion,
    cancelAgencyDeletion,
  } = await import('./agency-deletion.js'))
})

describe('agency deletion', () => {
  it('returns impact summary for owners', async () => {
    const state = await getAgencyDeletionState({ agencyId: 'agc_1', callerUserId: 'usr_owner' })
    expect(state.agency.name).toBe('Coastal Realty')
    expect(state.impact.listings_count).toBe(1)
    expect(state.can_schedule).toBe(true)
  })

  it('schedules deletion after word + typed agency name', async () => {
    const { word } = await regenerateAgencyDeletionWord({ agencyId: 'agc_1', callerUserId: 'usr_owner' })
    const result = await initiateAgencyDeletion({
      agencyId: 'agc_1',
      callerUserId: 'usr_owner',
      word,
      typedAgencyName: 'Coastal Realty',
      reason: 'Business closed',
    })
    expect(result.status).toBe('scheduled')
    expect(result.scheduled_for).toBeTruthy()
  })

  it('rejects non-owners', async () => {
    tenantAuth.getAgencyMembership.mockResolvedValue({ agency_id: 'agc_1', role: 'admin' })
    await expect(
      getAgencyDeletionState({ agencyId: 'agc_1', callerUserId: 'usr_admin' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('cancels a scheduled deletion', async () => {
    const { word } = await regenerateAgencyDeletionWord({ agencyId: 'agc_1', callerUserId: 'usr_owner' })
    await initiateAgencyDeletion({
      agencyId: 'agc_1',
      callerUserId: 'usr_owner',
      word,
      typedAgencyName: 'Coastal Realty',
      reason: 'Business closed',
    })
    const cancelled = await cancelAgencyDeletion({ agencyId: 'agc_1', callerUserId: 'usr_owner' })
    expect(cancelled.ok).toBe(true)
  })
})
