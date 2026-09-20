/**
 * PA-AUD-002 — Audit-log retention policy (shared helpers).
 *
 * A single `audit_retention_policy` row (id = 'default') holds the platform
 * retention config per event category plus an export-before-purge flag. These
 * helpers load/serialize it with sane defaults so both the admin routes and the
 * purge job read one source of truth.
 */
import { findOne } from '../../db.js'

export const POLICY_ID = 'default'

// Regulatory floor: financial audit rows kept >= 7 years.
export const FINANCIAL_FLOOR_DAYS = 2555
export const MIN_CATEGORY_DAYS = 30
export const MAX_CATEGORY_DAYS = 3650

export const RETENTION_DEFAULTS = Object.freeze({
  financial_actions_days: FINANCIAL_FLOOR_DAYS,
  pa_actions_days: 365,
  tenant_actions_days: 365,
  system_events_days: 90,
  export_before_purge: true,
})

export function serializeRetentionPolicy(row) {
  const src = row || {}
  const num = (v, d) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  return {
    financial_actions_days: num(src.financial_actions_days, RETENTION_DEFAULTS.financial_actions_days),
    pa_actions_days: num(src.pa_actions_days, RETENTION_DEFAULTS.pa_actions_days),
    tenant_actions_days: num(src.tenant_actions_days, RETENTION_DEFAULTS.tenant_actions_days),
    system_events_days: num(src.system_events_days, RETENTION_DEFAULTS.system_events_days),
    export_before_purge:
      src.export_before_purge == null ? RETENTION_DEFAULTS.export_before_purge : Boolean(src.export_before_purge),
    updated_by: src.updated_by ?? null,
    updated_at: src.updated_at ?? null,
  }
}

/** Load the current policy, merged over defaults. Never throws on a bare DB. */
export async function loadRetentionPolicy() {
  try {
    const row = await findOne('audit_retention_policy', (r) => r.id === POLICY_ID)
    return serializeRetentionPolicy(row)
  } catch {
    return serializeRetentionPolicy(null)
  }
}
