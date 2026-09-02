import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { PACKAGE_ERROR } from './errors.js'
import { startSubscription } from './lifecycle.js'
import { activateProperty, countActive, deactivateProperty } from './property-tracker.js'
import { seedPublishedPackage, withTx } from './test-support.js'

finPostgresSuite('property tracker', {}, ({ pool }) => {
  it('refuses when count == properties_committed and allows after deactivate', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    const first = randomUUID()
    const second = randomUUID()
    await withTx(pool(), async (client) => {
      const paid = await seedPublishedPackage(client, {
        propertiesCovered: 1,
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 1 }],
      })
      await startSubscription(client, {
        tenantId,
        packageVersionId: paid.versionId,
        propertiesCommitted: 1,
        billingCycleStart: now,
        now,
      })
      const opened = await activateProperty(client, { tenantId, propertyId: first, now })
      expect(opened.property_id).toBe(first)
      expect(await countActive(client, tenantId)).toBe(1)

      await expect(activateProperty(client, { tenantId, propertyId: second, now }))
        .rejects.toMatchObject({ code: PACKAGE_ERROR.PROPERTY_LIMIT_EXCEEDED })

      const closed = await deactivateProperty(client, { tenantId, propertyId: first, now })
      expect(closed.deactivated_at).toBeTruthy()
      expect(await countActive(client, tenantId)).toBe(0)

      const again = await activateProperty(client, { tenantId, propertyId: second, now })
      expect(again.property_id).toBe(second)
      expect(await countActive(client, tenantId)).toBe(1)
    })
  })
})
