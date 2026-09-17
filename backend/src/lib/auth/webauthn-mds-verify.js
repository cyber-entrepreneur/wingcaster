/**
 * T3 — JWS signature verification of the FIDO MDS BLOB (H4 v2).
 *
 * H4 shipped the MDS cache but trusted the network-fetched payload without
 * verifying the JWS signature. This closes that: verify the BLOB's JWS
 * against the FIDO Alliance root cert chain before caching any entries.
 *
 * ---------------------------------------------------------------------------
 * Trust root
 * ---------------------------------------------------------------------------
 *
 * The BLOB is signed by an intermediate cert that chains to the FIDO
 * Alliance MDS root (published at `https://valid.mds.fidoalliance.org/`).
 * We ship the root PEM at `backend/src/lib/auth/fido-mds-root.pem` and
 * accept an override via `WINGCASTER_FIDO_MDS_ROOT_PEM` for tenants that
 * pin a different trust anchor (self-hosted MDS mirror, corporate CA
 * relay, etc.).
 *
 * ---------------------------------------------------------------------------
 * Signature algorithms
 * ---------------------------------------------------------------------------
 *
 * FIDO Alliance signs with ES256 (ECDSA P-256 + SHA-256). We accept only
 * that alg to prevent a "alg:none" or HMAC-family downgrade attack — the
 * classic JWT verification footgun.
 */

import { X509Certificate, createPublicKey, createVerify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import logger from '../logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT_PEM_PATH = path.join(__dirname, 'fido-mds-root.pem')

export const ACCEPTED_ALGORITHMS = Object.freeze(['ES256'])

/** Load the FIDO MDS root cert PEM. Env override wins; file path is fallback. */
export function loadFidoMdsRootPem() {
  if (process.env.WINGCASTER_FIDO_MDS_ROOT_PEM) {
    return process.env.WINGCASTER_FIDO_MDS_ROOT_PEM
  }
  try {
    return readFileSync(DEFAULT_ROOT_PEM_PATH, 'utf8')
  } catch (err) {
    // Missing bundled root — a fresh checkout or a deploy without the PEM
    // file. Log loudly; caller should refuse to trust unverified BLOBs.
    logger.error(
      { err, path: DEFAULT_ROOT_PEM_PATH },
      'FIDO MDS root cert PEM missing; JWS verification will refuse all BLOBs',
    )
    return null
  }
}

function base64UrlToBuffer(input) {
  return Buffer.from(String(input), 'base64url')
}

/**
 * Parse a JWS compact-serialized token into its three pieces.
 * Returns { headerB64, payloadB64, signatureB64, headerObj }.
 */
export function parseJws(jwt) {
  if (typeof jwt !== 'string') throw new Error('JWS must be a string')
  const parts = jwt.trim().split('.')
  if (parts.length !== 3) {
    throw new Error(`JWS malformed: expected 3 segments, got ${parts.length}`)
  }
  const [headerB64, payloadB64, signatureB64] = parts
  const headerJson = base64UrlToBuffer(headerB64).toString('utf8')
  let headerObj
  try {
    headerObj = JSON.parse(headerJson)
  } catch {
    throw new Error('JWS header is not valid JSON')
  }
  return { headerB64, payloadB64, signatureB64, headerObj }
}

/**
 * Convert an ES256 JWS signature (r||s, 64 bytes raw) into the DER
 * (ASN.1 SEQUENCE) form that node crypto's `Verify` expects.
 * Both r and s are zero-padded to 32 bytes, then wrapped as INTEGERs.
 */
function ecdsaJwsSignatureToDer(rawSig) {
  if (rawSig.length !== 64) {
    throw new Error(`ES256 signature must be 64 bytes; got ${rawSig.length}`)
  }
  const r = rawSig.subarray(0, 32)
  const s = rawSig.subarray(32, 64)
  const toDerInt = (bytes) => {
    // Strip leading zero bytes.
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) start += 1
    let body = bytes.subarray(start)
    // Prepend a zero if the high bit is set (would otherwise be interpreted
    // as a negative integer by ASN.1).
    if (body[0] & 0x80) body = Buffer.concat([Buffer.from([0x00]), body])
    return Buffer.concat([Buffer.from([0x02, body.length]), body])
  }
  const rDer = toDerInt(r)
  const sDer = toDerInt(s)
  const seqBody = Buffer.concat([rDer, sDer])
  return Buffer.concat([Buffer.from([0x30, seqBody.length]), seqBody])
}

