/**
 * Minimal account-recovery list/CSV query helpers.
 *
 * Agent 2 owns the full list-response extension ([BE-ACR-01]). This module
 * duplicates only the filter/sort semantics needed by CSV export ([BE-ACR-08])
 * so Agent 6 does not race on the list endpoint shape.
 */

export const ACR_LIST_STATUSES = Object.freeze([
  'pending_review',
  'approved',
  'rejected',
  'awaiting_info',
  'completed',
  'expired',
])

export const ACR_LIST_TIERS = Object.freeze(['standard', 'elevated', 'high_value'])
export const ACR_LIST_CHANNELS = Object.freeze(['email', 'sms', 'whatsapp', 'phone_call'])
export const ACR_LIST_WITHIN = Object.freeze(['24h', '7d', '30d', 'all'])

/**
 * Parse list/CSV query params. Defaults match PA-ACR-001:
 * status=pending_review, within=7d, page=1, pageSize=25.
 *
 * @param {Record<string, unknown>} raw
 */
export function parseAccountRecoveryListQuery(raw = {}) {
  const statusRaw = raw.status == null || raw.status === '' ? 'pending_review' : String(raw.status)
  const status = ACR_LIST_STATUSES.includes(statusRaw) ? statusRaw : null

  const tierRaw = raw.tier == null || raw.tier === '' ? null : String(raw.tier)
  const tier = tierRaw && ACR_LIST_TIERS.includes(tierRaw) ? tierRaw : (tierRaw ? null : undefined)

  const channelRaw = raw.channel == null || raw.channel === '' ? null : String(raw.channel)
  const channel = channelRaw && ACR_LIST_CHANNELS.includes(channelRaw)
    ? channelRaw
    : (channelRaw ? null : undefined)

  const withinRaw = raw.within == null || raw.within === '' ? '7d' : String(raw.within)
  const within = ACR_LIST_WITHIN.includes(withinRaw) ? withinRaw : null

  const q = raw.q == null || raw.q === '' ? '' : String(raw.q).trim()
  const page = Math.max(1, Number.parseInt(String(raw.page ?? '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(raw.pageSize ?? raw.page_size ?? '25'), 10) || 25))
  const sort = String(raw.sort || 'created_at_desc')

  const maskRaw = raw.mask
  const mask = !(maskRaw != null && String(maskRaw).toLowerCase() === 'false')

  const errors = []
  if (status === null) errors.push({ path: 'status', message: `status must be one of ${ACR_LIST_STATUSES.join('|')}` })
  if (tier === null) errors.push({ path: 'tier', message: `tier must be one of ${ACR_LIST_TIERS.join('|')}` })
  if (channel === null) errors.push({ path: 'channel', message: `channel must be one of ${ACR_LIST_CHANNELS.join('|')}` })
  if (within === null) errors.push({ path: 'within', message: `within must be one of ${ACR_LIST_WITHIN.join('|')}` })

  return {
    ok: errors.length === 0,
    errors,
    filters: {
      status,
      tier: tier === undefined ? null : tier,
      channel: channel === undefined ? null : channel,
      within,
      q,
      page,
      pageSize,
      sort,
      mask,
    },
  }
}

function withinCutoff(within, now = new Date()) {
  if (!within || within === 'all') return null
  const ms = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }[within]
  if (!ms) return null
  return new Date(now.getTime() - ms)
}

function caseCreatedAt(row) {
  return row.created_at || row.requested_at || null
}

function matchesSearch(row, agent, q) {
  if (!q || q.length < 2) return true
  const needle = q.toLowerCase()
  const id = String(row.id || '')
  const last4 = id.slice(-4).toLowerCase()
  const email = String(row.email || '').toLowerCase()
  const contact = String(row.contact || '').toLowerCase()
  const name = String(agent?.name || agent?.display_name || '').toLowerCase()
  return (
    email.includes(needle)
    || contact.includes(needle)
    || name.includes(needle)
    || id.toLowerCase().includes(needle)
    || (needle.length >= 2 && last4.includes(needle))
  )
}

/**
 * Filter + sort recovery cases in memory (DAL-friendly). CSV callers pass
 * agentByUserId for search on applicant name.
 *
 * @param {object[]} cases
 * @param {object} filters - from parseAccountRecoveryListQuery().filters
 * @param {{ agentByUserId?: Map<string, object>, now?: Date, paginate?: boolean, exportCap?: number }} [opts]
 */
export function filterAccountRecoveryCases(cases, filters, opts = {}) {
  const agentByUserId = opts.agentByUserId || new Map()
  const now = opts.now || new Date()
  const cutoff = withinCutoff(filters.within, now)
  const paginate = opts.paginate !== false
  const exportCap = opts.exportCap ?? 10_000

  let rows = (cases || []).filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.tier && row.account_value_tier !== filters.tier) return false
    if (filters.channel && row.preferred_channel !== filters.channel) return false
    if (cutoff) {
      const created = caseCreatedAt(row)
      if (!created || new Date(created).getTime() < cutoff.getTime()) return false
    }
    const agent = agentByUserId.get(String(row.user_id)) || null
    if (!matchesSearch(row, agent, filters.q)) return false
    return true
  })

  rows.sort((a, b) => {
    const at = new Date(caseCreatedAt(a) || 0).getTime()
    const bt = new Date(caseCreatedAt(b) || 0).getTime()
    return filters.sort === 'created_at_asc' ? at - bt : bt - at
  })

  const total = rows.length
  if (!paginate) {
    return { rows: rows.slice(0, exportCap), total, truncated: total > exportCap }
  }

  const start = (filters.page - 1) * filters.pageSize
  return {
    rows: rows.slice(start, start + filters.pageSize),
    total,
    truncated: false,
    pagination: {
      page: filters.page,
      page_size: filters.pageSize,
      total,
      has_next: start + filters.pageSize < total,
    },
  }
}
