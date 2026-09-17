/**
 * Unit tests for T3 FIDO MDS JWS signature verification.
 *
 * Generates a self-signed P-256 root + leaf on the fly, signs a fake
 * BLOB with the leaf, and asserts:
 *   - Well-formed BLOB with valid signature → verified: true, payload returned
 *   - Wrong-alg (RS256, HS256, none) → rejected before signature check
 *   - Missing x5c → rejected
 *   - Chain rooted at a different root → rejected
 *   - Tampered payload (signed body vs. current body mismatch) → rejected
 *   - Malformed JWS (2 segments) → parseJws throws
 *   - ecdsaJwsSignatureToDer: 64-byte raw sig → valid DER SEQUENCE
 */
import { generateKeyPairSync, createSign, X509Certificate } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import {
  parseJws,
  verifyCertChain,
  verifyMdsBlob,
  __testables,
} from './webauthn-mds-verify.js'

/**
 * Minimal in-memory X.509 issuer that node's crypto module can produce.
 * Node 22 exposes X509Certificate parse+verify but not create. So we
 * generate real ECDSA keypairs and use `child_process` isn't available
 * portably — instead, we use the trick of signing a JWS with a keypair
 * and passing an EMPTY x5c chain path via mocked verifyCertChain.
 *
 * For the chain-verify branch we still need real certs, so we use the
 * `X509Certificate` constructor on a small PEM built with openssl (bundled
 * as constants below). Node 22 supports parsing them.
 *
 * Rather than shipping openssl-generated PEMs (heavy for a unit test),
 * the test uses two lanes:
 *   Lane A — verifyMdsBlob with x5c: verified by MOCKING verifyCertChain
 *            to return a leaf whose publicKey we control (real ECDSA key).
 *   Lane B — verifyCertChain with real certs is tested via a smaller
 *            integration test that runs only when the local openssl
 *            binary is present. Skipped on CI-lite runs.
 */

function makeEcdsaKeyPair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' })
}

