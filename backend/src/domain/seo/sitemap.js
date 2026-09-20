/**
 * Wave 2F — per-site XML sitemaps and robots.txt.
 */

import { findAll, findOne } from '../../persistence/index.js'
import { escapeXml } from '../../lib/xml.js'
import { isAgencySiteVisible, isMarketplaceVisible } from '../../platformModel.js'
import { getPublicAppBase } from '../../whiteLabel.js'
import { getSeoPage } from './repository.js'

function photos(property) {
  if (Array.isArray(property.photos)) return property.photos
  if (typeof property.photos === 'string') return property.photos.split('|').filter(Boolean)
  return []
}

function lastMod(property, seoPage) {
  const candidate = seoPage?.updated_at || property.updated_at || property.listed_date
  if (!candidate) return null
  const d = new Date(candidate)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

/**
 * Build sitemap XML for a white-label site subdomain.
 */
export async function buildSiteSitemap(subdomain, { appBase } = {}) {
  const base = (appBase || getPublicAppBase()).replace(/\/$/, '')
  const site = await findOne('white_label_sites', (s) => s.subdomain === subdomain && s.status === 'active')
  if (!site) return null

  const agency = await findOne('agencies', (a) => a.id === site.agency_id)
  if (!agency) return null

  const members = await findAll('agency_members', (m) => m.agency_id === agency.id && m.status === 'active')
  const memberIds = members.map((m) => m.user_id)
  const allProps = await findAll('properties', (p) => memberIds.includes(p.agent_id) || p.agency_id === agency.id)
  const indexable = allProps.filter((p) => isAgencySiteVisible(p, agency.id))

  const siteBase = site.custom_domain
    ? `https://${String(site.custom_domain).replace(/^https?:\/\//, '')}`
    : `${base}/site/${subdomain}`

  let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  xml += `<url><loc>${escapeXml(`${siteBase}/`)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`

  for (const property of indexable) {
    const seoPage = await getSeoPage(property.id, { agencyId: agency.id, agentId: property.agent_id })
    if (seoPage?.status === 'archived') continue
    const loc = seoPage?.canonical_url || `${siteBase}/property/${property.id}`
    const mod = lastMod(property, seoPage)
    xml += '<url>'
    xml += `<loc>${escapeXml(loc)}</loc>`
    if (mod) xml += `<lastmod>${escapeXml(mod)}</lastmod>`
    xml += '<changefreq>weekly</changefreq><priority>0.8</priority>'
    xml += '</url>'
  }

  xml += '</urlset>'
  return { xml, site, agency, count: indexable.length }
}

/**
 * Build sitemap for agent external-site export (published listings only).
 */
export async function buildAgentExportSitemap(agentId, { externalBaseUrl, appBase } = {}) {
  const apiBase = (appBase || getPublicAppBase()).replace(/\/$/, '')
  const properties = await findAll('properties', (p) => p.agent_id === agentId)
  const indexable = properties.filter(isMarketplaceVisible)

  let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  for (const property of indexable) {
    const seoPage = await getSeoPage(property.id, { agentId })
    const loc = externalBaseUrl
      ? `${externalBaseUrl.replace(/\/$/, '')}/listings/${seoPage?.slug || property.id}`
      : `${apiBase}/api/public/seo/agents/${agentId}/listings/${property.id}`
    const mod = lastMod(property, seoPage)
    xml += '<url>'
    xml += `<loc>${escapeXml(loc)}</loc>`
    if (mod) xml += `<lastmod>${escapeXml(mod)}</lastmod>`
    xml += '<changefreq>weekly</changefreq><priority>0.8</priority>'
    xml += '</url>'
  }
  xml += '</urlset>'
  return { xml, count: indexable.length }
}

export function buildRobotsTxt({ sitemapUrl, allowAll = true } = {}) {
  const lines = ['User-agent: *']
  lines.push(allowAll ? 'Allow: /' : 'Disallow: /')
  if (sitemapUrl) lines.push(`Sitemap: ${sitemapUrl}`)
  return lines.join('\n')
}
