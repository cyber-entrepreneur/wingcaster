/**
 * AGT-LST-015 — compose seller-safe performance report payload from existing feeds.
 */
import { findAll, findOne } from '../db.js'
import { resolveListingPerformance } from '../performance-dashboard.js'

const QUALIFIED_INQUIRY_STATUSES = new Set([
  'qualified',
  'scheduled_viewing',
  'negotiating',
  'closed_won',
])

function daysSince(iso) {
  if (!iso) return 0
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / (24 * 3600 * 1000)))
}

function deriveStateOfPlay({ performance, offers, inquiries, listing }) {
  const views = performance?.all_channels?.impressions || 0
  const inquiryCount = inquiries.length
  const activeOffers = offers.filter((o) => !['rejected', 'withdrawn'].includes(o.status))
  if (activeOffers.length > 0) {
    const suffix = activeOffers.length === 1 ? 'offer' : 'offers'
    return `Active interest — ${activeOffers.length} ${suffix} under review.`
  }
  if (inquiryCount >= 3) {
    return 'Strong early interest — inquiries are coming in steadily.'
  }
  if (views >= 50) {
    return 'Healthy visibility — buyers are viewing the listing.'
  }
  if (daysSince(listing.created_at) <= 7) {
    return 'Your campaign just started — early metrics are still building.'
  }
  return 'Steady progress — your listing is live and being promoted.'
}

function buildPropertyScores(aiRatings) {
  const ratings = aiRatings?.ratings || aiRatings || {}
  const pick = (key) => {
    const value = Number(ratings[key])
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null
  }
  return {
    quality: pick('quality') ?? pick('overall'),
    cleanliness: pick('cleanliness'),
    location: pick('location'),
    overall: pick('overall'),
  }
}

function serializeDistribution(dist) {
  const payload = typeof dist.payload === 'string'
    ? (() => { try { return JSON.parse(dist.payload) } catch { return {} } })()
    : (dist.payload || {})
  const postUrl = payload.post_url || payload.url || payload.permalink || null
  return {
    id: dist.id,
    platform: dist.platform,
    status: dist.status,
    published_at: dist.published_at || null,
    post_url: postUrl,
    views: Number(dist.views) || 0,
    clicks: Number(dist.clicks) || 0,
    leads: Number(dist.leads) || 0,
  }
}

function serializeOffer(offer, showAmounts) {
  const amount = typeof offer.amount === 'string' ? Number(offer.amount) : offer.amount
  const base = {
    id: offer.id,
    status: offer.status,
    offer_date: offer.offer_date,
    financing_type: offer.financing_type || null,
  }
  if (!showAmounts) {
    return {
      ...base,
      summary: 'Offer received',
      amount_hidden: true,
    }
  }
  return {
    ...base,
    amount,
    currency: offer.currency || 'USD',
    amount_hidden: false,
  }
}

function serializeViewingFeedback(viewing) {
  const note = viewing.outcome || viewing.notes || viewing.feedback || null
  if (!note) return null
  return {
    id: viewing.id,
    scheduled_at: viewing.scheduled_at,
    outcome: String(note).slice(0, 240),
  }
}

function clientSafeLocation(listing, showFullAddress) {
  if (showFullAddress) {
    return [listing.location, listing.neighborhood, listing.city].filter(Boolean).join(', ')
  }
  return [listing.neighborhood, listing.city].filter(Boolean).join(', ') || listing.city || 'Area withheld'
}

