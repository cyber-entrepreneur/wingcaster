/**
 * Publishing tracker query helpers (BE-BLOCKER-11).
 *
 * Status mapping is explicit (DB distribution status → tracker status):
 *   published / success / live          → live
 *   pending / submitted                 → submitted
 *   in_review / pending_moderation      → in_review
 *   rejected                            → rejected
 *   expired                             → expired
 *   failed / error                      → failed
 *
 * error_class is the CHECK enum **snake_case** from
 * distribution_attempts (auth_expired, portal_rules_violation, portal_down,
 * quota_exceeded, invalid_content, unknown_error) matching BE-BLOCKER-03.
 * The AGT-PUB-006 brief also mentions kebab-case; this module does not emit
 * kebab-case and does not invent a third enum.
 *
 * submitted_at is COALESCE(jobs.published_at, jobs.created_at, attempts.attempted_at).
 */

export const TRACKER_STATUSES = Object.freeze([
  'submitted',
  'in_review',
  'live',
  'rejected',
  'expired',
  'failed',
])

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50
export const SORT_SUBMITTED = 'submitted_at:desc'
export const SORT_UPDATED = 'updated_at:desc'
export const TRACKER_SORTS = Object.freeze([SORT_SUBMITTED, SORT_UPDATED])

/** Human labels for top_failure_class.display_label. */
export const ERROR_CLASS_LABELS = Object.freeze({
  auth_expired: 'Auth expired',
  portal_rules_violation: 'Rules violation',
  portal_down: 'Portal down',
  quota_exceeded: 'Quota exceeded',
  invalid_content: 'Invalid content',
  unknown_error: 'Unknown error',
})

export const TRACKER_QUERY_ERROR = 'TRACKER_QUERY_ERROR'

export class TrackerQueryError extends Error {
  constructor(message, issues = []) {
    super(message)
    this.name = 'TrackerQueryError'
    this.code = TRACKER_QUERY_ERROR
    this.status = 400
    this.issues = issues
  }
}

/**
 * Map a raw distribution_jobs / distribution_attempts status to tracker status.
 * Unknown values fall through to `submitted` (still in-flight) rather than a
 * third enum.
 */
export function mapDistributionStatusToTracker(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase()
  if (status === 'published' || status === 'success' || status === 'live') return 'live'
  if (status === 'pending' || status === 'submitted' || status === 'draft' || status === 'pending_retry') {
    return 'submitted'
  }
  if (status === 'in_review' || status === 'pending_moderation') return 'in_review'
  if (status === 'rejected') return 'rejected'
  if (status === 'expired') return 'expired'
  if (status === 'failed' || status === 'error') return 'failed'
  return 'submitted'
}

/** SQL CASE matching mapDistributionStatusToTracker. Prefer attempt, then job. */
export const TRACKER_STATUS_SQL = `
CASE
  WHEN lower(COALESCE(a.status, j.status, '')) IN ('published', 'success', 'live')
    THEN 'live'
  WHEN lower(COALESCE(a.status, j.status, '')) IN ('pending', 'submitted', 'draft', 'pending_retry')
    THEN 'submitted'
  WHEN lower(COALESCE(a.status, j.status, '')) IN ('in_review', 'pending_moderation')
    THEN 'in_review'
  WHEN lower(COALESCE(a.status, j.status, '')) = 'rejected'
    THEN 'rejected'
  WHEN lower(COALESCE(a.status, j.status, '')) = 'expired'
    THEN 'expired'
  WHEN lower(COALESCE(a.status, j.status, '')) IN ('failed', 'error')
    THEN 'failed'
  ELSE 'submitted'
END
`.trim()

export const SUBMITTED_AT_SQL = 'COALESCE(j.published_at, j.created_at, a.attempted_at)'
export const UPDATED_AT_SQL = 'COALESCE(j.updated_at, a.updated_at, a.attempted_at)'

export function errorClassDisplayLabel(errorClass) {
  if (!errorClass) return null
  return ERROR_CLASS_LABELS[errorClass] || String(errorClass).replace(/_/g, ' ')
}

function issue(path, message) {
  return { path, message }
}

