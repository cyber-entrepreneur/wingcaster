/**
 * AGN-WLB-005 — white-label site analytics aggregation.
 */
import { findAll } from '../db.js'

const EVENT_TYPES = new Set(['pageview', 'inquiry', 'conversion'])

function parseDate(value, fallback) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date) {
  const copy = new Date(date)
  copy.setUTCHours(23, 59, 59, 999)
  return copy
}

function defaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return { start, end }
}

function normalizeEventType(event) {
  const fromColumn = String(event.event_type || '').trim().toLowerCase()
  if (EVENT_TYPES.has(fromColumn)) return fromColumn
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {}
  const fromMeta = String(meta.event_type || '').trim().toLowerCase()
  if (EVENT_TYPES.has(fromMeta)) return fromMeta
  const page = String(event.page || '').toLowerCase()
  if (page.includes('inquiry') || page.includes('contact')) return 'inquiry'
  return 'pageview'
}

function normalizeReferrer(event) {
  const direct = String(event.referrer || '').trim()
  if (direct) return direct.toLowerCase()
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {}
  const fromMeta = String(meta.referrer || meta.source || '').trim()
  return fromMeta ? fromMeta.toLowerCase() : 'direct'
}

function normalizePropertyId(event) {
  if (event.property_id) return String(event.property_id)
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {}
  return meta.property_id ? String(meta.property_id) : null
}

function normalizeSessionId(event) {
  if (event.session_id) return String(event.session_id)
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {}
  return meta.session_id ? String(meta.session_id) : null
}

function inRange(createdAt, start, end) {
  const ts = new Date(createdAt).getTime()
  return ts >= start.getTime() && ts <= end.getTime()
}

function pct(numerator, denominator) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function topEntries(map, limit = 8) {
  return Object.entries(map)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export async function getWhiteLabelAnalytics({ agencyId, startDate, endDate } = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const defaults = defaultRange()
  const start = startOfDay(parseDate(startDate, defaults.start))
  const end = endOfDay(parseDate(endDate, defaults.end))

  const [events, properties] = await Promise.all([
    findAll('website_analytics', (row) => row.agency_id === agencyId),
    findAll('properties', (row) => row.agency_id === agencyId),
  ])

  const propertyTitles = new Map(
    properties.map((row) => [String(row.id), row.title || row.name || `Listing ${row.id}`]),
  )

  const filtered = events.filter((event) => inRange(event.created_at, start, end))

  const sessions = new Set()
  let pageviews = 0
  let inquiries = 0
  let conversions = 0
  let bazaarReferrals = 0
  const byPage = {}
  const byDevice = {}
  const bySource = {}
  const listingViews = {}
  const daily = {}

  for (const event of filtered) {
    const eventType = normalizeEventType(event)
    const referrer = normalizeReferrer(event)
    const page = String(event.page || '/').trim() || '/'
    const device = String(event.device || 'unknown').trim() || 'unknown'
    const sessionId = normalizeSessionId(event)
    const propertyId = normalizePropertyId(event)
    const day = String(event.created_at || '').slice(0, 10)

    if (sessionId) sessions.add(sessionId)
    if (eventType === 'pageview') pageviews += 1
    if (eventType === 'inquiry') inquiries += 1
    if (eventType === 'conversion') conversions += 1
    if (referrer.includes('bazaar')) bazaarReferrals += 1

    byPage[page] = (byPage[page] || 0) + 1
    byDevice[device] = (byDevice[device] || 0) + 1
    bySource[referrer] = (bySource[referrer] || 0) + 1

    if (propertyId) {
      listingViews[propertyId] = (listingViews[propertyId] || 0) + 1
    }

    if (day) {
      if (!daily[day]) daily[day] = { date: day, pageviews: 0, inquiries: 0, visitors: 0 }
      if (eventType === 'pageview') daily[day].pageviews += 1
      if (eventType === 'inquiry') daily[day].inquiries += 1
      if (sessionId) daily[day].visitors += 1
    }
  }

  const visitors = sessions.size || pageviews
  const conversionRate = pct(inquiries, pageviews)
  const bazaarReferralShare = pct(bazaarReferrals, pageviews)

  const topListings = topEntries(listingViews, 10).map((row) => ({
    property_id: row.key,
    title: propertyTitles.get(row.key) || `Listing ${row.key}`,
    views: row.value,
  }))

  const trend = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date))

  return {
    agency_id: agencyId,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    kpis: {
      visitors,
      inquiries,
      conversions,
      conversion_rate: conversionRate,
      bazaar_referral_share: bazaarReferralShare,
      pageviews,
    },
    top_pages: topEntries(byPage),
    traffic_sources: topEntries(bySource),
    devices: topEntries(byDevice),
    top_listings: topListings,
    trend,
    total_events: filtered.length,
  }
}
