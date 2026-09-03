import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { createAgencyWithOwner } from '../../tenant-authorization.js'
import { creditTenantIdForScope } from '../credits/tenant-context.js'
import { FREE_VERSION_ID } from './test-support.js'

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

  it('createAgencyWithOwner provisions an agency wallet + free-tier subscription', async () => {
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
      agency: { id: agencyId, name: 'Free Agency' },
      ownerUserId: ownerId,
    })
    const tenantId = creditTenantIdForScope('agency', agencyId)
    const sub = await pool().query(
      `SELECT package_version_id FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(sub.rows[0].package_version_id).toBe(FREE_VERSION_ID)
  })
})