function splitCsv(value) {
  if (value == null || value === '') return []
  const parts = Array.isArray(value) ? value : [value]
  return parts
    .flatMap((part) => String(part).split(','))
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseIsoBound(raw, { endOfDay = false } = {}) {
  if (raw == null || raw === '') return null
  const text = String(raw).trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return endOfDay ? `${text}T23:59:59.999Z` : `${text}T00:00:00.000Z`
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new TrackerQueryError('Invalid query parameters', [
      issue(endOfDay ? 'to' : 'from', 'Must be an ISO-8601 datetime'),
    ])
  }
  return date.toISOString()
}

export function encodeTrackerCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

export function decodeTrackerCursor(token) {
  if (token == null || token === '') return null
  try {
    const decoded = Buffer.from(String(token), 'base64').toString('utf8')
    const payload = JSON.parse(decoded)
    if (!payload || typeof payload !== 'object' || !payload.id) {
      throw new Error('invalid')
    }
    return payload
  } catch {
    throw new TrackerQueryError('Invalid query parameters', [
      issue('after', 'Cursor is invalid'),
    ])
  }
}

export function currentUtcMonthBounds(now = new Date()) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * Parse list / summary query params. `defaultMonth` fills from/to when both
 * omitted (summary KPI scope).
 */
export function parseTrackerQuery(query = {}, { defaultMonth = false } = {}) {
  const issues = []
  const statuses = splitCsv(query.status)
  for (const status of statuses) {
    if (!TRACKER_STATUSES.includes(status)) {
      issues.push(issue('status', `Unknown status '${status}'`))
    }
  }
  const portals = splitCsv(query.portal).map((code) => code.toLowerCase())
  const listingId = query.listing_id == null || query.listing_id === ''
    ? null
    : String(query.listing_id).trim()
  if (listingId && listingId.length > 80) {
    issues.push(issue('listing_id', 'Must be at most 80 characters'))
  }

  let from
  let to
  try {
    from = parseIsoBound(query.from, { endOfDay: false })
    to = parseIsoBound(query.to, { endOfDay: true })
  } catch (err) {
    if (err instanceof TrackerQueryError) issues.push(...err.issues)
    else throw err
  }

  let limit = DEFAULT_LIMIT
  if (query.limit != null && query.limit !== '') {
    const parsed = Number(query.limit)
    if (!Number.isInteger(parsed)) {
      issues.push(issue('limit', 'Must be an integer'))
    } else if (parsed < 1 || parsed > MAX_LIMIT) {
      issues.push(issue('limit', `Must be between 1 and ${MAX_LIMIT}`))
    } else {
      limit = parsed
    }
  }

  const sort = query.sort == null || query.sort === '' ? SORT_SUBMITTED : String(query.sort)
  if (!TRACKER_SORTS.includes(sort)) {
    issues.push(issue('sort', `Must be ${TRACKER_SORTS.join(' | ')}`))
  }

  let cursor = null
  if (query.after) {
    try {
      cursor = decodeTrackerCursor(query.after)
    } catch (err) {
      if (err instanceof TrackerQueryError) issues.push(...err.issues)
      else throw err
    }
  }

  if (issues.length) {
    throw new TrackerQueryError('Invalid query parameters', issues)
  }

  let fromBound = from
  let toBound = to
  let monthDefaulted = false
  if (defaultMonth && !fromBound && !toBound) {
    const bounds = currentUtcMonthBounds()
    fromBound = bounds.from
    toBound = bounds.to
    monthDefaulted = true
  }

  return {
    statuses,
    portals,
    listingId,
    from: fromBound,
    to: toBound,
    limit,
    sort,
    cursor,
    monthDefaulted,
  }
}

/**
 * Resolve tenant scope from the authenticated principal.
 * Header `x-active-tenant-id` / `x-tenant-id` wins when present; otherwise
 * agency affiliation on req.agent, else the caller's personal agent.
 */
