/**
 * Property Finder Group publisher adapter (BE-BLOCKER-01).
 *
 * One adapter covers PF's nine Phase-1 countries. There is no live partner
 * API in this repo — HTTP is injected (`httpClient`, default `fetch`) so
 * unit/postgres tests mock the network. Metering stays in
 * `publishToRealEstatePortal` (Option 2); this file must not call meterFeature.
 *
 * Env:
 *   PF_API_KEY, PF_CLIENT_ID, PF_CLIENT_SECRET
 *   PF_API_BASE_URL          — override every country
 *   PF_API_BASE_URL_<CC>     — per-country override (e.g. PF_API_BASE_URL_AE)
 */
import { PortalPublisher } from './base.js'
import { recordDistributionAttempt } from '../../publishing/record-attempt.js'

/** ISO country codes covered by the Property Finder Group deal (D19). */
export const PF_SUPPORTED_COUNTRIES = Object.freeze([
  'AE', 'SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM',
])

/**
 * Per-country API hosts for the Property Finder Group partner API.
 * Consumer sites share these hostnames; the partner API is assumed to live
 * at `https://{host}/partner/v1` until a commercial URL is documented.
 *
 *   AE  propertyfinder.ae
 *   SA  propertyfinder.sa
 *   EG  propertyfinder.eg
 *   LB  propertyfinder.com.lb
 *   JO  propertyfinder.jo      (country-variant of the group API)
 *   QA  propertyfinder.qa
 *   KW  propertyfinder.com.kw
 *   BH  propertyfinder.bh
 *   OM  propertyfinder.om
 */
export const PF_API_HOSTS = Object.freeze({
  AE: 'www.propertyfinder.ae',
  SA: 'www.propertyfinder.sa',
  EG: 'www.propertyfinder.eg',
  LB: 'www.propertyfinder.com.lb',
  JO: 'www.propertyfinder.jo',
  QA: 'www.propertyfinder.qa',
  KW: 'www.propertyfinder.com.kw',
  BH: 'www.propertyfinder.bh',
  OM: 'www.propertyfinder.om',
})

/** Default ISO currencies when the listing omits one. */
export const PF_DEFAULT_CURRENCY = Object.freeze({
  AE: 'AED',
  SA: 'SAR',
  EG: 'EGP',
  LB: 'USD',
  JO: 'JOD',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
})

/**
 * License / broker field aliases. UAE requires `agency_license` + `broker_id`.
 * Other countries accept those names OR the country-specific aliases; missing
 * both canonical and alias is a fail-closed check.
 */
export const PF_LICENSE_FIELD_ALIASES = Object.freeze({
  AE: { license: ['agency_license'], broker: ['broker_id'] },
  SA: { license: ['agency_license', 'advertiser_license', 'fal_license'], broker: ['broker_id'] },
  EG: { license: ['agency_license', 'developer_registration'], broker: ['broker_id'] },
  LB: { license: ['agency_license', 'syndicate_license'], broker: ['broker_id'] },
  JO: { license: ['agency_license'], broker: ['broker_id'] },
  QA: { license: ['agency_license', 'rera_permit'], broker: ['broker_id'] },
  KW: { license: ['agency_license'], broker: ['broker_id'] },
  BH: { license: ['agency_license'], broker: ['broker_id'] },
  OM: { license: ['agency_license'], broker: ['broker_id'] },
})

export const PF_IMAGE_MIN_PX = 1200
export const PF_IMAGE_FORMATS = Object.freeze(['jpg', 'jpeg', 'png'])

/** Canonical listing shape the adapter accepts (used by tests). */
export function canonicalPfListing(overrides = {}) {
  return {
    id: 'lst-1',
    title: 'Marina apartment',
    description: 'Bright 2BR with sea view',
    price: 1_500_000,
    currency: 'AED',
    bedrooms: 2,
    bathrooms: 2,
    area: 1200,
    city: 'Dubai',
    neighborhood: 'Dubai Marina',
    country_code: 'AE',
    agency_license: 'ORN-12345',
    broker_id: 'BRK-9',
    images: [{ url: 'https://cdn.example.test/a.jpg', width: 1600, height: 1200 }],
    ...overrides,
  }
}

const LISTINGS_PATH = '/listings'
const ENQUIRIES_PATH = '/enquiries'

function codedError(code, message, extra = {}) {
  const err = new Error(message)
  err.code = code
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) err[key] = value
  }
  return err
}

