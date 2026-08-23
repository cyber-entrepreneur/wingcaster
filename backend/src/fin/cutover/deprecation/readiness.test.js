/**
 * Fast suite — deprecation readiness gate branches (no Postgres).
 */
import { describe, expect, it } from 'vitest'
import { computeDeprecationReadiness } from '../deprecation.js'

function poolFrom(state) {
  return {
    query: async (sql) => {
      if (sql.includes('pg_tables') && sql.includes('schemaname = \'commercial\'')) {
        return { rows: [{ n: state.commercialTables ?? 1 }] }
      }
      if (sql.includes('pg_constraint') && sql.includes('fnsp.nspname = \'commercial\'')) {
        return { rows: [{ n: state.fksOutside ?? 0 }] }
      }
      if (sql.includes('COMMERCIAL_WRITE_ATTEMPT')) {
        return { rows: [{ n: state.writeAttempts90d ?? 0 }] }
      }
      if (sql.includes('cutover_parity_attestations')) {
        return { rows: state.attestationSignedAt ? [{ signed_at: state.attestationSignedAt }] : [] }
      }
      if (sql.includes('cutover_active_environment')) {
        return {
          rows: state.active ? [{
            mode: state.active.mode,
            activated_at: state.active.activated_at,
            attestation_id: state.active.attestation_id || null,
          }] : [],
        }
      }
      if (sql.includes('FIN_CUTOVER_COMMERCIAL_DROPPED')) {
        return { rows: [] }
      }
      throw new Error(`unexpected query: ${sql.slice(0, 80)}`)
    },
  }
}

const NOW = '2026-08-18T12:00:00.000Z'
const ACTIVATED_90D_AGO = '2026-05-18T12:00:00.000Z'

const allGreen = {
  active: { mode: 'FIN_ONLY', activated_at: ACTIVATED_90D_AGO },
  writeAttempts90d: 0,
  commercialTables: 3,
  fksOutside: 0,
  attestationSignedAt: NOW,
}

describe('computeDeprecationReadiness', () => {
  it('is not ready when mode is not FIN_ONLY', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      active: { mode: 'DUAL', activated_at: ACTIVATED_90D_AGO },
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.mode_fin_only).toBe(false)
  })

  it('is not ready when quiet period < 90 days', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      active: { mode: 'FIN_ONLY', activated_at: NOW },
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.quiet_period_90d).toBe(false)
  })

  it('is not ready when COMMERCIAL_WRITE_ATTEMPT in last 90 days', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      writeAttempts90d: 1,
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.r097_clean_90d).toBe(false)
  })

  it('is not ready without fresh attestation', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      attestationSignedAt: null,
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.r099_fresh).toBe(false)
  })

  it('is not ready when commercial tables already dropped', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      commercialTables: 0,
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.commercial_tables_remaining).toBe(0)
  })

  it('is not ready when FKs outside commercial reference commercial', async () => {
    const result = await computeDeprecationReadiness(poolFrom({
      ...allGreen,
      fksOutside: 2,
    }), { environment: 'LIVE', now: NOW })
    expect(result.ready_for_drop).toBe(false)
    expect(result.gates.fks_outside_commercial).toBe(2)
  })

  it('is ready when all gates are true and snapshot note is long enough', async () => {
    const result = await computeDeprecationReadiness(poolFrom(allGreen), {
      environment: 'LIVE',
      now: NOW,
      snapshotNote: 'snap-abc123@2026-08-17T10:00:00Z, restored to staging by ops',
    })
    expect(result.ready_for_drop).toBe(true)
    expect(result.gates.snapshot_confirmed_by_operator).toBe(true)
  })
})
