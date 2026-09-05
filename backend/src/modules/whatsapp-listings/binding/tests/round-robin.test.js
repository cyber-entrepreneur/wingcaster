import { describe, expect, it } from 'vitest'
import { fnv1aHash, sharedNumberIndex } from '../round-robin.js'

describe('shared-number round-robin (H3)', () => {
  it('is deterministic for a given user_id and pool size', () => {
    const a = sharedNumberIndex('user-abc', 3)
    const b = sharedNumberIndex('user-abc', 3)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(3)
  })

  it('distributes 100 agents across 3 numbers approximately evenly', () => {
    const counts = [0, 0, 0]
    for (let i = 0; i < 100; i += 1) {
      counts[sharedNumberIndex(`agent-${i}`, 3)] += 1
    }
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(100)
    for (const n of counts) {
      expect(n).toBeGreaterThan(15)
      expect(n).toBeLessThan(60)
    }
  })

  it('fnv1a is stable', () => {
    expect(fnv1aHash('stable-id')).toBe(fnv1aHash('stable-id'))
  })
})
