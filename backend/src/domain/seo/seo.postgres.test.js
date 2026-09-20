/**
 * Wave 2F — Real-PG: SEO pages, target resolver, executions, events, RLS.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { listEvents } from '../../lib/growth-os/index.js'
import {
  generateListingSeo,
  getListingSeo,
  setSeoTargetPreference,
} from './index.js'
import { resolveSeoTarget } from './target-resolver.js'
import { validateJsonLd, buildRealEstateListingJsonLd } from './jsonld.js'
import { computeSeoRecommendations } from './recommendations.js'
import { SEO_EVENT_GENERATED } from './constants.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

async function seedAgencySiteConfig(pool, { agencyId, slug, customDomain = null }) {
  await pool.query(
    `INSERT INTO public.agency_site_config (
       id, agency_id, custom_domain, published_at, copy_fields, data
     )
     VALUES ($1, $2, $3, NOW(), '{}'::jsonb, '{}'::jsonb)
     ON CONFLICT (agency_id) DO UPDATE
       SET published_at = EXCLUDED.published_at,
           custom_domain = COALESCE(EXCLUDED.custom_domain, public.agency_site_config.custom_domain)`,
    [`asc_${randomUUID()}`, agencyId, customDomain],
  )
}

async function seedAgencyAgent(pool, { agencyId, agentId, propertyId }) {
  const userId = randomUUID()
  const agencySlug = `site-${agencyId.slice(-8)}`
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave2F', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2f.test`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, owner_id, name, slug, site_hosting_type, data)
     VALUES ($1, $2, $3, $4, 'whitelabel', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agencyId, userId, `Agency ${agencyId}`, agencySlug],
  )
  await pool.query(
    `INSERT INTO public.agents (id, user_id, email, name, agency_id, data)
     VALUES ($1, $2, $3, 'Agent', $4, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, `${agentId}@wave2f.test`, agencyId],
  )
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, agency_id, title, description, status, price, city, data)
     VALUES ($1, $2, $3, $4, $5, 'active', 500000, 'Dubai', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      propertyId,
      agentId,
      agencyId,
      'Luxury Apartment in Downtown Dubai Marina',
      'Spacious apartment with marina views, modern finishes, and premium amenities in the heart of Dubai Marina district.',
    ],
  )
  await seedAgencySiteConfig(pool, { agencyId, slug: agencySlug })
}

skipIfNoPostgres()('SEO Real-PG', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('migration 792 grants properties SELECT to growth_os_app_role', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const sql = await readFile(join(migrationsDir, '792_seo_read_grants.sql'), 'utf8')
      await pool.query(sql)
      await pool.query(sql)

      const grant = await pool.query(
        `SELECT has_table_privilege('growth_os_app_role', 'public.properties', 'SELECT') AS ok`,
      )
      expect(grant.rows[0].ok).toBe(true)
      await closeDb()
    })
  })

  it('migration 790 is idempotent and admits seo.page.generated', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const sql = await readFile(join(migrationsDir, '790_seo_enums.sql'), 'utf8')
      await pool.query(sql)
      await pool.query(sql)

      const status = await pool.query(
        `SELECT public.growth_os_is_seo_page_status('published') AS ok,
                public.growth_os_is_seo_target_surface('bazaar') AS surf`,
      )
      expect(status.rows[0].ok).toBe(true)
      expect(status.rows[0].surf).toBe(true)

      const ev = await pool.query(
        `SELECT public.growth_os_is_event_name('seo.page.generated') AS ok,
                public.growth_os_event_name_category('seo.page.generated') AS cat`,
      )
      expect(ev.rows[0].ok).toBe(true)
      expect(ev.rows[0].cat).toBe('delivery')
      await closeDb()
    })
  })

  it('creates seo_page under strict RLS and emits Execution + event', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const propertyId = `prop_${randomUUID()}`
      await seedAgencyAgent(pool, { agencyId, agentId, propertyId })

      const result = await generateListingSeo(propertyId, { agencyId, agentId })
      expect(result.execution.kind).toBe('seo_page')
      expect(result.execution.status).toBe('published')
      expect(result.seo_page.property_id).toBe(propertyId)
      expect(result.seo_page.canonical_url).toBeTruthy()

      const validation = validateJsonLd(result.seo_page.schema_jsonld)
      expect(validation.valid).toBe(true)
      expect(result.seo_page.schema_jsonld['@type']).toBe('RealEstateListing')

      const events = await listEvents({ agencyId, agentId })
      const seoEvent = events.find((e) => e.event_name === SEO_EVENT_GENERATED)
      expect(seoEvent).toBeTruthy()

      const listing = await getListingSeo(propertyId, { agencyId, agentId })
      expect(listing.recommendations.score).toBeGreaterThan(0)
      expect(listing.target.target_surface).toBe('agency_white_label')

      await closeDb()
    })
  })

  it('resolves agency-tagged agent to agency white-label site', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const propertyId = `prop_${randomUUID()}`
      await seedAgencyAgent(pool, { agencyId, agentId, propertyId })

      const { findOne } = await import('../../persistence/index.js')
      const property = await findOne('properties', (p) => p.id === propertyId)
      const target = await resolveSeoTarget({
        property: { ...property, agency_tied: true, listing_owner_type: 'agency' },
        agentId,
        agencyId,
      })
      expect(target.target_surface).toBe('agency_white_label')
      expect(target.can_toggle).toBe(false)
      await closeDb()
    })
  })

  it('free agent with both surfaces honours toggle preference', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const freeAgentId = `agt_${randomUUID()}`
      const freeUserId = randomUUID()
      const propertyId = `prop_${randomUUID()}`

      await pool.query(
        `INSERT INTO public.users (id, email, name, data) VALUES ($1, $2, 'Free', '{}'::jsonb)`,
        [freeUserId, `${freeUserId}@free.test`],
      )
      await pool.query(
        `INSERT INTO public.agents (id, user_id, email, name, data)
         VALUES ($1, $2, $3, 'Free Agent', jsonb_build_object('website', 'https://freeagent.example.com'))`,
        [freeAgentId, freeUserId, `${freeAgentId}@free.test`],
      )
      await pool.query(
        `INSERT INTO public.properties (id, agent_id, title, description, status, city, data)
         VALUES ($1, $2, 'Free Agent Listing Downtown', 'A nice place.', 'active', 'Dubai', '{}'::jsonb)`,
        [propertyId, freeAgentId],
      )
      const soloAgencyId = `agy_${randomUUID()}`
      const soloSlug = `agent-${freeAgentId.slice(-8)}`
      await pool.query(
        `INSERT INTO public.agencies (id, owner_id, name, slug, site_hosting_type, data)
         VALUES ($1, $2, 'Free Agent Site', $3, 'whitelabel', '{}'::jsonb)`,
        [soloAgencyId, freeUserId, soloSlug],
      )
      await seedAgencySiteConfig(pool, { agencyId: soloAgencyId, slug: soloSlug })

      const { findOne } = await import('../../persistence/index.js')
      const property = await findOne('properties', (p) => p.id === propertyId)

      const defaultTarget = await resolveSeoTarget({ property, agentId: freeAgentId })
      expect(defaultTarget.can_toggle).toBe(true)
      expect(defaultTarget.available_surfaces).toContain('own_white_label')
      expect(defaultTarget.available_surfaces).toContain('external_site')

      await setSeoTargetPreference({
        propertyId,
        agentId: freeAgentId,
        targetSurface: 'external_site',
        externalSiteUrl: 'https://freeagent.example.com',
      })

      const toggled = await resolveSeoTarget({
        property,
        agentId: freeAgentId,
        preference: { target_surface: 'external_site' },
      })
      expect(toggled.target_surface).toBe('external_site')
      await closeDb()
    })
  })

  it('computes recommendation score with length rules', () => {
    const property = {
      title: 'Luxury Apartment in Downtown Dubai Marina',
      description: 'Spacious apartment with marina views.',
      city: 'Dubai',
      property_type: 'apartment',
      photos: ['https://example.com/a.jpg'],
    }
    const jsonld = buildRealEstateListingJsonLd(property, {
      canonicalUrl: 'https://example.com/p',
      title: property.title,
    })
    const seoPage = {
      title: property.title,
      meta_description: 'Discover this spacious apartment with marina views, modern finishes, and premium amenities in the heart of Dubai Marina district.',
      canonical_url: 'https://example.com/p',
      schema_jsonld: jsonld,
    }
    const rec = computeSeoRecommendations(property, seoPage)
    expect(rec.score).toBeGreaterThan(40)
    expect(rec.checks.title.ok).toBe(true)
  })
})
