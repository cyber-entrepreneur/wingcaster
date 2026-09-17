/**
 * Self-serve data export (closes issue #192b).
 *
 * Routes:
 *   POST /api/settings/data-export             — create a new export job
 *   GET  /api/settings/data-export             — list caller's recent exports
 *   GET  /api/settings/data-export/:id/status  — poll one job
 *   GET  /api/settings/data-export/:id/download — stream the file (auth-gated)
 *
 * ---------------------------------------------------------------------------
 * Regulatory grounding
 * ---------------------------------------------------------------------------
 *
 * GDPR Article 20 (right to portability) requires the controller to hand the
 * data subject a copy of their personal data in a "structured, commonly used
 * and machine-readable format." UAE Federal Law 45/2021 and KSA PDPL mirror
 * this. WingCaster already promises this compliance in login copy — this
 * route makes good on the promise.
 *
 * ---------------------------------------------------------------------------
 * Async model
 * ---------------------------------------------------------------------------
 *
 * Even a small user can have thousands of contacts + listings + activity
 * rows, so we cannot collect + write + return in a single HTTP call. The
 * pattern:
 *   1. POST creates a `data_exports` row with `status=pending` and returns
 *      the id immediately.
 *   2. `runExport()` is triggered in-process (no worker queue infra yet);
 *      writes JSON to disk under `DATA_EXPORT_DIR`, updates the row with
 *      `file_path` / `bytes` / `sha256` and `status=complete`.
 *   3. Client polls `/status/:id` every few seconds until status flips.
 *   4. Client GETs `/download/:id` — the response streams the file back.
 *
 * A future S3 migration replaces the local disk write with a bucket upload
 * and returns a signed URL from `/download/:id` as a 307 redirect.
 */

import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { insert, query, findAll } from '../../db.js'
import { findUserById, findAgentForUser } from '../../identity.js'
import logger from '../logger.js'

/**
 * Where files land on disk today. Overridable so tests do not pollute a
 * real directory. In production this is a persistent volume; in dev it is
 * the OS temp dir under a stable subfolder.
 */
export const DATA_EXPORT_DIR =
  process.env.WINGCASTER_DATA_EXPORT_DIR ||
  path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'wingcaster-exports')

/** Cap on active (pending / running / recently-completed) exports per user. */
export const MAX_ACTIVE_EXPORTS_PER_USER = 3

async function ensureExportDir() {
  await mkdir(DATA_EXPORT_DIR, { recursive: true })
}

/**
 * Collect the user's exportable payload. Called ONLY under the async
 * `runExport` path — never in the request handler. Reads through the same
 * DAL every other route uses so RLS / tenant scoping stays honest.
 */
async function collectExportPayload(userId) {
  const user = await findUserById(userId)
  if (!user) throw new Error('user_not_found')
  const agent = await findAgentForUser(userId)

  // Sensitive-field policy: PII the user owns is fair game (email, phone,
  // profile fields). Server-side secrets (password_hash, totp_secret,
  // hashed_secret) are dropped. Anything on `data` JSONB is user-authored
  // content, kept.
  const safeUser = { ...user }
  for (const secret of [
    'password_hash',
    'totp_secret_encrypted',
    'totp_last_time_step',
  ]) {
    delete safeUser[secret]
  }

  // A user can own many rows across many collections. Query each with the
  // owner-scoped predicate our DAL uses elsewhere.
  const [contacts, opportunities, activityLog, backupCodes, sessions] = await Promise.all([
    findAll('contacts', (c) => c.owner_id === userId || c.user_id === userId).catch(() => []),
    findAll('opportunities', (o) => o.owner_id === userId || o.user_id === userId).catch(() => []),
    findAll('activity_log', (a) => a.agent_id === userId).catch(() => []),
    // Backup-codes are the hash — but the fact of their existence is
    // yours; return the count so a data-subject audit can see it.
    findAll('user_backup_codes', (c) => c.user_id === userId).catch(() => []),
    findAll('user_sessions', (s) => s.user_id === userId).catch(() => []),
  ])

  return {
    export_format_version: 1,
    generated_at: new Date().toISOString(),
    data_subject: {
      user_id: userId,
      email: user.email,
      name: user.name,
    },
    user: safeUser,
    agent,
    contacts,
    opportunities,
    // Show existence + timestamps, not the underlying hashes.
    backup_codes: backupCodes.map((b) => ({
      id: b.id,
      used_at: b.used_at,
      created_at: b.created_at,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      last_active_at: s.last_active_at,
      ip_country: s.ip_country,
      device_summary: s.device_summary,
      is_current: s.is_current,
      created_at: s.created_at,
      revoked_at: s.revoked_at,
    })),
    activity_log: activityLog,
    _notes: {
      excluded_fields: [
        'user.password_hash',
        'user.totp_secret_encrypted',
        'sessions.token_hash',
        'backup_codes.code_hash',
      ],
      generated_under: 'GDPR Article 20 / UAE Fed 45/2021 / KSA PDPL portability rights',
    },
  }
}

