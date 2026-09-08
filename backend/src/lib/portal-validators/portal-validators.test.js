/**
 * Fast unit tests for BE-BLOCKER-17 per-portal validators.
 * Missing required → fail; present → pass; image too small → fail;
 * Aqarmap developer_registration only for off-plan; Wasalt AI meta → warn;
 * Property Finder country variants.
 */
import { describe, expect, it } from 'vitest'
import { validate, KNOWN_PORTAL_CODES } from './index.js'
import { validate as validateBayut } from './bayut.js'
import { validate as validatePf, PF_COUNTRY_VARIANTS } from './property_finder.js'
import { validate as validateAqarmap } from './aqarmap.js'
import { validate as validateWasalt } from './wasalt.js'
import { validate as validateDubizzle } from './dubizzle.js'
import { validate as validateOlx } from './olx.js'
import { validate as validateAqar } from './aqar.js'
import { validate as validateAkarat } from './3akarat.js'
import { FIVE_MB, readImageMeta } from './image-spec.js'

function byCode(result, code) {
  return (result.checks || []).filter((c) => c.code === code)
}

function hasSeverity(result, code, severity) {
  return byCode(result, code).some((c) => c.severity === severity)
}

function okImage(overrides = {}) {
  return {
    width: 1600,
    height: 1200,
    mime: 'image/jpeg',
    bytes: 200_000,
    ...overrides,
  }
}

function completeBaseline(overrides = {}) {
  return {
    title: 'Marina View 2BR',
    price: 1_500_000,
    currency: 'AED',
    city: 'Dubai',
    images: [okImage()],
    ...overrides,
  }
}

describe('portal-validators index', () => {
  it('exports all eight portal modules', () => {
    expect([...KNOWN_PORTAL_CODES].sort()).toEqual([
      '3akarat',
      'aqar',
      'aqarmap',
      'bayut',
      'dubizzle',
      'olx',
      'property_finder',
      'wasalt',
    ].sort())
  })

  it('unknown portal → fail unknown_portal', () => {
    const result = validate(completeBaseline(), { portalCode: 'blue_door' })
    expect(hasSeverity(result, 'unknown_portal', 'fail')).toBe(true)
    expect(result.checks[0].expected).toContain('bayut')
  })

  it('dispatches on portalContext.code and portalCode', () => {
    const listing = {
      ...completeBaseline(),
      trakheesi_number: 'TRK-1',
      broker_orn: 'ORN-1',
    }
    expect(hasSeverity(validate(listing, { portalCode: 'bayut', countryCode: 'AE' }), 'required_trakheesi_number', 'pass')).toBe(true)
    expect(hasSeverity(validate(listing, { code: 'bayut', countryCode: 'AE' }), 'required_trakheesi_number', 'pass')).toBe(true)
  })

  it('missing portal identity → unknown_portal fail', () => {
    const result = validate(completeBaseline(), { countryCode: 'AE' })
    expect(hasSeverity(result, 'unknown_portal', 'fail')).toBe(true)
  })
})

describe('bayut', () => {
  it('UAE missing required fields → fail', () => {
    const result = validateBayut({ images: [okImage()] }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'required_trakheesi_number', 'fail')).toBe(true)
    expect(hasSeverity(result, 'required_broker_orn', 'fail')).toBe(true)
  })

  it('UAE present fields (including data/metadata bags) → pass', () => {
    const result = validateBayut({
      data: { trakheesi_number: '12345' },
      metadata: { broker_orn: 'ORN-99' },
      images: [okImage()],
    }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'required_trakheesi_number', 'pass')).toBe(true)
    expect(hasSeverity(result, 'required_broker_orn', 'pass')).toBe(true)
    expect(hasSeverity(result, 'image_dimensions', 'pass')).toBe(true)
  })

  it('image too small → fail', () => {
    const result = validateBayut({
      trakheesi_number: 'T',
      broker_orn: 'O',
      images: [{ width: 400, height: 300, mime: 'image/png', bytes: 1000 }],
    }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'image_dimensions', 'fail')).toBe(true)
  })

  it('image over 5MB → fail', () => {
    const result = validateBayut({
      trakheesi_number: 'T',
      broker_orn: 'O',
      images: [okImage({ bytes: FIVE_MB + 1 })],
    }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'image_size', 'fail')).toBe(true)
  })

  it('KSA requires advertiser_license (Fal), not UAE permits', () => {
    const missing = validateBayut({ images: [okImage()] }, { countryCode: 'SA' })
    expect(hasSeverity(missing, 'required_advertiser_license', 'fail')).toBe(true)
    expect(byCode(missing, 'required_trakheesi_number')).toHaveLength(0)

    const present = validateBayut({
      metadata: { advertiser_license: 'FAL-1' },
      images: [okImage()],
    }, { portalCode: 'bayut', countryCode: 'SA' })
    expect(hasSeverity(present, 'required_advertiser_license', 'pass')).toBe(true)
  })
})

