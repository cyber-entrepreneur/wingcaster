/**
 * Private blob storage for account-recovery evidence ([BE-ACR-03]).
 *
 * Default: local private directory (not under public /uploads).
 * Interface is S3-ready: put / getStream / exists / remove by storage_key.
 * Private ACL — never emit public or presigned URLs to clients.
 */

import { createReadStream, existsSync } from 'node:fs'
import { mkdir, writeFile, unlink, access } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_EVIDENCE_STORAGE_ROOT = resolve(
  __dirname,
  '../../private/account-recovery-evidence',
)

export function resolveEvidenceStorageRoot(env = process.env) {
  const configured = env.ACCOUNT_RECOVERY_EVIDENCE_PATH
  if (configured && String(configured).trim()) {
    return resolve(String(configured).trim())
  }
  return DEFAULT_EVIDENCE_STORAGE_ROOT
}

function assertSafeRelativeKey(storageKey) {
  const key = String(storageKey || '')
  if (!key || key.includes('\0') || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid storage_key')
  }
  return key.replace(/\\/g, '/')
}

export function createLocalEvidenceStorage({ rootDir } = {}) {
  const root = resolve(rootDir || resolveEvidenceStorageRoot())

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
    /** No public URL — evidence is proxy-only. */
    publicUrlFor() {
      return null
    },
    async put(storageKey, buffer, { contentType } = {}) {
      const abs = absolutePath(storageKey)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, buffer, { mode: 0o600 })
      // Touch contentType for future S3 metadata parity (unused locally).
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

export function getEvidenceStorage() {
  if (!_defaultStorage) {
    _defaultStorage = createLocalEvidenceStorage()
  }
  return _defaultStorage
}

/** Test hook — swap storage backend. */
export function setEvidenceStorageForTests(storage) {
  _defaultStorage = storage
}
