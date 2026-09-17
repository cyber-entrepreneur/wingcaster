/**
 * Unit tests for H3 data-export cleanup worker.
 *
 * Covers:
 *   - runDataExportCleanupOnce: scans expired rows, deletes storage,
 *     stamps `pruned_at` on the row (audit-preserving)
 *   - Empty result set → summary is all zeros
 *   - Storage-delete failure on one row doesn't stop the sweep
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
const storage = vi.hoisted(() => ({ deleteStoredExport: vi.fn() }))

vi.mock('../db.js', () => db)
vi.mock('../lib/settings/data-export-storage.js', () => storage)
vi.mock('../lib/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let runDataExportCleanupOnce

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  storage.deleteStoredExport.mockReset()
  ;({ runDataExportCleanupOnce } = await import('./data-export-cleanup.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('runDataExportCleanupOnce', () => {
  it('returns zeroes when no expired rows', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT id, file_path/i.test(sql)) return []
      return []
    })
    const summary = await runDataExportCleanupOnce()
    expect(summary).toEqual({ scanned: 0, deleted: 0, failed: 0 })
    expect(storage.deleteStoredExport).not.toHaveBeenCalled()
  })

  it('deletes storage + nulls file_path + stamps pruned_at for each expired row', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT id, file_path/i.test(sql)) {
        return [
          { id: 'exp-1', file_path: '/tmp/exp-1.json' },
          { id: 'exp-2', file_path: 's3://bucket/exp-2.json' },
        ]
      }
      return []
    })
    storage.deleteStoredExport.mockResolvedValue(undefined)
    const summary = await runDataExportCleanupOnce()
    expect(summary.scanned).toBe(2)
    expect(summary.deleted).toBe(2)
    expect(summary.failed).toBe(0)
    // Two UPDATEs, each setting file_path=NULL and stamping pruned_at.
    const updates = db.query.mock.calls.filter((c) => /^UPDATE data_exports/i.test(c[0]))
    expect(updates.length).toBe(2)
    for (const [sql] of updates) {
      expect(sql).toMatch(/file_path = NULL/i)
      expect(sql).toMatch(/pruned_at/i)
    }
  })

  it('records failures per-row and keeps sweeping', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT id, file_path/i.test(sql)) {
        return [
          { id: 'exp-1', file_path: '/tmp/exp-1.json' },
          { id: 'exp-2', file_path: '/tmp/exp-2.json' },
        ]
      }
      return []
    })
    storage.deleteStoredExport.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    storage.deleteStoredExport.mockResolvedValueOnce(undefined)
    const summary = await runDataExportCleanupOnce()
    expect(summary.scanned).toBe(2)
    expect(summary.deleted).toBe(1)
    expect(summary.failed).toBe(1)
  })
})
