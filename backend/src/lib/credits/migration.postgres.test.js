import { afterAll, beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { skipIfNoPostgres } from '../../testing/postgres.js'
import { isAutoMigration } from '../../persistence/migrations/runner.js'
import { CHECKS } from '../../fin/reconciliation/checks.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

function migrationSort(a, b) {
  const na = parseInt(a.match(/^\d+/)?.[0] || '0', 10)
  const nb = parseInt(b.match(/^\d+/)?.[0] || '0', 10)
  return na - nb
}

async function createTestDatabase() {
  const testDbName = `test_credits_mig_${Date.now()}_${randomUUID().slice(0, 8)}`.replace(/-/g, '_')
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'
  const admin = new Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE ${testDbName}`)
  } finally {
    await admin.end()
  }
  const testUrl = new URL(databaseUrl)
  testUrl.pathname = `/${testDbName}`
  return { testDbName, testUrl: testUrl.toString() }
}

async function dropTestDatabase(testDbName) {
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'
  const admin = new Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${testDbName}`)
  } finally {
    await admin.end()
  }
}

skipIfNoPostgres()('credits migration 300+301', () => {
  let client
  let testDbName

  beforeAll(async () => {
    const created = await createTestDatabase()
    testDbName = created.testDbName
    client = new Client({ connectionString: created.testUrl })
    await client.connect()
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis')

    const files = (await readdir(migrationsDir))
      .filter((f) => isAutoMigration(f))
      .sort(migrationSort)

    for (const file of files) {
      if (file.startsWith('301_')) break
      const sql = await readFile(join(migrationsDir, file), 'utf8')
      try {
        await client.query(sql)
      } catch (error) {
        const roleRace = error.code === '23505' && /pg_authid_rolname_index|fin_migrator/.test(String(error.message || ''))
        if (!roleRace) throw error
      }
    }
  }, 180_000)

  afterAll(async () => {
    if (client) await client.end().catch(() => {})
    if (testDbName) await dropTestDatabase(testDbName)
  })

  it('copies ai_credit_* into credit_* and R110 is GREEN', async () => {
    const scopeId = randomUUID()
    await client.query(
      `INSERT INTO users (id, email, name, data) VALUES ($1, $2, 'Mig Agent', '{}'::jsonb)`,
      [scopeId, `mig-${scopeId}@example.test`],
    )
    await client.query(
      `INSERT INTO public.ai_credit_balances (id, scope, scope_id, credits_remaining, credits_reserved, data)
       VALUES ($1, 'agent', $2, 12.50, 0, '{}'::jsonb)`,
      [`agent:${scopeId}`, scopeId],
    )
    const topUpId = randomUUID()
    const consumeId = randomUUID()
    await client.query(
      `INSERT INTO public.ai_credit_transactions (
         id, scope, scope_id, type, amount, description, related_draft_id, data
       ) VALUES
         ($1, 'agent', $2, 'top_up', 20, 'seed topup', null, '{}'::jsonb),
         ($3, 'agent', $2, 'consumption', 7.5, 'seed consume', $4, '{}'::jsonb)`,
      [topUpId, scopeId, consumeId, randomUUID()],
    )

    const sql301 = await readFile(join(migrationsDir, '301_credits_backfill_from_wa.sql'), 'utf8')
    await client.query(sql301)

    const renamed = await client.query(
      `SELECT to_regclass('public.ai_credit_balances') AS orig,
              to_regclass('public.ai_credit_balances_deprecated_20260902') AS deprecated`,
    )
    expect(renamed.rows[0].orig).toBeNull()
    expect(renamed.rows[0].deprecated).toBeTruthy()

    const wallet = await client.query(
      `SELECT credits_remaining, credits_reserved, scope_id
         FROM public.credit_wallets WHERE scope = 'agent' AND scope_id = $1`,
      [scopeId],
    )
    expect(wallet.rows).toHaveLength(1)
    expect(Number(wallet.rows[0].credits_remaining)).toBe(1250)

    const grants = await client.query(
      `SELECT SUM(amount)::bigint AS qty FROM public.credit_grants g
         JOIN public.credit_wallets w ON w.tenant_id = g.tenant_id
        WHERE w.scope_id = $1`,
      [scopeId],
    )
    const consumptions = await client.query(
      `SELECT SUM(credits_amount)::bigint AS qty FROM public.credit_consumptions c
         JOIN public.credit_wallets w ON w.tenant_id = c.tenant_id
        WHERE w.scope_id = $1`,
      [scopeId],
    )
    expect(Number(wallet.rows[0].credits_remaining)).toBe(
      Number(grants.rows[0].qty) - Number(consumptions.rows[0].qty),
    )

    const r110 = CHECKS.find((c) => c.check_code === 'R110')
    const source = await client.query(r110.source_query)
    const comparison = await client.query(r110.comparison_query)
    const src = Object.fromEntries(source.rows.map((r) => [r.entity_id, Number(r.qty)]))
    const cmp = Object.fromEntries(comparison.rows.map((r) => [r.entity_id, Number(r.qty)]))
    for (const id of Object.keys(src)) {
      expect(src[id]).toBe(cmp[id])
    }
  })
})
