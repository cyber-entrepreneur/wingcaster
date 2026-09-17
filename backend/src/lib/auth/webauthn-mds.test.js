/**
 * Unit tests for H4 FIDO MDS integration.
 *
 * Covers:
 *   - refreshMdsBlob decodes the middle JWT segment, upserts each entry
 *     keyed by AAGUID, returns { fetched, cached } counts
 *   - Malformed BLOB (wrong segment count) throws
 *   - lookupAaguid returns cached blob or null
 *   - displayNameForMdsEntry falls through description → authenticatorName → truncated aaguid
 *   - enforcePasskeyPolicy: denylist wins, allowlist gates, attestation
 *     required when policy set + format=none
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../db.js', () => db)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let refreshMdsBlob
let lookupAaguid
let displayNameForMdsEntry
let enforcePasskeyPolicy

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  ;({
    refreshMdsBlob,
    lookupAaguid,
    displayNameForMdsEntry,
    enforcePasskeyPolicy,
  } = await import('./webauthn-mds.js'))
})

afterEach(() => vi.restoreAllMocks())

function makeMdsJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Signature not verified in this iteration — placeholder is fine.
  return `${header}.${body}.stub-signature`
}

describe('refreshMdsBlob', () => {
  it('decodes the MDS payload and upserts each entry by AAGUID', async () => {
    const payload = {
      entries: [
        { aaguid: 'aa-1', metadataStatement: { description: 'YubiKey 5' } },
        { aaguid: 'aa-2', metadataStatement: { description: 'iPhone Touch ID' } },
      ],
    }
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(makeMdsJwt(payload)),
    })
    db.query.mockResolvedValue([])
    const summary = await refreshMdsBlob({ fetchImpl })
    expect(summary.fetched).toBe(2)
    expect(summary.cached).toBe(2)
    expect(db.query.mock.calls.some((c) => /^INSERT INTO fido_mds_metadata/i.test(c[0]))).toBe(true)
  })

  it('throws on malformed BLOB (wrong segment count)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('notajwt'),
    })
    await expect(refreshMdsBlob({ fetchImpl })).rejects.toThrow(/malformed/i)
  })

  it('throws on HTTP failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(refreshMdsBlob({ fetchImpl })).rejects.toThrow(/503/)
  })
})

describe('lookupAaguid', () => {
  it('returns metadata blob when cached', async () => {
    db.query.mockResolvedValue([
      { metadata: { description: 'YubiKey' }, refreshed_at: '2026-09-16T00:00:00Z' },
    ])
    const result = await lookupAaguid('aa-1')
    expect(result?.aaguid).toBe('aa-1')
    expect(result?.metadata.description).toBe('YubiKey')
  })

  it('returns null when unknown', async () => {
    db.query.mockResolvedValue([])
    expect(await lookupAaguid('aa-unknown')).toBeNull()
  })

  it('returns null on null input without touching DB', async () => {
    expect(await lookupAaguid(null)).toBeNull()
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns null on DB error (fail-safe)', async () => {
    db.query.mockRejectedValue(new Error('db down'))
    expect(await lookupAaguid('aa-1')).toBeNull()
  })
})

describe('displayNameForMdsEntry', () => {
  it('prefers description', () => {
    expect(
      displayNameForMdsEntry({ metadata: { metadataStatement: { description: 'YubiKey 5' } } }, 'aa'),
    ).toBe('YubiKey 5')
  })
  it('falls back to authenticatorName', () => {
    expect(
      displayNameForMdsEntry(
        { metadata: { metadataStatement: { authenticatorName: 'Feitian' } } },
        'aa',
      ),
    ).toBe('Feitian')
  })
  it('falls back to truncated aaguid when no name', () => {
    expect(displayNameForMdsEntry(null, 'abcdef01-2345-6789-abcd-ef0123456789')).toBe(
      'Authenticator abcdef01',
    )
  })
  it('returns Passkey when nothing is known', () => {
    expect(displayNameForMdsEntry(null, null)).toBe('Passkey')
  })
})

describe('enforcePasskeyPolicy', () => {
  it('accepts when no policy fields set', () => {
    expect(enforcePasskeyPolicy({ policy: {}, aaguid: 'aa', attestationFormat: 'none' })).toBeNull()
  })
  it('rejects when aaguid on denylist', () => {
    const refusal = enforcePasskeyPolicy({
      policy: { webauthn_denied_aaguids: ['bad-1'] },
      aaguid: 'bad-1',
      attestationFormat: 'packed',
    })
    expect(refusal?.code).toBe('webauthn_aaguid_denied')
  })
  it('rejects when aaguid not on allowlist and allowlist non-empty', () => {
    const refusal = enforcePasskeyPolicy({
      policy: { webauthn_allowed_aaguids: ['good-1'] },
      aaguid: 'other',
      attestationFormat: 'packed',
    })
    expect(refusal?.code).toBe('webauthn_aaguid_not_allowlisted')
  })
  it('accepts when aaguid on allowlist', () => {
    expect(
      enforcePasskeyPolicy({
        policy: { webauthn_allowed_aaguids: ['good-1', 'good-2'] },
        aaguid: 'good-1',
        attestationFormat: 'packed',
      }),
    ).toBeNull()
  })
  it('rejects when attestation required + format=none', () => {
    const refusal = enforcePasskeyPolicy({
      policy: { webauthn_require_attestation: true },
      aaguid: 'aa',
      attestationFormat: 'none',
    })
    expect(refusal?.code).toBe('webauthn_attestation_required')
  })
  it('denylist wins over allowlist', () => {
    const refusal = enforcePasskeyPolicy({
      policy: {
        webauthn_allowed_aaguids: ['aa-1'],
        webauthn_denied_aaguids: ['aa-1'],
      },
      aaguid: 'aa-1',
      attestationFormat: 'packed',
    })
    expect(refusal?.code).toBe('webauthn_aaguid_denied')
  })
})
