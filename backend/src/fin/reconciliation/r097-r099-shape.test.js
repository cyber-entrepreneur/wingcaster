import { describe, expect, it } from 'vitest'
import { CHECKS } from './checks.js'
import {
  QUIET_PERIOD_DAYS_REQUIRED,
  STAGE_13F_ATTESTATION_FRESH_DAYS,
  quietPeriodDaysElapsed,
  r098Display,
  r099Display,
  readyForStage13f,
} from '../cutover/quiet_period/status.js'

function check(code) {
  return CHECKS.find((c) => c.check_code === code)
}

describe('reconciliation/r097-r099-shape', () => {
  it('R097 is CRITICAL / BLOCK_NEW_ISSUANCE over quiet_period_events', () => {
    expect(check('R097')).toMatchObject({
      severity: 'CRITICAL',
      drift_action: 'BLOCK_NEW_ISSUANCE',
      entity_type: 'cutover_quiet_period_events',
      expected_delta_units: 0,
    })
    expect(check('R097').source_query).toMatch(/COMMERCIAL_WRITE_ATTEMPT/)
    expect(check('R097').source_query).toMatch(/24 hours/)
  })

  it('R098 is LOW / WARN (INFO mapped to LOW; CHECK has no INFO) and requires 90 days', () => {
    expect(check('R098')).toMatchObject({
      severity: 'LOW',
      drift_action: 'WARN',
      entity_type: 'cutover_active_environment',
    })
    expect(check('R098').source_query).toMatch(/interval '90 days'/)
    expect(QUIET_PERIOD_DAYS_REQUIRED).toBe(90)
    expect(r098Display('DRIFT')).toBe('WARN')
    expect(r098Display('GREEN')).toBe('GREEN')
  })

  it('R099 is LOW / WARN with a 30-day attestation window', () => {
    expect(check('R099')).toMatchObject({
      severity: 'LOW',
      drift_action: 'WARN',
      entity_type: 'cutover_parity_attestations',
    })
    expect(check('R099').source_query).toMatch(/interval '30 days'/)
    expect(STAGE_13F_ATTESTATION_FRESH_DAYS).toBe(30)
    expect(r099Display('DRIFT')).toBe('WARN')
    expect(r099Display('GREEN')).toBe('GREEN')
  })

  it('ready_for_stage_13f requires FIN_ONLY + R097/R098/R099 GREEN + fresh attestation', () => {
    expect(readyForStage13f({
      mode: 'FIN_ONLY',
      r097: 'GREEN',
      r098: 'GREEN',
      r099: 'GREEN',
      attestationFresh: true,
    })).toBe(true)
    expect(readyForStage13f({
      mode: 'OFF',
      r097: 'GREEN',
      r098: 'GREEN',
      r099: 'GREEN',
      attestationFresh: true,
    })).toBe(false)
    expect(readyForStage13f({
      mode: 'FIN_ONLY',
      r097: 'DRIFT',
      r098: 'GREEN',
      r099: 'GREEN',
      attestationFresh: true,
    })).toBe(false)
    expect(readyForStage13f({
      mode: 'FIN_ONLY',
      r097: 'GREEN',
      r098: 'GREEN',
      r099: 'GREEN',
      attestationFresh: false,
    })).toBe(false)
  })

  it('quietPeriodDaysElapsed floors whole UTC days', () => {
    expect(quietPeriodDaysElapsed(
      '2026-05-25T12:00:00.000Z',
      '2026-08-23T12:00:00.000Z',
    )).toBe(90)
    expect(quietPeriodDaysElapsed(null, '2026-08-23T12:00:00.000Z')).toBeNull()
  })
})
