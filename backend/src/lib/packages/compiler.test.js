import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { compileGrantFromSnapshot } from './compiler.js'

describe('compileGrantFromSnapshot', () => {
  const subscriptionId = randomUUID()
  const packageVersionId = randomUUID()
  const instagram = randomUUID()
  const postCreation = randomUUID()

  it('known inputs → known totals and per-feature breakdown', () => {
    const compiled = compileGrantFromSnapshot({
      subscription: {
        id: subscriptionId,
        package_version_id: packageVersionId,
        properties_committed: 10,
      },
      quotas: [
        { feature_id: instagram, feature_code: 'publishing.social.instagram', credits_per_property: 5 },
        { feature_id: postCreation, feature_code: 'ai.post_creation', credits_per_property: 3 },
      ],
      cycleStart: '2026-09-01T00:00:00.000Z',
      cycleEnd: '2026-10-01T00:00:00.000Z',
    })
    expect(compiled.total_credits).toBe(80)
    expect(compiled.breakdown).toEqual([
      {
        feature_id: instagram,
        feature_code: 'publishing.social.instagram',
        credits_per_property: 5,
        properties: 10,
        total_credits: 50,
      },
      {
        feature_id: postCreation,
        feature_code: 'ai.post_creation',
        credits_per_property: 3,
        properties: 10,
        total_credits: 30,
      },
    ])
    expect(compiled.grant_ref).toEqual({
      subscription_id: subscriptionId,
      package_version_id: packageVersionId,
      cycle_start: '2026-09-01T00:00:00.000Z',
      cycle_end: '2026-10-01T00:00:00.000Z',
      properties_committed: 10,
      idempotency_key: `subscription_cycle:${subscriptionId}:2026-09-01T00:00:00.000Z`,
    })
  })

  it('zero quotas and zero properties compile to a zero grant', () => {
    const compiled = compileGrantFromSnapshot({
      subscription: {
        id: subscriptionId,
        package_version_id: packageVersionId,
        properties_committed: 0,
      },
      quotas: [],
      cycleStart: '2026-09-01T00:00:00.000Z',
      cycleEnd: '2026-10-01T00:00:00.000Z',
    })
    expect(compiled.total_credits).toBe(0)
    expect(compiled.breakdown).toEqual([])
  })
})
