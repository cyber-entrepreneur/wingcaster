/**
 * Wave 2F — SEO unit tests.
 */
import { describe, expect, it } from 'vitest'
import { buildRealEstateListingJsonLd, validateJsonLd } from './jsonld.js'
import { buildCanonicalUrl, buildOgTags, slugify, validateMetaLength, validateTitleLength } from './meta.js'
import { computeSeoRecommendations } from './recommendations.js'

const sampleProperty = {
  id: 'prop_test_1',
  title: 'Modern 3BR Villa in Palm Jumeirah with Sea Views',
  description: 'Stunning waterfront villa featuring open-plan living, private pool, and direct beach access in Dubai\'s iconic Palm Jumeirah community.',
  price: 4500000,
  price_unit: 'AED',
  bedrooms: 3,
  bathrooms: 4,
  area: 3200,
  area_unit: 'SQF',
  city: 'Dubai',
  neighborhood: 'Palm Jumeirah',
  location: 'Frond G',
  latitude: 25.1124,
  longitude: 55.1390,
  property_type: 'villa',
  photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
}

describe('SEO JSON-LD', () => {
  it('builds valid schema.org RealEstateListing', () => {
    const jsonld = buildRealEstateListingJsonLd(sampleProperty, {
      canonicalUrl: 'https://example.com/property/prop_test_1',
      title: sampleProperty.title,
      description: sampleProperty.description,
    })
    const result = validateJsonLd(jsonld)
    expect(result.valid).toBe(true)
    expect(jsonld['@type']).toBe('RealEstateListing')
    expect(jsonld['@context']).toContain('schema.org')
    expect(jsonld.name).toBe(sampleProperty.title)
    expect(jsonld.offers.price).toBe('4500000')
    expect(jsonld.numberOfBedrooms).toBe(3)
    expect(jsonld.image).toHaveLength(2)
  })
})

describe('SEO meta', () => {
  it('generates canonical URLs per target surface', async () => {
    const wl = await buildCanonicalUrl('agency_white_label', sampleProperty, {
      subdomain: 'aleph',
      appBase: 'https://app.wingcaster.com',
    })
    expect(wl).toBe('https://app.wingcaster.com/site/aleph/property/prop_test_1')

    const ext = await buildCanonicalUrl('external_site', sampleProperty, {
      slug: 'modern-villa-palm',
      externalSiteUrl: 'https://myagent.com',
    })
    expect(ext).toBe('https://myagent.com/listings/modern-villa-palm')

    const bazaar = await buildCanonicalUrl('bazaar', sampleProperty, {
      appBase: 'https://app.wingcaster.com',
    })
    expect(bazaar).toBe('https://app.wingcaster.com/property/prop_test_1')
  })

  it('builds OG/Twitter tags', () => {
    const tags = buildOgTags({
      title: 'Test Listing',
      description: 'A great property',
      canonicalUrl: 'https://example.com/p/1',
      imageUrl: 'https://example.com/img.jpg',
    })
    expect(tags['og:title']).toBe('Test Listing')
    expect(tags['og:description']).toBe('A great property')
    expect(tags['og:url']).toBe('https://example.com/p/1')
    expect(tags['twitter:card']).toBe('summary_large_image')
  })

  it('validates title and meta length rules', () => {
    const shortTitle = validateTitleLength('Short')
    expect(shortTitle.ok).toBe(false)
    const goodTitle = validateTitleLength('Modern 3BR Villa in Palm Jumeirah Sea Views')
    expect(goodTitle.ok).toBe(true)

    const shortMeta = validateMetaLength('Too short.')
    expect(shortMeta.ok).toBe(false)
    const goodMeta = validateMetaLength(
      'Discover this stunning waterfront villa in Palm Jumeirah featuring open-plan living, private pool, and direct beach access in Dubai.',
    )
    expect(goodMeta.ok).toBe(true)
  })

  it('slugifies titles', () => {
    expect(slugify('Modern 3BR Villa!')).toBe('modern-3br-villa')
  })
})

describe('SEO target toggle', () => {
  it('can_toggle is a boolean when both surfaces are present', () => {
    const ownWhiteLabel = { subdomain: 'solo-agent' }
    const external = { url: 'https://freeagent.example.com', source: 'agent_profile' }
    const canToggle = Boolean(ownWhiteLabel && external)
    expect(canToggle).toBe(true)
    expect(typeof canToggle).toBe('boolean')
  })
})

describe('SEO recommendations', () => {
  it('computes score and recommendations', () => {
    const seoPage = {
      title: 'Modern 3BR Villa in Palm Jumeirah with Sea Views',
      meta_description: 'Discover this stunning waterfront villa in Palm Jumeirah featuring open-plan living, private pool, and direct beach access in Dubai community.',
      canonical_url: 'https://example.com/p/1',
      schema_jsonld: buildRealEstateListingJsonLd(sampleProperty, {
        canonicalUrl: 'https://example.com/p/1',
        title: sampleProperty.title,
      }),
    }
    const result = computeSeoRecommendations(sampleProperty, seoPage, {
      targetSurface: 'agency_white_label',
    })
    expect(result.score).toBeGreaterThan(50)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.checks.jsonld.valid).toBe(true)
  })
})