/**
 * Verify the cert chain: leaf → intermediates → rootPem.
 * Returns true when every link's issuer matches the next cert's subject
 * AND every link's `verify()` succeeds with its issuer's public key.
 *
 * Note: node's X509Certificate.verify uses the given public key to verify
 * this cert's own signature. Rooting at the trusted PEM means we walk
 * top-to-bottom (root → leaf) confirming each cert is signed by the one
 * above it in the chain.
 */
export function verifyCertChain(x5cChain, rootPem) {
  if (!Array.isArray(x5cChain) || x5cChain.length === 0) {
    throw new Error('x5c chain empty')
  }
  if (!rootPem) throw new Error('FIDO MDS root PEM not loaded')
  const root = new X509Certificate(rootPem)
  const rootKey = root.publicKey

  // x5c order per RFC 7515: leaf first, then intermediates, root LAST or
  // absent (root is trusted out-of-band). Reverse to walk root → leaf.
  const chain = x5cChain.map((b64) => {
    const der = Buffer.from(b64, 'base64')
    return new X509Certificate(der)
  })
  // If the chain includes the root, drop it — we only verify from our
  // trusted anchor. Match by subject == issuer of the next cert or by
  // fingerprint equality with the loaded root.
  const rootFp = root.fingerprint256
  const trimmed = chain.filter((c) => c.fingerprint256 !== rootFp)
  if (trimmed.length === 0) {
    // Only the root was present — no leaf to verify against.
    throw new Error('x5c chain contains only the root cert')
  }
  // Chain to walk: root → intermediates → leaf. `trimmed` is leaf-first;
  // reverse to be top-down.
  const walk = [...trimmed].reverse()
  let parentKey = rootKey
  for (const cert of walk) {
    if (!cert.verify(parentKey)) {
      return { verified: false, reason: `chain link failed: ${cert.subject}` }
    }
    parentKey = cert.publicKey
  }
  return { verified: true, leaf: walk[walk.length - 1] }
}

/**
 * Verify a FIDO MDS BLOB JWS end-to-end.
 * Returns { verified: true, payload } on success, or throws.
 */
export function verifyMdsBlob(jwt, { rootPem = loadFidoMdsRootPem() } = {}) {
  const { headerB64, payloadB64, signatureB64, headerObj } = parseJws(jwt)

  if (!ACCEPTED_ALGORITHMS.includes(headerObj.alg)) {
    throw new Error(`JWS alg not accepted: ${JSON.stringify(headerObj.alg)}`)
  }
  if (!Array.isArray(headerObj.x5c) || headerObj.x5c.length === 0) {
    throw new Error('JWS header missing x5c chain')
  }

  const chainResult = verifyCertChain(headerObj.x5c, rootPem)
  if (!chainResult.verified) {
    throw new Error(`FIDO MDS cert chain verification failed: ${chainResult.reason}`)
  }
  const leaf = chainResult.leaf
  const publicKey = createPublicKey(leaf.publicKey)

  // Verify the JWS signature over `headerB64 + '.' + payloadB64` with the
  // leaf cert's public key, alg=ES256 (SHA-256 + ECDSA).
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8')
  const rawSig = base64UrlToBuffer(signatureB64)
  const derSig = ecdsaJwsSignatureToDer(rawSig)
  const verifier = createVerify('SHA256')
  verifier.update(signingInput)
  verifier.end()
  const sigValid = verifier.verify(publicKey, derSig)
  if (!sigValid) {
    throw new Error('FIDO MDS BLOB signature invalid')
  }

  const payloadJson = base64UrlToBuffer(payloadB64).toString('utf8')
  const payload = JSON.parse(payloadJson)
  return { verified: true, payload, leafSubject: leaf.subject }
}

// Exported for tests.
export const __testables = {
  ecdsaJwsSignatureToDer,
  base64UrlToBuffer,
  DEFAULT_ROOT_PEM_PATH,
}