export function resolveTrackerScope(req) {
  const userId = req.user?.id || null
  const agentId = req.user?.agent_id || req.agent?.id || userId
  const headerTenant = (
    req.get?.('x-active-tenant-id')
    || req.get?.('x-tenant-id')
    || req.headers?.['x-active-tenant-id']
    || req.headers?.['x-tenant-id']
    || ''
  ).toString().trim() || null

  if (headerTenant) {
    if (headerTenant.startsWith('agency:')) {
      const agencyId = headerTenant.slice('agency:'.length)
      return { mode: 'agency', userId, agentId, agencyId, publicTenantId: headerTenant, headerTenant }
    }
    if (headerTenant.startsWith('personal:')) {
      return {
        mode: 'personal',
        userId,
        agentId,
        agencyId: null,
        publicTenantId: headerTenant,
        headerTenant,
      }
    }
    return {
      mode: 'agency',
      userId,
      agentId,
      agencyId: headerTenant,
      publicTenantId: `agency:${headerTenant}`,
      headerTenant,
    }
  }

  const agencyId = req.agent?.agency_id || null
  if (agencyId) {
    return {
      mode: 'agency',
      userId,
      agentId,
      agencyId: String(agencyId),
      publicTenantId: `agency:${agencyId}`,
      headerTenant: null,
    }
  }
  return {
    mode: 'personal',
    userId,
    agentId,
    agencyId: null,
    publicTenantId: userId ? `personal:${userId}` : null,
    headerTenant: null,
  }
}

