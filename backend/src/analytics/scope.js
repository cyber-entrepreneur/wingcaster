/**
 * Helpers for pushing analytics scope (agency / agent / date window / id lists)
 * down into the SQL query instead of loading whole tables into Node and
 * filtering in JS.
 *
 * These build the structured `filter` object understood by the DAL's
 * `findAll(collection, filter)` (see persistence/postgres-adapter.js). The
 * analytics readers keep their existing in-JS filtering as the behavioural
 * source of truth; the pushed-down filter only narrows what the database
 * returns, so it must always be equivalent-to-or-looser than the JS predicate
 * (never stricter). In practice we only push dimensions that map to a real,
 * typed column on the table being read.
 */

function isMeaningful(value) {
  if (value === undefined || value === null || value === '') return false
  return true
}

/**
 * Build a structured DAL filter from a set of column→value pairs plus an
 * optional half-open date window on `dateColumn` ([startDate, endDate)).
 *
 * - `undefined` / `null` / `''` column values are dropped (no predicate).
 * - array values become an SQL `IN` (an empty array matches nothing, exactly
 *   like a JS `Set.has()` against an empty set).
 * - the date window mirrors the readers' `isInRange`: `>= startDate` and
 *   `< endDate`, and rows with a NULL date fall out (as they do in JS).
 *
 * Returns `undefined` when nothing is scopeable, so the caller's `findAll`
 * loads everything and the in-JS filter still applies (preserving behaviour
 * for un-scopeable requests and for mocked unit tests).
 */
export function buildScopeFilter({ columns = {}, dateColumn, startDate, endDate } = {}) {
  const filter = {}

  for (const [column, value] of Object.entries(columns)) {
    if (Array.isArray(value)) {
      // Keep empty arrays: they legitimately mean "match nothing".
      filter[column] = value
    } else if (isMeaningful(value)) {
      filter[column] = value
    }
  }

  if (dateColumn) {
    const range = {}
    if (isMeaningful(startDate)) range.gte = startDate instanceof Date ? startDate : new Date(startDate)
    if (isMeaningful(endDate)) range.lt = endDate instanceof Date ? endDate : new Date(endDate)
    if (Object.keys(range).length) filter[dateColumn] = range
  }

  return Object.keys(filter).length ? filter : undefined
}

export default { buildScopeFilter }
