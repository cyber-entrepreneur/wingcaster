/**
 * Defensive listing field access for per-portal validators.
 *
 * Looks up `listing.<name>` then `listing.data.*` then `listing.metadata.*`
 * (and nested data.metadata / metadata.data). Missing required fields are
 * `fail`; the caller decides warn vs pass for soft/TBD rules.
 */

const NESTED_BAGS = ['data', 'metadata', 'attrs', 'attributes']

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function listingBags(listing) {
  if (!isPlainObject(listing)) return []
  const bags = [listing]
  for (const key of NESTED_BAGS) {
    const bag = listing[key]
    if (!isPlainObject(bag)) continue
    bags.push(bag)
    for (const nested of NESTED_BAGS) {
      if (isPlainObject(bag[nested])) bags.push(bag[nested])
    }
  }
  return bags
}

export function getListingField(listing, ...names) {
  const bags = listingBags(listing)
  for (const name of names) {
    if (!name) continue
    for (const bag of bags) {
      if (!Object.prototype.hasOwnProperty.call(bag, name)) continue
      const value = bag[name]
      if (value == null || value === '') continue
      return value
    }
  }
  return undefined
}

export function isPresent(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export function displayActual(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.length
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function makeCheck({ code, severity, message, expected, actual }) {
  return {
    code,
    severity,
    message,
    expected: expected == null ? null : expected,
    actual: actual === undefined ? null : actual,
  }
}

export function requiredFieldCheck(listing, {
  code,
  names,
  label,
  expected,
} = {}) {
  const actual = getListingField(listing, ...(names || []))
  if (isPresent(actual)) {
    return makeCheck({
      code,
      severity: 'pass',
      message: `${label} is present`,
      expected: expected || label,
      actual: displayActual(actual),
    })
  }
  return makeCheck({
    code,
    severity: 'fail',
    message: `${label} is required`,
    expected: expected || label,
    actual: null,
  })
}

export function getCountryCode(portalContext = {}, listing) {
  const ctx = portalContext || {}
  const raw = ctx.countryCode
    || ctx.country_code
    || ctx.country
    || getListingField(listing, 'country_code', 'countryCode', 'country')
  return String(raw || '').trim().toUpperCase()
}

const PRIMARY_OFFPLAN = new Set(['primary', 'off_plan', 'offplan', 'off-plan'])

export function isOffPlanOrPrimary(listing) {
  const flag = getListingField(listing, 'off_plan', 'offPlan', 'is_off_plan', 'isOffPlan')
  if (flag === true || flag === 'true' || flag === 1 || flag === '1') return true
  for (const name of ['market_type', 'marketType', 'sale_type', 'saleType']) {
    const raw = getListingField(listing, name)
    if (raw == null) continue
    const normalised = String(raw).trim().toLowerCase().replace(/-/g, '_')
    if (PRIMARY_OFFPLAN.has(normalised) || PRIMARY_OFFPLAN.has(String(raw).trim().toLowerCase())) {
      return true
    }
  }
  return false
}

export function getTitle(listing) {
  return getListingField(listing, 'title', 'name', 'headline', 'listing_title')
}

export function getPrice(listing) {
  const direct = getListingField(listing, 'price', 'asking_price', 'price_amount', 'amount')
  if (direct != null && typeof direct === 'object' && !Array.isArray(direct)) {
    return getListingField(direct, 'amount', 'value', 'price') ?? direct
  }
  return direct
}

export function getCurrency(listing) {
  const nestedPrice = getListingField(listing, 'price')
  if (nestedPrice && typeof nestedPrice === 'object' && !Array.isArray(nestedPrice)) {
    const fromPrice = getListingField(nestedPrice, 'currency', 'currency_code')
    if (isPresent(fromPrice)) return fromPrice
  }
  return getListingField(listing, 'currency', 'currency_code', 'price_currency')
}

export function getLocation(listing) {
  const nested = getListingField(listing, 'address', 'location')
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const fromAddr = getListingField(nested, 'city', 'city_name', 'locality', 'area', 'district', 'name')
    if (isPresent(fromAddr)) return fromAddr
    if (typeof nested === 'string') return nested
  }
  return getListingField(
    listing,
    'city',
    'city_name',
    'location',
    'locality',
    'area',
    'district',
    'emirate',
  )
}
