/**
 * Wave 2F — SEO / owned-web constants.
 */

export const SEO_PAGE_STATUSES = Object.freeze([
  'draft',
  'published',
  'indexed',
  'archived',
])

export const SEO_TARGET_SURFACES = Object.freeze([
  'agency_white_label',
  'own_white_label',
  'external_site',
  'bazaar',
])

export const SEO_EXECUTION_KIND = 'seo_page'
export const SEO_EVENT_GENERATED = 'seo.page.generated'

export const TITLE_MIN_LENGTH = 30
export const TITLE_MAX_LENGTH = 60
export const META_MIN_LENGTH = 120
export const META_MAX_LENGTH = 160
