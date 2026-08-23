/**
 * Real-Postgres — R097–R099 DRIFT then GREEN.
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'

function resultOf(run, code) {
  return run.results.find((r) => r.check_code === code)
}

async function setMode(pool, { mode, activatedAt, attestationId = null }) {
  await pool.query(
    'ALTER TABLE fin.cutover_active_environment DISABLE TRIGGER trg_cutover_active_environment_fin_only',
  )
  await pool.query(`DELETE FROM fin.cutover_active_environment WHERE environment = 'LIVE'`)
  await pool.query(
    `INSERT INTO fin.cutover_active_environment (
       environment, mode, attestation_id, activated_at,
       activated_by_email, activated_by_actor_type, updated_at
     ) VALUES (
       'LIVE', $1, $2, $3::timestamptz,
       'test@example.test', 'SYSTEM', $3::timestamptz
     )`,
    [mode, attestationId, activatedAt],
  )
  await pool.query(
    'ALTER TABLE fin.cutover_active_environment ENABLE TRIGGER trg_cutover_active_environment_fin_only',
  )
}

finPostgresSuite('reconciliation/r097-r099', {}, ({ pool }) => {
  it('R097 DRIFT when a COMMERCIAL_WRITE_ATTEMPT row landed in the last 24h then GREEN after window', async () => {
    const clean = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(clean, 'R097').result).toBe('GREEN')

    await pool().query(
      `INSERT INTO fin.cutover_quiet_period_events (
         id, environment, kind, source_file, message, payload, occurred_at
       ) VALUES ($1, 'LIVE', 'COMMERCIAL_WRITE_ATTEMPT', 'billing/events.js', 'denied', '{}'::jsonb, $2::timestamptz)`,
      [randomUUID(), NOW],
    )
    const drifted = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(drifted, 'R097').result).toBe('DRIFT')
    const stored = await pool().query(
      `SELECT drift_action FROM fin.reconciliation_checks WHERE id = $1`,
      [resultOf(drifted, 'R097').checkId],
    )
    expect(stored.rows[0].drift_action).toBe('BLOCK_NEW_ISSUANCE')

    const later = await runReconciliation(pool(), { now: '2026-08-20T12:00:00.000Z' })
    expect(resultOf(later, 'R097').result).toBe('GREEN')
  })

  it('R098 DRIFT when FIN_ONLY is younger than 90 days and GREEN when 90 days have elapsed', async () => {
    await setMode(pool(), { mode: 'FIN_ONLY', activatedAt: '2026-08-08T12:00:00.000Z' })
    const young = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(young, 'R098').result).toBe('DRIFT')

    await setMode(pool(), { mode: 'FIN_ONLY', activatedAt: '2026-05-18T12:00:00.000Z' })
    const aged = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(aged, 'R098').result).toBe('GREEN')

    await setMode(pool(), { mode: 'OFF', activatedAt: NOW })
    const off = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(off, 'R098').result).toBe('GREEN')
  })

  it('R099 DRIFT when FIN_ONLY has no 30-day-fresh attestation and GREEN when one exists', async () => {
    await setMode(pool(), { mode: 'FIN_ONLY', activatedAt: NOW })
    const missing = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(missing, 'R099').result).toBe('DRIFT')

    await pool().query(
      `INSERT INTO fin.cutover_parity_attestations (
         id, environment, burn_in_days, total_rows_checked, total_rows_drifted,
         outstanding_corrections, attestation_hash, signed_by_email, signed_at, created_at
       ) VALUES (
         $1, 'LIVE', 30, 0, 0, 0, $2, 'finance@example.test', $3::timestamptz, $3::timestamptz
       )`,
      [randomUUID(), `hash-r099-${randomUUID()}`, NOW],
    )
    const fresh = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(fresh, 'R099').result).toBe('GREEN')

    await setMode(pool(), { mode: 'OFF', activatedAt: NOW })
    const off = await runReconciliation(pool(), { now: NOW })
    expect(resultOf(off, 'R099').result).toBe('GREEN')
  })
})
