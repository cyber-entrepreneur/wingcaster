/**
 * Wave 1C — Real-PG tests for creative tables, RLS, generation, approval gate.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import {
  generateAiCreative,
  approveCreative,
  buildPublishPayloads,
  assertPublishable,
} from './service.js'
import { loadCreativeBundle } from './repository.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE1C_FILES = [
  '620_creative_enums.sql',
  '621_creative_tables.sql',
  '622_creative_rls.sql',
]

vi.mock('../../lib/credits/ai-producers/create-ai-post-variants.js', () => ({
  produceAiPostVariants: vi.fn().mockResolvedValue({
    ok: true,
    variants: [
      { tone: 'warm', label: 'Warm lifestyle', captions: { instagram: 'Cap warm' } },
      { tone: 'professional', label: 'Professional', captions: { instagram: 'Cap pro' } },
      { tone: 'concise', label: 'Concise', captions: { instagram: 'Cap short' } },
      { tone: 'luxury', label: 'Luxury', captions: { instagram: 'Cap lux' } },
    ],
    provider: 'openai',
    cost_micro_usd: 0,
    tokens_in: 0,
    tokens_out: 0,
  }),
}))

vi.mock('./renderer-providers.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createRendererProvider: () => ({
      name: 'local',
      renderRendition: async ({ platform }) => ({
        asset_url: `/uploads/test/${platform}.png`,
        width: 1080,
        height: platform.includes('story') ? 1920 : 1080,
        provider: 'local',
      }),
    }),
  }
})

async function asGrowthOsRole(pool, gucs, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE growth_os_app_role')
    for (const [key, value] of Object.entries(gucs || {})) {
      await client.query('SELECT set_config($1, $2, true)', [key, String(value)])
    }
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* aborted */ }
    throw error
  } finally {
    client.release()
  }
}

async function seedTenant(pool, { agencyId, agentId, userId, listingId }) {
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Creative test', '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@creative.test`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, owner_id, name, slug, data)
     VALUES ($1, $2, 'Creative Agency', $3, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [agencyId, userId, `agency-${agencyId.slice(0, 8)}`],
  )
  await pool.query(
    `INSERT INTO public.agents (id, user_id, agency_id, email, name, data)
     VALUES ($1, $2, $3, $4, 'Agent', '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, agencyId, `${agentId}@creative.test`],
  )
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, description, data)
     VALUES ($1, $2, 'Test listing', 'Bright 2-bed in Hamra', '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [listingId, agentId],
  )
}

const TEMPLATE = {
  id: 'platform_editorial_v1',
  engine: 'builtin',
  name: 'Editorial',
  base_canvas: { width: 1080, height: 1080 },
  layers: [],
}

skipIfNoPostgres()('Wave 1C creative postgres', () => {
  it('migrations are idempotent', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE1C_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('strict RLS + generate ≥4 variants + approval gate', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const userId = randomUUID()
      const listingId = `lst_${randomUUID()}`

      try {
        await seedTenant(pool, { agencyId, agentId, userId, listingId })

        const bundle = await generateAiCreative({
          listing: { id: listingId, title: 'T', description: 'Desc', agent_id: agentId },
          agent: { id: agentId, name: 'Agent' },
          agencyId,
          agentId,
          channelKeys: ['instagram_feed', 'instagram_story'],
          description: 'Bright apartment in Hamra',
          template: TEMPLATE,
          provider: 'local',
          storageRoot: '/tmp',
          publicBaseUrl: '/uploads',
        })

        expect(bundle.variants.length).toBeGreaterThanOrEqual(4)
        for (const variant of bundle.variants) {
          expect(variant.renditions.length).toBe(2)
        }

        const hidden = await asGrowthOsRole(pool, {}, async (client) => {
          const { rows } = await client.query('SELECT id FROM public.creatives WHERE id = $1', [bundle.creative.id])
          return rows
        })
        expect(hidden).toHaveLength(0)

        expect(bundle.creative.approval_state).toBe('pending')
        expect(() => assertPublishable(bundle.creative)).toThrow(/approval/i)

        await approveCreative(bundle.creative.id, {
          agencyId,
          agentId,
          decidedBy: agentId,
          decision: 'approved',
        })

        const approved = await loadCreativeBundle(bundle.creative.id, { agencyId, agentId })
        const payloads = buildPublishPayloads(approved, [{
          variant_id: approved.variants[0].id,
          channel_key: 'instagram_feed',
        }])
        expect(payloads[0].platform).toBe('instagram')
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