function upper(value) {
  if (value == null || value === '') return null
  return String(value).trim().toUpperCase()
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

function pickAliasedField(sources, names) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const name of names) {
      const value = firstNonEmpty(source[name])
      if (value) return { name, value }
    }
  }
  return null
}

function imageExtension(url, mime) {
  const fromMime = String(mime || '').toLowerCase()
  if (fromMime.includes('jpeg') || fromMime.includes('jpg')) return 'jpg'
  if (fromMime.includes('png')) return 'png'
  const path = String(url || '').split('?')[0].split('#')[0]
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : ''
  if (ext === 'jpeg') return 'jpg'
  return ext || null
}

function collectImages(listing = {}) {
  const raw = listing.images || listing.photos || listing.media || []
  const list = Array.isArray(raw) ? raw : []
  return list.map((item) => {
    if (typeof item === 'string') return { url: item }
    if (!item || typeof item !== 'object') return null
    const url = item.url || item.src || item.href
    if (!url) return null
    return {
      url: String(url),
      width: Number(item.width ?? item.w ?? item.pixel_width) || null,
      height: Number(item.height ?? item.h ?? item.pixel_height) || null,
      mime: item.mime || item.contentType || item.content_type || item.media_type || null,
    }
  }).filter(Boolean)
}

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '')
}

export class PropertyFinderPortalPublisher extends PortalPublisher {
  /**
   * @param {object} [registryRow] row from public.portal_registry
   * @param {object} [options]
   * @param {typeof fetch} [options.httpClient] mockable HTTP client (default: fetch)
   * @param {object} [options.credentials] optional { apiKey, clientId, clientSecret }
   * @param {object} [options.hostMap] optional country → host overrides
   */
  constructor(registryRow = null, { httpClient, credentials, hostMap } = {}) {
    super(registryRow)
    this.code = registryRow?.code || 'property_finder'
    this.httpClient = httpClient || null
    this.credentials = credentials || null
    this.hostMap = hostMap || null
  }

  getHttpClient() {
    return this.httpClient || globalThis.fetch.bind(globalThis)
  }

  supportedCountryCodes() {
    const fromRegistry = this.registry?.country_codes
    if (Array.isArray(fromRegistry) && fromRegistry.length) {
      return fromRegistry
        .map((code) => upper(code))
        .filter((code) => PF_SUPPORTED_COUNTRIES.includes(code))
    }
    return [...PF_SUPPORTED_COUNTRIES]
  }

  /**
   * Resolve ISO country from agent context, listing, then registry.
   * @returns {string} uppercase ISO code
   */
  resolveCountryCode(listing = {}, agentContext = {}, portalContext = {}) {
    const candidates = [
      agentContext.countryCode,
      agentContext.country_code,
      listing.country_code,
      listing.countryCode,
      portalContext.countryCode,
      portalContext.country_code,
    ]
    let countryCode = candidates.map(upper).find(Boolean) || null
    const allowed = this.supportedCountryCodes()
    if (!countryCode && allowed.length === 1) countryCode = allowed[0]

    if (!countryCode) {
      throw codedError(
        'INVALID_CONTENT',
        'Property Finder country code is required (agentContext.countryCode or listing.country_code)',
        { status: 400 },
      )
    }
    if (!PF_SUPPORTED_COUNTRIES.includes(countryCode)) {
      throw codedError(
        'INVALID_CONTENT',
        `Unsupported Property Finder country: ${countryCode}`,
        { status: 400, expected: [...PF_SUPPORTED_COUNTRIES], actual: countryCode },
      )
    }
    if (allowed.length && !allowed.includes(countryCode)) {
      throw codedError(
        'PORTAL_RULES_VIOLATION',
        `Property Finder registry is not configured for ${countryCode}`,
        { status: 403, expected: allowed, actual: countryCode },
      )
    }
    return countryCode
  }

  resolveApiBaseUrl(countryCode) {
    const cc = upper(countryCode)
    const envCc = process.env[`PF_API_BASE_URL_${cc}`]
    if (envCc) return stripTrailingSlash(envCc)
    if (process.env.PF_API_BASE_URL) return stripTrailingSlash(process.env.PF_API_BASE_URL)

    const registryHosts = this.registry?.publisher_config?.hosts || this.registry?.publisher_config?.api_hosts
    const host = this.hostMap?.[cc]
      || registryHosts?.[cc]
      || PF_API_HOSTS[cc]
    if (!host) {
      throw codedError('INVALID_CONTENT', `No Property Finder API host for ${cc}`, { status: 400 })
    }
    const normalized = String(host).startsWith('http') ? stripTrailingSlash(host) : `https://${host}`
    return normalized.includes('/partner/') ? normalized : `${normalized}/partner/v1`
  }

