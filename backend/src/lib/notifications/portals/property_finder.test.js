import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyProviderError, ERROR_CLASS } from '../../publishing/error-classifier.js'
import { FALLBACK_PORTAL_ROWS } from './registry.js'
import {
  canonicalPfListing,
  PF_API_HOSTS,
  PF_SUPPORTED_COUNTRIES,
  PropertyFinderPortalPublisher,
} from './property_finder.js'

const PF_CREDS = {
  PF_API_KEY: 'test-pf-key',
  PF_CLIENT_ID: 'test-pf-client',
  PF_CLIENT_SECRET: 'test-pf-secret',
}

const CRED_KEYS = ['PF_API_KEY', 'PF_CLIENT_ID', 'PF_CLIENT_SECRET', 'PF_API_BASE_URL']

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const validPfListing = canonicalPfListing

function pfRow() {
  return FALLBACK_PORTAL_ROWS.find((row) => row.code === 'property_finder')
}

function createAdapter({ httpClient, credentials, listingEnv } = {}) {
  return new PropertyFinderPortalPublisher(pfRow(), {
    httpClient: httpClient || vi.fn(async () => jsonResponse(201, {
      id: 'pf-ext-1',
      url: 'https://www.propertyfinder.ae/en/listing/pf-ext-1',
      status: 'live',
    })),
    credentials: credentials === undefined
      ? { apiKey: 'k', clientId: 'cid', clientSecret: 'sec' }
      : credentials,
    ...listingEnv,
  })
}

