/**
 * Shared-number pool + intake CFG.
 * Runtime order: env → public.platform_config → hardcoded fallback
 * (same pattern as getDispatchConfig in lib/notifications/dispatch.js).
 */

import { query } from '../../../db.js'

const DB_CFG_TTL_MS = 30_000

export const INTAKE_CFG_DEFAULTS = Object.freeze({
  WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP: 500,
  WHATSAPP_INTAKE_TIER_ALERT_PERCENT: 70,
  WHATSAPP_INTAKE_CODE_TTL_HOURS: 24,
  WHATSAPP_INTAKE_TIER_CAP_PER_NUMBER: 10000,
})

export const DEFAULT_SHARED_NUMBERS = Object.freeze([
  { e164: '+15550000001', label: 'primary' },
  { e164: '+15550000002', label: 'secondary' },
  { e164: '+15550000003', label: 'tertiary' },
])

let dbCfgCache = null
let dbCfgCachedAt = 0

function readEnvRaw(key) {
  const raw = process.env[key]
  if (raw == null || raw === '') return null
  return raw
}

function readEnvInt(key) {
  const raw = readEnvRaw(key)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseSharedNumbers(raw) {
  if (raw == null || raw === '') return null
  if (Array.isArray(raw)) return normalizeNumberList(raw)
  try {
    const parsed = JSON.parse(raw)
    return normalizeNumberList(parsed)
  } catch {
    return null
  }
}

function normalizeNumberList(list) {
  if (!Array.isArray(list)) return null
  const numbers = list
    .map((entry) => {
      if (typeof entry === 'string') return { e164: entry, label: '' }
      if (entry && typeof entry === 'object' && entry.e164) {
        return { e164: String(entry.e164), label: String(entry.label || '') }
      }
      return null
    })
    .filter(Boolean)
  return numbers.length ? numbers : null
}

async function loadDbCfg() {
  const now = Date.now()
  if (dbCfgCache && now - dbCfgCachedAt < DB_CFG_TTL_MS) return dbCfgCache
  try {
    const rows = await query(
      `SELECT key, value FROM public.platform_config WHERE key LIKE 'WHATSAPP_INTAKE_%'`,
    )
    dbCfgCache = Object.fromEntries((rows || []).map((r) => [r.key, r.value]))
  } catch {
    dbCfgCache = {}
  }
  dbCfgCachedAt = now
  return dbCfgCache
}

export function _resetIntakeConfigCache() {
  dbCfgCache = null
  dbCfgCachedAt = 0
}

export function parseSharedNumbersFromEnv() {
  return parseSharedNumbers(readEnvRaw('WHATSAPP_INTAKE_SHARED_NUMBERS'))
}

/**
 * Sync pool used at boot. Production with an explicit undersized env var
 * (or missing env in production) rejects. Tests/dev fall back to 3 sandbox numbers.
 */
export function getSharedNumbersSync() {
  const fromEnv = parseSharedNumbersFromEnv()
  if (fromEnv) {
    assertSharedNumberFloor(fromEnv)
    return fromEnv
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WHATSAPP_INTAKE_SHARED_NUMBERS requires at least 3 numbers at launch (H3)')
  }
  return [...DEFAULT_SHARED_NUMBERS]
}

export function assertSharedNumberFloor(numbers) {
  if (!numbers || numbers.length < 3) {
    throw new Error('WHATSAPP_INTAKE_SHARED_NUMBERS requires at least 3 numbers at launch (H3)')
  }
}

export async function getIntakeConfig() {
  const dbCfg = await loadDbCfg()
  const cfg = {}
  for (const [key, fallback] of Object.entries(INTAKE_CFG_DEFAULTS)) {
    const envVal = readEnvInt(key)
    if (envVal != null) {
      cfg[key] = envVal
      continue
    }
    const fromDb = dbCfg[key]
    const parsed = fromDb == null ? NaN : Number(fromDb)
    cfg[key] = Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  }

  const fromEnv = parseSharedNumbersFromEnv()
  const fromDb = parseSharedNumbers(dbCfg.WHATSAPP_INTAKE_SHARED_NUMBERS)
  const numbers = fromEnv || fromDb || (process.env.NODE_ENV === 'production' ? null : [...DEFAULT_SHARED_NUMBERS])
  assertSharedNumberFloor(numbers)
  cfg.sharedNumbers = numbers
  cfg.poolSize = numbers.length
  return cfg
}
