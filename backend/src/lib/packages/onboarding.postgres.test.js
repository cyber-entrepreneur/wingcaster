import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { createAgencyWithOwner } from '../../tenant-authorization.js'
import { creditTenantIdForScope } from '../credits/tenant-context.js'
import { CREDIT_ERROR } from '../credits/errors.js'
import { provisionFreeTier } from './onboarding.js'
import { FREE_TIER_FLAG_CODES } from './registry.js'
import { FREE_AGENCY_PACKAGE_ID, FREE_AGENCY_VERSION_ID, FREE_VERSION_ID } from './test-support.js'

const seedSqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../persistence/migrations/319_agency_free_tier_seed.sql',
)

finPostgresSuite('free-tier onboarding', {}, ({ pool }) => {
  it('createAgentAccount provisions a wallet and free-tier subscription', async () => {
    const userId = randomUUID()
    const now = new Date().toISOString()
    await createAgentAccount({
      user: {
        id: userId, email: `o-${userId}@x.test`, name: 'Onboard',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: userId, email: `o-${userId}@x.test`, name: 'Onboard' },
    })
    const tenantId = creditTenantIdForScope('personal', userId)
    const wallet = await pool().query(
      `SELECT tenant_id, scope, scope_id FROM public.credit_wallets WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(wallet.rows[0].scope).toBe('personal')
    expect(wallet.rows[0].scope_id).toBe(userId)
    const sub = await pool().query(
      `SELECT status, package_version_id, properties_committed
         FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(sub.rows[0].package_version_id).toBe(FREE_VERSION_ID)
    expect(['ACTIVE', 'PENDING_START']).toContain(sub.rows[0].status)
    expect(Number(sub.rows[0].properties_committed)).toBe(0)
  })

  it('createAgencyWithOwner provisions an agency wallet + agency free-tier subscription', async () => {
    const ownerId = randomUUID()
    const now = new Date().toISOString()
    await createAgentAccount({
      user: {
        id: ownerId, email: `ag-${ownerId}@x.test`, name: 'Agency Owner',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: ownerId, email: `ag-${ownerId}@x.test`, name: 'Agency Owner' },
    })
    const agencyId = randomUUID()
    await createAgencyWithOwner({
      agency: { id: agencyId, name: 'Free Agency', license_number: 'LIC-319' },
      ownerUserId: ownerId,
    })

    const tenantRow = await pool().query(
      `SELECT id, tenant_type, agency_id, status FROM public.tenants WHERE agency_id = $1`,
      [agencyId],
    )
    expect(tenantRow.rows[0].tenant_type).toBe('agency')
    expect(tenantRow.rows[0].status).toBe('active')
    expect(tenantRow.rows[0].id).toBe(`agency:${agencyId}`)

    const membership = await pool().query(
      `SELECT role, status FROM public.tenant_memberships
        WHERE tenant_id = $1 AND user_id = $2`,
      [`agency:${agencyId}`, ownerId],
    )
    expect(membership.rows[0].role).toBe('owner')
    expect(membership.rows[0].status).toBe('active')

    const tenantId = creditTenantIdForScope('agency', agencyId)
    const sub = await pool().query(
      `SELECT s.status, s.package_version_id, p.code, p.target_audience, p.tier
         FROM public.tenant_subscriptions s
         JOIN public.product_package_versions v ON v.id = s.package_version_id
         JOIN public.product_packages p ON p.id = v.package_id
        WHERE s.tenant_id = $1`,
      [tenantId],
    )
    expect(sub.rows[0].package_version_id).toBe(FREE_AGENCY_VERSION_ID)
    expect(sub.rows[0].code).toBe('free-agency')
    expect(sub.rows[0].target_audience).toBe('agency')
    expect(sub.rows[0].tier).toBe('free')
    expect(['ACTIVE', 'PENDING_START']).toContain(sub.rows[0].status)
  })

  it('seeds free-agency with the same feature flags as agent free-tier', async () => {
    const pkg = await pool().query(
      `SELECT p.code, p.display_name, p.tier, p.target_audience, p.active,
              v.id AS version_id, v.state, v.properties_covered, v.monthly_price_minor
         FROM public.product_packages p
         JOIN public.product_package_versions v ON v.package_id = p.id
        WHERE p.id = $1 AND v.id = $2`,
      [FREE_AGENCY_PACKAGE_ID, FREE_AGENCY_VERSION_ID],
    )
    expect(pkg.rows[0].code).toBe('free-agency')
    expect(pkg.rows[0].display_name).toBe('Free Agency')
    expect(pkg.rows[0].tier).toBe('free')
    expect(pkg.rows[0].target_audience).toBe('agency')
    // Migration 339 deactivates free from the marketing catalog; stays PUBLISHED.
    expect(pkg.rows[0].active).toBe(false)
    expect(pkg.rows[0].state).toBe('PUBLISHED')
    expect(Number(pkg.rows[0].properties_covered)).toBe(0)
    expect(Number(pkg.rows[0].monthly_price_minor)).toBe(0)

    const agentFlags = await pool().query(
      `SELECT feature_code FROM public.package_feature_flags
        WHERE package_version_id = $1 ORDER BY feature_code`,
      [FREE_VERSION_ID],
    )
    const agencyFlags = await pool().query(
      `SELECT feature_code FROM public.package_feature_flags
        WHERE package_version_id = $1 ORDER BY feature_code`,
      [FREE_AGENCY_VERSION_ID],
    )
    const expected = [...FREE_TIER_FLAG_CODES].sort()
    expect(agentFlags.rows.map((r) => r.feature_code)).toEqual(expected)
    expect(agencyFlags.rows.map((r) => r.feature_code)).toEqual(expected)

    const quotas = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.package_feature_quotas
        WHERE package_version_id = $1`,
      [FREE_AGENCY_VERSION_ID],
    )
    expect(quotas.rows[0].n).toBe(0)
  })

  it('path=agency signup creates agency tenant + free-tier subscription in one transaction', async () => {
    const userId = randomUUID()
    const agencyId = randomUUID()
    const now = new Date().toISOString()
    await createAgentAccount({
      user: {
        id: userId, email: `c-${userId}@x.test`, name: 'Path C Owner',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: userId, email: `c-${userId}@x.test`, name: 'Path C Owner' },
      agency: { id: agencyId, name: `Acme ${agencyId.slice(0, 8)}`, license_number: 'LIC-C' },
    })

    const personalTenantId = creditTenantIdForScope('personal', userId)
    const agencyTenantId = creditTenantIdForScope('agency', agencyId)

    const tenants = await pool().query(
      `SELECT id, tenant_type FROM public.tenants
        WHERE personal_owner_user_id = $1 OR agency_id = $2
        ORDER BY tenant_type`,
      [userId, agencyId],
    )
    expect(tenants.rows.map((r) => r.tenant_type).sort()).toEqual(['agency', 'personal'])

    const personalSub = await pool().query(
      `SELECT package_version_id FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [personalTenantId],
    )
    const agencySub = await pool().query(
      `SELECT s.package_version_id, p.code
         FROM public.tenant_subscriptions s
         JOIN public.product_package_versions v ON v.id = s.package_version_id
         JOIN public.product_packages p ON p.id = v.package_id
        WHERE s.tenant_id = $1`,
      [agencyTenantId],
    )
    expect(personalSub.rows[0].package_version_id).toBe(FREE_VERSION_ID)
    expect(agencySub.rows[0].package_version_id).toBe(FREE_AGENCY_VERSION_ID)
    expect(agencySub.rows[0].code).toBe('free-agency')
    expect(['ACTIVE', 'PENDING_START']).toContain(
      (await pool().query(
        `SELECT status FROM public.tenant_subscriptions WHERE tenant_id = $1`,
        [agencyTenantId],
      )).rows[0].status,
    )
  })

  it('path=agency signup rolls back the agent when agency tenant creation fails', async () => {
    const userId = randomUUID()
    const now = new Date().toISOString()
    await expect(createAgentAccount({
      user: {
        id: userId, email: `fail-${userId}@x.test`, name: 'Rollback Owner',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: userId, email: `fail-${userId}@x.test`, name: 'Rollback Owner' },
      agency: { id: randomUUID() },
    })).rejects.toThrow(/agency id, agency name/)

    const user = await pool().query(`SELECT id FROM public.users WHERE id = $1`, [userId])
    expect(user.rows).toHaveLength(0)
    const personalSub = await pool().query(
      `SELECT id FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [creditTenantIdForScope('personal', userId)],
    )
    expect(personalSub.rows).toHaveLength(0)
  })

  it('re-applying migration 319 is a no-op', async () => {
    const sql = await readFile(seedSqlPath, 'utf8')
    await pool().query(sql)
    const packages = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.product_packages WHERE code = 'free-agency'`,
    )
    const versions = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.product_package_versions WHERE id = $1`,
      [FREE_AGENCY_VERSION_ID],
    )
    const flags = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.package_feature_flags WHERE package_version_id = $1`,
      [FREE_AGENCY_VERSION_ID],
    )
    expect(packages.rows[0].n).toBe(1)
    expect(versions.rows[0].n).toBe(1)
    expect(flags.rows[0].n).toBe(FREE_TIER_FLAG_CODES.length)
  })

  it('FREE_TIER_PACKAGE_MISSING refuses agency onboarding when the seed is unpublished', async () => {
    const client = await pool().connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE public.product_package_versions SET state = 'DEPRECATED' WHERE id = $1`,
        [FREE_AGENCY_VERSION_ID],
      )
      await expect(provisionFreeTier(client, {
        scope: 'agency',
        scopeId: randomUUID(),
      })).rejects.toMatchObject({ code: CREDIT_ERROR.FREE_TIER_PACKAGE_MISSING })
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})
