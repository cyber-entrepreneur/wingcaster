/**
 * Market-impact scoring for bad-comparable reports — [BE-CMR-04].
 *
 * Walks valuations (analysis_comparable_evidence + property_price_analyses)
 * that reference a comparable and estimates median/max price move if it were
 * removed. Tier drives the WF-05 two-person rule (high → requires_two_person).
 */

import { Collections } from '../infrastructure/db.js'

export const MARKET_IMPACT_TIERS = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
})

const TIER_RANK = {
  [MARKET_IMPACT_TIERS.NONE]: 0,
  [MARKET_IMPACT_TIERS.LOW]: 1,
  [MARKET_IMPACT_TIERS.MEDIUM]: 2,
  [MARKET_IMPACT_TIERS.HIGH]: 3,
}

export function marketImpactTierRank(tier) {
  return TIER_RANK[tier] ?? 0
}

export function classifyMarketImpactTier({
  valuations_affected = 0,
  pct_move_median = 0,
  pct_move_max = 0,
} = {}) {
  const affected = Number(valuations_affected) || 0
  if (affected <= 0) return MARKET_IMPACT_TIERS.NONE

  const absMed = Math.abs(Number(pct_move_median) || 0)
  const absMax = Math.abs(Number(pct_move_max) || 0)

  // Buckets aligned to PA-PVA-008 samples:
  //   low  ≈ 12 vals · ±4% median · ±7.8% max
  //   high ≈ 34 vals · ±11% median · ±18% max (two-person trigger)
  if (affected >= 25 || absMed >= 10 || absMax >= 15) {
    return MARKET_IMPACT_TIERS.HIGH
  }
  if (affected >= 15 || absMed >= 5 || absMax >= 8) {
    return MARKET_IMPACT_TIERS.MEDIUM
  }
  return MARKET_IMPACT_TIERS.LOW
}

function emptyImpact() {
  return {
    tier: MARKET_IMPACT_TIERS.NONE,
    valuations_affected: 0,
    pct_move_median: 0,
    pct_move_max: 0,
    top_markets: [],
    requires_two_person: false,
    affected_property_ids: [],
  }
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Number((((sorted[mid - 1] + sorted[mid]) / 2)).toFixed(2))
  }
  return Number(sorted[mid].toFixed(2))
}

function weightedMedian(entries) {
  if (!entries.length) return null
  const sorted = [...entries]
    .map((e) => ({ value: Number(e.value), weight: Math.max(Number(e.weight) || 0.0001, 0.0001) }))
    .filter((e) => Number.isFinite(e.value) && e.value > 0)
    .sort((a, b) => a.value - b.value)
  if (!sorted.length) return null
  const total = sorted.reduce((sum, e) => sum + e.weight, 0)
  let cumulative = 0
  for (const entry of sorted) {
    cumulative += entry.weight
    if (cumulative / total >= 0.5) return entry.value
  }
  return sorted[sorted.length - 1].value
}

function isAnalysisActive(analysis, now = new Date()) {
  if (!analysis) return false
  if (!analysis.expires_at) return true
  const expires = new Date(analysis.expires_at)
  return !Number.isNaN(expires.getTime()) && expires > now
}

/**
 * Pure helper: compute % move for one valuation given evidence rows and the
 * comparable being hypothetically removed.
 */
export function computeValuationMove(evidenceRows, comparableId, comparableType = null) {
  const rows = (evidenceRows || []).filter((r) => Number(r.normalized_price) > 0)
  if (!rows.length) return null

  const withAll = rows.map((r) => ({
    value: Number(r.normalized_price),
    weight: Number(r.weight) || 0.0001,
    comparable_id: r.comparable_id,
    comparable_type: r.comparable_type,
  }))
  const without = withAll.filter((r) => {
    if (String(r.comparable_id) !== String(comparableId)) return true
    if (comparableType && r.comparable_type && String(r.comparable_type) !== String(comparableType)) {
      return true
    }
    return false
  })

  // Comparable not in this valuation's evidence set.
  if (without.length === withAll.length) return null
  // Removing the only comparable → treat as full invalidation (100% move).
  if (!without.length) {
    return { pct_move: -100, property_id: evidenceRows[0]?.property_id || null }
  }

  const before = weightedMedian(withAll)
  const after = weightedMedian(without)
  if (!before || before === 0 || after == null) return null
  const pct_move = Number((((after - before) / before) * 100).toFixed(2))
  return {
    pct_move,
    property_id: evidenceRows[0]?.property_id || null,
  }
}

