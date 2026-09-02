/**
 * Double-entry mirror worker. Every 30s (caller schedules).
 * Advisory lock CREDITS_FIN_MIRROR = 1023 (spec 1021 is already FIN_VENDOR_STATEMENT_RECON).
 *
 * Deviation: postings live on the tenant CUSTOMER book (single-book
 * containment I-02). Grant: DR ISSUANCE / CR DEFERRED_REVENUE.
 * Consume: DR DEFERRED_REVENUE / CR RECOGNIZED_REVENUE.
 */
import { randomUUID } from 'node:crypto'
import { FIN_CREDITS_FIN_MIRROR } from '../../fin/foundation/advisory-locks.js'
import { insertLedgerTx, insertPostingPair, loadAccounts, loadBook } from '../../fin/ledger/write.js'
import { perCreditMicroUsd } from './pricing.js'

const BATCH = 500

async function resolveBookId(client, wallet) {
  const tenantKey = wallet.fin_tenant_id || wallet.tenant_id
  const { rows } = await client.query(
    `SELECT id FROM fin.ledger_books
      WHERE tenant_id = $1 AND book_type = 'CUSTOMER'
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantKey],
  )
  if (rows[0]) return rows[0].id
  const platform = await client.query(
    `SELECT id FROM fin.ledger_books WHERE book_type = 'PLATFORM' LIMIT 1`,
  )
  return platform.rows[0]?.id || null
}

function mirrorUnits(creditsAmount, actualCostMicroUsd) {
  if (actualCostMicroUsd != null && Number(actualCostMicroUsd) > 0) {
    return Math.max(1, Math.trunc(Number(actualCostMicroUsd)))
  }
  return Math.max(1, Math.trunc(Number(creditsAmount) * perCreditMicroUsd()))
}

async function mirrorOne(client, {
  environment, bookId, shape, sourceType, sourceId, units, now,
}) {
  const book = await loadBook(client, bookId)
  if (!book) return { skipped: true, reason: 'book_missing' }
  const env = environment || book.environment || book.tenant_environment || 'LIVE'
  const accounts = await loadAccounts(client, bookId)
  if (shape === 'GRANT_MIRROR' && (!accounts.ISSUANCE || !accounts.DEFERRED_REVENUE)) {
    return { skipped: true, reason: 'accounts_missing' }
  }
  if (shape === 'CONSUME_MIRROR' && (!accounts.DEFERRED_REVENUE || !accounts.RECOGNIZED_REVENUE)) {
    return { skipped: true, reason: 'accounts_missing' }
  }
  try {
    const txId = await insertLedgerTx(client, {
      environment: env,
      bookId,
      shape,
      economicSourceType: sourceType,
      economicSourceId: sourceId,
      actorType: 'SYSTEM',
      actorId: null,
      reasonCode: 'CREDIT_MIRROR',
      idempotencyKeyId: null,
      now,
    })
    if (shape === 'GRANT_MIRROR') {
      await insertPostingPair(client, {
        environment: env,
        transactionId: txId,
        bookId,
        accounts,
        debitType: 'ISSUANCE',
        creditType: 'DEFERRED_REVENUE',
        units,
        now,
      })
    } else {
      await insertPostingPair(client, {
        environment: env,
        transactionId: txId,
        bookId,
        accounts,
        debitType: 'DEFERRED_REVENUE',
        creditType: 'RECOGNIZED_REVENUE',
        units,
        now,
      })
    }
    return { ok: true, transactionId: txId }
  } catch (error) {
    if (error.code === '23505') return { skipped: true, reason: 'already_mirrored' }
    throw error
  }
}

export async function runCreditFinMirrorTick({
  pool,
  now = new Date().toISOString(),
  limit = BATCH,
  environment = 'LIVE',
} = {}) {
  const lockClient = await pool.connect()
  try {
    const locked = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [FIN_CREDITS_FIN_MIRROR, 0],
    )
    if (!locked.rows[0].ok) {
      return { skipped: true, processed: 0, reason: 'CREDITS_FIN_MIRROR_LOCK_HELD' }
    }
    try {
      const grants = await lockClient.query(
        `SELECT g.*, w.fin_tenant_id, w.tenant_id AS wallet_tenant_id
           FROM public.credit_grants g
           JOIN public.credit_wallets w ON w.tenant_id = g.tenant_id
          WHERE NOT EXISTS (
            SELECT 1 FROM fin.ledger_transactions t
             WHERE t.economic_source_type = 'credit_grants'
               AND t.economic_source_id = g.id
               AND t.shape = 'GRANT_MIRROR'
          )
          ORDER BY g.granted_at ASC
          LIMIT $1`,
        [limit],
      )
      const remaining = Math.max(0, limit - grants.rows.length)
      const consumptions = remaining
        ? await lockClient.query(
          `SELECT c.*, w.fin_tenant_id, w.tenant_id AS wallet_tenant_id
             FROM public.credit_consumptions c
             JOIN public.credit_wallets w ON w.tenant_id = c.tenant_id
            WHERE NOT EXISTS (
              SELECT 1 FROM fin.ledger_transactions t
               WHERE t.economic_source_type = 'credit_consumptions'
                 AND t.economic_source_id = c.id
                 AND t.shape = 'CONSUME_MIRROR'
            )
            ORDER BY c.consumed_at ASC
            LIMIT $1`,
          [remaining],
        )
        : { rows: [] }

      let processed = 0
      let skipped = 0
      for (const row of grants.rows) {
        await lockClient.query('BEGIN')
        try {
          const bookId = await resolveBookId(lockClient, row)
          if (!bookId) {
            skipped += 1
            await lockClient.query('ROLLBACK')
            continue
          }
          const result = await mirrorOne(lockClient, {
            environment,
            bookId,
            shape: 'GRANT_MIRROR',
            sourceType: 'credit_grants',
            sourceId: row.id,
            units: mirrorUnits(row.amount, null),
            now,
          })
          await lockClient.query('COMMIT')
          if (result.ok) processed += 1
          else skipped += 1
        } catch (error) {
          await lockClient.query('ROLLBACK').catch(() => {})
          throw error
        }
      }
      for (const row of consumptions.rows) {
        await lockClient.query('BEGIN')
        try {
          const bookId = await resolveBookId(lockClient, row)
          if (!bookId) {
            skipped += 1
            await lockClient.query('ROLLBACK')
            continue
          }
          const result = await mirrorOne(lockClient, {
            environment,
            bookId,
            shape: 'CONSUME_MIRROR',
            sourceType: 'credit_consumptions',
            sourceId: row.id,
            units: mirrorUnits(row.credits_amount, row.actual_cost_micro_usd),
            now,
          })
          await lockClient.query('COMMIT')
          if (result.ok) processed += 1
          else skipped += 1
        } catch (error) {
          await lockClient.query('ROLLBACK').catch(() => {})
          throw error
        }
      }
      return { skipped: false, processed, skippedRows: skipped, lockId: randomUUID() }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [FIN_CREDITS_FIN_MIRROR, 0])
    }
  } finally {
    lockClient.release()
  }
}
