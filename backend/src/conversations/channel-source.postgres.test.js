import { afterAll, beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { skipIfNoPostgres, withTestDb } from '../testing/postgres.js'
import { isAutoMigration } from '../persistence/migrations/runner.js'
import { closeDb, configure, findOne, insert } from '../db.js'
import {
  conversationChannelSourceFields,
  readChannel,
  readSource,
  readSourceChannel,
} from './channel-source.js'

const { Client, Pool } = pg
const databaseUrl = process.env.TEST_DATABASE_URL
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../persistence/migrations')
const MIGRATION_FILE = '318_conversations_channel_source_split.sql'

function migrationSort(a, b) {
  const na = parseInt(a.match(/^\d+/)?.[0] || '0', 10)
  const nb = parseInt(b.match(/^\d+/)?.[0] || '0', 10)
  return na - nb
}

async function createTestDatabase() {
  const testDbName = `test_conv_chsrc_${Date.now()}_${randomUUID().slice(0, 8)}`.replace(/-/g, '_')
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
      if (file === MIGRATION_FILE || file.startsWith('318_')) break
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

  it('backfills channel + source from source_channel and is idempotent', async () => {
    const samples = [
      { id: 'sc-whatsapp', source_channel: 'whatsapp', channel: 'whatsapp', source: 'direct' },
      { id: 'sc-wa-bazaar', source_channel: 'whatsapp_bazaar', channel: 'whatsapp', source: 'bazaar' },
      { id: 'sc-email-pf', source_channel: 'email_property_finder', channel: 'email', source: 'property_finder' },
      { id: 'sc-sms', source_channel: 'sms', channel: 'sms', source: 'direct' },
      { id: 'sc-ig-comment', source_channel: 'instagram_comment', channel: 'instagram_dm', source: 'direct' },
      { id: 'sc-ig-dm', source_channel: 'ig_dm_thread', channel: 'instagram_dm', source: 'direct' },
      { id: 'sc-fb', source_channel: 'facebook_comment', channel: 'facebook_messenger', source: 'direct' },
      { id: 'sc-fb-underscore', source_channel: 'fb_inbox', channel: 'facebook_messenger', source: 'direct' },
      { id: 'sc-tiktok-olx', source_channel: 'tiktok_olx', channel: 'tiktok', source: 'olx' },
      { id: 'sc-x-dm', source_channel: 'x_dm', channel: 'x_dm', source: 'direct' },
      { id: 'sc-twitter', source_channel: 'twitter_dm', channel: 'x_dm', source: 'direct' },
      { id: 'sc-linkedin', source_channel: 'linkedin_comment', channel: 'linkedin', source: 'direct' },
      { id: 'sc-telegram', source_channel: 'telegram', channel: 'telegram', source: 'direct' },
      { id: 'sc-x-mention', source_channel: 'x_mention', channel: 'direct', source: 'direct' },
      { id: 'sc-bayut', source_channel: 'email_bayut', channel: 'email', source: 'bayut' },
      { id: 'sc-dubizzle', source_channel: 'sms_dubizzle', channel: 'sms', source: 'dubizzle' },
    ]

    for (const sample of samples) {
      await client.query(
        `INSERT INTO conversations (id, source_channel, data) VALUES ($1, $2, '{}'::jsonb)`,
        [sample.id, sample.source_channel],
      )
    }

    const before = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'conversations'
         AND column_name IN ('channel', 'source')
       ORDER BY column_name`,
    )
    expect(before.rows.map((r) => r.column_name)).toEqual([])

    const sql = await readFile(join(migrationsDir, MIGRATION_FILE), 'utf8')
    await client.query(sql)
    await client.query(sql) // idempotent re-run

    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'conversations'
         AND column_name IN ('channel', 'source', 'source_channel')
       ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual(['channel', 'source', 'source_channel'])

    for (const sample of samples) {
      const { rows } = await client.query(
        `SELECT channel, source, source_channel FROM conversations WHERE id = $1`,
        [sample.id],
      )
      expect(rows[0]).toEqual({
        channel: sample.channel,
        source: sample.source,
        source_channel: sample.source_channel,
      })
    }

    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'conversations'
         AND indexname IN ('idx_conversations_channel', 'idx_conversations_source')
       ORDER BY indexname`,
    )
    expect(indexes.rows.map((r) => r.indexname)).toEqual([
      'idx_conversations_channel',
      'idx_conversations_source',
    ])
  })

  it('dual-reads old source_channel-only rows and new channel+source rows', async () => {
    // Old-code write after migration: only source_channel is populated.
    await client.query(
      `INSERT INTO conversations (id, source_channel, channel, source, data)
       VALUES ('legacy-write', 'instagram_comment', NULL, NULL, '{}'::jsonb)`,
    )
    const legacy = (await client.query(
      `SELECT channel, source, source_channel FROM conversations WHERE id = 'legacy-write'`,
    )).rows[0]
    expect(legacy.channel).toBeNull()
    expect(legacy.source).toBeNull()
    expect(readChannel(legacy)).toBe('instagram_dm')
    expect(readSource(legacy)).toBe('direct')
    expect(readSourceChannel(legacy)).toBe('instagram_comment')

    // New-code write: all three columns populated.
    await client.query(
      `INSERT INTO conversations (id, channel, source, source_channel, data)
       VALUES ('new-both', 'email', 'property_finder', 'email:property_finder', '{}'::jsonb)`,
    )
    const fresh = (await client.query(
      `SELECT channel, source, source_channel FROM conversations WHERE id = 'new-both'`,
    )).rows[0]
    expect(fresh).toEqual({
      channel: 'email',
      source: 'property_finder',
      source_channel: 'email:property_finder',
    })
    expect(readChannel(fresh)).toBe('email')
    expect(readSource(fresh)).toBe('property_finder')
    expect(readSourceChannel(fresh)).toBe('email:property_finder')

    // Re-running the migration backfills leftover NULL channel rows.
    const sql = await readFile(join(migrationsDir, MIGRATION_FILE), 'utf8')
    await client.query(sql)
    const backfilled = (await client.query(
      `SELECT channel, source, source_channel FROM conversations WHERE id = 'legacy-write'`,
    )).rows[0]
    expect(backfilled).toEqual({
      channel: 'instagram_dm',
      source: 'direct',
      source_channel: 'instagram_comment',
    })
  })
})

skipIfNoPostgres()('conversations channel/source DAL dual-write', () => {
  it('persists channel, source, and source_channel as real columns', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      try {
        const id = randomUUID()
        const fields = conversationChannelSourceFields({ channel: 'whatsapp', source: 'bazaar' })
        await insert('conversations', {
          id,
          contact_name: 'Dual Write',
          ...fields,
        })

        const pool = new Pool({ connectionString: url })
        try {
          const { rows } = await pool.query(
            `SELECT channel, source, source_channel FROM conversations WHERE id = $1`,
            [id],
          )
          expect(rows[0]).toEqual({
            channel: 'whatsapp',
            source: 'bazaar',
            source_channel: 'whatsapp:bazaar',
          })
        } finally {
          await pool.end()
        }

        const found = await findOne('conversations', (c) => c.id === id)
        expect(readChannel(found)).toBe('whatsapp')
        expect(readSource(found)).toBe('bazaar')
        expect(readSourceChannel(found)).toBe('whatsapp:bazaar')
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