export function createMarketImpactService({ dal, logger } = {}) {
  async function loadEvidenceForComparable(comparableId, comparableType = null) {
    if (!dal?.findAll || !comparableId) return []
    const all = await dal.findAll(
      Collections.ANALYSIS_COMPARABLE_EVIDENCE,
      (row) => {
        if (String(row.comparable_id) !== String(comparableId)) return false
        if (comparableType && row.comparable_type && String(row.comparable_type) !== String(comparableType)) {
          return false
        }
        return true
      },
    )
    return all || []
  }

  async function loadActiveAnalysesByProperty(propertyIds) {
    const ids = [...new Set((propertyIds || []).filter(Boolean).map(String))]
    if (!ids.length || !dal?.findAll) return new Map()
    const now = new Date()
    const analyses = await dal.findAll(
      Collections.PROPERTY_PRICE_ANALYSES,
      (a) => ids.includes(String(a.property_id)) && isAnalysisActive(a, now),
    )
    const byProperty = new Map()
    for (const analysis of analyses || []) {
      const key = String(analysis.property_id)
      const existing = byProperty.get(key)
      if (!existing || new Date(analysis.calculated_at || 0) > new Date(existing.calculated_at || 0)) {
        byProperty.set(key, analysis)
      }
    }
    return byProperty
  }

  async function loadEvidenceForRuns(runIds) {
    const ids = [...new Set((runIds || []).filter(Boolean).map(String))]
    if (!ids.length || !dal?.findAll) return []
    return dal.findAll(
      Collections.ANALYSIS_COMPARABLE_EVIDENCE,
      (row) => ids.includes(String(row.analysis_run_id)),
    )
  }

  async function resolveMarketLabel(propertyId) {
    if (!propertyId || !dal?.findOne) return null
    try {
      const property = await dal.findOne('properties', (p) => p.id === propertyId)
      if (!property) return null
      return property.neighborhood || property.city || property.area || property.location || null
    } catch (err) {
      logger?.debug?.({ err: err.message, propertyId }, 'market label lookup failed')
      return null
    }
  }

  /**
   * Score market impact for a comparable referenced by a report.
   * @returns {Promise<object>} market_impact payload (+ requires_two_person, affected_property_ids)
   */
  async function scoreComparableImpact({ comparableId, comparableType = null } = {}) {
    if (!comparableId) return emptyImpact()

    try {
      const hitEvidence = await loadEvidenceForComparable(comparableId, comparableType)
      if (!hitEvidence.length) return emptyImpact()

      const propertyIds = hitEvidence.map((e) => e.property_id).filter(Boolean)
      const activeByProperty = await loadActiveAnalysesByProperty(propertyIds)
      if (!activeByProperty.size) return emptyImpact()

      const runIds = [...activeByProperty.values()]
        .map((a) => a.latest_run_id || a.data?.latest_run_id)
        .filter(Boolean)

      // Prefer full evidence for those runs; fall back to analyses.data.comparables_used.
      let runEvidence = await loadEvidenceForRuns(runIds)
      if (!runEvidence.length) {
        runEvidence = hitEvidence.filter((e) => {
          const analysis = activeByProperty.get(String(e.property_id))
          return analysis && (
            !analysis.latest_run_id
            || String(e.analysis_run_id) === String(analysis.latest_run_id)
          )
        })
      }

      const byProperty = new Map()
      for (const row of runEvidence) {
        const pid = String(row.property_id)
        if (!activeByProperty.has(pid)) continue
        if (!byProperty.has(pid)) byProperty.set(pid, [])
        byProperty.get(pid).push(row)
      }

      // Fallback: analyses that list the comparable in data.comparables_used
      // but lack evidence rows (older caches).
      for (const [pid, analysis] of activeByProperty.entries()) {
        if (byProperty.has(pid)) continue
        const used = analysis.data?.comparables_used || []
        if (used.map(String).includes(String(comparableId))) {
          byProperty.set(pid, [{
            property_id: pid,
            comparable_id: comparableId,
            comparable_type: comparableType,
            normalized_price: Number(analysis.median_price) || 1,
            weight: 1,
          }])
        }
      }

      const moves = []
      const marketCounts = new Map()

      for (const [pid, rows] of byProperty.entries()) {
        let move = computeValuationMove(rows, comparableId, comparableType)
        if (!move && rows.some((r) => String(r.comparable_id) === String(comparableId))) {
          // Evidence only has the hit row(s) — approximate with weight share.
          const hitWeight = rows
            .filter((r) => String(r.comparable_id) === String(comparableId))
            .reduce((s, r) => s + (Number(r.weight) || 0), 0)
          const totalWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1
          move = {
            pct_move: Number((-(hitWeight / totalWeight) * 100).toFixed(2)),
            property_id: pid,
          }
        }
        if (!move) continue
        moves.push(move)

        const label = await resolveMarketLabel(pid)
        if (label) {
          marketCounts.set(label, (marketCounts.get(label) || 0) + 1)
        }
      }

      if (!moves.length) return emptyImpact()

      const pctMoves = moves.map((m) => m.pct_move)
      const absSorted = [...pctMoves].sort((a, b) => Math.abs(b) - Math.abs(a))
      const pct_move_median = median(pctMoves)
      const pct_move_max = absSorted[0] ?? 0
      const valuations_affected = moves.length
      const tier = classifyMarketImpactTier({
        valuations_affected,
        pct_move_median,
        pct_move_max,
      })

      const top_markets = [...marketCounts.entries()]
        .map(([market, count]) => ({ market, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return {
        tier,
        valuations_affected,
        pct_move_median,
        pct_move_max,
        top_markets,
        requires_two_person: tier === MARKET_IMPACT_TIERS.HIGH,
        affected_property_ids: moves.map((m) => m.property_id).filter(Boolean),
      }
    } catch (err) {
      logger?.warn?.({ err: err.message, comparableId }, 'market impact scoring failed')
      return emptyImpact()
    }
  }

  return {
    scoreComparableImpact,
    classifyMarketImpactTier,
    computeValuationMove,
    marketImpactTierRank,
  }
}


/** Thresholds consumed by decision scoring / Agent-5 tests. */
export const MARKET_IMPACT_THRESHOLDS = Object.freeze({
  HIGH_VALUATIONS: 25,
  HIGH_MEDIAN_ABS_PCT: 10,
  HIGH_MAX_ABS_PCT: 15,
  MEDIUM_VALUATIONS: 10,
  MEDIUM_MEDIAN_ABS_PCT: 5,
})

/**
 * Decision-facing alias over classifyMarketImpactTier (camelCase inputs).
 * Prefer this from WF-05 decision code; list/detail keep snake_case helper.
 */
export function tierFromImpact({
  valuationsAffected = 0,
  pctMoveMedian = 0,
  pctMoveMax = 0,
  thresholds = MARKET_IMPACT_THRESHOLDS,
} = {}) {
  const n = Number(valuationsAffected) || 0
  const med = Math.abs(Number(pctMoveMedian) || 0)
  const max = Math.abs(Number(pctMoveMax) || 0)
  if (n <= 0) return MARKET_IMPACT_TIERS.NONE
  if (
    n >= thresholds.HIGH_VALUATIONS
    || med >= thresholds.HIGH_MEDIAN_ABS_PCT
    || max >= thresholds.HIGH_MAX_ABS_PCT
  ) {
    return MARKET_IMPACT_TIERS.HIGH
  }
  if (
    n >= thresholds.MEDIUM_VALUATIONS
    || med >= thresholds.MEDIUM_MEDIAN_ABS_PCT
  ) {
    return MARKET_IMPACT_TIERS.MEDIUM
  }
  return MARKET_IMPACT_TIERS.LOW
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

/**
 * Estimate % move if a weighted comparable were removed from a run.
 * Shared by decision endpoints / bulk undo (Agents 5–6).
 */
export function estimateRemovalMovePct({
  weight,
  totalWeight,
  medianPrice,
  comparablePrice,
} = {}) {
  const w = Number(weight) || 0
  const tw = Number(totalWeight) || 0
  if (tw <= 0 || w <= 0) return 0
  const share = Math.min(1, w / tw)
  const price = Number(comparablePrice)
  const med = Number(medianPrice)
  if (Number.isFinite(price) && Number.isFinite(med) && med !== 0) {
    const direction = price >= med ? -1 : 1
    return round1(direction * share * Math.abs((price - med) / med) * 100)
  }
  return round1(share * 5)
}

export { emptyImpact as emptyMarketImpact }
