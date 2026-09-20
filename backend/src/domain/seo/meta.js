/**
 * Wave 2F — canonical URLs, OG/Twitter meta tag generation.
 */

import { getPublicAppBase } from '../../whiteLabel.js'
import {
  META_MAX_LENGTH,
  META_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from './constants.js'

export function slugify(text, fallback = 'listing') {
  const base = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || fallback
}

export async function buildCanonicalUrl(targetSurface, property, context = {}) {
  const appBase = (context.appBase || getPublicAppBase()).replace(/\/$/, '')
  const propertyId = property.id
  const slug = context.slug || slugify(property.title, propertyId)

  switch (targetSurface) {
    case 'agency_white_label':
    case 'own_white_label': {
      const subdomain = context.subdomain
      const customDomain = context.customDomain
      if (customDomain) {
        return `https://${customDomain.replace(/^https?:\/\//, '')}/property/${slug}`
      }
      if (subdomain) {
        return `${appBase}/site/${subdomain}/property/${propertyId}`
      }
      return `${appBase}/property/${propertyId}`
    }
    case 'external_site': {
      const base = (context.externalSiteUrl || '').replace(/\/$/, '')
      if (!base) return null
      return `${base}/listings/${slug}`
    }
    case 'bazaar':
    default:
      return `${appBase}/property/${propertyId}`
  }
}

export function buildOgTags({ title, description, canonicalUrl, imageUrl, siteName = 'WingCaster' } = {}) {
  const tags = {
    'og:type': 'website',
    'og:site_name': siteName,
  }
  if (title) tags['og:title'] = title
  if (description) tags['og:description'] = description
  if (canonicalUrl) {
    tags['og:url'] = canonicalUrl
    tags['twitter:url'] = canonicalUrl
  }
  if (imageUrl) {
    tags['og:image'] = imageUrl
    tags['twitter:image'] = imageUrl
  }
  tags['twitter:card'] = imageUrl ? 'summary_large_image' : 'summary'
  if (title) tags['twitter:title'] = title
  if (description) tags['twitter:description'] = description
  return tags
}

export function validateTitleLength(title) {
  const len = String(title || '').length
  if (len === 0) return { ok: false, length: len, message: 'Title is required' }
  if (len < TITLE_MIN_LENGTH) {
    return { ok: false, length: len, message: `Title is short (${len}/${TITLE_MIN_LENGTH} min)` }
  }
  if (len > TITLE_MAX_LENGTH) {
    return { ok: false, length: len, message: `Title is long (${len}/${TITLE_MAX_LENGTH} max)` }
  }
  return { ok: true, length: len, message: 'Title length is optimal' }
}

export function validateMetaLength(description) {
  const len = String(description || '').length
  if (len === 0) return { ok: false, length: len, message: 'Meta description is required' }
  if (len < META_MIN_LENGTH) {
    return { ok: false, length: len, message: `Meta description is short (${len}/${META_MIN_LENGTH} min)` }
  }
  if (len > META_MAX_LENGTH) {
    return { ok: false, length: len, message: `Meta description is long (${len}/${META_MAX_LENGTH} max)` }
  }
  return { ok: true, length: len, message: 'Meta description length is optimal' }
}
