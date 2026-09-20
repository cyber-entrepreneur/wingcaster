/**
 * Wave 2F — SEO HTTP routes.
 *
 *   GET  /api/seo/properties/:propertyId
 *   PUT  /api/seo/properties/:propertyId
 *   POST /api/seo/properties/:propertyId/generate
 *   GET  /api/seo/properties/:propertyId/export
 *   GET  /api/seo/properties/:propertyId/target
 *   PUT  /api/seo/properties/:propertyId/target
 *   GET  /api/public/sites/by-subdomain/:subdomain/sitemap.xml
 *   GET  /api/public/sites/by-subdomain/:subdomain/robots.txt
 *   GET  /api/public/seo/listings/:propertyId/bundle
 *   GET  /api/public/seo/agents/:agentId/feed.xml
 *   GET  /api/public/seo/agents/:agentId/sitemap.xml
 */

import { z } from 'zod'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { getPublicAppBase } from '../../whiteLabel.js'
import { SEO_TARGET_SURFACES } from './constants.js'
import { buildExternalSeoBundle, buildAgentFeedXml, buildAgentSitemapXml } from './export.js'
import { buildSiteSitemap, buildRobotsTxt } from './sitemap.js'
import {
  generateListingSeo,
  getListingSeo,
  setSeoTargetPreference,
  updateListingSeo,
} from './service.js'

const updateSeoSchema = z.object({
  title: z.string().optional(),
  meta_description: z.string().optional(),
  slug: z.string().optional(),
  canonical_url: z.string().url().optional().nullable(),
  og_tags: z.record(z.unknown()).optional(),
  schema_jsonld: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'indexed', 'archived']).optional(),
}).strict()

const targetSchema = z.object({
  target_surface: z.enum([...SEO_TARGET_SURFACES]),
  external_site_url: z.string().url().optional().nullable(),
}).strict()

async function resolveTenant(req) {
  const agentId = req.user?.id || null
  let agencyId = req.agencyId || req.body?.agency_id || req.query?.agency_id || null
  if (!agencyId && agentId) {
    const memberships = await listUserAgencyMemberships(agentId)
    const exclusive = memberships.find((row) => row.affiliation_mode === 'exclusive')
    agencyId = exclusive?.agency_id || memberships[0]?.agency_id || null
  }
  return { agencyId, agentId }
}

function mapError(res, err) {
  const code = err?.code || 'INTERNAL_ERROR'
  if (code === 'PROPERTY_NOT_FOUND') return res.status(404).json({ error: err.message, code })
  if (code === 'SEO_EXPORT_NOT_EXTERNAL' || code === 'INVALID_SEO_TARGET' || code === 'INVALID_JSONLD') {
    return res.status(400).json({ error: err.message, code, details: err.details || err.available })
  }
  return res.status(500).json({ error: err.message, code })
}

export function registerSeoRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('seo-routes requires authMiddleware')

  app.get('/api/seo/properties/:propertyId', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const result = await getListingSeo(req.params.propertyId, tenant)
      res.json(result)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.put('/api/seo/properties/:propertyId', authMiddleware, async (req, res) => {
    const body = updateSeoSchema.safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const tenant = await resolveTenant(req)
      const result = await updateListingSeo(req.params.propertyId, body.data, tenant)
      res.json(result)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.post('/api/seo/properties/:propertyId/generate', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const result = await generateListingSeo(req.params.propertyId, tenant)
      res.json(result)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.get('/api/seo/properties/:propertyId/export', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const bundle = await buildExternalSeoBundle(req.params.propertyId, tenant)
      res.json(bundle)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.get('/api/seo/properties/:propertyId/target', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const result = await getListingSeo(req.params.propertyId, tenant)
      res.json({ target: result.target })
    } catch (err) {
      mapError(res, err)
    }
  })

  app.put('/api/seo/properties/:propertyId/target', authMiddleware, async (req, res) => {
    const body = targetSchema.safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const tenant = await resolveTenant(req)
      const result = await setSeoTargetPreference({
        propertyId: req.params.propertyId,
        ...tenant,
        targetSurface: body.data.target_surface,
        externalSiteUrl: body.data.external_site_url,
      })
      res.json(result)
    } catch (err) {
      mapError(res, err)
    }
  })

  // Public per-site sitemap (WingCaster-served white-label)
  app.get('/api/public/sites/by-subdomain/:subdomain/sitemap.xml', async (req, res) => {
    try {
      const appBase = await getPublicAppBase()
      const result = await buildSiteSitemap(req.params.subdomain, { appBase })
      if (!result) return res.status(404).send('Site not found')
      res.set('Content-Type', 'application/xml')
      res.send(result.xml)
    } catch (err) {
      res.status(500).send('Error generating sitemap')
    }
  })

  app.get('/api/public/sites/by-subdomain/:subdomain/robots.txt', async (req, res) => {
    try {
      const appBase = await getPublicAppBase()
      const sitemapUrl = `${appBase}/api/public/sites/by-subdomain/${req.params.subdomain}/sitemap.xml`
      res.set('Content-Type', 'text/plain')
      res.send(buildRobotsTxt({ sitemapUrl }))
    } catch (err) {
      res.status(500).send('Error generating robots.txt')
    }
  })

  // Public external-site SEO bundle (export only — no page injection)
  app.get('/api/public/seo/listings/:propertyId/bundle', async (req, res) => {
    try {
      const { findOne } = await import('../../persistence/index.js')
      const { getSeoPage } = await import('./repository.js')
      const property = await findOne('properties', (p) => p.id === req.params.propertyId)
      if (!property) return res.status(404).json({ error: 'Not found' })
      let bundle
      try {
        bundle = await buildExternalSeoBundle(req.params.propertyId, {
          agentId: property.agent_id,
          agencyId: property.agency_id,
        })
      } catch (err) {
        if (err?.code !== 'SEO_EXPORT_NOT_EXTERNAL') throw err
        const seoPage = await getSeoPage(req.params.propertyId, {
          agentId: property.agent_id,
          agencyId: property.agency_id,
        })
        bundle = {
          property_id: req.params.propertyId,
          jsonld: seoPage?.schema_jsonld || {},
          og_tags: seoPage?.og_tags || {},
          canonical_url: seoPage?.canonical_url,
          meta: { title: seoPage?.title, description: seoPage?.meta_description },
        }
      }
      res.json(bundle)
    } catch (err) {
      res.status(err?.code === 'PROPERTY_NOT_FOUND' ? 404 : 500).json({ error: err.message })
    }
  })

  app.get('/api/public/seo/agents/:agentId/feed.xml', async (req, res) => {
    try {
      const xml = await buildAgentFeedXml(req.params.agentId)
      res.set('Content-Type', 'application/xml')
      res.send(xml)
    } catch (err) {
      res.status(500).send('Error generating feed')
    }
  })

  app.get('/api/public/seo/agents/:agentId/sitemap.xml', async (req, res) => {
    try {
      const externalBase = req.query.base_url || null
      const xml = await buildAgentSitemapXml(req.params.agentId, { externalBaseUrl: externalBase })
      res.set('Content-Type', 'application/xml')
      res.send(xml)
    } catch (err) {
      res.status(500).send('Error generating sitemap')
    }
  })
}