describe('property_finder', () => {
  it('UAE missing agency_license / broker_id → fail', () => {
    const result = validatePf({ images: [okImage()] }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'required_agency_license', 'fail')).toBe(true)
    expect(hasSeverity(result, 'required_broker_id', 'fail')).toBe(true)
  })

  it('UAE present → pass; UAE does not accept country aliases', () => {
    const present = validatePf({
      agency_license: 'CN-1',
      broker_id: 'BR-1',
      images: [okImage()],
    }, { countryCode: 'AE' })
    expect(hasSeverity(present, 'required_agency_license', 'pass')).toBe(true)
    expect(hasSeverity(present, 'required_broker_id', 'pass')).toBe(true)

    const aliasOnly = validatePf({
      license_number: 'CN-1',
      agent_id: 'BR-1',
      images: [okImage()],
    }, { countryCode: 'AE' })
    expect(hasSeverity(aliasOnly, 'required_agency_license', 'fail')).toBe(true)
    expect(hasSeverity(aliasOnly, 'required_broker_id', 'fail')).toBe(true)
  })

  it('image below 1200px → fail', () => {
    const result = validatePf({
      agency_license: 'CN-1',
      broker_id: 'BR-1',
      images: [{ width: 800, height: 600, mime: 'image/jpeg', bytes: 1000 }],
    }, { countryCode: 'AE' })
    expect(hasSeverity(result, 'image_dimensions', 'fail')).toBe(true)
  })

  it('country variants accept documented aliases for every PF market', () => {
    expect(PF_COUNTRY_VARIANTS).toEqual(['SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM'])
    for (const countryCode of PF_COUNTRY_VARIANTS) {
      const result = validatePf({
        data: { license_number: 'LIC-SA', agent_id: 'AG-9' },
        images: [okImage()],
      }, { code: 'property_finder', countryCode })
      expect(hasSeverity(result, 'required_agency_license', 'pass')).toBe(true)
      expect(hasSeverity(result, 'required_broker_id', 'pass')).toBe(true)
    }
  })
})

describe('aqarmap', () => {
  it('developer_registration required only for primary/off-plan', () => {
    const offPlan = validateAqarmap({
      off_plan: true,
      images: [okImage({ width: 800, height: 600 })],
    })
    expect(hasSeverity(offPlan, 'required_developer_registration', 'fail')).toBe(true)

    const primary = validateAqarmap({
      market_type: 'primary',
      developer_registration: 'DEV-1',
      images: [okImage({ width: 800, height: 600 })],
    })
    expect(hasSeverity(primary, 'required_developer_registration', 'pass')).toBe(true)

    const hyphen = validateAqarmap({
      sale_type: 'off-plan',
      images: [okImage({ width: 800, height: 600 })],
    })
    expect(hasSeverity(hyphen, 'required_developer_registration', 'fail')).toBe(true)

    const resale = validateAqarmap({
      market_type: 'secondary',
      images: [okImage({ width: 800, height: 600 })],
    })
    expect(hasSeverity(resale, 'required_developer_registration', 'fail')).toBe(false)
    expect(hasSeverity(resale, 'required_developer_registration', 'pass')).toBe(true)
  })

  it('image below 600px → fail', () => {
    const result = validateAqarmap({
      images: [{ width: 400, height: 400, mime: 'image/png', bytes: 100 }],
    })
    expect(hasSeverity(result, 'image_dimensions', 'fail')).toBe(true)
  })
})

describe('wasalt', () => {
  it('missing AI-verification metadata → warn, not fail', () => {
    const result = validateWasalt({ images: [okImage()] })
    expect(hasSeverity(result, 'ai_verification', 'warn')).toBe(true)
    expect(result.checks.every((c) => c.severity !== 'fail')).toBe(true)
  })

  it('present wasalt_verified metadata → pass', () => {
    const result = validateWasalt({
      metadata: { wasalt_verified: true },
      images: [okImage()],
    })
    expect(hasSeverity(result, 'ai_verification', 'pass')).toBe(true)
  })
})

describe('baseline portals (dubizzle, olx, aqar, 3akarat)', () => {
  const modules = [
    ['dubizzle', validateDubizzle],
    ['olx', validateOlx],
    ['aqar', validateAqar],
    ['3akarat', validateAkarat],
  ]

  for (const [name, fn] of modules) {
    it(`${name}: missing title/price/currency/location/image → fail`, () => {
      const result = fn({})
      expect(hasSeverity(result, 'required_title', 'fail')).toBe(true)
      expect(hasSeverity(result, 'required_price', 'fail')).toBe(true)
      expect(hasSeverity(result, 'required_currency', 'fail')).toBe(true)
      expect(hasSeverity(result, 'required_location', 'fail')).toBe(true)
      expect(hasSeverity(result, 'required_image', 'fail')).toBe(true)
    })

    it(`${name}: present baseline fields → pass`, () => {
      const result = fn(completeBaseline())
      expect(hasSeverity(result, 'required_title', 'pass')).toBe(true)
      expect(hasSeverity(result, 'required_price', 'pass')).toBe(true)
      expect(hasSeverity(result, 'required_currency', 'pass')).toBe(true)
      expect(hasSeverity(result, 'required_location', 'pass')).toBe(true)
    })

    it(`${name}: missing image dimensions → warn; below 600px → fail`, () => {
      const missing = fn(completeBaseline({
        images: [{ mime: 'image/jpeg', bytes: 1000 }],
      }))
      expect(hasSeverity(missing, 'image_dimensions', 'warn')).toBe(true)

      const small = fn(completeBaseline({
        images: [{ width: 400, height: 400, mime: 'image/jpeg', bytes: 1000 }],
      }))
      expect(hasSeverity(small, 'image_dimensions', 'fail')).toBe(true)
    })
  }
})

describe('image-spec helpers', () => {
  it('reads width/height/mime/size from documented field names', () => {
    const meta = readImageMeta({
      width: 800,
      height: 600,
      content_type: 'image/png',
      size: 4096,
    })
    expect(meta).toMatchObject({ width: 800, height: 600, mime: 'image/png', bytes: 4096, maxSide: 800 })
  })
})
