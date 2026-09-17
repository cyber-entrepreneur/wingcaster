/**
 * Data-export cleanup worker (H3 — #196 v2).
 *
 * Sweeps expired export rows: deletes the underlying storage (disk file or
 * S3 object) and stamps the row so we know when it was pruned. The DB row
 * stays around for audit trail — an auditor asking "who requested export X"
 * still gets an answer, even after the file itself is gone.
 *
 * Called from `startDataExportCleanupJob()` on a `CLEANUP_INTERVAL_MS`
 * interval; also exported as `runDataExportCleanupOnce()` for direct use
 * from tests or a manual admin action.
 */

import { query } from '../db.js'
import { deleteStoredExport } from '../lib/settings/data-export-storage.js'
import logger from '../lib/logger.js'

export const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

/** Sweep once. Returns a summary useful for logs + observability. */
export async function runDataExportCleanupOnce() {
  const expiredRows = await query(
    `SELECT id, file_path FROM data_exports
     WHERE status = 'complete'
       AND file_path IS NOT NULL
       AND expires_at <= CURRENT_TIMESTAMP`,
  )
  let deleted = 0
  let failed = 0
  for (const row of expiredRows) {
    try {
      await deleteStoredExport(row.file_path)
      await query(
        `UPDATE data_exports
         SET file_path = NULL,
             data = jsonb_set(COALESCE(data, '{}'::jsonb), '{pruned_at}', to_jsonb($2::text), true),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id, new Date().toISOString()],
      )
      deleted += 1
    } catch (err) {
      failed += 1
      logger.error({ err, exportId: row.id }, 'data-export cleanup: single row failed')
    }
  }
  return { scanned: expiredRows.length, deleted, failed }
}

/**
 * Long-running loop. In production, called once from server.js startup;
 * `setInterval` is unref'd so it doesn't hold the process open during
 * graceful shutdown.
 */
export function startDataExportCleanupJob({ intervalMs = CLEANUP_INTERVAL_MS } = {}) {
  const tick = async () => {
    try {
      const summary = await runDataExportCleanupOnce()
      if (summary.deleted > 0 || summary.failed > 0) {
        logger.info(summary, 'data-export cleanup tick')
      }
    } catch (err) {
      logger.error({ err }, 'data-export cleanup tick threw')
    }
  }
  // Run once at startup so the first sweep isn't delayed by a full interval.
  void tick()
  const handle = setInterval(tick, intervalMs)
  handle.unref?.()
  return handle
}
