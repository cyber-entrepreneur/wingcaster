/**
 * Wave 2F — SEO / owned-web public surface.
 */

export { registerSeoRoutes } from './routes.js'
export {
  SEO_PAGE_STATUSES,
  SEO_TARGET_SURFACES,
  SEO_EXECUTION_KIND,
  SEO_EVENT_GENERATED,
} from './constants.js'
export { buildRealEstateListingJsonLd, validateJsonLd } from './jsonld.js'
export { buildCanonicalUrl, buildOgTags, slugify, validateTitleLength, validateMetaLength } from './meta.js'
export { computeSeoRecommendations } from './recommendations.js'
export { resolveSeoTarget, resolveSeoTargetForProperty } from './target-resolver.js'
export {
  buildSiteContext,
  getAgencySiteContext,
  getAgencySiteContextBySubdomain,
  getAgentOwnWhiteLabelSite,
} from './site-context.js'
export { getSeoPage, upsertSeoPage, getSeoTargetPreference, upsertSeoTargetPreference } from './repository.js'
export { buildSiteSitemap, buildAgentExportSitemap, buildRobotsTxt } from './sitemap.js'
export { buildExternalSeoBundle, buildAgentFeedXml, buildAgentSitemapXml } from './export.js'
export {
  getListingSeo,
  updateListingSeo,
  generateListingSeo,
  setSeoTargetPreference,
  attachSeoToPublishPayload,
  enrichPropertyWithSeo,
} from './service.js'
