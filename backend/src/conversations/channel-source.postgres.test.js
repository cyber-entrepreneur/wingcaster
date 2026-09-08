import { afterAll, beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { skipIfNoPostgres } from '../testing/postgres.js'
import { isAutoMigration } from '../persistence/migrations/runner.js'
import {
  conversationChannel,
  conversationSource,
  dualWriteChannelSource,
} from './channel-source.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../persistence/migrations')
const MIGRATION_318 = '318_conversations_channel_source_split.sql'

function migrationSort(a, b) {
  const na = parseInt(a.match(/^\d+/)?.[0] || '0', 10)
  const nb = parseInt(b.match(/^\d+/)?.[0] || '0', 10)
  return na - nb
}

async function createTestDatabase() {
  const testDbName = `test_chsrc_${Date.now()}_${randomUUID().slice(0, 8)}`.replace(/-/g, '_')
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

skipIfNoPostgres()('conversations channel/source split (migration 318)', () => {
  let client
  let testDbName
  let sql318

  beforeAll(async () => {
    const created = await createTestDatabase()
    testDbName = created.testDbName
    client = new Client({ connectionString: created.testUrl })
    await client.connect()
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis')

    const files = (await readdir(migrationsDir))
      .filter((f) => isAutoMigration(f))
      .sort(migrationSort)

    // Apply everything before 318 so we can seed legacy source_channel rows first.
    for (const file of files) {
      if (file.startsWith('318_')) break
      const sql = await readFile(join(migrationsDir, file), 'utf8')
      try {
        await client.query(sql)
      } catch (error) {
        const roleRace = error.code === '23505' && /pg_authid_rolename_index|fin_migrator/.test(String(error.message || ''))
        if (!roleRace) throw error
      }
    }

    sql318 = await readFile(join(migrationsDir, MIGRATION_318), 'utf8')
  }, 180_000)

  afterAll(async () => {
    if (client) await client.end().catch(() => {})
    if (testDbName) await dropTestDatabase(testDbName)
  })

  it('backfills channel + source from source_channel and is idempotent', async () => {
    const contactId = randomUUID()
    const now = new Date().toISOString()

    await client.query(
      `INSERT INTO contacts (id, email, phone, name, data)
       VALUES ($1, $2, '+971500000001', 'Lead', '{}'::jsonb)`,
      [contactId, `lead-${contactId}@example.test`],
    )

    const rows = [
      { id: randomUUID(), source_channel: 'whatsapp_bazaar' },
      { id: randomUUID(), source_channel: 'email_bayut' },
      { id: randomUUID(), source_channel: 'sms_property_finder' },
      { id: randomUUID(), source_channel: 'instagram_dubizzle' },
      { id: randomUUID(), source_channel: 'web_olx' },
      { id: randomUUID(), source_channel: 'facebook_messenger' },
      { id: randomUUID(), source_channel: 'tiktok' },
      { id: randomUUID(), source_channel: 'x_dm' },
      { id: randomUUID(), source_channel: 'linkedin' },
      { id: randomUUID(), source_channel: 'telegram' },
      { id: randomUUID(), source_channel: 'unknown_portal' },
    ]

    for (const row of rows) {
      await client.query(
        `INSERT INTO conversations (
           id, contact_id, source_channel, status, created_at, updated_at, data
         ) VALUES ($1, $2, $3, 'open', $4, $4, '{}'::jsonb)`,
        [row.id, contactId, row.source_channel, now],
      )
    }

    // Pre-318: channel/source columns must not exist yet.
    const preCols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND column_name IN ('channel', 'source')`,
    )
    expect(preCols.rows).toHaveLength(0)

    await client.query(sql318)
    await client.query(sql318) // idempotent re-run

    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND column_name IN ('channel', 'source')
        ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual(['channel', 'source'])

    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'conversations'
          AND indexname IN ('idx_conversations_channel', 'idx_conversations_source')
        ORDER BY indexname`,
    )
    expect(indexes.rows.map((r) => r.indexname)).toEqual([
      'idx_conversations_channel',
      'idx_conversations_source',
    ])

    // source_channel must still exist (do not drop during migration window).
    const legacy = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND column_name = 'source_channel'`,
    )
    expect(legacy.rows).toHaveLength(1)

    const expected = {
      whatsapp_bazaar: { channel: 'whatsapp', source: 'bazaar' },
      email_bayut: { channel: 'email', source: 'bayut' },
      sms_property_finder: { channel: 'sms', source: 'property_finder' },
      instagram_dubizzle: { channel: 'instagram_dm', source: 'dubizzle' },
      web_olx: { channel: 'direct', source: 'olx' },
      facebook_messenger: { channel: 'facebook_messenger', source: 'direct' },
      tiktok: { channel: 'tiktok', source: 'direct' },
      x_dm: { channel: 'x_dm', source: 'direct' },
      linkedin: { channel: 'linkedin', source: 'direct' },
      telegram: { channel: 'telegram', source: 'direct' },
      unknown_portal: { channel: 'direct', source: 'direct' },
    }

    const result = await client.query(
      `SELECT source_channel, channel, source FROM conversations WHERE contact_id = $1`,
      [contactId],
    )
    expect(result.rows).toHaveLength(rows.length)
    for (const row of result.rows) {
      expect(row).toMatchObject(expected[row.source_channel])
    }
  })

  it('supports dual-read fallback and dual-write after columns exist', async () => {
    // Ensure 318 is applied (idempotent if prior test already ran it).
    await client.query(sql318)

    const contactId = randomUUID()
    const convId = randomUUID()
    const now = new Date().toISOString()

    await client.query(
      `INSERT INTO contacts (id, email, phone, name, data)
       VALUES ($1, $2, '+971500000002', 'Lead2', '{}'::jsonb)`,
      [contactId, `lead2-${contactId}@example.test`],
    )
    // Simulate a legacy writer that only stamped source_channel after columns exist.
    await client.query(
      `INSERT INTO conversations (
         id, contact_id, source_channel, channel, source, status, created_at, updated_at, data
       ) VALUES ($1, $2, 'whatsapp_bazaar', NULL, NULL, 'open', $3, $3, '{}'::jsonb)`,
      [convId, contactId, now],
    )

    const { rows } = await client.query(
      `SELECT source_channel, channel, source FROM conversations WHERE id = $1`,
      [convId],
    )
    expect(conversationChannel(rows[0])).toBe('whatsapp')
    expect(conversationSource(rows[0])).toBe('bazaar')

    const dual = dualWriteChannelSource({ channel: 'email', source: 'bayut' })
    await client.query(
      `UPDATE conversations
          SET source_channel = $2, channel = $3, source = $4, updated_at = $5
        WHERE id = $1`,
      [convId, dual.source_channel, dual.channel, dual.source, now],
    )
    const updated = await client.query(
      `SELECT source_channel, channel, source FROM conversations WHERE id = $1`,
      [convId],
    )
    expect(updated.rows[0]).toEqual({
      source_channel: 'email',
      channel: 'email',
      source: 'bayut',
    })
  })
})
