/**
 * Wave 2F — SEO page generation, Execution(kind=seo_page), events.
 */

import {
  buildIdempotencyKey,
  createExecution,
  ingestEvent,
  transitionExecution,
  withTenant,
} from '../../lib/growth-os/index.js'
import { findOne } from '../../persistence/index.js'
import { getPublicAppBase } from '../../whiteLabel.js'
import { SEO_EVENT_GENERATED, SEO_EVENT_SOURCE, SEO_EXECUTION_KIND } from './constants.js'
import { buildRealEstateListingJsonLd, validateJsonLd } from './jsonld.js'
import { buildCanonicalUrl, buildOgTags, slugify } from './meta.js'
import { computeSeoRecommendations } from './recommendations.js'
import { getSeoPage, upsertSeoPage, upsertSeoTargetPreference } from './repository.js'
import { resolveSeoTarget, resolveSeoTargetForProperty } from './target-resolver.js'

function serializeProperty(property) {
  const photos = Array.isArray(property.photos)
    ? property.photos
    : (typeof property.photos === 'string' ? property.photos.split('|').filter(Boolean) : [])
  return { ...property, photos }
}

export async function getListingSeo(propertyId, { agencyId, agentId } = {}) {
  const property = await withTenant(agencyId, agentId, () =>
    findOne('properties', (p) => p.id === propertyId),
  )
  if (!property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }

  const effectiveAgentId = agentId || property.agent_id
  const effectiveAgencyId = agencyId || property.agency_id
  const target = await resolveSeoTargetForProperty(propertyId, {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  })
  const seoPage = await getSeoPage(propertyId, {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  })
  const recommendations = computeSeoRecommendations(
    serializeProperty(property),
    seoPage,
    { targetSurface: target.target_surface },
  )

  return {
    property_id: propertyId,
    seo_page: seoPage,
    target,
    recommendations,
    is_external: target.target_surface === 'external_site',
    is_wingcaster_served: ['agency_white_label', 'own_white_label', 'bazaar'].includes(target.target_surface),
  }
}

export async function updateListingSeo(propertyId, patch, { agencyId, agentId } = {}) {
  const property = await withTenant(agencyId, agentId, () =>
    findOne('properties', (p) => p.id === propertyId),
  )
  if (!property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }

  const effectiveAgentId = agentId || property.agent_id
  const effectiveAgencyId = agencyId || property.agency_id
  const existing = await getSeoPage(propertyId, {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  })

  const slug = patch.slug || existing?.slug || slugify(patch.title || property.title, property.id)

  const seoPage = await upsertSeoPage({
    propertyId,
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
    slug,
    title: patch.title ?? existing?.title ?? property.title,
    metaDescription: patch.meta_description ?? existing?.meta_description ?? property.description,
    canonicalUrl: patch.canonical_url ?? existing?.canonical_url,
    ogTags: patch.og_tags ?? existing?.og_tags,
    schemaJsonld: patch.schema_jsonld ?? existing?.schema_jsonld,
    status: patch.status ?? existing?.status ?? 'draft',
  })

  const recommendations = computeSeoRecommendations(
    serializeProperty(property),
    seoPage,
    { targetSurface: (await resolveSeoTargetForProperty(propertyId, { agencyId: effectiveAgencyId, agentId: effectiveAgentId })).target_surface },
  )

  return { seo_page: seoPage, recommendations }
}

