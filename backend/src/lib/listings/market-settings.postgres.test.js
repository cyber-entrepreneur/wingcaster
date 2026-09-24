/**
 * Real-Postgres tests for the PA market on/off registry (migration 804).
 * Launch seed = Lebanon ON, everything else OFF.
 */
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import {
  getEnabledMarketCodes,
  listMarketSettings,
  setMarketEnabled,
  MARKET_LABELS,
} from './market-settings.js'

finPostgresSuite('market settings registry (migration 804)', { seed: false }, () => {
  it('seeds Lebanon ON and every other market OFF', async () => {
    expect(await getEnabledMarketCodes()).toEqual(['LB'])
  })

  it('lists all known markets with their enabled flag', async () => {
    const rows = await listMarketSettings()
    expect(rows).toHaveLength(Object.keys(MARKET_LABELS).length)
    expect(rows.find((r) => r.code === 'LB')).toMatchObject({ enabled: true, label: 'Lebanon' })
    expect(rows.find((r) => r.code === 'AE')).toMatchObject({ enabled: false })
  })

  it('turns a market on and off', async () => {
    await setMarketEnabled('AE', true, null)
    expect((await getEnabledMarketCodes()).sort()).toEqual(['AE', 'LB'])
    await setMarketEnabled('AE', false, null)
    expect(await getEnabledMarketCodes()).toEqual(['LB'])
  })
})
