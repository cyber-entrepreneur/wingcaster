/**
 * Private blob storage for pricing evidence (Wave 5 / PR #127).
 * Mirrors account-recovery/evidence-storage.js — local private dir, S3-ready.
 */

import { createReadStream, existsSync } from 'node:fs'
import { mkdir, writeFile, unlink, access } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_PRICING_EVIDENCE_ROOT = resolve(
  __dirname,
  '../../../private/pricing-evidence',
)

export function resolvePricingEvidenceStorageRoot(env = process.env) {
  const configured = env.PRICING_EVIDENCE_PATH
  if (configured && String(configured).trim()) {
    return resolve(String(configured).trim())
  }
  return DEFAULT_PRICING_EVIDENCE_ROOT
}

function assertSafeRelativeKey(storageKey) {
  const key = String(storageKey || '')
  if (!key || key.includes('\0') || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid storage_key')
  }
  return key.replace(/\\/g, '/')
}

export function createLocalPricingEvidenceStorage({ rootDir } = {}) {
  const root = resolve(rootDir || resolvePricingEvidenceStorageRoot())

  function absolutePath(storageKey) {
    const safe = assertSafeRelativeKey(storageKey)
    const abs = resolve(join(root, safe))
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new Error('storage_key escapes root')
    }
    return abs
  }

  return {
    kind: 'local',
    root,
    publicUrlFor() {
      return null
    },
    async put(storageKey, buffer, { contentType } = {}) {
      const abs = absolutePath(storageKey)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, buffer, { mode: 0o600 })
      void contentType
      return { storageKey, size: buffer.length }
    },
    async exists(storageKey) {
      try {
        await access(absolutePath(storageKey), fsConstants.R_OK)
        return true
      } catch {
        return false
      }
    },
    async getStream(storageKey) {
      const abs = absolutePath(storageKey)
      if (!existsSync(abs)) {
        const err = new Error('Evidence blob not found')
        err.code = 'ENOENT'
        throw err
      }
      return createReadStream(abs)
    },
    async remove(storageKey) {
      try {
        await unlink(absolutePath(storageKey))
        return true
      } catch (err) {
        if (err?.code === 'ENOENT') return false
        throw err
      }
    },
  }
}

let _defaultStorage = null

export function getPricingEvidenceStorage() {
  if (!_defaultStorage) {
    _defaultStorage = createLocalPricingEvidenceStorage()
  }
  return _defaultStorage
}

/** Test hook — swap storage backend. */
export function setPricingEvidenceStorageForTests(storage) {
  _defaultStorage = storage
}
