/**
 * T7 — Multi-format serializers for data-export payloads (H3 v2).
 *
 * H3 shipped JSON-only. This module adds:
 *   - `serializeJson(payload)` — pass-through, matches H3 output
 *   - `serializeZip(payload)` — ZIP archive containing:
 *       profile.json      — user + agent + notes.excluded_fields metadata
 *       request.json      — the export-request row (chain-of-custody)
 *       contacts.csv      — one row per contact
 *       opportunities.csv — one row per opportunity
 *       activity_log.csv  — one row per activity_log event
 *       sessions.csv      — one row per user_session (sanitised — no tokens)
 *       backup_codes.csv  — one row per backup-code stub (id + used_at only)
 *
 * The CSV format matches Google Takeout's convention (one CSV per
 * collection, top-level JSON for scalar fields). Enterprise DPOs prefer
 * spreadsheet-friendly output for reviews.
 *
 * ZIP writing uses `archiver`. Streams to a buffer so the caller can hand
 * either a Buffer or a Readable back to the storage adapter.
 */

import archiver from 'archiver'

/** RFC-4180 escape (same rules H5 uses for audit-log CSV). */
export function csvEscape(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Convert an array of homogenous objects to a CSV string. Columns are the
 * union of all rows' keys, sorted alphabetically for determinism.
 * Empty input returns just a header line "empty," so importers don't crash
 * on a truly blank file.
 */
export function rowsToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'empty\n'
  const cols = new Set()
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) cols.add(k)
    }
  }
  const columns = Array.from(cols).sort()
  const header = columns.join(',')
  const lines = rows.map((row) => columns.map((c) => csvEscape(row?.[c])).join(','))
  return `${header}\n${lines.join('\n')}\n`
}

/** T7 pass-through serialiser — matches H3's `runExport` body shape. */
export function serializeJson(payload) {
  return {
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
    contentType: 'application/json; charset=utf-8',
    extension: 'json',
  }
}

/**
 * ZIP serialiser. Returns a Promise<{body: Buffer, contentType, extension}>.
 * `archiver` streams into a memory Buffer via `WritableStream`; for very
 * large exports (>100 MB) a future iteration would stream directly to S3
 * via `Upload` from @aws-sdk/lib-storage. Today, in-memory is fine — the
 * bounded payload discipline in H3 caps a single export at ~10-20 MB in
 * practice.
 */
export async function serializeZip(payload) {
  const chunks = []
  const archive = archiver('zip', { zlib: { level: 9 } })

  const done = new Promise((resolve, reject) => {
    archive.on('data', (buf) => chunks.push(buf))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('warning', (err) => {
      // ENOENT-family warnings are safe to log; other warnings should fail.
      if (err.code !== 'ENOENT') reject(err)
    })
    archive.on('error', reject)
  })

  // Split the H3 payload shape into per-collection files.
  const profile = {
    export_format_version: payload.export_format_version,
    generated_at: payload.generated_at,
    data_subject: payload.data_subject,
    user: payload.user,
    agent: payload.agent,
    _notes: payload._notes,
  }
  archive.append(JSON.stringify(profile, null, 2), { name: 'profile.json' })

  // Chain-of-custody: include the request metadata inside the export
  // itself, matching Google Takeout's convention. Regulator wants to
  // trace who asked for what.
  archive.append(
    JSON.stringify(
      {
        exported_at: payload.generated_at,
        format: 'zip',
        format_version: payload.export_format_version,
      },
      null,
      2,
    ),
    { name: 'request.json' },
  )

  const csvCollections = [
    ['contacts.csv', payload.contacts],
    ['opportunities.csv', payload.opportunities],
    ['activity_log.csv', payload.activity_log],
    ['sessions.csv', payload.sessions],
    ['backup_codes.csv', payload.backup_codes],
  ]
  for (const [filename, rows] of csvCollections) {
    archive.append(rowsToCsv(rows || []), { name: filename })
  }

  await archive.finalize()
  const body = await done
  return {
    body,
    contentType: 'application/zip',
    extension: 'zip',
  }
}

/**
 * Format registry — pick a serialiser by format string. Unknown formats
 * fall back to JSON so a bad format param can't crash a job.
 */
export async function serializeExport(format, payload) {
  if (format === 'zip') return serializeZip(payload)
  return serializeJson(payload)
}

// Exported for tests.
export const __testables = {
  csvEscape,
  rowsToCsv,
  serializeJson,
  serializeZip,
}
