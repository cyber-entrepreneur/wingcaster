/**
 * SELECT helpers for vendor admin reads. MTD aggregates COALESCE to 0 (§2.9).
 * Selling-price source for margin is fin.prices ACTIVE version (§2.5).
 */
import { CATEGORY, finError } from '../../errors.js'
import { encodeCursor, parsePagination, slicePage, totalEstimate } from './pagination.js'

function num(value) {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapVendorRow(row) {
  return {
    ...row,
    mtd_cost_micro_usd: num(row.mtd_cost_micro_usd),
    mtd_units: num(row.mtd_units),
    active_rate_versions: num(row.active_rate_versions),
  }
}

function monthStartSql() {
  return `date_trunc('month', $2::timestamptz)`
}

const MTD_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(e.quantity_units), 0)::bigint AS mtd_units,
           COALESCE(SUM(
             e.quantity_units * COALESCE((
               SELECT (vrv.rates -> e.vendor_product_code ->> 'unit_cost_minor')::bigint
                 FROM fin.vendor_rate_versions vrv
                 JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
                WHERE vrc.vendor_id = v.id
                  AND vrv.status = 'ACTIVE'
                  AND vrv.environment = v.environment
                ORDER BY vrv.effective_from DESC
                LIMIT 1
             ), 0)
           ), 0)::bigint AS mtd_cost_micro_usd
      FROM fin.vendor_usage_events e
     WHERE e.vendor_id = v.id
       AND e.environment = v.environment
       AND e.occurred_at >= ${monthStartSql()}
       AND e.occurred_at <= $2::timestamptz
  ) u ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS active_rate_versions
      FROM fin.vendor_rate_versions vrv
      JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
     WHERE vrc.vendor_id = v.id
       AND vrv.status = 'ACTIVE'
  ) r ON true
