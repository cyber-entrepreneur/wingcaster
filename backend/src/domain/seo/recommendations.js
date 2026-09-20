/**
 * Wave 2F — per-listing SEO recommendations and content score (Yoast-style).
 */

import { validateJsonLd } from './jsonld.js'
import { validateMetaLength, validateTitleLength } from './meta.js'

function keywordInText(keywords, text) {
  const haystack = String(text || '').toLowerCase()
  return keywords.some((kw) => haystack.includes(String(kw).toLowerCase()))
}

function extractKeywords(property) {
  const parts = [
    property.city,
    property.neighborhood,
    property.property_type,
    property.listing_type,
    property.bedrooms != null ? `${property.bedrooms} bedroom` : null,
    property.bedrooms != null ? `${property.bedrooms} bed` : null,
  ].filter(Boolean)
  return parts
}

function scoreAltText(property) {
  const photos = Array.isArray(property.photos)
    ? property.photos
    : (typeof property.photos === 'string' ? property.photos.split('|') : [])
  if (!photos.length) {
    return { score: 0, max: 15, message: 'Add listing photos for image SEO' }
  }
  const media = Array.isArray(property.media) ? property.media : []
  const withAlt = media.filter((m) => m.caption || m.alt).length
  if (withAlt > 0) {
    return { score: 15, max: 15, message: 'Image alt text present' }
  }
  return { score: 5, max: 15, message: 'Add alt text/captions to listing photos' }
}

/**
 * Compute SEO recommendations and an overall content score (0–100).
 */
export function computeSeoRecommendations(property, seoPage, { targetSurface } = {}) {
  const keywords = extractKeywords(property)
  const title = seoPage?.title || property.title || ''
  const description = seoPage?.meta_description || property.description || ''
  const titleCheck = validateTitleLength(title)
  const metaCheck = validateMetaLength(description)
  const jsonldCheck = validateJsonLd(seoPage?.schema_jsonld || {})
  const altCheck = scoreAltText(property)

  const recommendations = []

  if (!titleCheck.ok) {
    recommendations.push({
      id: 'title_length',
      severity: 'warning',
      message: titleCheck.message,
      field: 'title',
    })
  } else {
    recommendations.push({
      id: 'title_length',
      severity: 'success',
      message: titleCheck.message,
      field: 'title',
    })
  }

  if (!metaCheck.ok) {
    recommendations.push({
      id: 'meta_length',
      severity: 'warning',
      message: metaCheck.message,
      field: 'meta_description',
    })
  } else {
    recommendations.push({
      id: 'meta_length',
      severity: 'success',
      message: metaCheck.message,
      field: 'meta_description',
    })
  }

  const hasKeywords = keywordInText(keywords, `${title} ${description}`)
  recommendations.push({
    id: 'keyword_presence',
    severity: hasKeywords ? 'success' : 'warning',
    message: hasKeywords
      ? 'Primary location/type keywords appear in title or meta'
      : `Include keywords: ${keywords.slice(0, 4).join(', ')}`,
    field: 'keywords',
  })

  recommendations.push({
    id: 'alt_text',
    severity: altCheck.score >= altCheck.max ? 'success' : 'warning',
    message: altCheck.message,
    field: 'photos',
  })

  if (!jsonldCheck.valid) {
    recommendations.push({
      id: 'jsonld_valid',
      severity: 'error',
      message: `JSON-LD issues: ${jsonldCheck.errors.join('; ')}`,
      field: 'schema_jsonld',
    })
  } else if (seoPage?.schema_jsonld?.['@type']) {
    recommendations.push({
      id: 'jsonld_valid',
      severity: 'success',
      message: 'Structured data (JSON-LD) is valid',
      field: 'schema_jsonld',
    })
  } else {
    recommendations.push({
      id: 'jsonld_valid',
      severity: 'warning',
      message: 'Generate structured data for this listing',
      field: 'schema_jsonld',
    })
  }

  if (!seoPage?.canonical_url) {
    recommendations.push({
      id: 'canonical_url',
      severity: 'warning',
      message: 'Set a canonical URL',
      field: 'canonical_url',
    })
  }

  if (targetSurface === 'external_site') {
    recommendations.push({
      id: 'external_export',
      severity: 'info',
      message: 'Use the SEO asset bundle to embed JSON-LD on your external site',
      field: 'export',
    })
  }

  let score = 0
  if (titleCheck.ok) score += 25
  else if (title) score += 10
  if (metaCheck.ok) score += 25
  else if (description) score += 10
  if (hasKeywords) score += 20
  score += altCheck.score
  if (jsonldCheck.valid && seoPage?.schema_jsonld?.['@type']) score += 15
  if (seoPage?.canonical_url) score += 10

  const grade = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor'

  return {
    score: Math.min(100, score),
    grade,
    recommendations,
    checks: {
      title: titleCheck,
      meta: metaCheck,
      jsonld: jsonldCheck,
      keywords: { present: hasKeywords, keywords },
    },
  }
}
