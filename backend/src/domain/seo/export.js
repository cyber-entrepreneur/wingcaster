/**
 * Wave 2F — SEO asset bundle for external self-hosted sites (export only).
 */

import { findOne } from '../../persistence/index.js'
import { getPublicApiBase, getPublicAppBase } from '../../whiteLabel.js'
import { buildRealEstateListingJsonLd } from './jsonld.js'
import { buildCanonicalUrl, buildOgTags, slugify } from './meta.js'
import { getSeoPage } from './repository.js'
import { resolveSeoTargetForProperty } from './target-resolver.js'
import { buildAgentExportSitemap } from './sitemap.js'

function serializePropertyForExport(property) {
  const photos = Array.isArray(property.photos)
    ? property.photos
    : (typeof property.photos === 'string' ? property.photos.split('|').filter(Boolean) : [])
  return {
    id: property.id,
    title: property.title,
    description: property.description,
    price: property.price,
    price_unit: property.price_unit,
    city: property.city,
    neighborhood: property.neighborhood,
    location: property.location,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area: property.area,
    property_type: property.property_type,
    photos,
  }
}

/**
 * Build embeddable SEO asset bundle for external-site target.
 */
export async function buildExternalSeoBundle(propertyId, { agencyId, agentId } = {}) {
  const property = await findOne('properties', (p) => p.id === propertyId)
  if (!property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }

  const effectiveAgentId = agentId || property.agent_id
  const target = await resolveSeoTargetForProperty(propertyId, {
    agencyId: agencyId || property.agency_id,
    agentId: effectiveAgentId,
  })

  if (target.target_surface !== 'external_site') {
    throw Object.assign(
      new Error('SEO export is only available when target surface is external_site'),
      { code: 'SEO_EXPORT_NOT_EXTERNAL' },
    )
  }

  const seoPage = await getSeoPage(propertyId, {
    agencyId: agencyId || property.agency_id,
    agentId: effectiveAgentId,
  })

  const serialized = serializePropertyForExport(property)
  const slug = seoPage?.slug || slugify(property.title, property.id)
  const canonicalUrl = seoPage?.canonical_url || await buildCanonicalUrl('external_site', property, {
    slug,
    externalSiteUrl: target.external_site_url,
  })

  const jsonld = seoPage?.schema_jsonld?.['@type']
    ? seoPage.schema_jsonld
    : buildRealEstateListingJsonLd(serialized, {
      canonicalUrl,
      title: seoPage?.title || property.title,
      description: seoPage?.meta_description || property.description,
    })

  const photos = serialized.photos || []
  const ogTags = seoPage?.og_tags?.['og:title']
    ? seoPage.og_tags
    : buildOgTags({
      title: seoPage?.title || property.title,
      description: seoPage?.meta_description || property.description,
      canonicalUrl,
      imageUrl: photos[0] || null,
    })

  const apiBase = getPublicApiBase()
  const appBase = getPublicAppBase()
  const feedUrl = `${apiBase}/public/seo/agents/${effectiveAgentId}/feed.xml`
  const sitemapUrl = `${apiBase}/public/seo/agents/${effectiveAgentId}/sitemap.xml`
  const listingFeedItemUrl = `${apiBase}/public/seo/listings/${propertyId}/bundle`

  const embedSnippet = `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`

  return {
    property_id: propertyId,
    target_surface: 'external_site',
    external_site_url: target.external_site_url,
    canonical_url: canonicalUrl,
    slug,
    jsonld,
    og_tags: ogTags,
    embed_snippet: embedSnippet,
    feed_url: feedUrl,
    sitemap_url: sitemapUrl,
    listing_bundle_url: listingFeedItemUrl,
    meta: {
      title: seoPage?.title || property.title,
      description: seoPage?.meta_description || property.description,
    },
    app_base: appBase,
  }
}

export async function buildAgentFeedXml(agentId) {
  const { findAll } = await import('../../persistence/index.js')
  const { isMarketplaceVisible } = await import('../../platformModel.js')
  const { escapeXml } = await import('../../lib/xml.js')

  const properties = await findAll('properties', (p) => p.agent_id === agentId)
  const indexable = properties.filter(isMarketplaceVisible)
  const apiBase = getPublicApiBase()

  let xml = '<?xml version="1.0" encoding="UTF-8"?><listings>'
  for (const property of indexable) {
    const seoPage = await getSeoPage(property.id, { agentId })
    const serialized = serializePropertyForExport(property)
    const slug = seoPage?.slug || slugify(property.title, property.id)
    const canonicalUrl = seoPage?.canonical_url || null
    const jsonld = seoPage?.schema_jsonld?.['@type']
      ? seoPage.schema_jsonld
      : buildRealEstateListingJsonLd(serialized, {
        canonicalUrl,
        title: seoPage?.title || property.title,
        description: seoPage?.meta_description || property.description,
      })

    xml += '<listing>'
    xml += `<id>${escapeXml(property.id)}</id>`
    xml += `<slug>${escapeXml(slug)}</slug>`
    xml += `<title>${escapeXml(property.title || '')}</title>`
    xml += `<price>${escapeXml(String(property.price || ''))}</price>`
    xml += `<location>${escapeXml(property.location || property.city || '')}</location>`
    if (canonicalUrl) xml += `<url>${escapeXml(canonicalUrl)}</url>`
    xml += `<seo_jsonld>${escapeXml(JSON.stringify(jsonld))}</seo_jsonld>`
    xml += `<bundle_url>${escapeXml(`${apiBase}/public/seo/listings/${property.id}/bundle`)}</bundle_url>`
    xml += '</listing>'
  }
  xml += '</listings>'
  return xml
}

export async function buildAgentSitemapXml(agentId, { externalBaseUrl } = {}) {
  const result = await buildAgentExportSitemap(agentId, { externalBaseUrl })
  return result.xml
}