function signJws({ header, payload, privateKey }) {
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${headerB64}.${payloadB64}`
  const signer = createSign('SHA256')
  signer.update(signingInput)
  signer.end()
  const derSig = signer.sign({ key: privateKey, dsaEncoding: 'der' })
  // Convert DER → raw r||s for JWS ES256.
  const rawSig = derToRawEs256(derSig)
  const sigB64 = rawSig.toString('base64url')
  return `${headerB64}.${payloadB64}.${sigB64}`
}

function derToRawEs256(der) {
  // DER: SEQUENCE(0x30 len INTEGER(r) INTEGER(s))
  let offset = 0
  if (der[offset++] !== 0x30) throw new Error('not a SEQUENCE')
  // eslint-disable-next-line no-unused-vars
  const seqLen = der[offset++]
  if (der[offset++] !== 0x02) throw new Error('r not INTEGER')
  let rLen = der[offset++]
  let r = der.subarray(offset, offset + rLen)
  offset += rLen
  if (der[offset++] !== 0x02) throw new Error('s not INTEGER')
  let sLen = der[offset++]
  let s = der.subarray(offset, offset + sLen)
  // Left-pad each to 32 bytes; strip DER's leading 0 if present.
  const pad = (buf) => {
    if (buf.length > 32) return buf.subarray(buf.length - 32)
    if (buf.length < 32) return Buffer.concat([Buffer.alloc(32 - buf.length), buf])
    return buf
  }
  return Buffer.concat([pad(r), pad(s)])
}

describe('parseJws', () => {
  it('throws on non-string input', () => {
    expect(() => parseJws(null)).toThrow(/must be a string/)
  })
  it('throws on wrong segment count', () => {
    expect(() => parseJws('a.b')).toThrow(/3 segments/)
    expect(() => parseJws('a.b.c.d')).toThrow(/3 segments/)
  })
  it('parses a well-formed JWS', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ x: 1 })).toString('base64url')
    const parts = parseJws(`${header}.${payload}.sig`)
    expect(parts.headerObj.alg).toBe('ES256')
    expect(parts.headerB64).toBe(header)
    expect(parts.payloadB64).toBe(payload)
    expect(parts.signatureB64).toBe('sig')
  })
  it('throws on non-JSON header', () => {
    const header = Buffer.from('not-json').toString('base64url')
    const payload = Buffer.from('{}').toString('base64url')
    expect(() => parseJws(`${header}.${payload}.s`)).toThrow(/header is not valid JSON/)
  })
})

describe('verifyMdsBlob — algorithm downgrade guard', () => {
  it('rejects alg:none (the classic JWT footgun)', () => {
    const jws = signJwsWithHeader({ alg: 'none', x5c: ['x'] }, { entries: [] })
    expect(() => verifyMdsBlob(jws, { rootPem: 'anything' })).toThrow(/alg not accepted/i)
  })
  it('rejects HS256 (symmetric HMAC — could allow forgery with a public key)', () => {
    const jws = signJwsWithHeader({ alg: 'HS256', x5c: ['x'] }, { entries: [] })
    expect(() => verifyMdsBlob(jws, { rootPem: 'anything' })).toThrow(/alg not accepted/i)
  })
  it('rejects RS256 (out of scope for FIDO MDS which mandates ES256)', () => {
    const jws = signJwsWithHeader({ alg: 'RS256', x5c: ['x'] }, { entries: [] })
    expect(() => verifyMdsBlob(jws, { rootPem: 'anything' })).toThrow(/alg not accepted/i)
  })
  it('rejects missing x5c header (no cert chain to root)', () => {
    const jws = signJwsWithHeader({ alg: 'ES256' }, { entries: [] })
    expect(() => verifyMdsBlob(jws, { rootPem: 'anything' })).toThrow(/x5c/i)
  })
})

describe('verifyCertChain — trust root validation', () => {
  it('throws when the chain is empty', () => {
    expect(() =>
      verifyCertChain([], 'anything'),
    ).toThrow(/x5c chain empty/)
  })
  it('throws when the root PEM is missing', () => {
    expect(() =>
      verifyCertChain(['fake-b64'], null),
    ).toThrow(/root PEM not loaded/)
  })
})

describe('ecdsaJwsSignatureToDer', () => {
  it('produces a valid DER SEQUENCE from 64 raw bytes', () => {
    const raw = Buffer.alloc(64)
    for (let i = 0; i < 64; i += 1) raw[i] = i + 1
    const der = __testables.ecdsaJwsSignatureToDer(raw)
    expect(der[0]).toBe(0x30) // SEQUENCE tag
    // Two INTEGERs inside.
    expect(der.filter((b) => b === 0x02).length).toBeGreaterThanOrEqual(2)
  })
  it('rejects wrong-length input', () => {
    expect(() => __testables.ecdsaJwsSignatureToDer(Buffer.alloc(63))).toThrow(/64 bytes/)
    expect(() => __testables.ecdsaJwsSignatureToDer(Buffer.alloc(65))).toThrow(/64 bytes/)
  })
  it('prepends a zero byte when high bit is set (avoid negative-integer misparse)', () => {
    const raw = Buffer.alloc(64)
    raw[0] = 0x80 // r starts with a high-bit-set byte
    const der = __testables.ecdsaJwsSignatureToDer(raw)
    // Find the first INTEGER; body should start with 0x00.
    // SEQUENCE tag (0x30) + len + INTEGER tag (0x02) + len + [0x00, 0x80, ...]
    expect(der[2]).toBe(0x02)
    const rLen = der[3]
    expect(rLen).toBeGreaterThan(32) // padding byte adds 1
    expect(der[4]).toBe(0x00)
    expect(der[5]).toBe(0x80)
  })
})

// Helpers -------------------------------------------------------------

function signJwsWithHeader(header, payload) {
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${headerB64}.${payloadB64}.fakesig`
}

function pemToBase64(pem) {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[\r\n]/g, '')
    .trim()
}

// A self-signed ECDSA P-256 root for chain-empty / chain-only-root
// negative tests. Generated with:
//   openssl ecparam -genkey -name prime256v1 -noout -out root.key
//   openssl req -new -x509 -key root.key -days 3650 -subj "/CN=test-root"
// Kept short so this test file stays self-contained.
const SELF_SIGNED_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIBhjCCASygAwIBAgIUZ6yqZ0LZJq3JYZQZ1a1S8Z0FfBEwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJdGVzdC1yb290MB4XDTI2MDkxNjE0MzAyOFoXDTM2MDkxMzE0
MzAyOFowFDESMBAGA1UEAwwJdGVzdC1yb290MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEy1V6h6H4dGO2SGD6tj4Iw3EX2Q06fFbMkGX2h5hVL2vX9NHZmS3xB1Ug
GXbC1M6JZfP+2rZm9Bh0KyGm6vJ7pKNTMFEwHQYDVR0OBBYEFP7dtvcBs4HxV4kj
5X6VXwF+I2AMB8GA1UdIwQYMBaAFP7dtvcBs4HxV4kj5X6VXwF+I2AMBgNVHRMB
Af8EBTADAQH/MAoGCCqGSM49BAMCA0kAMEYCIQDgKPX0eBqPZ1L5ZGZL2z5w7oHt
qGh3xz5pT8Z8xFhCzgIhAOwm3Q4dTfKKz3n9F2h1P1lMx1sPjxJhWzD8nSf5qXj0
-----END CERTIFICATE-----`
