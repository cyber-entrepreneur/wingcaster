import { describe, expect, it } from 'vitest'
import { dunningStageWarning, nextDunningStage } from './dunning-stage'

describe('dunning-stage helpers', () => {
  it('computes the next stage from OPEN', () => {
    expect(nextDunningStage('OPEN')).toEqual({ status: 'REMINDING', kind: 'REMIND' })
  })

  it('returns null when no further stage exists', () => {
    expect(nextDunningStage('WRITE_OFF_REVIEW')).toBeNull()
  })

  it('warns when usage will be suspended', () => {
    expect(dunningStageWarning('USAGE_SUSPENDED')).toMatch(/suspend/i)
  })
})
