/**
 * WF-04 / PA-NAV-001 environment scoping for account-recovery cases.
 *
 * LIVE and TEST must never co-mingle. Cases persist `environment` and all
 * admin list/detail/mutations filter by the operator session env.
 *
 * Header: `X-Wingcaster-Env: live|test` (case-insensitive). Session fields
 * `fin_environment` / `environment` remain authoritative when present.
 */

import logger from '../lib/logger.js'

export const WINGCASTER_ENVS = Object.freeze({
  LIVE: 'LIVE',
  TEST: 'TEST',
})

export const WINGCASTER_ENV_HEADER = 'x-wingcaster-env'

/**
 * @param {unknown} raw
 * @returns {'LIVE'|'TEST'|null}
 */
export function normalizeWingcasterEnv(raw) {
  if (raw == null || raw === '') return null
  const value = String(raw).trim().toUpperCase()
  if (value === 'LIVE' || value === 'TEST') return value
  return null
}

/**
 * Resolve the operator environment for a request.
 *
 * Preference: session (`fin_environment` / `environment` / `finEnvironment`)
 * when set; otherwise header; otherwise LIVE.
 *
 * Header/session mismatches are audited and the session value wins so a
 * spoofed header cannot pivot the PA into the other catalog.
 *
 * @param {import('express').Request} req
 * @returns {'LIVE'|'TEST'}
 */
export function resolveWingcasterEnv(req) {
  const headerRaw = req?.get?.(WINGCASTER_ENV_HEADER)
    || req?.headers?.[WINGCASTER_ENV_HEADER]
    || req?.headers?.['X-Wingcaster-Env']
  const headerEnv = normalizeWingcasterEnv(headerRaw)

  const sessionRaw = req?.user?.fin_environment
    || req?.user?.environment
    || req?.finEnvironment
  const sessionEnv = normalizeWingcasterEnv(sessionRaw)

  if (headerEnv && sessionEnv && headerEnv !== sessionEnv) {
    logger.warn(
      {
        header_env: headerEnv,
        session_env: sessionEnv,
        user_id: req?.user?.id || null,
        path: req?.originalUrl || req?.url || null,
      },
      'account-recovery: X-Wingcaster-Env mismatches session; using session',
    )
  }

  return sessionEnv || headerEnv || WINGCASTER_ENVS.LIVE
}

/**
 * Environment for public recovery intake (`POST /api/auth/recovery/request`).
 * Public callers have no PA session — honor a valid header, else LIVE.
 *
 * @param {import('express').Request} req
 * @returns {'LIVE'|'TEST'}
 */
export function resolveRecoveryRequestEnv(req) {
  const headerRaw = req?.get?.(WINGCASTER_ENV_HEADER)
    || req?.headers?.[WINGCASTER_ENV_HEADER]
    || req?.headers?.['X-Wingcaster-Env']
  return normalizeWingcasterEnv(headerRaw) || WINGCASTER_ENVS.LIVE
}

/**
 * @param {object|null|undefined} recoveryCase
 * @param {'LIVE'|'TEST'} environment
 * @returns {boolean}
 */
export function caseMatchesEnvironment(recoveryCase, environment) {
  if (!recoveryCase) return false
  const caseEnv = normalizeWingcasterEnv(recoveryCase.environment) || WINGCASTER_ENVS.LIVE
  return caseEnv === environment
}