export async function generateListingSeo(propertyId, { agencyId, agentId, force = false } = {}) {
  const property = await withTenant(agencyId, agentId, () =>
    findOne('properties', (p) => p.id === propertyId),
  )
  if (!property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }

  const effectiveAgentId = agentId || property.agent_id
  const effectiveAgencyId = agencyId || property.agency_id
  const serialized = serializeProperty(property)
  const target = await resolveSeoTargetForProperty(propertyId, {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  })

  const appBase = getPublicAppBase()
  const slug = slugify(property.title, property.id)
  const title = property.title || 'Property listing'
  const metaDescription = (property.description || '').slice(0, 160)
  const canonicalUrl = await buildCanonicalUrl(target.target_surface, serialized, {
    slug,
    subdomain: target.subdomain,
    customDomain: target.custom_domain,
    externalSiteUrl: target.external_site_url,
    appBase,
  })

  const photos = serialized.photos || []
  const schemaJsonld = buildRealEstateListingJsonLd(serialized, {
    canonicalUrl,
    title,
    description: metaDescription,
  })
  const jsonldValidation = validateJsonLd(schemaJsonld)
  if (!jsonldValidation.valid) {
    throw Object.assign(
      new Error(`Invalid JSON-LD: ${jsonldValidation.errors.join('; ')}`),
      { code: 'INVALID_JSONLD', details: jsonldValidation.errors },
    )
  }

  const ogTags = buildOgTags({
    title,
    description: metaDescription,
    canonicalUrl,
    imageUrl: photos[0] || null,
  })

  const execution = await createExecution({
    kind: SEO_EXECUTION_KIND,
    status: 'processing',
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
    subjectType: 'property',
    subjectId: propertyId,
    data: {
      target_surface: target.target_surface,
      slug,
    },
  })

  const seoPage = await upsertSeoPage({
    propertyId,
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
    slug,
    title,
    metaDescription,
    canonicalUrl,
    ogTags,
    schemaJsonld,
    status: target.target_surface === 'external_site' ? 'published' : 'published',
    indexedAt: new Date().toISOString(),
    data: { execution_id: execution.id, target_surface: target.target_surface },
  })

  const publishedExecution = await transitionExecution(execution.id, 'published', {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  })

  const occurredAt = new Date().toISOString()
  const idempotencyKey = buildIdempotencyKey({
    source: SEO_EVENT_SOURCE,
    objectType: 'execution',
    objectId: publishedExecution.id,
    eventName: SEO_EVENT_GENERATED,
    occurredAt,
  })

  await ingestEvent({
    eventName: SEO_EVENT_GENERATED,
    source: SEO_EVENT_SOURCE,
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
    actorType: 'agent',
    actorId: effectiveAgentId,
    objectType: 'execution',
    objectId: publishedExecution.id,
    executionId: publishedExecution.id,
    occurredAt,
    idempotencyKey,
    data: {
      property_id: propertyId,
      target_surface: target.target_surface,
      canonical_url: canonicalUrl,
      seo_page_id: seoPage.id,
      score: computeSeoRecommendations(serialized, seoPage, { targetSurface: target.target_surface }).score,
    },
  })

  const recommendations = computeSeoRecommendations(serialized, seoPage, {
    targetSurface: target.target_surface,
  })

  return {
    execution: publishedExecution,
    seo_page: seoPage,
    target,
    recommendations,
    jsonld_validation: jsonldValidation,
  }
}

export async function setSeoTargetPreference({
  propertyId,
  agentId,
  agencyId,
  targetSurface,
  externalSiteUrl,
} = {}) {
  const property = propertyId
    ? await withTenant(agencyId, agentId, () => findOne('properties', (p) => p.id === propertyId))
    : null

  if (propertyId && !property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }

  const effectiveAgentId = agentId || property?.agent_id
  const effectiveAgencyId = agencyId || property?.agency_id

  const target = await resolveSeoTarget({
    property: property || { id: propertyId, agent_id: effectiveAgentId, agency_id: effectiveAgencyId },
    agentId: effectiveAgentId,
    agencyId: effectiveAgencyId,
    preference: { target_surface: targetSurface, external_site_url: externalSiteUrl },
  })

  if (!target.available_surfaces.includes(targetSurface)) {
    throw Object.assign(
      new Error(`target surface ${targetSurface} is not available for this listing`),
      { code: 'INVALID_SEO_TARGET', available: target.available_surfaces },
    )
  }

  const preference = await upsertSeoTargetPreference({
    agentId: effectiveAgentId,
    propertyId: propertyId || null,
    agencyId: effectiveAgencyId,
    targetSurface,
    externalSiteUrl,
  })

  return { preference, target: await resolveSeoTargetForProperty(propertyId || property?.id, {
    agencyId: effectiveAgencyId,
    agentId: effectiveAgentId,
  }) }
}

/**
 * Attach SEO-ready markup to a publish payload (own-website / external integration).
 */
export function attachSeoToPublishPayload(property, seoPage) {
  if (!seoPage) return { property, seo: null }
  return {
    property,
    seo: {
      title: seoPage.title,
      meta_description: seoPage.meta_description,
      canonical_url: seoPage.canonical_url,
      og_tags: seoPage.og_tags,
      schema_jsonld: seoPage.schema_jsonld,
      embed_snippet: seoPage.schema_jsonld?.['@type']
        ? `<script type="application/ld+json">\n${JSON.stringify(seoPage.schema_jsonld, null, 2)}\n</script>`
        : null,
    },
  }
}

export async function enrichPropertyWithSeo(property, { agencyId, agentId } = {}) {
  const seoPage = await getSeoPage(property.id, { agencyId, agentId })
  return attachSeoToPublishPayload(property, seoPage)
}
