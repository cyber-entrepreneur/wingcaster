/**
 * Wave 2F — seo_pages + seo_target_preferences persistence.
 */

import { randomUUID } from 'node:crypto'
import { findOne, insert, update } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/index.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

export async function getSeoPage(propertyId, { agencyId = null, agentId = null } = {}) {
  if (!propertyId) return null
  return withTenant(agencyId, agentId, () =>
    findOne('seo_pages', (row) => row.property_id === propertyId),
  )
}

export async function upsertSeoPage({
  propertyId,
  agencyId = null,
  agentId = null,
  slug,
  title = null,
  metaDescription = null,
  canonicalUrl = null,
  ogTags = {},
  schemaJsonld = {},
  status = 'draft',
  indexedAt = null,
  id = null,
  data = {},
} = {}) {
  if (!propertyId) {
    throw Object.assign(new Error('propertyId is required'), { code: 'MISSING_PROPERTY_ID' })
  }
  const now = new Date().toISOString()
  const existing = await getSeoPage(propertyId, { agencyId, agentId })

  return withTenant(agencyId, agentId, async () => {
    if (existing) {
      await update(
        'seo_pages',
        (row) => row.id === existing.id,
        (row) => ({
          ...row,
          slug: slug ?? row.slug,
          title: title ?? row.title,
          meta_description: metaDescription ?? row.meta_description,
          canonical_url: canonicalUrl ?? row.canonical_url,
          og_tags: ogTags ?? row.og_tags,
          schema_jsonld: schemaJsonld ?? row.schema_jsonld,
          status: status ?? row.status,
          indexed_at: indexedAt ?? row.indexed_at,
          updated_at: now,
          data: { ...(row.data || {}), ...data },
        }),
      )
      return findOne('seo_pages', (row) => row.id === existing.id)
    }

    return insert('seo_pages', {
      id: id || prefixedId('seop_'),
      property_id: propertyId,
      agency_id: agencyId,
      agent_id: agentId,
      slug,
      title,
      meta_description: metaDescription,
      canonical_url: canonicalUrl,
      og_tags: ogTags,
      schema_jsonld: schemaJsonld,
      status,
      indexed_at: indexedAt,
      created_at: now,
      updated_at: now,
      data,
    })
  })
}

export async function getSeoTargetPreference({ agentId, propertyId = null, agencyId = null } = {}) {
  if (!agentId) return null
  return withTenant(agencyId, agentId, () =>
    findOne('seo_target_preferences', (row) => {
      if (row.agent_id !== agentId) return false
      if (propertyId) return row.property_id === propertyId
      return row.property_id == null
    }),
  )
}

export async function upsertSeoTargetPreference({
  agentId,
  propertyId = null,
  agencyId = null,
  targetSurface,
  externalSiteUrl = null,
  id = null,
  data = {},
} = {}) {
  if (!agentId || !targetSurface) {
    throw Object.assign(new Error('agentId and targetSurface are required'), {
      code: 'MISSING_TARGET_PREFERENCE',
    })
  }
  const now = new Date().toISOString()
  const existing = await getSeoTargetPreference({ agentId, propertyId, agencyId })

  return withTenant(agencyId, agentId, async () => {
    if (existing) {
      await update(
        'seo_target_preferences',
        (row) => row.id === existing.id,
        (row) => ({
          ...row,
          target_surface: targetSurface,
          external_site_url: externalSiteUrl ?? row.external_site_url,
          updated_at: now,
          data: { ...(row.data || {}), ...data },
        }),
      )
      return findOne('seo_target_preferences', (row) => row.id === existing.id)
    }

    return insert('seo_target_preferences', {
      id: id || prefixedId('seot_'),
      agent_id: agentId,
      property_id: propertyId,
      agency_id: agencyId,
      target_surface: targetSurface,
      external_site_url: externalSiteUrl,
      created_at: now,
      updated_at: now,
      data,
    })
  })
}
