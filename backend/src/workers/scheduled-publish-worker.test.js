/**
 * AGT-PUB-007 scheduled-publish worker tests.
 * Mocks the db query layer; injects a fake `submit` so the worker's
 * fire → publish/re-arm/fail transitions can be asserted without the real
 * publishing engine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../db.js', () => db)
vi.mock('../lib/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

let runScheduledPublishOnce

/**
 * Wire the query mock: SELECT returns the given due rows, the claim UPDATE
 * reports success, and everything else (final UPDATE) returns []. Records
 * the final status-transition UPDATEs for assertions.
 */
function wireQuery(dueRows, updates) {
  db.query.mockImplementation(async (sql, params) => {
    if (/FROM scheduled_publications\s+WHERE status = 'pending'/.test(sql)) return dueRows
    if (/SET status = 'processing'/.test(sql)) return [{ id: params[0] }]
    updates.push({ sql, params })
    return []
  })
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  ;({ runScheduledPublishOnce } = await import('./scheduled-publish-worker.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('runScheduledPublishOnce', () => {
  it('fires a due one-shot schedule and marks it published', async () => {
    const updates = []
    wireQuery(
      [{ id: 's1', property_id: 'p1', agent_id: 'a1', agency_id: null, portals: ['pf'], message: '', recurrence: 'none', scheduled_at: '2026-01-01T00:00:00Z', attempts: 0 }],
      updates,
    )
    const submit = vi.fn(async () => ({ jobId: 'job-1' }))
    const summary = await runScheduledPublishOnce({ submit })
    expect(summary).toMatchObject({ scanned: 1, published: 1, failed: 0 })
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 'p1', agentId: 'a1', portals: ['pf'] }))
    const final = updates.at(-1).sql
    expect(final).toMatch(/status = 'published'/)
  })

  it('re-arms a weekly schedule for +7 days and keeps it pending', async () => {
    const updates = []
    wireQuery(
      [{ id: 's2', property_id: 'p1', agent_id: 'a1', agency_id: null, portals: ['pf'], message: '', recurrence: 'weekly', scheduled_at: '2026-01-01T00:00:00Z', attempts: 0 }],
      updates,
    )
    const submit = vi.fn(async () => ({ jobId: 'job-2' }))
    await runScheduledPublishOnce({ submit })
    const final = updates.at(-1)
    expect(final.sql).toMatch(/status = 'pending'/)
    // next scheduled_at is +7 days
    expect(final.params).toContain('2026-01-08T00:00:00.000Z')
  })

  it('marks a schedule failed when submit throws', async () => {
    const updates = []
    wireQuery(
      [{ id: 's3', property_id: 'p1', agent_id: 'a1', agency_id: null, portals: ['pf'], message: '', recurrence: 'none', scheduled_at: '2026-01-01T00:00:00Z', attempts: 0 }],
      updates,
    )
    const submit = vi.fn(async () => {
      throw new Error('portal down')
    })
    const summary = await runScheduledPublishOnce({ submit })
    expect(summary).toMatchObject({ published: 0, failed: 1 })
    const final = updates.at(-1)
    expect(final.sql).toMatch(/status = 'failed'/)
    expect(final.params).toContain('portal down')
  })

  it('does nothing when nothing is due', async () => {
    wireQuery([], [])
    const submit = vi.fn()
    const summary = await runScheduledPublishOnce({ submit })
    expect(summary).toMatchObject({ scanned: 0, published: 0, failed: 0 })
    expect(submit).not.toHaveBeenCalled()
  })
})
