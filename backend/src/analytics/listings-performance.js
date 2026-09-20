import { findAll } from '../db.js'
import { aggregateListingEvents } from '../platformModel.js'
import { buildScopeFilter } from './scope.js'

function parseDate(date) {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

function isInRange(iso, startDate, endDate) {
  if (!iso) return false
  const d = parseDate(iso)
  if (!d) return false
  if (startDate && d < startDate) return false
  if (endDate && d >= endDate) return false
  return true
}

function matchesArea(property, area) {
  if (!area) return true
  const needle = area.trim().toLowerCase()
  if (!needle) return true
  const city = String(property.city || '').toLowerCase()
  const neighborhood = String(property.neighborhood || '').toLowerCase()
  return city === needle || neighborhood === needle || city.includes(needle) || neighborhood.includes(needle)
}

function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 100)
}

export async function getListingsPerformance({
  agencyId,
  startDate,
  endDate,
  agentId,
  area,
  propertyType,
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const start = parseDate(startDate)
  const end = parseDate(endDate)

  // Properties carry agency/agent/property_type as typed columns, so push those
  // into SQL (area is a substring match and stays in JS). agents is a full
  // lookup load; listing_events (legacy JSONB) and profile_followers (entity
  // fields live in the JSONB blob) can't push their scope to typed columns.
  const [
    allProperties,
    allAgents,
    allListingEvents,
    allProfileFollowers,
  ] = await Promise.all([
    findAll('properties', buildScopeFilter({
      columns: { agency_id: agencyId, agent_id: agentId, property_type: propertyType },
    })),
    findAll('agents'),
    findAll('listing_events'),
    findAll('profile_followers'),
  ])

  const agentNames = new Map(allAgents.map((row) => [row.id, row.name || row.email || row.id]))

  const scopedProperties = allProperties.filter((row) => {
    if (row.agency_id !== agencyId) return false
    if (agentId && row.agent_id !== agentId) return false
    if (propertyType && row.property_type !== propertyType) return false
    if (!matchesArea(row, area)) return false
    return true
  })

  const propertyIds = new Set(scopedProperties.map((row) => row.id))

  // Inquiries/viewings/opportunities are only kept for scoped properties, so
  // push property_id IN (…) down to SQL. created_at windows push too for the
  // tables the JS filters on created_at directly; viewings coalesce
  // scheduled_at || created_at, which stays a JS-only window.
  const propertyIdList = [...propertyIds]
  const [allInquiries, allViewings, allOpportunities] = await Promise.all([
    findAll('inquiries', buildScopeFilter({
      columns: { property_id: propertyIdList }, dateColumn: 'created_at', startDate: start, endDate: end,
    })),
    findAll('viewings', buildScopeFilter({ columns: { property_id: propertyIdList } })),
    findAll('opportunities', buildScopeFilter({
      columns: { property_id: propertyIdList }, dateColumn: 'created_at', startDate: start, endDate: end,
    })),
  ])

  const scopedInquiries = allInquiries.filter((row) => {
    if (!propertyIds.has(row.property_id)) return false
    return isInRange(row.created_at, start, end)
  })

  const scopedViewings = allViewings.filter((row) => {
    if (!propertyIds.has(row.property_id)) return false
    return isInRange(row.scheduled_at || row.created_at, start, end)
  })

  const scopedOpportunities = allOpportunities.filter((row) => {
    if (!propertyIds.has(row.property_id)) return false
    return isInRange(row.created_at, start, end)
  })

  const scopedEvents = allListingEvents.filter((row) => {
    if (!propertyIds.has(row.property_id)) return false
    return isInRange(row.created_at, start, end)
  })

  const savesByProperty = new Map()
  for (const row of allProfileFollowers) {
    if (row.entity_type !== 'property' || !propertyIds.has(row.entity_id)) continue
    if (row.status === 'unfollowed') continue
    if (!isInRange(row.created_at, start, end)) continue
    savesByProperty.set(row.entity_id, (savesByProperty.get(row.entity_id) || 0) + 1)
  }

  const inquiriesByProperty = new Map()
  for (const row of scopedInquiries) {
    inquiriesByProperty.set(row.property_id, (inquiriesByProperty.get(row.property_id) || 0) + 1)
  }

  const viewingsByProperty = new Map()
  for (const row of scopedViewings) {
    viewingsByProperty.set(row.property_id, (viewingsByProperty.get(row.property_id) || 0) + 1)
  }

  const conversionsByProperty = new Map()
  for (const row of scopedOpportunities) {
    if (row.stage !== 'closed_won') continue
    conversionsByProperty.set(row.property_id, (conversionsByProperty.get(row.property_id) || 0) + 1)
  }

  const eventsByProperty = new Map()
  for (const row of scopedEvents) {
    if (!eventsByProperty.has(row.property_id)) eventsByProperty.set(row.property_id, [])
    eventsByProperty.get(row.property_id).push(row)
  }

  const rows = scopedProperties.map((property) => {
    const events = eventsByProperty.get(property.id) || []
    const agg = aggregateListingEvents(events)
    const distViews = property.views || property.data?.views || 0
    const views = Math.max(distViews, agg.views)
    const clicks = agg.clicks
    const inquiries = inquiriesByProperty.get(property.id) || 0
    const viewings = viewingsByProperty.get(property.id) || 0
    const saves = savesByProperty.get(property.id) || 0
    const conversions = conversionsByProperty.get(property.id) || 0

    return {
      id: property.id,
      title: property.title || 'Untitled listing',
      city: property.city || null,
      neighborhood: property.neighborhood || null,
      property_type: property.property_type || null,
      status: property.status || 'active',
      agent_id: property.agent_id || null,
      agent_name: property.agent_id ? agentNames.get(property.agent_id) || property.agent_id : null,
      views,
      clicks,
      saves,
      inquiries,
      viewings,
      conversions,
      conversion_rate: pct(conversions, inquiries),
      engagement: views + clicks + inquiries + viewings,
    }
  }).sort((a, b) => b.views - a.views)

  const overview = {
    listings: rows.length,
    active_listings: rows.filter((row) => row.status === 'active').length,
    total_views: rows.reduce((sum, row) => sum + row.views, 0),
    total_saves: rows.reduce((sum, row) => sum + row.saves, 0),
    total_inquiries: rows.reduce((sum, row) => sum + row.inquiries, 0),
    total_viewings: rows.reduce((sum, row) => sum + row.viewings, 0),
    total_conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    conversion_rate: pct(
      rows.reduce((sum, row) => sum + row.conversions, 0),
      rows.reduce((sum, row) => sum + row.inquiries, 0),
    ),
  }

  const overallEvents = aggregateListingEvents(scopedEvents)

  const filterOptions = {
    agents: [...new Set(scopedProperties.map((row) => row.agent_id).filter(Boolean))]
      .map((id) => ({ id, name: agentNames.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    areas: [...new Set(
      scopedProperties.flatMap((row) => [row.city, row.neighborhood].filter(Boolean)),
    )].sort((a, b) => a.localeCompare(b)),
    property_types: [...new Set(scopedProperties.map((row) => row.property_type).filter(Boolean))].sort(),
  }

  return {
    generated_at: new Date().toISOString(),
    agency_id: agencyId,
    filters: {
      start_date: startDate || null,
      end_date: endDate || null,
      agent_id: agentId || null,
      area: area || null,
      property_type: propertyType || null,
    },
    overview,
    rows,
    by_channel: overallEvents.by_channel,
    by_device: overallEvents.by_device,
    top_listings: rows.slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title,
      views: row.views,
      inquiries: row.inquiries,
    })),
    filter_options: filterOptions,
  }
}

export default { getListingsPerformance }
