/**
 * Private blob storage for contact attachments (full-form Pre-Approval Letter,
 * and future contact files).
 *
 * Default: local private directory, NOT under the public /uploads static mount.
 * Interface is S3-ready: put / getStream / exists / remove by storage_key.
 * Private ACL — never emit public or presigned URLs to clients; downloads are
 * proxied through an auth + ownership gate.
 *
 * Mirrors account-recovery/evidence-storage.js (same safe-key handling and 0600
 * mode) but keeps its own root so the two stores stay isolated.
 */

import { createReadStream, existsSync } from 'node:fs'
import { mkdir, writeFile, unlink, access } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_CONTACT_ATTACHMENT_ROOT = resolve(
  __dirname,
  '../../../private/contact-attachments',
)

export function resolveContactAttachmentRoot(env = process.env) {
  const configured = env.CONTACT_ATTACHMENT_STORAGE_PATH
  if (configured && String(configured).trim()) {
    return resolve(String(configured).trim())
  }
  return DEFAULT_CONTACT_ATTACHMENT_ROOT
}

function assertSafeRelativeKey(storageKey) {
  const key = String(storageKey || '')
  if (!key || key.includes('\0') || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid storage_key')
  }
  return key.replace(/\\/g, '/')
}

export function createLocalContactAttachmentStorage({ rootDir } = {}) {
  const root = resolve(rootDir || resolveContactAttachmentRoot())

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
    /** No public URL — attachments are proxy-only. */
    publicUrlFor() {
      return null
    },
    async put(storageKey, buffer) {
      const abs = absolutePath(storageKey)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, buffer, { mode: 0o600 })
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
        const err = new Error('Attachment blob not found')
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

export function getContactAttachmentStorage() {
  if (!_defaultStorage) {
    _defaultStorage = createLocalContactAttachmentStorage()
  }
  return _defaultStorage
}

/** Test hook — swap storage backend. */
export function setContactAttachmentStorageForTests(storage) {
  _defaultStorage = storage
}