async function updateExportRow(id, patch) {
  const now = new Date().toISOString()
  const fields = Object.keys(patch)
  if (!fields.length) return
  const setClauses = fields.map((k, i) => `${k} = $${i + 2}`).join(', ')
  await query(
    `UPDATE data_exports SET ${setClauses}, updated_at = $${fields.length + 2} WHERE id = $1`,
    [id, ...fields.map((k) => patch[k]), now],
  )
}

/**
 * The async worker. Kicked off (fire-and-forget) from the POST handler so
 * the HTTP response returns immediately. Errors are captured on the row —
 * they must never crash the process.
 */
export async function runExport(exportId, userId) {
  try {
    await updateExportRow(exportId, { status: 'running', started_at: new Date().toISOString() })
    await ensureExportDir()
    const payload = await collectExportPayload(userId)
    const body = JSON.stringify(payload, null, 2)
    const filePath = path.join(DATA_EXPORT_DIR, `${exportId}.json`)
    await writeFile(filePath, body, 'utf8')
    const bytes = Buffer.byteLength(body, 'utf8')
    const sha = createHash('sha256').update(body).digest('hex')
    await updateExportRow(exportId, {
      status: 'complete',
      file_path: filePath,
      bytes,
      sha256: sha,
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.error({ err, exportId, userId }, 'data export run failed')
    try {
      await updateExportRow(exportId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
    } catch (nested) {
      logger.error({ err: nested, exportId }, 'data export failure-status write also failed')
    }
  }
}

function serializeExport(row) {
  return {
    id: row.id,
    status: row.status,
    bytes: row.bytes ? Number(row.bytes) : null,
    sha256: row.sha256,
    error: row.error,
    requested_at: row.requested_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
  }
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} deps.authMiddleware
 * @param {Function} [deps.scheduleRun] — override for tests: defaults to
 *   `setImmediate(() => runExport(id, uid))`. Tests pass a synchronous stub.
 */
export function registerDataExportRoutes(app, deps) {
  const auth = deps.authMiddleware
  const schedule =
    deps.scheduleRun ||
    ((id, uid) => {
      setImmediate(() => {
        void runExport(id, uid)
      })
    })

  app.post('/api/settings/data-export', auth, async (req, res, next) => {
    try {
      // Rate limit: too many outstanding jobs = tell the user to wait rather
      // than let a runaway loop pin the export directory.
      const active = await query(
        `SELECT COUNT(*)::int AS n FROM data_exports
         WHERE user_id = $1 AND status IN ('pending', 'running')`,
        [req.user.id],
      )
      if ((active[0]?.n ?? 0) >= MAX_ACTIVE_EXPORTS_PER_USER) {
        return res.status(409).json({
          error: 'export_in_progress',
          message:
            'You already have an export in progress. Wait for it to finish before starting a new one.',
        })
      }

      const row = {
        id: randomUUID(),
        user_id: req.user.id,
        status: 'pending',
        requested_ip: req.ip,
        requested_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      }
      await insert('data_exports', row)
      schedule(row.id, req.user.id)
      return res.status(202).json({ export: serializeExport(row) })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/settings/data-export', auth, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT * FROM data_exports WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 25`,
        [req.user.id],
      )
      return res.json({ exports: rows.map(serializeExport) })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/settings/data-export/:id/status', auth, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT * FROM data_exports WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [req.params.id, req.user.id],
      )
      const row = rows[0]
      if (!row) return res.status(404).json({ error: 'Not found' })
      return res.json({ export: serializeExport(row) })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/settings/data-export/:id/download', auth, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT * FROM data_exports WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [req.params.id, req.user.id],
      )
      const row = rows[0]
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (row.status !== 'complete') {
        return res.status(409).json({ error: 'not_ready', status: row.status })
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ error: 'expired', message: 'Export link has expired. Request a new one.' })
      }
      if (!row.file_path) {
        return res.status(500).json({ error: 'missing_file' })
      }
      // Stream (not readFileSync) so a large export does not hold N bytes
      // of RAM per download.
      let stat
      try {
        stat = statSync(row.file_path)
      } catch {
        return res.status(410).json({ error: 'file_missing', message: 'Export file has been cleaned up. Request a new one.' })
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="wingcaster-export-${row.id}.json"`,
      )
      res.setHeader('Content-Length', String(stat.size))
      if (row.sha256) res.setHeader('X-WingCaster-Export-Sha256', row.sha256)
      const stream = createReadStream(row.file_path)
      stream.on('error', () => {
        // Best-effort — headers already sent.
        try { res.end() } catch { /* swallow */ }
      })
      return stream.pipe(res)
    } catch (err) {
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  MAX_ACTIVE_EXPORTS_PER_USER,
  DATA_EXPORT_DIR,
  collectExportPayload,
  serializeExport,
  ensureExportDir,
}
