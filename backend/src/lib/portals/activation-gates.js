/**
 * Server-side gates for portal is_active flips (BE-BLOCKER-35 / PA-POR-002).
 * Adapter + validator files must exist before activation can be requested or approved.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ADAPTERS_DIR = join(HERE, '../notifications/portals')
export const VALIDATORS_DIR = join(HERE, '../portal-validators')

export function resolveAdapterFilePath(adapterClassName, code) {
  const raw = String(adapterClassName || (code ? `portals/${code}.js` : ''))
  const file = raw.replace(/^portals\//, '').replace(/^\.\//, '')
  if (!file) return null
  const name = file.endsWith('.js') ? file : `${file}.js`
  return join(ADAPTERS_DIR, name)
}

export function resolveValidatorFilePath(validatorRef, code) {
  let raw = String(validatorRef || code || '').trim()
  if (!raw) return null
  raw = raw
    .replace(/^backend\/src\/lib\/portal-validators\//, '')
    .replace(/^src\/lib\/portal-validators\//, '')
    .replace(/^portal-validators\//, '')
    .replace(/^portals\//, '')
    .replace(/\.js$/, '')
  if (!raw) return null
  const base = raw.includes('/') ? raw.split('/').pop() : raw
  return join(VALIDATORS_DIR, `${base}.js`)
}

export function adapterFileExists(portal) {
  const path = resolveAdapterFilePath(portal?.adapter_class_name, portal?.code)
  return Boolean(path && existsSync(path))
}

export function validatorFileExists(portal) {
  const path = resolveValidatorFilePath(portal?.validator_ref, portal?.code)
  return Boolean(path && existsSync(path))
}

/** Derive PA-POR-001 adapter_status: live | stub | deprecated. */
export function deriveAdapterStatus(portal) {
  if (portal?.deprecated_at) return 'deprecated'
  if (adapterFileExists(portal) && validatorFileExists(portal)) return 'live'
  return 'stub'
}

/** Gate for flipping is_active → true. Throws ADAPTER_MISSING / VALIDATOR_MISSING. */
export function assertActivationFilesPresent(portal) {
  if (!adapterFileExists(portal)) {
    const err = new Error(
      `Can't activate — adapter file missing for ${portal?.adapter_class_name || portal?.code}`,
    )
    err.code = 'ADAPTER_MISSING'
    err.httpStatus = 400
    throw err
  }
  if (!validatorFileExists(portal)) {
    const err = new Error(
      `Can't activate — validator file missing for ${portal?.validator_ref || portal?.code}`,
    )
    err.code = 'VALIDATOR_MISSING'
    err.httpStatus = 400
    throw err
  }
}
