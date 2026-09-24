/**
 * Market on/off registry — PA-controlled (migration 804).
 *
 * A market that is OFF is not offered to agents and its listing-verification
 * triggers never fire (the gate treats it as the 'none' tier). Launch = only
 * Lebanon ON. Raw SQL access (not the generic DAL) — natural PK is country_code.
 */
import { query } from '../../db.js'

/** The markets WingCaster knows about (label source of truth for the PA screen). */
export const MARKET_LABELS = Object.freeze({
  LB: 'Lebanon',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  KW: 'Kuwait',
  QA: 'Qatar',
  BH: 'Bahrain',
  OM: 'Oman',
  EG: 'Egypt',
  JO: 'Jordan',
})

export function isKnownMarket(code) {
  return Object.prototype.hasOwnProperty.call(MARKET_LABELS, String(code || '').toUpperCase())
}

/** ISO2 codes of markets that are currently ON. */
export async function getEnabledMarketCodes() {
  const rows = await query('SELECT country_code FROM public.market_settings WHERE enabled = TRUE')
  return rows.map((r) => r.country_code)
}

/** All known markets with their enabled flag — for the PA admin screen. */
export async function listMarketSettings() {
  const rows = await query('SELECT country_code, enabled FROM public.market_settings')
  const byCode = new Map(rows.map((r) => [r.country_code, Boolean(r.enabled)]))
  return Object.entries(MARKET_LABELS).map(([code, label]) => ({
    code,
    label,
    enabled: byCode.get(code) ?? false,
  }))
}

/** Turn a market on/off (upsert). Returns the new state. */
export async function setMarketEnabled(code, enabled, actorId = null) {
  const cc = String(code || '').toUpperCase()
  await query(
    `INSERT INTO public.market_settings (country_code, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (country_code)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by,
                     updated_at = CURRENT_TIMESTAMP`,
    [cc, Boolean(enabled), actorId],
  )
  return { code: cc, enabled: Boolean(enabled) }
}
