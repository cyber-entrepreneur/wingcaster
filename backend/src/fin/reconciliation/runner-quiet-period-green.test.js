/**
 * Real-Postgres — empty quiet-period tables keep R097–R099 GREEN.
 */
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'

finPostgresSuite('reconciliation/runner-quiet-period-green', {}, ({ pool }) => {
  it('R097–R099 stay GREEN with empty quiet-period tables and OFF mode', async () => {
    const run = await runReconciliation(pool(), { now: NOW })
    const byCode = Object.fromEntries(run.results.map((r) => [r.check_code, r]))
    expect(byCode.R097.result).toBe('GREEN')
    expect(byCode.R098.result).toBe('GREEN')
    expect(byCode.R099.result).toBe('GREEN')
    expect(byCode.R096.result).toBe('GREEN')
  })
})
