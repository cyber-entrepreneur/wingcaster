/**
 * AGN-PRC-002 — pure helpers for agency bulk price adjustment.
 *
 * Kept free of I/O so both the preview and apply paths compute identical
 * numbers, and so the safety-rail maths can be unit-tested without a DB.
 */

export const BULK_ADJUSTMENT_STRATEGIES = Object.freeze([
  'percent_up',
  'percent_down',
  'fixed_delta',
  'set_to_median',
])

/** Hard safety rails — a batch above either bound is blocked (WF-36). */
export const MAX_BULK_LISTINGS = 100
export const MAX_AGGREGATE_CHANGE_PERCENT = 50

export const DEFAULT_REVERSAL_WINDOW_HOURS = 24
export const MIN_REVERSAL_WINDOW_HOURS = 1
export const MAX_REVERSAL_WINDOW_HOURS = 168

/** The exact phrase the actor must type to confirm a bulk change. */
export function confirmPhraseFor(count) {
  return `I have reviewed all ${count} changes`
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

/**
 * Compute the target price for one listing under a strategy.
 * Returns `{ newPrice }` or `{ skip, reason }` when the row cannot change.
 */
export function computeAdjustedPrice({ currentPrice, strategy, percent, delta, median }) {
  const current = Number(currentPrice)
  if (!Number.isFinite(current) || current <= 0) {
    return { skip: true, reason: 'no_current_price' }
  }

  let next
  switch (strategy) {
    case 'percent_up': {
      const pct = Number(percent)
      if (!Number.isFinite(pct) || pct <= 0) return { skip: true, reason: 'invalid_percent' }
      next = current * (1 + pct / 100)
      break
    }
    case 'percent_down': {
      const pct = Number(percent)
      if (!Number.isFinite(pct) || pct <= 0) return { skip: true, reason: 'invalid_percent' }
      next = current * (1 - pct / 100)
      break
    }
    case 'fixed_delta': {
      const d = Number(delta)
      if (!Number.isFinite(d) || d === 0) return { skip: true, reason: 'invalid_delta' }
      next = current + d
      break
    }
    case 'set_to_median': {
      const m = Number(median)
      if (!Number.isFinite(m) || m <= 0) return { skip: true, reason: 'no_median' }
      next = m
      break
    }
    default:
      return { skip: true, reason: 'invalid_strategy' }
  }

  next = round2(next)
  if (!Number.isFinite(next) || next <= 0) return { skip: true, reason: 'non_positive_result' }
  if (next === round2(current)) return { skip: true, reason: 'no_change' }
  return { newPrice: next }
}

/**
 * Build the full preview for a set of listings. `listings` is an array of
 * `{ id, title, agent_id, agent_name, currency, price, median }`.
 */
export function buildBulkPreview({ listings, strategy, percent, delta }) {
  const items = listings.map((listing) => {
    const result = computeAdjustedPrice({
      currentPrice: listing.price,
      strategy,
      percent,
      delta,
      median: listing.median,
    })
    const currency = listing.currency || 'USD'
    if (result.skip) {
      return {
        property_id: listing.id,
        title: listing.title || listing.id,
        agent_id: listing.agent_id || null,
        agent_name: listing.agent_name || null,
        currency,
        old_price: Number(listing.price) || null,
        new_price: null,
        delta: null,
        delta_percent: null,
        skipped: true,
        skip_reason: result.reason,
      }
    }
    const oldPrice = round2(listing.price)
    const change = round2(result.newPrice - oldPrice)
    return {
      property_id: listing.id,
      title: listing.title || listing.id,
      agent_id: listing.agent_id || null,
      agent_name: listing.agent_name || null,
      currency,
      old_price: oldPrice,
      new_price: result.newPrice,
      delta: change,
      delta_percent: oldPrice ? round2((change / oldPrice) * 100) : null,
      skipped: false,
      skip_reason: null,
    }
  })

  const changing = items.filter((item) => !item.skipped)
  const totalBefore = round2(changing.reduce((sum, item) => sum + (item.old_price || 0), 0))
  const totalAfter = round2(changing.reduce((sum, item) => sum + (item.new_price || 0), 0))
  const aggregateDeltaPercent = totalBefore
    ? round2((Math.abs(totalAfter - totalBefore) / totalBefore) * 100)
    : 0

  const capReasons = []
  if (changing.length > MAX_BULK_LISTINGS) capReasons.push('too_many_listings')
  if (aggregateDeltaPercent > MAX_AGGREGATE_CHANGE_PERCENT) capReasons.push('aggregate_change_too_large')

  return {
    items,
    summary: {
      selected_count: items.length,
      changing_count: changing.length,
      skipped_count: items.length - changing.length,
      total_value_before: totalBefore,
      total_value_after: totalAfter,
      aggregate_delta_percent: aggregateDeltaPercent,
    },
    safety: {
      exceeds_cap: capReasons.length > 0,
      cap_reasons: capReasons,
      max_listings: MAX_BULK_LISTINGS,
      max_aggregate_change_percent: MAX_AGGREGATE_CHANGE_PERCENT,
    },
  }
}

export function clampReversalWindowHours(hours) {
  const value = Number(hours)
  if (!Number.isFinite(value)) return DEFAULT_REVERSAL_WINDOW_HOURS
  return Math.min(MAX_REVERSAL_WINDOW_HOURS, Math.max(MIN_REVERSAL_WINDOW_HOURS, Math.round(value)))
}

/** True while a batch is still inside its reversal window. */
export function isReversible(batch, now = new Date()) {
  if (!batch || batch.status !== 'applied') return false
  if (!batch.reversal_deadline) return false
  return new Date(batch.reversal_deadline).getTime() > now.getTime()
}