export async function buildSellerReportPayload({
  listing,
  agentId,
  report,
  clientSafe = false,
}) {
  const performanceResult = await resolveListingPerformance(listing.id, agentId, { days: 30 })
  if (performanceResult.error) {
    return { error: performanceResult.error }
  }

  const [offers, inquiries, viewings, distributions, agent] = await Promise.all([
    findAll('property_offers', (o) => o.property_id === listing.id),
    findAll('inquiries', (i) => i.property_id === listing.id),
    findAll('viewings', (v) => v.property_id === listing.id),
    findAll('distributions', (d) => d.property_id === listing.id),
    findOne('agents', (a) => a.id === agentId || a.user_id === agentId),
  ])

  const publishedDistributions = distributions
    .filter((d) => d.status === 'published')
    .sort((a, b) => String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at)))

  const qualifiedCount = inquiries.filter((i) => QUALIFIED_INQUIRY_STATUSES.has(i.status)).length
  const untriagedCount = inquiries.filter((i) => !QUALIFIED_INQUIRY_STATUSES.has(i.status) && i.status !== 'closed_lost').length
  const feedback = viewings
    .map(serializeViewingFeedback)
    .filter(Boolean)
    .slice(0, 6)

  const showOfferAmounts = Boolean(report?.show_offer_amounts)
  const showFullAddress = Boolean(report?.show_full_address)
  const stateOfPlay = report?.state_of_play || deriveStateOfPlay({
    performance: performanceResult,
    offers,
    inquiries,
    listing,
  })

  const heroMedia = Array.isArray(listing.media) ? listing.media[0] : null
  const photos = Array.isArray(listing.photos) ? listing.photos : []

  const payload = {
    generated_at: new Date().toISOString(),
    report: {
      id: report?.id || null,
      status: report?.status || 'live',
      layout_template: report?.layout_template || 'standard',
      state_of_play: stateOfPlay,
      agent_summary: report?.agent_summary || null,
      show_offer_amounts: showOfferAmounts,
      show_full_address: showFullAddress,
    },
    property: {
      id: listing.id,
      reference: listing.id.slice(0, 8).toUpperCase(),
      title: listing.title,
      listing_type: listing.listing_type,
      property_type: listing.property_type,
      status: listing.status,
      price: Number(listing.price) || 0,
      price_unit: listing.price_unit || 'USD',
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      area: listing.area ?? null,
      area_unit: listing.area_unit || null,
      location_label: clientSafeLocation(listing, showFullAddress),
      campaign_started_at: listing.created_at,
      days_on_market: daysSince(listing.created_at),
      hero_image: heroMedia?.url || photos[0] || null,
    },
    agent: agent ? {
      id: agent.id,
      name: agent.name || agent.display_name || 'Your agent',
      photo_url: agent.photo_url || agent.avatar_url || null,
      agency_name: agent.agency_name || null,
    } : null,
    scores: buildPropertyScores(listing.ai_ratings),
    summary: {
      list_price: Number(listing.price) || 0,
      days_on_market: daysSince(listing.created_at),
      posts_count: publishedDistributions.length,
      inquiries_received: inquiries.length,
      qualified_inquiries: qualifiedCount,
      shielded_inquiries: Math.max(0, inquiries.length - qualifiedCount),
      untriaged_inquiries: untriagedCount,
      viewings_count: viewings.length,
      offers_count: offers.length,
      momentum: performanceResult.all_channels?.impressions || 0,
    },
    marketing: {
      websites: publishedDistributions.filter((d) => ['portal', 'website', 'bayut', 'propertyfinder'].includes(String(d.platform).toLowerCase())),
      social_posts: publishedDistributions.filter((d) => !['portal', 'website', 'bayut', 'propertyfinder'].includes(String(d.platform).toLowerCase())),
      channels: publishedDistributions.map(serializeDistribution),
    },
    performance: {
      all_channels: performanceResult.all_channels,
      per_channel: performanceResult.per_channel,
      funnel: performanceResult.funnel,
      time_series: performanceResult.time_series,
    },
    inquiries: {
      total: inquiries.length,
      qualified: qualifiedCount,
      shielded: Math.max(0, inquiries.length - qualifiedCount),
      untriaged: untriagedCount,
    },
    feedback,
    offers: offers
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((offer) => serializeOffer(offer, !clientSafe || showOfferAmounts)),
    is_empty: publishedDistributions.length === 0 && inquiries.length === 0,
  }

  return payload
}
