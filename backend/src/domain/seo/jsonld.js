/**
 * Wave 2F — schema.org RealEstateListing JSON-LD generation + validation.
 */

const REQUIRED_FIELDS = ['@context', '@type', 'name']

function normalizePhotos(property) {
  if (Array.isArray(property.photos)) return property.photos.filter(Boolean)
  if (typeof property.photos === 'string' && property.photos) {
    return property.photos.split('|').filter(Boolean)
  }
  return []
}

function buildAddress(property) {
  const parts = [property.location, property.neighborhood, property.city].filter(Boolean)
  if (!parts.length && property.latitude == null) return undefined
  const address = {
    '@type': 'PostalAddress',
  }
  if (property.location) address.streetAddress = property.location
  if (property.neighborhood) address.addressLocality = property.neighborhood
  if (property.city) address.addressRegion = property.city
  return address
}

/**
 * Build schema.org/RealEstateListing JSON-LD from a serialized property.
 */
export function buildRealEstateListingJsonLd(property, { canonicalUrl, title, description } = {}) {
  const photos = normalizePhotos(property)
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title || property.title || 'Property listing',
    description: description || property.description || undefined,
    url: canonicalUrl || undefined,
  }

  if (property.price != null) {
    jsonld.offers = {
      '@type': 'Offer',
      price: String(property.price),
      priceCurrency: property.price_unit || property.currency || 'USD',
    }
  }

  const address = buildAddress(property)
  if (address) {
    jsonld.address = address
  }

  if (property.latitude != null && property.longitude != null) {
    jsonld.geo = {
      '@type': 'GeoCoordinates',
      latitude: Number(property.latitude),
      longitude: Number(property.longitude),
    }
  }

  if (property.bedrooms != null) {
    jsonld.numberOfBedrooms = Number(property.bedrooms)
  }
  if (property.bathrooms != null) {
    jsonld.numberOfBathroomsTotal = Number(property.bathrooms)
  }
  if (property.area != null) {
    jsonld.floorSize = {
      '@type': 'QuantitativeValue',
      value: Number(property.area),
      unitCode: property.area_unit || 'SQF',
    }
  }
  if (property.property_type) {
    jsonld.category = property.property_type
  }
  if (photos.length) {
    jsonld.image = photos.slice(0, 10)
  }

  return jsonld
}

/**
 * Validate JSON-LD has required schema.org fields for RealEstateListing.
 */
export function validateJsonLd(jsonld) {
  const errors = []
  if (!jsonld || typeof jsonld !== 'object') {
    return { valid: false, errors: ['JSON-LD must be an object'] }
  }
  for (const field of REQUIRED_FIELDS) {
    if (!jsonld[field]) errors.push(`Missing required field: ${field}`)
  }
  if (jsonld['@context'] && !String(jsonld['@context']).includes('schema.org')) {
    errors.push('@context must reference schema.org')
  }
  const allowedTypes = new Set(['RealEstateListing', 'Product', 'Residence', 'House', 'Apartment'])
  if (jsonld['@type'] && !allowedTypes.has(jsonld['@type'])) {
    errors.push(`@type must be a real-estate schema type, got: ${jsonld['@type']}`)
  }
  if (jsonld.name && String(jsonld.name).length < 5) {
    errors.push('name is too short for SEO')
  }
  return { valid: errors.length === 0, errors }
}
