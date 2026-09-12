/**
 * Fast unit tests for agency-application expiry → resolved notification hook.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notifyMock = vi.hoisted(() => ({
  safeEmitAgencyApplicationResolved: vi.fn(async () => ({ ok: true })),
}))

const queryMock = vi.hoisted(() => ({
  query: vi.fn(),
}))

vi.mock('./lib/agencies/notify-application-resolved.js', () => notifyMock)
vi.mock('./db.js', () => queryMock)
vi.mock('./lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { runAgencyApplicationExpiryTick } = await import('./workers/agency-application-expiry.js')

beforeEach(() => {
  notifyMock.safeEmitAgencyApplicationResolved.mockClear()
  queryMock.query.mockReset()
})

describe('runAgencyApplicationExpiryTick notification hook', () => {
  it('emits agency_application.resolved.expired for each newly expired row', async () => {
    const now = '2026-06-15T12:00:00.000Z'
    queryMock.query
      .mockResolvedValueOnce([{ '?column?': 1 }]) // agencyApplicationsTableExists
      .mockResolvedValueOnce([{ id: 'app1', status: 'pending' }, { id: 'app2', status: 'pending' }])
      .mockResolvedValueOnce([
        { id: 'app1', applicant_user_id: 'usr1', agency_id: 'ag1' },
        { id: 'app2', applicant_user_id: 'usr2', agency_id: 'ag1' },
      ])
      .mockResolvedValueOnce([{ id: 'ag1', name: 'Palm Realty' }])
      .mockResolvedValueOnce([]) // legacy due

    const result = await runAgencyApplicationExpiryTick({ now })
    expect(result.expired).toBe(2)
    expect(notifyMock.safeEmitAgencyApplicationResolved).toHaveBeenCalledTimes(2)
    expect(notifyMock.safeEmitAgencyApplicationResolved).toHaveBeenCalledWith({
      userId: 'usr1',
      agencyName: 'Palm Realty',
      applicationId: 'app1',
      newStatus: 'expired',
    })
    expect(notifyMock.safeEmitAgencyApplicationResolved).toHaveBeenCalledWith({
      userId: 'usr2',
      agencyName: 'Palm Realty',
      applicationId: 'app2',
      newStatus: 'expired',
    })
  })

  it('skips emit when applicant_user_id is missing', async () => {
    queryMock.query
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ id: 'app1', status: 'pending' }])
      .mockResolvedValueOnce([{ id: 'app1', applicant_user_id: null, agency_id: 'ag1' }])
      .mockResolvedValueOnce([{ id: 'ag1', name: 'Palm Realty' }])
      .mockResolvedValueOnce([])

    await runAgencyApplicationExpiryTick({ now: '2026-06-15T12:00:00.000Z' })
    expect(notifyMock.safeEmitAgencyApplicationResolved).not.toHaveBeenCalled()
  })
})
