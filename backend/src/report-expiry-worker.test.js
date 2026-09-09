/**
 * Unit coverage for report expiry helpers (no Postgres required).
 */
import { describe, expect, it } from 'vitest'
import {
  PENDING_LIKE_STATUSES,
  REPORT_EXPIRY_DAYS,
  REPORT_EXPIRY_TABLES,
  reportExpiresAt,
} from './workers/report-expiry-worker.js'

describe('report expiry helpers (BE-BLOCKER-24/25)', () => {
  it('reportExpiresAt adds 30 UTC days', () => {
    expect(REPORT_EXPIRY_DAYS).toBe(30)
    expect(reportExpiresAt('2026-01-01T00:00:00.000Z')).toBe('2026-01-31T00:00:00.000Z')
    expect(reportExpiresAt(new Date('2026-02-01T12:30:00.000Z'))).toBe('2026-03-03T12:30:00.000Z')
  })

  it('shared worker targets both report tables identically', () => {
    expect(REPORT_EXPIRY_TABLES).toHaveLength(2)
    expect(REPORT_EXPIRY_TABLES.map((t) => t.key)).toEqual([
      'comparable_reports',
      'agent_price_reports',
    ])
    expect(PENDING_LIKE_STATUSES).toEqual(['pending', 'pending_review'])
  })
})
