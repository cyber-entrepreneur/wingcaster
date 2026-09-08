import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { registerSchema } from '../validation.js'
import {
  FREE_TIER_FLAG_CODES,
  FREE_TIER_PACKAGE_CODES,
  freeTierAudienceForScope,
  freeTierPackageCode,
} from './registry.js'
import { FREE_AGENCY_PACKAGE_ID, FREE_AGENCY_VERSION_ID } from './test-support.js'

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../persistence/migrations/319_agency_free_tier_seed.sql',
)

describe('agency free-tier seed (fast)', () => {
  it('maps audience and scope to distinct package codes', () => {
    expect(freeTierPackageCode('agent')).toBe('free-agent')
    expect(freeTierPackageCode('agency')).toBe('free-agency')
    expect(freeTierPackageCode()).toBe('free-agent')
    expect(freeTierAudienceForScope('personal')).toBe('agent')
    expect(freeTierAudienceForScope('agency')).toBe('agency')
    expect(FREE_TIER_PACKAGE_CODES.agency).toBe('free-agency')
  })

  it('migration 319 seeds free-agency with 304-baseline flags and idempotent guards', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain(FREE_AGENCY_PACKAGE_ID)
    expect(sql).toContain(FREE_AGENCY_VERSION_ID)
    expect(sql).toContain("'free-agency'")
    expect(sql).toContain("'Free Agency'")
    expect(sql).toContain("'agency'")
    expect(sql).toContain("'DRAFT'")
    expect(sql).toContain("state = 'PUBLISHED'")
    expect(sql).toMatch(/ON CONFLICT|WHERE NOT EXISTS/i)
    for (const flag of FREE_TIER_FLAG_CODES) {
      expect(sql).toContain(`'${flag}'`)
    }
    expect(sql).not.toContain('tagline')
    expect(sql).not.toContain('portal_groups')
  })

  it('registerSchema requires agency_name on path=agency (agency_mode=new)', () => {
    const missing = registerSchema.safeParse({
      name: 'Owner',
      email: 'owner@example.test',
      password: 'secret123',
      agency_mode: 'new',
    })
    expect(missing.success).toBe(false)

    const ok = registerSchema.safeParse({
      name: 'Owner',
      email: 'owner@example.test',
      password: 'secret123',
      agency_mode: 'new',
      agency_name: 'Acme Realty',
    })
    expect(ok.success).toBe(true)
    expect(ok.data.agency_mode).toBe('new')
    expect(ok.data.agency_name).toBe('Acme Realty')
  })
})
