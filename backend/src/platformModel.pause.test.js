// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pauseAffiliation, resumeAffiliation } from './platformModel.js'
import { findOne, update, insert } from './db.js'
import { getAgencyMembership } from './tenant-authorization.js'

vi.mock('./db.js', () => ({
  findAll: vi.fn(async () => []),
  findOne: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(async (_c, item) => item),
}))

vi.mock('./tenant-authorization.js', () => ({
  endAgencyMembership: vi.fn(),
  getAgencyMembership: vi.fn(),
  listUserAgencyMemberships: vi.fn(async () => []),
  normalizeAgencyMembershipInput: vi.fn(),
}))

function seedStore(members, tenantMemberships) {
  const store = {
    agency_members: [...members],
    tenant_memberships: [...tenantMemberships],
  }
  vi.mocked(findOne).mockImplementation(async (collection, filter) => (store[collection] || []).find(filter) || null)
  vi.mocked(update).mockImplementation(async (collection, filter, updater) => {
    const rows = store[collection] || []
    const idx = rows.findIndex(filter)
    if (idx < 0) return null
    rows[idx] = updater(rows[idx])
    return rows[idx]
  })
  return store
}

beforeEach(() => {
  vi.mocked(findOne).mockReset()
  vi.mocked(update).mockReset()
  vi.mocked(insert).mockClear()
  vi.mocked(getAgencyMembership).mockReset()
})

describe('pauseAffiliation', () => {
  it('pauses an active member and suspends the canonical membership', async () => {
    const store = seedStore(
      [{ id: 'm1', agency_id: 'ag-1', user_id: 'u-2', role: 'member', status: 'active' }],
      [{ id: 'tm1', status: 'active' }],
    )
    vi.mocked(getAgencyMembership).mockResolvedValue({ id: 'tm1' })

    const result = await pauseAffiliation('m1', 'ag-1', { pausedBy: 'owner-1', reason: 'On leave for Q3' })

    expect(result.ok).toBe(true)
    expect(store.agency_members[0]).toMatchObject({ status: 'paused', pause_reason: 'On leave for Q3', paused_by: 'owner-1' })
    expect(store.agency_members[0].paused_at).toBeTruthy()
    expect(store.tenant_memberships[0].status).toBe('suspended')
    expect(insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({ type: 'agency_member_pause' }))
  })

  it('returns notFound for an unknown member', async () => {
    seedStore([], [])
    const result = await pauseAffiliation('missing', 'ag-1', { pausedBy: 'owner-1', reason: 'x reason' })
    expect(result).toMatchObject({ ok: false, notFound: true })
  })

  it('refuses to pause the owner', async () => {
    seedStore([{ id: 'm1', agency_id: 'ag-1', user_id: 'u-owner', role: 'owner', status: 'active' }], [])
    const result = await pauseAffiliation('m1', 'ag-1', { pausedBy: 'owner-1', reason: 'nope reason' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/owner cannot be paused/i)
  })

  it('refuses to pause yourself', async () => {
    seedStore([{ id: 'm1', agency_id: 'ag-1', user_id: 'owner-1', role: 'admin', status: 'active' }], [])
    const result = await pauseAffiliation('m1', 'ag-1', { pausedBy: 'owner-1', reason: 'valid reason' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/yourself/i)
  })

  it('requires a reason', async () => {
    seedStore([{ id: 'm1', agency_id: 'ag-1', user_id: 'u-2', role: 'member', status: 'active' }], [])
    const result = await pauseAffiliation('m1', 'ag-1', { pausedBy: 'owner-1', reason: '  ' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/reason is required/i)
  })

  it('will not pause a member that is not active', async () => {
    seedStore([{ id: 'm1', agency_id: 'ag-1', user_id: 'u-2', role: 'member', status: 'paused' }], [])
    const result = await pauseAffiliation('m1', 'ag-1', { pausedBy: 'owner-1', reason: 'valid reason' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/active member can be paused/i)
  })
})

describe('resumeAffiliation', () => {
  it('resumes a paused member and reactivates the canonical membership', async () => {
    const store = seedStore(
      [{ id: 'm1', agency_id: 'ag-1', user_id: 'u-2', role: 'member', status: 'paused', pause_reason: 'On leave', paused_at: 'x', paused_by: 'owner-1' }],
      [{ id: 'tm1', status: 'suspended' }],
    )
    vi.mocked(getAgencyMembership).mockResolvedValue({ id: 'tm1' })

    const result = await resumeAffiliation('m1', 'ag-1', { resumedBy: 'owner-1' })

    expect(result.ok).toBe(true)
    expect(store.agency_members[0]).toMatchObject({ status: 'active', pause_reason: null, paused_at: null, paused_by: null })
    expect(store.tenant_memberships[0].status).toBe('active')
    expect(insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({ type: 'agency_member_resume' }))
  })

  it('returns notFound for an unknown member', async () => {
    seedStore([], [])
    const result = await resumeAffiliation('missing', 'ag-1', { resumedBy: 'owner-1' })
    expect(result).toMatchObject({ ok: false, notFound: true })
  })

  it('will not resume a member that is not paused', async () => {
    seedStore([{ id: 'm1', agency_id: 'ag-1', user_id: 'u-2', role: 'member', status: 'active' }], [])
    const result = await resumeAffiliation('m1', 'ag-1', { resumedBy: 'owner-1' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/paused member can be resumed/i)
  })
})
