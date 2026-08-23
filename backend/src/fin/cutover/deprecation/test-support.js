/**
 * Real-Postgres — deprecation test helpers.
 */
import { randomUUID } from 'node:crypto'

export async function setFinOnlyMode(pool, {
  activatedAt = '2026-05-18T12:00:00.000Z',
  attestationId = null,
} = {}) {
  await pool.query(
    'ALTER TABLE fin.cutover_active_environment DISABLE TRIGGER trg_cutover_active_environment_fin_only',
  )
  await pool.query(`DELETE FROM fin.cutover_active_environment WHERE environment = 'LIVE'`)
  await pool.query(
    `INSERT INTO fin.cutover_active_environment (
       environment, mode, attestation_id, activated_at,
       activated_by_email, activated_by_actor_type, updated_at
     ) VALUES (
       'LIVE', 'FIN_ONLY', $1, $2::timestamptz,
       'test@example.test', 'SYSTEM', $2::timestamptz
     )`,
    [attestationId, activatedAt],
  )
  await pool.query(
    'ALTER TABLE fin.cutover_active_environment ENABLE TRIGGER trg_cutover_active_environment_fin_only',
  )
}

export async function seedFreshAttestation(pool, { now }) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO fin.cutover_parity_attestations (
       id, environment, burn_in_days, total_rows_checked, total_rows_drifted,
       outstanding_corrections, attestation_hash, signed_by_email, signed_at, created_at
     ) VALUES (
       $1, 'LIVE', 30, 0, 0, 0, $2, 'finance@example.test', $3::timestamptz, $3::timestamptz
     )`,
    [id, `hash-${id}`, now],
  )
  return id
}

export const SNAPSHOT_NOTE = 'snap-prod-20260817@2026-08-17T08:00:00Z, restored to staging 2026-08-18 by ops'

export const DEPRECATE_ACTOR = {
  actorType: 'USER',
  actorId: '00000000-0000-0000-0000-0000000000a1',
  actorEmail: 'admin@example.test',
}