function iso(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asInt(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Shape one SQL row into the brief's tracker row. Pure — never queries.
 */
export function toTrackerRow(row) {
  const status = row.tracker_status || mapDistributionStatusToTracker(row.attempt_status || row.job_status)
  const failed = status === 'rejected' || status === 'failed'
  const errorClass = failed ? (row.error_class || null) : null
  return {
    distribution_attempt_id: row.distribution_attempt_id,
    // Receipt deep-link: prefer publishing_jobs.id, fall back to distribution_jobs.id
    // (GET /api/publishing/jobs/:jobId accepts either — BE-BLOCKER-10).
    job_id: row.publishing_job_id || row.job_id || null,
    listing: {
      id: row.listing_id || row.property_id || null,
      address_line: row.address_line || null,
      thumbnail_url: row.thumbnail_url || null,
    },
    portal: {
      code: row.portal_code || row.platform || null,
      display_name: row.portal_display_name || row.platform || null,
      channel_token_key: row.channel_token_key || (
        row.portal_code || row.platform
          ? `publishing.realestate.${row.portal_code || row.platform}`
          : null
      ),
    },
    submitted_at: iso(row.submitted_at),
    updated_at: iso(row.updated_at),
    status,
    error_class: errorClass,
    error_message: failed ? (row.error_message || null) : null,
    credits_charged: asInt(row.credits_charged),
    portal_live_url: row.portal_live_url || null,
  }
}

export function toTrackerRows(rows) {
  return (rows || []).map(toTrackerRow)
}

function scopedFromSql() {
  return `
    FROM public.distribution_attempts a
    INNER JOIN public.distribution_jobs j ON j.id = a.distribution_job_id
    LEFT JOIN public.properties p ON p.id = j.property_id
    LEFT JOIN LATERAL (
      SELECT pm.url
        FROM public.property_media pm
       WHERE pm.property_id = p.id
       ORDER BY pm.is_hero DESC NULLS LAST, pm.order_index ASC, pm.created_at ASC
       LIMIT 1
    ) hero ON TRUE
    LEFT JOIN public.portal_registry pr ON pr.code = j.platform
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cc.credits_amount), 0)::bigint AS credits_charged
        FROM public.credit_consumptions cc
       WHERE cc.related_entity_id IN (a.id, j.id)
          OR (
            cc.related_entity_id = j.property_id
            AND cc.feature = ('publishing.realestate.' || COALESCE(j.platform, ''))
          )
    ) credits ON TRUE
  `
}

function scopedSelectSql() {
  return `
    SELECT
      a.id AS distribution_attempt_id,
      a.status AS attempt_status,
      j.status AS job_status,
      a.error_class,
      a.error_message,
      ${TRACKER_STATUS_SQL} AS tracker_status,
      ${SUBMITTED_AT_SQL} AS submitted_at,
      ${UPDATED_AT_SQL} AS updated_at,
      j.id AS job_id,
      j.publishing_job_id AS publishing_job_id,
      j.property_id,
      j.platform,
      COALESCE(p.id, j.property_id) AS listing_id,
      NULLIF(BTRIM(COALESCE(
        NULLIF(p.data->>'address', ''),
        NULLIF(p.data->>'address_line', ''),
        NULLIF(CONCAT_WS(', ',
          NULLIF(BTRIM(p.location), ''),
          NULLIF(BTRIM(p.neighborhood), ''),
          NULLIF(BTRIM(p.city), '')
        ), ''),
        NULLIF(BTRIM(p.title), '')
      )), '') AS address_line,
      COALESCE(
        hero.url,
        NULLIF(p.data->'photos'->>0, ''),
        NULLIF(p.data->'media'->0->>'url', '')
      ) AS thumbnail_url,
      COALESCE(pr.code, j.platform) AS portal_code,
      COALESCE(pr.display_name, j.platform) AS portal_display_name,
      COALESCE(
        NULLIF(pr.publisher_config->>'channel_token_key', ''),
        'publishing.realestate.' || COALESCE(pr.code, j.platform)
      ) AS channel_token_key,
      COALESCE(credits.credits_charged, 0)::bigint AS credits_charged,
      NULLIF(COALESCE(
        NULLIF(j.data->>'portal_live_url', ''),
        NULLIF(j.payload->>'portal_live_url', ''),
        NULLIF(a.response->>'portal_live_url', ''),
        NULLIF(a.response->>'url', ''),
        NULLIF(j.data->>'live_url', '')
      ), '') AS portal_live_url
    ${scopedFromSql()}
  `
}

function pushScope(params, clauses, scope) {
  if (scope.mode === 'agency') {
    params.push(scope.agencyId)
    clauses.push(`j.agency_id = $${params.length}`)
    return
  }
  params.push(scope.agentId)
  clauses.push(`j.agent_id = $${params.length}`)
}

function pushFilters(params, clauses, filters) {
  if (filters.statuses?.length) {
    params.push(filters.statuses)
    clauses.push(`(${TRACKER_STATUS_SQL}) = ANY($${params.length}::text[])`)
  }
  if (filters.portals?.length) {
    params.push(filters.portals)
    clauses.push(`lower(j.platform) = ANY($${params.length}::text[])`)
  }
  if (filters.listingId) {
    params.push(filters.listingId)
    clauses.push(`j.property_id = $${params.length}`)
  }
  if (filters.from) {
    params.push(filters.from)
    clauses.push(`${SUBMITTED_AT_SQL} >= $${params.length}::timestamptz`)
  }
  if (filters.to) {
    params.push(filters.to)
    clauses.push(`${SUBMITTED_AT_SQL} <= $${params.length}::timestamptz`)
  }
}

function cursorClause(params, filters) {
  if (!filters.cursor?.id) return null
  const sortTs = filters.sort === SORT_UPDATED
    ? (filters.cursor.updated_at || filters.cursor.submitted_at)
    : (filters.cursor.submitted_at || filters.cursor.updated_at)
  if (!sortTs) {
    throw new TrackerQueryError('Invalid query parameters', [
      issue('after', 'Cursor is invalid'),
    ])
  }
  const expr = filters.sort === SORT_UPDATED ? 'updated_at' : 'submitted_at'
  params.push(sortTs)
  const tsIdx = params.length
  params.push(filters.cursor.id)
  const idIdx = params.length
  return `(${expr}, distribution_attempt_id) < ($${tsIdx}::timestamptz, $${idIdx})`
}

function orderBySql(sort) {
  if (sort === SORT_UPDATED) {
    return 'updated_at DESC, distribution_attempt_id DESC'
  }
  return 'submitted_at DESC, distribution_attempt_id DESC'
}

function nextCursorFromRow(row, sort) {
  if (sort === SORT_UPDATED) {
    return encodeTrackerCursor({
      updated_at: iso(row.updated_at),
      id: row.distribution_attempt_id,
    })
  }
  return encodeTrackerCursor({
    submitted_at: iso(row.submitted_at),
    id: row.distribution_attempt_id,
  })
}

export function filtersApplied(filters) {
  return {
    status: filters.statuses || [],
    portal: filters.portals || [],
    listing_id: filters.listingId || null,
    from: filters.from || null,
    to: filters.to || null,
  }
}

/**
 * Cursor-paginated tracker ledger. One SQL statement (JOIN + aggregates).
 * `queryFn` is injected so tests can assert call count; never query inside
 * `rows.map`.
 */
export async function listTrackerAttempts(queryFn, { scope, filters }) {
  const params = []
  const where = []
  pushScope(params, where, scope)
  pushFilters(params, where, filters)
  const cursorSql = cursorClause(params, filters)
  const filterWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const pageWhere = cursorSql
    ? `WHERE ${cursorSql}`
    : ''

  params.push(filters.limit + 1)
  const limitIdx = params.length

  const sql = `
    WITH filtered AS (
      ${scopedSelectSql()}
      ${filterWhere}
    )
    SELECT page.*, (SELECT COUNT(*)::int FROM filtered) AS total
      FROM (
        SELECT *
          FROM filtered
          ${pageWhere}
         ORDER BY ${orderBySql(filters.sort)}
         LIMIT $${limitIdx}
      ) page
  `

  const rows = await queryFn(sql, params)
  const total = asInt(rows[0]?.total)
  const hasMore = rows.length > filters.limit
  const page = hasMore ? rows.slice(0, filters.limit) : rows
  const last = page[page.length - 1]
  return {
    rows: toTrackerRows(page),
    next_cursor: hasMore && last ? nextCursorFromRow(last, filters.sort) : null,
    has_more: hasMore,
    total,
  }
}

/**
 * KPI aggregate for the same filter set as the list. One SQL with GROUP BY
 * (no JS counting loops).
 */
export async function summarizeTrackerAttempts(queryFn, { scope, filters }) {
  const params = []
  const where = []
  pushScope(params, where, scope)
  pushFilters(params, where, filters)
  const filterWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const sql = `
    WITH filtered AS (
      SELECT
        ${TRACKER_STATUS_SQL} AS tracker_status,
        a.error_class,
        COALESCE((
          SELECT SUM(cc.credits_amount)::bigint
            FROM public.credit_consumptions cc
           WHERE cc.related_entity_id IN (a.id, j.id)
              OR (
                cc.related_entity_id = j.property_id
                AND cc.feature = ('publishing.realestate.' || COALESCE(j.platform, ''))
              )
        ), 0) AS credits_charged
      FROM public.distribution_attempts a
      INNER JOIN public.distribution_jobs j ON j.id = a.distribution_job_id
      ${filterWhere}
    ),
    kpis AS (
      SELECT
        COUNT(*)::int AS total_submissions,
        COUNT(*) FILTER (WHERE tracker_status = 'live')::int AS live_count,
        COALESCE(SUM(credits_charged), 0)::bigint AS credits_spent
      FROM filtered
    ),
    top_fail AS (
      SELECT error_class, COUNT(*)::int AS failure_count
        FROM filtered
       WHERE tracker_status IN ('rejected', 'failed')
         AND error_class IS NOT NULL
       GROUP BY error_class
       ORDER BY COUNT(*) DESC, error_class ASC
       LIMIT 1
    )
    SELECT
      kpis.total_submissions,
      kpis.live_count,
      kpis.credits_spent,
      top_fail.error_class AS top_failure_class,
      top_fail.failure_count AS top_failure_count
    FROM kpis
    LEFT JOIN top_fail ON TRUE
  `

  const rows = await queryFn(sql, params)
  const row = rows[0] || {}
  const total = asInt(row.total_submissions)
  const live = asInt(row.live_count)
  const successRate = total === 0 ? 0 : Number((live / total).toFixed(4))
  const topClass = row.top_failure_class || null
  return {
    scope: {
      from: filters.from || null,
      to: filters.to || null,
      filters_applied: filtersApplied(filters),
    },
    total_submissions: total,
    success_rate: successRate,
    credits_spent: asInt(row.credits_spent),
    top_failure_class: topClass
      ? {
        class: topClass,
        display_label: errorClassDisplayLabel(topClass),
        count: asInt(row.top_failure_count),
      }
      : null,
  }
}

/**
 * Confirm the caller is an active member of header-selected tenant.
 * Returns null when no extra check is needed. One query max.
 */
export async function assertTrackerTenantAccess(queryFn, scope) {
  if (!scope.headerTenant || !scope.userId) return true
  const tenantId = scope.publicTenantId
  if (scope.mode === 'personal') {
    const expected = `personal:${scope.userId}`
    return tenantId === expected
  }
  const rows = await queryFn(
    `SELECT 1
       FROM public.tenant_memberships
      WHERE user_id = $1
        AND tenant_id = $2
        AND status = 'active'
      LIMIT 1`,
    [scope.userId, tenantId],
  )
  return Boolean(rows[0])
}
