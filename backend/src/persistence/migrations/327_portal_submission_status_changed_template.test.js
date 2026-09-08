/**
 * Fast seed-SQL parser for BE-BLOCKER-12 migration 327.
 * Postgres coverage (when TEST_DATABASE_URL is set) asserts the rows exist
 * after a real migrate.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FILENAME = '327_portal_submission_status_changed_template.sql'
const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), FILENAME), 'utf8')

export const STATUS_CHANGED_CODES = [
  'portal_submission.status_changed.live',
  'portal_submission.status_changed.rejected',
  'portal_submission.status_changed.failed',
  'portal_submission.status_changed.expired',
  'portal_submission.status_changed.in_review',
]

describe('327_portal_submission_status_changed_template.sql', () => {
  it('is the reserved 327 filename and extends channel CHECK with push', () => {
    expect(FILENAME.startsWith('327_')).toBe(true)
    expect(sql).toMatch(/platform_msg_templates_channel_check/)
    expect(sql).toMatch(/ILIKE '%''push''%'/)
    expect(sql).toMatch(/array_append\(channels, 'push'\)/)
  })

  it('seeds five status-transition variants as push / en / is_seed', () => {
    const codes = [...new Set([...sql.matchAll(/'(portal_submission\.status_changed\.[a-z_]+)'/g)].map((m) => m[1]))]
    expect(codes.sort()).toEqual([...STATUS_CHANGED_CODES].sort())
    for (const code of STATUS_CHANGED_CODES) {
      const idx = sql.indexOf(`'${code}'`)
      expect(idx).toBeGreaterThan(-1)
    }
    expect(sql).toMatch(/'push'/)
    expect(sql).toMatch(/is_seed/)
    expect(sql).toMatch(/language, territory_id/)
    expect(sql).toMatch(/'en'/)
    expect(sql).toMatch(/WHERE NOT EXISTS/)
  })

  it('embeds AGT-PUB-006 copy + receipts deep-link', () => {
    expect(sql).toContain('{{portal_name}} accepted your listing')
    expect(sql).toContain('{{listing_address}} is now live on {{portal_name}}.')
    expect(sql).toContain("{{portal_name}} didn''t accept your listing")
    expect(sql).toContain('Delivery to {{portal_name}} failed')
    expect(sql).toContain('Submission to {{portal_name}} timed out')
    expect(sql).toContain('No portal response after {{sla_days}} days')
    expect(sql).toContain('{{portal_name}} started reviewing your listing')
    expect(sql).toContain('wingcaster://publishing/receipts/:distributionAttemptId')
  })
})
