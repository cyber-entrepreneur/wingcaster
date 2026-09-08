/**
 * Production entrypoint — apply pending migrations, then boot the server.
 *
 * Used by the Docker image CMD and by the `npm start` script. The
 * migration runner is idempotent and acquires a Postgres advisory lock so
 * concurrent workers on a Railway rolling deploy will serialize safely.
 */

import { loadDb } from '../src/db.js'
import { getPool } from '../src/persistence/postgres-adapter.js'
import { runMigrations } from '../src/persistence/migrations/runner.js'
import { bootPortalRegistry } from '../src/lib/notifications/portals/registry.js'
import { refreshRealEstatePortalExport } from '../src/lib/notifications/realestate.js'
import { backfillDistributionAttemptErrorClasses } from '../src/lib/publishing/backfill-error-class.js'
import logger from '../src/lib/logger.js'

await loadDb()
await runMigrations()
try {
  await backfillDistributionAttemptErrorClasses({ pool: getPool(), logger })
} catch (err) {
  logger.warn({ err: err?.message || String(err) }, 'distribution_attempts.error_class backfill skipped')
}
await bootPortalRegistry()
refreshRealEstatePortalExport()
await import('../src/server.js')