  listingsUrl(countryCode) {
    return `${this.resolveApiBaseUrl(countryCode)}${LISTINGS_PATH}`
  }

  enquiriesUrl(countryCode) {
    return `${this.resolveApiBaseUrl(countryCode)}${ENQUIRIES_PATH}`
  }

  requireCredentials() {
    const apiKey = this.credentials?.apiKey || this.credentials?.api_key || process.env.PF_API_KEY
    const clientId = this.credentials?.clientId || this.credentials?.client_id || process.env.PF_CLIENT_ID
    const clientSecret = this.credentials?.clientSecret || this.credentials?.client_secret || process.env.PF_CLIENT_SECRET
    if (!firstNonEmpty(apiKey) || !firstNonEmpty(clientId) || !firstNonEmpty(clientSecret)) {
      throw codedError(
        'PUBLISH_CREDENTIALS_MISSING',
        'Property Finder API credentials are missing. Set PF_API_KEY, PF_CLIENT_ID, and PF_CLIENT_SECRET.',
      )
    }
    return {
      apiKey: String(apiKey).trim(),
      clientId: String(clientId).trim(),
      clientSecret: String(clientSecret).trim(),
    }
  }

  authHeaders() {
    const { apiKey, clientId, clientSecret } = this.requireCredentials()
    return {
      Authorization: `Bearer ${apiKey}`,
      'X-PF-Client-Id': clientId,
      'X-PF-Client-Secret': clientSecret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  mapListingToPayload(listing = {}, countryCode, agentContext = {}) {
    const sources = [
      listing,
      listing.licenses,
      listing.compliance,
      listing.agency,
      agentContext,
      agentContext.agency,
      agentContext.agent,
    ]
    const aliases = PF_LICENSE_FIELD_ALIASES[countryCode] || PF_LICENSE_FIELD_ALIASES.AE
    const license = pickAliasedField(sources, aliases.license)
    const broker = pickAliasedField(sources, aliases.broker)
    const images = collectImages(listing)

    return {
      country_code: countryCode,
      reference: firstNonEmpty(listing.reference, listing.canonical_id, listing.id),
      title: listing.title || listing.name || '',
      description: listing.description || listing.body || '',
      price: listing.price ?? listing.asking_price ?? null,
      currency: firstNonEmpty(listing.currency, listing.price_unit, PF_DEFAULT_CURRENCY[countryCode]),
      bedrooms: listing.bedrooms ?? listing.beds ?? null,
      bathrooms: listing.bathrooms ?? listing.baths ?? null,
      size: listing.size ?? listing.area ?? listing.area_sqm ?? null,
      size_unit: listing.area_unit || listing.size_unit || 'sqm',
      offering_type: listing.type || listing.offering_type || listing.listing_type || null,
      property_type: listing.property_type || listing.category || null,
      location: {
        city: listing.city || listing.location?.city || null,
        neighborhood: listing.neighborhood || listing.location?.neighborhood || listing.community || null,
        address: listing.address || listing.location?.address || (typeof listing.location === 'string' ? listing.location : null),
        latitude: listing.latitude ?? listing.location?.latitude ?? null,
        longitude: listing.longitude ?? listing.location?.longitude ?? null,
      },
      images: images.map((img) => ({ url: img.url, width: img.width, height: img.height })),
      agency_license: license?.value || null,
      broker_id: broker?.value || null,
      license_field: license?.name || null,
      broker_field: broker?.name || null,
    }
  }

  /**
   * Country-aware pre-publish checks. Does not import portal-validators/.
   * @returns {{ valid: boolean, checks: Array<object>, countryCode: string|null }}
   */
  async validateListing(listing = {}, portalContext = {}) {
    const checks = []
    let countryCode = null
    try {
      countryCode = this.resolveCountryCode(listing, portalContext, portalContext)
      checks.push({
        code: 'country_supported',
        severity: 'pass',
        message: `Property Finder supports ${countryCode}`,
        expected: [...PF_SUPPORTED_COUNTRIES],
        actual: countryCode,
      })
    } catch (error) {
      checks.push({
        code: 'country_supported',
        severity: 'fail',
        message: error.message,
        expected: [...PF_SUPPORTED_COUNTRIES],
        actual: upper(portalContext.countryCode || listing.country_code || listing.countryCode),
      })
      return { valid: false, checks, countryCode: null }
    }

    const sources = [
      listing,
      listing.licenses,
      listing.compliance,
      listing.agency,
      portalContext,
      portalContext.agency,
      portalContext.agent,
    ]
    const aliases = PF_LICENSE_FIELD_ALIASES[countryCode] || PF_LICENSE_FIELD_ALIASES.AE
    const license = pickAliasedField(sources, aliases.license)
    const broker = pickAliasedField(sources, aliases.broker)

    checks.push({
      code: 'agency_license',
      severity: license ? 'pass' : 'fail',
      message: license
        ? `License present (${license.name})`
        : `Required license field missing for ${countryCode} (accept ${aliases.license.join(' / ')})`,
      expected: aliases.license,
      actual: license?.value || null,
    })
    checks.push({
      code: 'broker_id',
      severity: broker ? 'pass' : 'fail',
      message: broker
        ? `Broker id present (${broker.name})`
        : `Required broker id missing for ${countryCode} (accept ${aliases.broker.join(' / ')})`,
      expected: aliases.broker,
      actual: broker?.value || null,
    })

    const images = collectImages(listing)
    if (!images.length) {
      checks.push({
        code: 'images_required',
        severity: 'fail',
        message: 'At least one listing image is required',
        expected: '>=1 JPG/PNG image, min 1200px',
        actual: 0,
      })
    } else {
      checks.push({
        code: 'images_required',
        severity: 'pass',
        message: `${images.length} image(s) provided`,
        expected: '>=1',
        actual: images.length,
      })
    }

    images.forEach((image, index) => {
      const ext = imageExtension(image.url, image.mime)
      const formatOk = ext && PF_IMAGE_FORMATS.includes(ext)
      checks.push({
        code: `image_format_${index}`,
        severity: formatOk ? 'pass' : 'fail',
        message: formatOk
          ? `Image ${index + 1} is ${ext.toUpperCase()}`
          : `Image ${index + 1} must be JPG or PNG`,
        expected: 'JPG/PNG',
        actual: ext || image.mime || image.url,
      })

      const longest = Math.max(Number(image.width) || 0, Number(image.height) || 0)
      if (!image.width && !image.height) {
        checks.push({
          code: `image_size_${index}`,
          severity: 'fail',
          message: `Image ${index + 1} is missing width/height; PF requires min ${PF_IMAGE_MIN_PX}px`,
          expected: PF_IMAGE_MIN_PX,
          actual: null,
        })
      } else {
        checks.push({
          code: `image_size_${index}`,
          severity: longest >= PF_IMAGE_MIN_PX ? 'pass' : 'fail',
          message: longest >= PF_IMAGE_MIN_PX
            ? `Image ${index + 1} longest side ${longest}px`
            : `Image ${index + 1} longest side ${longest}px is below ${PF_IMAGE_MIN_PX}px`,
          expected: PF_IMAGE_MIN_PX,
          actual: longest,
        })
      }
    })

    const valid = !checks.some((check) => check.severity === 'fail')
    return { valid, checks, countryCode }
  }

  async publish(listing = {}, agentContext = {}) {
    const jobId = agentContext.distributionJobId || agentContext.distribution_job_id || null
    try {
      const countryCode = this.resolveCountryCode(listing, agentContext, agentContext)
      this.requireCredentials()
      const validation = await this.validateListing(listing, { ...agentContext, countryCode })
      if (!validation.valid) {
        const failed = validation.checks.filter((check) => check.severity === 'fail')
        throw codedError(
          'PORTAL_RULES_VIOLATION',
          `Property Finder listing failed portal validation (${failed.map((c) => c.code).join(', ')})`,
          { status: 403, details: { checks: validation.checks } },
        )
      }

      const payload = this.mapListingToPayload(listing, countryCode, agentContext)
      const raw = await this.pfRequest('POST', this.listingsUrl(countryCode), payload)
      const result = this.normalizePublishResult(raw, countryCode)
      await this.safeRecordAttempt(jobId, {
        status: 'published',
        response: raw,
      })
      return result
    } catch (error) {
      await this.safeRecordAttempt(jobId, {
        status: 'failed',
        error,
      })
      throw error
    }
  }

  async fetchInboundLeads(agentContext = {}) {
    const countryCode = this.resolveCountryCode({}, agentContext, agentContext)
    this.requireCredentials()
    const raw = await this.pfRequest('GET', this.enquiriesUrl(countryCode))
    const rows = Array.isArray(raw?.leads)
      ? raw.leads
      : Array.isArray(raw?.enquiries)
        ? raw.enquiries
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
            ? raw
            : []
    return {
      leads: rows.map((row) => this.normalizeLead(row)),
      countryCode,
      raw,
    }
  }

  normalizePublishResult(raw, countryCode) {
    const body = raw && typeof raw === 'object' ? raw : {}
    const listing = body.listing || body.data || body
    const externalId = firstNonEmpty(
      listing.id,
      listing.listing_id,
      listing.external_id,
      listing.reference,
      body.id,
      body.listing_id,
      body.external_id,
    )
    const liveUrl = firstNonEmpty(
      listing.url,
      listing.live_url,
      listing.permalink,
      listing.share_url,
      body.url,
      body.live_url,
      body.permalink,
    )
    const rawStatus = firstNonEmpty(listing.status, body.status, 'submitted')?.toLowerCase()
    const status = rawStatus === 'live' || rawStatus === 'published' || rawStatus === 'active'
      ? 'live'
      : 'submitted'
    return { externalId, liveUrl, status, countryCode, raw }
  }

  normalizeLead(row = {}) {
    const contact = row.contact || row.enquirer || {}
    return {
      externalId: firstNonEmpty(row.id, row.enquiry_id, row.lead_id, row.external_id),
      name: firstNonEmpty(row.name, contact.name, row.full_name),
      phone: firstNonEmpty(row.phone, contact.phone, row.mobile),
      email: firstNonEmpty(row.email, contact.email),
      listingExternalId: firstNonEmpty(
        row.listing_id,
        row.listingExternalId,
        row.listing_external_id,
        row.property_id,
        row.listing?.id,
      ),
      message: firstNonEmpty(row.message, row.body, row.comment, row.notes) || '',
      receivedAt: firstNonEmpty(row.received_at, row.created_at, row.createdAt, row.timestamp),
      raw: row,
    }
  }

  async pfRequest(method, url, body) {
    const http = this.getHttpClient()
    if (typeof http !== 'function') {
      throw codedError('PORTAL_DOWN', 'Property Finder HTTP client is not available')
    }
    let response
    try {
      response = await http(url, {
        method,
        headers: this.authHeaders(),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) {
      throw codedError(
        error?.code && String(error.code).toUpperCase() !== 'ERR_UNHANDLED_ERROR'
          ? String(error.code).toUpperCase()
          : 'PORTAL_DOWN',
        error?.message || `Property Finder ${method} ${url} failed`,
        { cause: error, status: error?.status },
      )
    }
    return this.parsePfResponse(method, url, response)
  }

  async parsePfResponse(method, url, response) {
    const status = Number(response?.status ?? response?.statusCode ?? 0)
    const data = await this.readResponseBody(response)
    const ok = response?.ok === true || (status >= 200 && status < 300)
    if (ok) return data
    throw this.httpFailure(method, url, status, data)
  }

  async readResponseBody(response) {
    if (!response) return {}
    if (typeof response.json === 'function') {
      try {
        const parsed = await response.json()
        if (parsed && typeof parsed === 'object') return parsed
        if (parsed != null) return { value: parsed }
      } catch {
        // Fall through to text() when json() is unavailable or already consumed.
      }
    }
    if (typeof response.text === 'function') {
      const rawText = await response.text().catch(() => '')
      if (!rawText) return {}
      try { return JSON.parse(rawText) } catch { return { raw: rawText } }
    }
    if (response.body && typeof response.body === 'object') return response.body
    return {}
  }

  httpFailure(method, url, status, data) {
    const message = data?.error?.message
      || data?.message
      || data?.error
      || `Property Finder ${method} ${url} failed (${status})`
    const text = typeof message === 'string' ? message : JSON.stringify(message)
    if (status === 401) {
      return codedError('UNAUTHORIZED', text, { status: 401, details: data })
    }
    if (status === 429) {
      return codedError('QUOTA_EXCEEDED', text, { status: 429, details: data })
    }
    if (status === 403) {
      return codedError('PORTAL_RULES_VIOLATION', text, { status: 403, details: data })
    }
    if (status === 400 || status === 422) {
      return codedError('INVALID_CONTENT', text, { status, details: data })
    }
    if (status >= 500 || status === 408) {
      return codedError('PORTAL_DOWN', text, { status, details: data })
    }
    return codedError('UNKNOWN_ERROR', text, { status, details: data })
  }

  async safeRecordAttempt(jobId, fields) {
    if (!jobId) return null
    try {
      return await recordDistributionAttempt({
        distributionJobId: jobId,
        ...fields,
        extra: { portal: 'property_finder', ...(fields.extra || {}) },
      })
    } catch {
      return null
    }
  }
}

export default PropertyFinderPortalPublisher
