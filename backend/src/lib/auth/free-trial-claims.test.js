import { describe, expect, it } from 'vitest'
import {
  FreeTrialAlreadyClaimedError,
  recordClaim,
} from './free-trial-claims.js'

describe('FreeTrialAlreadyClaimedError', () => {
  it('exposes code and blockingDimensions', () => {
    const err = new FreeTrialAlreadyClaimedError(['email', 'phone'])
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('FREE_TRIAL_ALREADY_CLAIMED')
    expect(err.blockingDimensions).toEqual(['email', 'phone'])
    expect(err.message).toMatch(/already claimed/)
  })
})

describe('recordClaim unique-violation mapping', () => {
  it('re-throws unique-constraint violations as FreeTrialAlreadyClaimedError', async () => {
    let calls = 0
    const client = {
      async query() {
        calls += 1
        if (calls === 1) {
          const err = new Error('duplicate key value violates unique constraint "uq_ftc_email_hash"')
          err.code = '23505'
          err.constraint = 'uq_ftc_email_hash'
          throw err
        }
        return { rows: [] }
      },
    }
    await expect(recordClaim({
      userId: 'u-1',
      email: 'a@x.test',
      phone: '+96171123456',
      username: 'ali',
      client,
    })).rejects.toMatchObject({
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
      blockingDimensions: ['email'],
    })
  })
})
