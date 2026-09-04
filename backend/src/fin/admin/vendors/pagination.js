/**
 * Cursor pagination for vendor admin list routes.
 * Shape: ?limit=N&cursor=<opaque> → { next_cursor, total_estimate }.
 */
import { CATEGORY, finError } from '../../errors.js'

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200
const EXACT_COUNT_RELTUPLES_CEILING = 10_000

export function parsePagination(query = {}) {
  let limit = DEFAULT_LIMIT
  if (query.limit != null && query.limit !== '') {
    const n = Number(query.limit)
    if (!Number.isFinite(n) || n < 1) {
      throw finError('VALIDATION', {
        category: CATEGORY.VALIDATION,
        details: { field: 'limit' },
      })
    }
    limit = Math.min(Math.trunc(n), MAX_LIMIT)
  }
  let cursor = null
  if (query.cursor) {
    try {
      const decoded = Buffer.from(String(query.cursor), 'base64url').toString('utf8')
      cursor = JSON.parse(decoded)
      if (!cursor || typeof cursor !== 'object') throw new Error('invalid')
    } catch {
      throw finError('VALIDATION', {
        category: CATEGORY.VALIDATION,
        details: { field: 'cursor' },
      })
    }
  }
  return { limit, cursor }
}

export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function slicePage(rows, limit) {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return { page, hasMore }
}

export async function totalEstimate(client, { schema = 'fin', table, exactSql, exactParams = [] }) {
  const stats = await client.query(
    `SELECT c.reltuples::bigint AS reltuples
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, table],
  )
  const reltuples = Number(stats.rows[0]?.reltuples ?? 0)
  if (reltuples > EXACT_COUNT_RELTUPLES_CEILING) return reltuples
  const counted = await client.query(exactSql, exactParams)
  return Number(counted.rows[0]?.n ?? 0)
}