describe('PropertyFinderPortalPublisher', () => {
  const previous = {}

  beforeEach(() => {
    for (const key of CRED_KEYS) {
      previous[key] = process.env[key]
      delete process.env[key]
    }
    for (const cc of PF_SUPPORTED_COUNTRIES) {
      const key = `PF_API_BASE_URL_${cc}`
      previous[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('documents the nine-country host map', () => {
    expect(PF_SUPPORTED_COUNTRIES).toEqual(['AE', 'SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM'])
    expect(PF_API_HOSTS.AE).toBe('www.propertyfinder.ae')
    expect(PF_API_HOSTS.SA).toBe('www.propertyfinder.sa')
    expect(PF_API_HOSTS.EG).toBe('www.propertyfinder.eg')
    expect(PF_API_HOSTS.LB).toBe('www.propertyfinder.com.lb')
    expect(PF_API_HOSTS.JO).toBe('www.propertyfinder.jo')
    expect(PF_API_HOSTS.QA).toBe('www.propertyfinder.qa')
    expect(PF_API_HOSTS.KW).toBe('www.propertyfinder.com.kw')
    expect(PF_API_HOSTS.BH).toBe('www.propertyfinder.bh')
    expect(PF_API_HOSTS.OM).toBe('www.propertyfinder.om')
  })

  it('publishes a valid listing per PF country against the mocked host', async () => {
    for (const countryCode of PF_SUPPORTED_COUNTRIES) {
      const httpClient = vi.fn(async () => jsonResponse(201, {
        id: `pf-${countryCode}`,
        url: `https://${PF_API_HOSTS[countryCode]}/en/listing/1`,
        status: countryCode === 'AE' ? 'live' : 'submitted',
      }))
      const adapter = createAdapter({ httpClient })
      const listing = validPfListing({
        country_code: countryCode,
        ...(countryCode === 'SA' ? { advertiser_license: 'FAL-1', agency_license: undefined } : {}),
        ...(countryCode === 'EG' ? { developer_registration: 'DEV-1', agency_license: undefined } : {}),
      })
      const result = await adapter.publish(listing, { countryCode })
      expect(result.externalId).toBe(`pf-${countryCode}`)
      expect(result.countryCode).toBe(countryCode)
      expect(['live', 'submitted']).toContain(result.status)
      expect(httpClient).toHaveBeenCalledTimes(1)
      const [url, init] = httpClient.mock.calls[0]
      expect(url).toContain(PF_API_HOSTS[countryCode])
      expect(url).toMatch(/\/listings$/)
      expect(init.method).toBe('POST')
      const payload = JSON.parse(init.body)
      expect(payload.title).toBe('Marina apartment')
      expect(payload.bedrooms).toBe(2)
      expect(payload.country_code).toBe(countryCode)
      expect(payload.agency_license).toBeTruthy()
      expect(payload.broker_id).toBe('BRK-9')
    }
  })

  it('honors PF_API_BASE_URL and PF_API_BASE_URL_<CC>', async () => {
    process.env.PF_API_BASE_URL = 'https://global.example/v1'
    const httpClient = vi.fn(async () => jsonResponse(200, { id: 'g1', status: 'submitted' }))
    const adapter = createAdapter({ httpClient })
    await adapter.publish(validPfListing(), { countryCode: 'AE' })
    expect(httpClient.mock.calls[0][0]).toBe('https://global.example/v1/listings')

    process.env.PF_API_BASE_URL_SA = 'https://sa-mock.example/partner'
    const saClient = vi.fn(async () => jsonResponse(200, { id: 's1', status: 'submitted' }))
    const saAdapter = createAdapter({ httpClient: saClient })
    await saAdapter.publish(validPfListing({ country_code: 'SA', advertiser_license: 'FAL-1' }), { countryCode: 'SA' })
    expect(saClient.mock.calls[0][0]).toBe('https://sa-mock.example/partner/listings')
  })

  it('rejects unknown countries with INVALID_CONTENT (invalid_content class)', async () => {
    const adapter = createAdapter()
    await expect(adapter.publish(validPfListing({ country_code: 'FR' }), { countryCode: 'FR' }))
      .rejects.toMatchObject({ code: 'INVALID_CONTENT' })
    const err = await adapter.publish(validPfListing({ country_code: 'XX' }), {}).catch((e) => e)
    expect(classifyProviderError(err)).toBe(ERROR_CLASS.INVALID_CONTENT)
  })

  it('throws PUBLISH_CREDENTIALS_MISSING when env/constructor creds are absent', async () => {
    const adapter = createAdapter({ credentials: null })
    await expect(adapter.publish(validPfListing(), { countryCode: 'AE' }))
      .rejects.toMatchObject({ code: 'PUBLISH_CREDENTIALS_MISSING' })
    const err = await adapter.publish(validPfListing(), { countryCode: 'AE' }).catch((e) => e)
    expect(classifyProviderError(err)).toBe(ERROR_CLASS.AUTH_EXPIRED)
  })

  it('reads credentials from PF_API_* env when constructor credentials are omitted', async () => {
    Object.assign(process.env, PF_CREDS)
    const httpClient = vi.fn(async () => jsonResponse(201, { id: 'env-1', status: 'live' }))
    const adapter = new PropertyFinderPortalPublisher(pfRow(), { httpClient })
    const result = await adapter.publish(validPfListing(), { countryCode: 'AE' })
    expect(result.externalId).toBe('env-1')
    expect(httpClient.mock.calls[0][1].headers.Authorization).toBe('Bearer test-pf-key')
  })

  it('maps HTTP failures onto classifyProviderError classes', async () => {
    const cases = [
      { status: 401, body: { message: 'Unauthorized' }, cls: ERROR_CLASS.AUTH_EXPIRED, code: 'UNAUTHORIZED' },
      { status: 403, body: { message: 'Forbidden listing type' }, cls: ERROR_CLASS.PORTAL_RULES_VIOLATION, code: 'PORTAL_RULES_VIOLATION' },
      { status: 503, body: { message: 'Service Unavailable' }, cls: ERROR_CLASS.PORTAL_DOWN, code: 'PORTAL_DOWN' },
      { status: 429, body: { message: 'Too Many Requests' }, cls: ERROR_CLASS.QUOTA_EXCEEDED, code: 'QUOTA_EXCEEDED' },
      { status: 400, body: { message: 'invalid payload' }, cls: ERROR_CLASS.INVALID_CONTENT, code: 'INVALID_CONTENT' },
    ]
    for (const sample of cases) {
      const httpClient = vi.fn(async () => jsonResponse(sample.status, sample.body))
      const adapter = createAdapter({ httpClient })
      const err = await adapter.publish(validPfListing(), { countryCode: 'AE' }).catch((e) => e)
      expect(err.code).toBe(sample.code)
      expect(err.status).toBe(sample.status)
      expect(classifyProviderError(err)).toBe(sample.cls)
    }
  })

  it('classifies network failures as portal_down', async () => {
    const httpClient = vi.fn(async () => {
      const err = new Error('connect ECONNREFUSED')
      err.code = 'ECONNREFUSED'
      throw err
    })
    const adapter = createAdapter({ httpClient })
    const err = await adapter.publish(validPfListing(), { countryCode: 'AE' }).catch((e) => e)
    expect(classifyProviderError(err)).toBe(ERROR_CLASS.PORTAL_DOWN)
  })

  it('validateListing fails closed on UAE license + undersized / wrong-format images', async () => {
    const adapter = createAdapter()
    const ok = await adapter.validateListing(validPfListing(), { countryCode: 'AE' })
    expect(ok.valid).toBe(true)
    expect(ok.checks.every((c) => c.severity !== 'fail')).toBe(true)

    const missingLicense = await adapter.validateListing(
      validPfListing({ agency_license: '', broker_id: '' }),
      { countryCode: 'AE' },
    )
    expect(missingLicense.valid).toBe(false)
    expect(missingLicense.checks.filter((c) => c.severity === 'fail').map((c) => c.code))
      .toEqual(expect.arrayContaining(['agency_license', 'broker_id']))

    const badImage = await adapter.validateListing(
      validPfListing({
        images: [{ url: 'https://cdn.example.test/tiny.webp', width: 800, height: 600 }],
      }),
      { countryCode: 'AE' },
    )
    expect(badImage.valid).toBe(false)
    expect(badImage.checks.some((c) => c.code.startsWith('image_format_') && c.severity === 'fail')).toBe(true)
    expect(badImage.checks.some((c) => c.code.startsWith('image_size_') && c.severity === 'fail')).toBe(true)
  })

  it('validateListing accepts country-specific license aliases', async () => {
    const adapter = createAdapter()
    const sa = await adapter.validateListing(
      validPfListing({ country_code: 'SA', agency_license: '', advertiser_license: 'FAL-88' }),
      { countryCode: 'SA' },
    )
    expect(sa.valid).toBe(true)

    const eg = await adapter.validateListing(
      validPfListing({ country_code: 'EG', agency_license: '', developer_registration: 'DEV-2' }),
      { countryCode: 'EG' },
    )
    expect(eg.valid).toBe(true)

    const joMissing = await adapter.validateListing(
      validPfListing({ country_code: 'JO', agency_license: '', broker_id: 'BRK-9' }),
      { countryCode: 'JO' },
    )
    expect(joMissing.valid).toBe(false)
  })

  it('publish throws PORTAL_RULES_VIOLATION when validate has fail checks', async () => {
    const httpClient = vi.fn()
    const adapter = createAdapter({ httpClient })
    await expect(adapter.publish(
      validPfListing({ agency_license: '', broker_id: '' }),
      { countryCode: 'AE' },
    )).rejects.toMatchObject({ code: 'PORTAL_RULES_VIOLATION' })
    expect(httpClient).not.toHaveBeenCalled()
  })

  it('fetchInboundLeads GETs the country enquiries endpoint', async () => {
    const httpClient = vi.fn(async () => jsonResponse(200, {
      leads: [{
        id: 'lead-1',
        name: 'Sara',
        phone: '+97150000000',
        email: 'sara@example.test',
        listing_id: 'pf-ext-1',
        message: 'Is this still available?',
        created_at: '2026-09-08T12:00:00.000Z',
      }],
    }))
    const adapter = createAdapter({ httpClient })
    const result = await adapter.fetchInboundLeads({ countryCode: 'QA' })
    expect(httpClient.mock.calls[0][0]).toContain(PF_API_HOSTS.QA)
    expect(httpClient.mock.calls[0][0]).toMatch(/\/enquiries$/)
    expect(httpClient.mock.calls[0][1].method).toBe('GET')
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0]).toMatchObject({
      externalId: 'lead-1',
      name: 'Sara',
      phone: '+97150000000',
      email: 'sara@example.test',
      listingExternalId: 'pf-ext-1',
      message: 'Is this still available?',
      receivedAt: '2026-09-08T12:00:00.000Z',
    })
  })

  it('fetchInboundLeads classifies 401 as auth_expired', async () => {
    const httpClient = vi.fn(async () => jsonResponse(401, { message: 'Unauthorized' }))
    const adapter = createAdapter({ httpClient })
    const err = await adapter.fetchInboundLeads({ countryCode: 'AE' }).catch((e) => e)
    expect(classifyProviderError(err)).toBe(ERROR_CLASS.AUTH_EXPIRED)
  })

  it('does not call the network from the default constructor path without a mock', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const adapter = createAdapter({ credentials: null })
    await expect(adapter.publish({}, {})).rejects.toMatchObject({ code: 'INVALID_CONTENT' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
