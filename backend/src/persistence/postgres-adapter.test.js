/**
 * Postgres adapter integration tests.
 *
 * These tests require a running Postgres instance and TEST_DATABASE_URL to be set.
 * If TEST_DATABASE_URL is missing, the suite is skipped.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import pg from 'pg'
import * as postgresAdapter from './postgres-adapter.js'
import { skipIfNoPostgres } from '../testing/postgres.js'

const { Client } = pg

const databaseUrl = process.env.TEST_DATABASE_URL

async function createTestDatabase() {
  const baseUrl = new URL(databaseUrl)
  const testDbName = `rebazaar_persistence_test_${Date.now()}_${randomUUID().slice(0, 8)}`
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'

  const client = new Client({ connectionString: adminUrl.toString() })
  await client.connect()
  try {
    // Force disconnect any existing connections to the test DB if it exists.
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`)
    await client.query(`CREATE DATABASE ${testDbName}`)
  } finally {
    await client.end()
  }

  const testUrl = new URL(databaseUrl)
  testUrl.pathname = `/${testDbName}`
  return { testUrl: testUrl.toString(), testDbName }
}

async function dropTestDatabase(testDbName) {
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'
  const client = new Client({ connectionString: adminUrl.toString() })
  await client.connect()
  try {
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`)
  } finally {
    await client.end()
  }
}

skipIfNoPostgres()('Postgres adapter', () => {
  let testDatabaseUrl = null
  let testDbName = null

  beforeAll(async () => {
    const created = await createTestDatabase()
    testDatabaseUrl = created.testUrl
    testDbName = created.testDbName
    postgresAdapter.configure({ databaseUrl: testDatabaseUrl, force: true })
    await postgresAdapter.loadDb()
  })

  afterAll(async () => {
    await postgresAdapter.closeDb()
    if (testDbName) {
      await dropTestDatabase(testDbName)
    }
  })

  beforeEach(async () => {
    const pool = postgresAdapter.getPool()
    await pool.query("DELETE FROM legacy_collections WHERE collection LIKE 'test_%'")
  })

  it('inserts and reads a record', async () => {
    const item = await postgresAdapter.insert('test_items', { name: 'alpha', value: 1 })
    expect(item.id).toBeTruthy()
    expect(item.name).toBe('alpha')

    const found = await postgresAdapter.findOne('test_items', (i) => i.id === item.id)
    expect(found).toBeTruthy()
    expect(found.name).toBe('alpha')
  })

  it('finds all records with a filter', async () => {
    await postgresAdapter.insert('test_items', { name: 'alpha', value: 1 })
    await postgresAdapter.insert('test_items', { name: 'beta', value: 2 })
    await postgresAdapter.insert('test_items', { name: 'gamma', value: 3 })

    const filtered = await postgresAdapter.findAll('test_items', (i) => i.value > 1)
    expect(filtered).toHaveLength(2)
  })

  it('updates records', async () => {
    const item = await postgresAdapter.insert('test_update_items', { name: 'a', value: 1 })
    const updated = await postgresAdapter.update(
      'test_update_items',
      (i) => i.id === item.id,
      (i) => ({ ...i, value: 99 }),
    )
    expect(updated).toBe(1)

    const found = await postgresAdapter.findOne('test_update_items', (i) => i.id === item.id)
    expect(found.value).toBe(99)
  })

  it('removes records', async () => {
    const keep = await postgresAdapter.insert('test_remove_items', { name: 'keep' })
    const gone = await postgresAdapter.insert('test_remove_items', { name: 'gone' })

    const removed = await postgresAdapter.remove('test_remove_items', (i) => i.id === gone.id)
    expect(removed).toBe(1)

    const remaining = await postgresAdapter.findAll('test_remove_items')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })

  it('upserts on duplicate id', async () => {
    const item = await postgresAdapter.insert('test_upsert_items', { id: 'shared-id', name: 'first' })
    expect(item.name).toBe('first')

    const updated = await postgresAdapter.insert('test_upsert_items', { id: 'shared-id', name: 'second' })
    expect(updated.name).toBe('second')

    const all = await postgresAdapter.findAll('test_upsert_items')
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('second')
  })

  it('runs transactions', async () => {
    const result = await postgresAdapter.transaction(async (client) => {
      const { rows } = await client.query('SELECT 1 + 1 AS sum')
      return rows[0].sum
    })
    expect(result).toBe(2)
  })

  describe('structured filter pushdown', () => {
    // website_analytics is a real mapped table with a NOT NULL, un-FK'd
    // agency_id and a settable created_at — ideal for exercising the WHERE
    // builder without seeding parent rows.
    const agencyA = `agc_pushdown_a_${randomUUID().slice(0, 8)}`
    const agencyB = `agc_pushdown_b_${randomUUID().slice(0, 8)}`

    beforeAll(async () => {
      await postgresAdapter.insert('website_analytics', {
        agency_id: agencyA, page: '/one', referrer: 'google', created_at: '2026-01-10T00:00:00Z',
      })
      await postgresAdapter.insert('website_analytics', {
        agency_id: agencyA, page: '/two', created_at: '2026-02-10T00:00:00Z',
      })
      await postgresAdapter.insert('website_analytics', {
        agency_id: agencyB, page: '/three', referrer: 'bing', created_at: '2026-01-15T00:00:00Z',
      })
    })

    it('applies an equality filter in SQL', async () => {
      const rows = await postgresAdapter.findAll('website_analytics', { agency_id: agencyA })
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.agency_id === agencyA)).toBe(true)
    })

    it('applies an IN (array) filter in SQL', async () => {
      const both = await postgresAdapter.findAll('website_analytics', { agency_id: [agencyA, agencyB] })
      expect(both.filter((r) => [agencyA, agencyB].includes(r.agency_id))).toHaveLength(3)

      const justB = await postgresAdapter.findAll('website_analytics', { agency_id: [agencyB] })
      expect(justB).toHaveLength(1)
      expect(justB[0].agency_id).toBe(agencyB)
    })

    it('matches nothing for an empty array', async () => {
      const rows = await postgresAdapter.findAll('website_analytics', { agency_id: [] })
      expect(rows).toHaveLength(0)
    })

    it('applies a half-open date range in SQL', async () => {
      const rows = await postgresAdapter.findAll('website_analytics', {
        agency_id: agencyA,
        created_at: { gte: '2026-02-01T00:00:00Z', lt: '2026-03-01T00:00:00Z' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].page).toBe('/two')
    })

    it('applies an IS NULL filter in SQL', async () => {
      const rows = await postgresAdapter.findAll('website_analytics', {
        agency_id: agencyA,
        referrer: null,
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].page).toBe('/two')
    })

    it('rejects a filter on a non-column field', async () => {
      await expect(
        postgresAdapter.findAll('website_analytics', { not_a_column: 'x' }),
      ).rejects.toThrow(/not a mapped column/)
    })

    it('still honours a function filter as an in-JS predicate', async () => {
      const rows = await postgresAdapter.findAll(
        'website_analytics',
        (r) => r.agency_id === agencyB,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].agency_id).toBe(agencyB)
    })
  })
})