`

export async function listVendorsAdmin(client, { environment, query, now }) {
  const { limit, cursor } = parsePagination(query)
  const params = [environment, now]
  const filters = [`v.environment = $1`]
  if (cursor?.name != null && cursor?.id) {
    params.push(cursor.name, cursor.id)
    filters.push(`(v.name, v.id) > ($${params.length - 1}, $${params.length})`)
  }
  const { rows } = await client.query(
    `SELECT v.*,
            COALESCE(u.mtd_units, 0)::bigint AS mtd_units,
            COALESCE(u.mtd_cost_micro_usd, 0)::bigint AS mtd_cost_micro_usd,
            COALESCE(r.active_rate_versions, 0)::int AS active_rate_versions
       FROM fin.vendors v
       ${MTD_LATERAL}
      WHERE ${filters.join(' AND ')}
      ORDER BY v.name ASC, v.id ASC
      LIMIT $` + (params.length + 1),
    [...params, limit + 1],
  )
  const { page, hasMore } = slicePage(rows, limit)
  const last = page[page.length - 1]
  const total_estimate = await totalEstimate(client, {
    table: 'vendors',
    exactSql: `SELECT COUNT(*)::bigint AS n FROM fin.vendors WHERE environment = $1`,
    exactParams: [environment],
  })
  return {
    vendors: page.map(mapVendorRow),
    next_cursor: hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null,
    total_estimate,
  }
}

export async function getVendorAdmin(client, { environment, id, now }) {
  const { rows } = await client.query(
    `SELECT v.*,
            COALESCE(u.mtd_units, 0)::bigint AS mtd_units,
            COALESCE(u.mtd_cost_micro_usd, 0)::bigint AS mtd_cost_micro_usd,
            COALESCE(r.active_rate_versions, 0)::int AS active_rate_versions
       FROM fin.vendors v
       ${MTD_LATERAL}
      WHERE v.environment = $1 AND v.id = $3`,
    [environment, now, id],
  )
  const header = rows[0]
  if (!header) return null
  const products = (await client.query(
    `SELECT * FROM fin.vendor_products WHERE vendor_id = $1 ORDER BY product_code`,
    [id],
  )).rows
  const rateCards = (await client.query(
    `SELECT * FROM fin.vendor_rate_cards WHERE vendor_id = $1 ORDER BY name`,
    [id],
  )).rows
  const rateSchedule = (await client.query(
    `SELECT vrv.*
       FROM fin.vendor_rate_versions vrv
       JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
      WHERE vrc.vendor_id = $1
      ORDER BY vrv.effective_from DESC, vrv.id DESC`,
    [id],
  )).rows
  const mtdStatement = (await client.query(
    `SELECT s.*,
            (SELECT COUNT(*)::int FROM fin.vendor_variances v
              WHERE v.statement_id = s.id AND v.resolved = false) AS unresolved_variance_count
       FROM fin.vendor_statements s
      WHERE s.vendor_id = $1
        AND s.environment = $2
        AND s.statement_period_key = to_char($3::timestamptz, 'YYYY-MM')
      LIMIT 1`,
    [id, environment, now],
  )).rows[0] || null
  return {
    ...mapVendorRow(header),
    products,
    rateCards,
    rate_schedule: rateSchedule,
    mtd_statement: mtdStatement,
  }
}

export async function listVendorRatesAdmin(client, { environment, vendorId, query }) {
  const vendor = (await client.query(
    `SELECT id FROM fin.vendors WHERE id = $1 AND environment = $2`,
    [vendorId, environment],
  )).rows[0]
  if (!vendor) return null
  const { limit, cursor } = parsePagination(query)
  const params = [vendorId, environment]
  const filters = [`vrc.vendor_id = $1`, `vrc.environment = $2`]
  if (cursor?.effective_from && cursor?.id) {
    params.push(cursor.effective_from, cursor.id)
    filters.push(`(vrv.effective_from, vrv.id) < ($${params.length - 1}::timestamptz, $${params.length})`)
  }
  const { rows } = await client.query(
    `SELECT vrv.*, vrc.name AS rate_card_name, vrc.id AS rate_card_id
       FROM fin.vendor_rate_versions vrv
       JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
      WHERE ${filters.join(' AND ')}
      ORDER BY vrv.effective_from DESC, vrv.id DESC
      LIMIT $` + (params.length + 1),
    [...params, limit + 1],
  )
  const { page, hasMore } = slicePage(rows, limit)
  const last = page[page.length - 1]
  const total_estimate = await totalEstimate(client, {
    table: 'vendor_rate_versions',
    exactSql: `SELECT COUNT(*)::bigint AS n
                 FROM fin.vendor_rate_versions vrv
                 JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
                WHERE vrc.vendor_id = $1 AND vrc.environment = $2`,
    exactParams: [vendorId, environment],
  })
  return {
    rates: page,
    next_cursor: hasMore && last
      ? encodeCursor({ effective_from: last.effective_from, id: last.id })
      : null,
    total_estimate,
  }
}

export async function listVendorStatementsAdmin(client, { environment, vendorId, query }) {
  const vendor = (await client.query(
    `SELECT id FROM fin.vendors WHERE id = $1 AND environment = $2`,
    [vendorId, environment],
  )).rows[0]
  if (!vendor) return null
  const { limit, cursor } = parsePagination(query)
  const params = [vendorId, environment]
  const filters = [`s.vendor_id = $1`, `s.environment = $2`]
  if (cursor?.statement_period_key && cursor?.id) {
    params.push(cursor.statement_period_key, cursor.id)
    filters.push(`(s.statement_period_key, s.id) < ($${params.length - 1}, $${params.length})`)
  }
  const { rows } = await client.query(
    `SELECT s.*,
            (SELECT COUNT(*)::int FROM fin.vendor_variances v
              WHERE v.statement_id = s.id AND v.resolved = false) AS unresolved_variance_count
       FROM fin.vendor_statements s
      WHERE ${filters.join(' AND ')}
      ORDER BY s.statement_period_key DESC, s.id DESC
      LIMIT $` + (params.length + 1),
    [...params, limit + 1],
  )
  const { page, hasMore } = slicePage(rows, limit)
  const last = page[page.length - 1]
  const total_estimate = await totalEstimate(client, {
    table: 'vendor_statements',
    exactSql: `SELECT COUNT(*)::bigint AS n FROM fin.vendor_statements WHERE vendor_id = $1 AND environment = $2`,
    exactParams: [vendorId, environment],
  })
  return {
    statements: page,
    next_cursor: hasMore && last
      ? encodeCursor({ statement_period_key: last.statement_period_key, id: last.id })
      : null,
    total_estimate,
  }
}

export async function getVendorStatementAdmin(client, { environment, vendorId, month }) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    throw finError('VALIDATION', {
      category: CATEGORY.VALIDATION,
      details: { field: 'month' },
    })
  }
  const statement = (await client.query(
    `SELECT s.*,
            (SELECT COUNT(*)::int FROM fin.vendor_variances v
              WHERE v.statement_id = s.id AND v.resolved = false) AS unresolved_variance_count
       FROM fin.vendor_statements s
      WHERE s.vendor_id = $1 AND s.environment = $2 AND s.statement_period_key = $3`,
    [vendorId, environment, month],
  )).rows[0]
  if (!statement) return null
  const lines = (await client.query(
    `SELECT product_code AS rate_key,
            quantity_units,
            unit_cost_minor,
            amount_minor,
            currency
       FROM fin.vendor_statement_lines
      WHERE statement_id = $1
      ORDER BY product_code`,
    [statement.id],
  )).rows
  const variances = (await client.query(
    `SELECT axis, reason_code, left_qty, right_qty, resolved, details
       FROM fin.vendor_variances
      WHERE statement_id = $1
      ORDER BY axis`,
    [statement.id],
  )).rows
  return {
    statement,
    line_items: lines,
    drift_indicators: variances,
  }
}

/**
 * Platform-wide margin per vendor product / metered feature.
 * Selling = ACTIVE fin.price_versions.unit_rate_minor × units.
 * Cost = SUM(vendor_usage quantity × active vendor rate) for the month.
 */
export async function getVendorMarginAdmin(client, { environment, vendorId, month, now }) {
  const vendor = (await client.query(
    `SELECT * FROM fin.vendors WHERE id = $1 AND environment = $2`,
    [vendorId, environment],
  )).rows[0]
  if (!vendor) return null
  const period = month || String(now).slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw finError('VALIDATION', {
      category: CATEGORY.VALIDATION,
      details: { field: 'month' },
    })
  }
  const { rows } = await client.query(
    `SELECT
        p.product_code AS feature,
        COALESCE(u.units, 0)::bigint AS units,
        COALESCE(u.cost_minor, 0)::bigint AS cost_micro_usd,
        COALESCE(pv.unit_rate_minor, 0)::bigint AS selling_unit_rate_minor,
        (COALESCE(u.units, 0) * COALESCE(pv.unit_rate_minor, 0))::bigint AS selling_micro_usd
       FROM fin.vendor_products p
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(e.quantity_units), 0)::bigint AS units,
                COALESCE(SUM(
                  e.quantity_units * COALESCE((
                    SELECT (vrv.rates -> e.vendor_product_code ->> 'unit_cost_minor')::bigint
                      FROM fin.vendor_rate_versions vrv
                      JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
                     WHERE vrc.vendor_id = p.vendor_id
                       AND vrv.status = 'ACTIVE'
                     ORDER BY vrv.effective_from DESC
                     LIMIT 1
                  ), 0)
                ), 0)::bigint AS cost_minor
           FROM fin.vendor_usage_events e
          WHERE e.vendor_id = p.vendor_id
            AND e.vendor_product_code = p.product_code
            AND e.environment = p.environment
            AND to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM') = $3
       ) u ON true
       LEFT JOIN LATERAL (
         SELECT vrv.unit_rate_minor
           FROM fin.prices pr
           JOIN fin.price_versions vrv ON vrv.price_id = pr.id AND vrv.status = 'ACTIVE'
          WHERE pr.environment = p.environment
            AND (
              pr.code = p.product_code
              OR pr.meter_id IN (
                SELECT mvm.meter_id FROM fin.meter_vendor_map mvm
                 WHERE mvm.vendor_id = p.vendor_id
                   AND mvm.vendor_product_code = p.product_code
                   AND mvm.environment = p.environment
              )
            )
          ORDER BY pr.code
          LIMIT 1
       ) pv ON true
      WHERE p.vendor_id = $1 AND p.environment = $2
      ORDER BY p.product_code`,
    [vendorId, environment, period],
  )
  const features = rows.map((row) => {
    const selling = num(row.selling_micro_usd)
    const cost = num(row.cost_micro_usd)
    const margin_pct = selling === 0 ? null : ((selling - cost) / selling) * 100
    return {
      feature: row.feature,
      units: num(row.units),
      selling_micro_usd: selling,
      cost_micro_usd: cost,
      selling_unit_rate_minor: num(row.selling_unit_rate_minor),
      margin_pct,
    }
  })
  return { vendor_id: vendorId, month: period, features }
}
