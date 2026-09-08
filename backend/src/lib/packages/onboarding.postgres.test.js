import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { createAgencyWithOwner } from '../../tenant-authorization.js'
import { creditTenantIdForScope } from '../credits/tenant-context.js'
import {
  FREE_VERSION_ID,
  FREE_AGENCY_VERSION_ID,
  FREE_AGENCY_PACKAGE_ID,
} from './test-support.js'

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

  it('path=agency signup creates agency tenant + free-agency subscription in one transaction', async () => {
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

    const flags = await pool().query(
      `SELECT feature_code FROM public.package_feature_flags
        WHERE package_version_id = $1 ORDER BY feature_code`,
      [FREE_AGENCY_VERSION_ID],
    )
    expect(flags.rows.map((r) => r.feature_code)).toEqual([
      'crm.contacts',
      'crm.opportunities',
      'crm.tasks',
      'listings.crud',
    ])

    // Seed package row is present and distinct from agent free-tier.
    const pkg = await pool().query(
      `SELECT id, code FROM public.product_packages WHERE id = $1`,
      [FREE_AGENCY_PACKAGE_ID],
    )
    expect(pkg.rows[0].code).toBe('free-agency')
  })
})
