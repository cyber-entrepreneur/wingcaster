/**
 * Fast seed-SQL parser for Wave 1 WF-02 migration 335.
 * Postgres coverage (when TEST_DATABASE_URL is set) asserts the rows exist
 * after a real migrate.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FILENAME = '335_agency_application_resolved_template.sql'
const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), FILENAME), 'utf8')

export const RESOLVED_CODES = [
  'agency_application.resolved.approved',
  'agency_application.resolved.rejected',
  'agency_application.resolved.expired',
]

describe('335_agency_application_resolved_template.sql', () => {
  it('is the reserved 335 filename and seeds three en/push/is_seed variants', () => {
    expect(FILENAME.startsWith('335_')).toBe(true)
    const codes = [
      ...new Set(
        [...sql.matchAll(/'(agency_application\.resolved\.[a-z_]+)'/g)].map((m) => m[1]),
      ),
    ]
    expect(codes.sort()).toEqual([...RESOLVED_CODES].sort())
    expect(sql).toMatch(/'push'/)
    expect(sql).toMatch(/is_seed/)
    expect(sql).toMatch(/'en'/)
    expect(sql).toMatch(/WHERE NOT EXISTS/)
  })

  it('embeds AGT-REC-004 copy + applications deep-link', () => {
    expect(sql).toContain('{{agency_name}} accepted your application')
    expect(sql).toContain('Welcome. Tap to switch to your new workspace.')
    expect(sql).toContain('{{agency_name}} responded to your application')
    expect(sql).toContain('Your application was reviewed. Tap to see the outcome.')
    expect(sql).toContain('Your application to {{agency_name}} timed out')
    expect(sql).toContain('No response after 30 days. Tap to re-apply or browse other agencies.')
    expect(sql).toContain('wingcaster://applications/:applicationId')
    expect(sql).toContain('/applications/:applicationId')
  })
})
