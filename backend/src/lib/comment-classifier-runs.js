import { randomUUID } from 'node:crypto'
import { query } from '../db.js'

export async function recordCommentClassifierRun({
  triggeredByAgentId,
  batched = 0,
  updatedCount = 0,
  skippedReason = null,
  errorMessage = null,
}) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await query(
    `INSERT INTO comment_classifier_runs (
       id, triggered_by_agent_id, batched, updated_count, skipped_reason, error_message, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, triggeredByAgentId || null, batched, updatedCount, skippedReason, errorMessage, createdAt],
  )
  return {
    id,
    triggered_by_agent_id: triggeredByAgentId || null,
    batched,
    updated_count: updatedCount,
    skipped_reason: skippedReason,
    error_message: errorMessage,
    created_at: createdAt,
  }
}

export async function listCommentClassifierRuns({ limit = 25 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 25, 1), 100)
  const runs = await query(
    `SELECT id, triggered_by_agent_id, batched, updated_count, skipped_reason, error_message, created_at
       FROM comment_classifier_runs
      ORDER BY created_at DESC
      LIMIT $1`,
    [capped],
  )
  return { runs, total: runs.length }
}
