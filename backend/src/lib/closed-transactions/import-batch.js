import { v4 as uuidv4 } from 'uuid'
import { insert } from '../../db.js'

export async function recordImportBatch({
  agentId,
  agencyId,
  filename,
  rowCount,
  imported,
  skipped,
  errors,
  columnMap,
}) {
  const row = {
    id: uuidv4(),
    agent_id: agentId,
    agency_id: agencyId || null,
    filename: filename || null,
    row_count: rowCount,
    imported_count: imported,
    skipped_count: skipped,
    error_summary: Array.isArray(errors) ? errors.slice(0, 50) : [],
    column_map: columnMap && typeof columnMap === 'object' ? columnMap : {},
    created_at: new Date().toISOString(),
  }
  await insert('closed_transaction_imports', row)
  return row.id
}
