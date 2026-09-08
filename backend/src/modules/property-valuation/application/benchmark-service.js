/**
 * Pricing benchmark writer + delta + series (BE-DESIGN-PVA09-01/02/07).
 *
 * Incorporate path MUST keep benchmark writes inside the same DAL transaction
 * as the report status update so a failed status write rolls the benchmark back.
 */

import { randomUUID } from 'crypto'
import { Collections } from '../infrastructure/db.js'

export const HIGH_DELTA_THRESHOLD_PCT = 10
export const HIGH_RISK_DELTA_PCT = 15
export const PRICE_REPORT_INCORPORATE_ACTION = 'PRICE_REPORT_INCORPORATE'

const COUNTRY_FLAGS = Object.freeze({
  AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬', LB: '🇱🇧', JO: '🇯🇴', OM: '🇴🇲', BH: '🇧🇭', KW: '🇰🇼', QA: '🇶🇦', US: '🇺🇸',
})

export function countryFlagEmoji(countryCode) {
  if (!countryCode) return null
  return COUNTRY_FLAGS[String(countryCode).toUpperCase()] || null
}

export function computeDeltaPct(recommendationPrice, benchmarkPrice) {
  const rec = Number(recommendationPrice)
  const bench = Number(benchmarkPrice)
  if (!Number.isFinite(rec) || !Number.isFinite(bench) || bench === 0) return null
  return Math.round(((rec - bench) / bench) * 1000) / 10
}

export function classifyDelta(deltaPct) {
  if (deltaPct == null || !Number.isFinite(Number(deltaPct))) {
    return { delta_direction: 'unknown', delta_tier: 'unknown' }
  }
  const abs = Math.abs(deltaPct)
  const delta_tier = abs >= HIGH_DELTA_THRESHOLD_PCT ? 'high' : abs >= 5 ? 'medium' : 'low'
  const delta_direction = abs < 2 ? 'in_band' : deltaPct > 0 ? 'above' : 'below'
  return { delta_direction, delta_tier }
}

export function matchesDeltaBucket(deltaPct, bucket) {
  if (!bucket || bucket === 'all') return true
  if (deltaPct == null || !Number.isFinite(Number(deltaPct))) return false
  const d = Number(deltaPct)
  switch (bucket) {
    case 'in_band': return Math.abs(d) < 5
    case 'above_5': return d >= 5 && d < 10
    case 'above_10': return d >= 10
    case 'below_5': return d <= -5 && d > -10
    case 'below_10': return d <= -10
    default: return true
  }
}

export function compositeRiskTier({ deltaPct, tenureTier }) {
  const abs = Math.abs(Number(deltaPct) || 0)
  if (abs >= HIGH_RISK_DELTA_PCT || tenureTier === 'high') return 'high'
  if (abs >= HIGH_DELTA_THRESHOLD_PCT || tenureTier === 'medium') return 'medium'
  if (tenureTier === 'unknown' && (deltaPct == null || !Number.isFinite(Number(deltaPct)))) return 'unknown'
  return 'low'
}

export function resolveSegmentId(report) {
  if (report?.segment_id) return report.segment_id
  const data = report?.data || {}
  if (data.segment_id) return data.segment_id
  const location = report?.external_property_location || data.segment_label || 'unknown'
  const propertyType = report?.property_type || data.property_type || 'any'
  const beds = report?.bedrooms != null ? String(report.bedrooms) : (data.bedroom_range || 'any')
  const country = (report?.country_code || data.country_code || 'XX').toLowerCase()
  return `seg_${country}_${slugify(location)}_${slugify(propertyType)}_${beds}`
}

export function resolveSegmentLabel(report) {
  if (report?.segment_label) return report.segment_label
  const data = report?.data || {}
  if (data.segment_label) return data.segment_label
  const location = report?.external_property_location || 'Unknown area'
  const propertyType = report?.property_type || 'property'
  const beds = report?.bedrooms != null ? `${report.bedrooms}BR` : null
  return [location, beds, propertyType].filter(Boolean).join(' · ')
}

export function resolveRecommendation(report) {
  const data = report?.data?.recommendation || {}
  const pricePoint = firstNumber(
    report?.recommendation_price_point,
    data.price_point,
    data.amount,
    report?.sold_price,
  )
  const priceLow = firstNumber(report?.recommendation_price_low, data.price_low, data.range?.low)
  const priceHigh = firstNumber(report?.recommendation_price_high, data.price_high, data.range?.high)
  const currency = String(report?.currency || data.currency || 'USD').toUpperCase()
  return {
    price_low: priceLow ?? null,
    price_high: priceHigh ?? null,
    price_point: pricePoint ?? null,
    currency,
  }
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'unknown'
}

export function createBenchmarkService({ dal, recalculationJobService, logger }) {
  async function getBenchmarkForSegment(segmentId, env = 'live') {
    if (!segmentId) return null
    return dal.findOne(
      Collections.PRICING_BENCHMARKS,
      (row) => row.segment_id === segmentId && (row.env || 'live') === env,
    )
  }

  async function computeBenchmarkDelta(report, env = 'live') {
    const segmentId = resolveSegmentId(report)
    const recommendation = resolveRecommendation(report)
    const benchmark = await getBenchmarkForSegment(segmentId, env)
    const benchmarkPrice = firstNumber(benchmark?.price_point, report?.data?.benchmark_price_point)
    const deltaPct = computeDeltaPct(recommendation.price_point, benchmarkPrice)
    const classified = classifyDelta(deltaPct)
    const computedAt = benchmark?.computed_at || report?.data?.benchmark_computed_at || null
    const stale = computedAt
      ? (Date.now() - new Date(computedAt).getTime()) > 7 * 24 * 60 * 60 * 1000
      : !benchmark

    return {
      benchmark_price_point: benchmarkPrice ?? null,
      benchmark_currency: benchmark?.currency || recommendation.currency,
      delta_pct: deltaPct,
      delta_direction: classified.delta_direction,
      delta_tier: classified.delta_tier,
      benchmark_computed_at: computedAt,
      stale: Boolean(stale),
      segment_id: segmentId,
    }
  }

  /**
   * Write / upsert an authoritative benchmark from an incorporated report.
   * Caller must invoke inside dal.transaction() for atomicity with status write.
   */
  async function writeBenchmarkFromReport(report, { env = 'live', actorId = null } = {}) {
    const segmentId = resolveSegmentId(report)
    const recommendation = resolveRecommendation(report)
    if (!Number.isFinite(Number(recommendation.price_point))) {
      const err = new Error('Cannot incorporate without a recommendation price_point')
      err.status = 400
      err.code = 'MISSING_PRICE_POINT'
      throw err
    }

    const now = new Date().toISOString()
    const existing = await getBenchmarkForSegment(segmentId, env)
    const row = {
      id: existing?.id || randomUUID(),
      segment_id: segmentId,
      country_code: report.country_code || report.data?.country_code || null,
      currency: recommendation.currency,
      price_point: recommendation.price_point,
      price_low: recommendation.price_low,
      price_high: recommendation.price_high,
      source_report_id: report.id,
      computed_at: now,
      env,
      created_at: existing?.created_at || now,
      updated_at: now,
      data: {
        ...(existing?.data || {}),
        incorporated_by: actorId,
        source_report_id: report.id,
        previous_price_point: existing?.price_point ?? null,
      },
    }

    if (existing) {
      await dal.update(Collections.PRICING_BENCHMARKS, (b) => b.id === existing.id, () => row)
    } else {
      await dal.insert(Collections.PRICING_BENCHMARKS, row)
    }

    const snapshotDate = now.slice(0, 10)
    const existingSnap = await dal.findOne(
      Collections.PRICING_BENCHMARK_SNAPSHOTS,
      (s) => s.segment_id === segmentId && (s.env || 'live') === env && String(s.snapshot_date).slice(0, 10) === snapshotDate,
    )
    const snap = {
      id: existingSnap?.id || randomUUID(),
      segment_id: segmentId,
      env,
      snapshot_date: snapshotDate,
      price: recommendation.price_point,
      confidence_low: recommendation.price_low,
      confidence_high: recommendation.price_high,
      currency: recommendation.currency,
      source_report_id: report.id,
      created_at: existingSnap?.created_at || now,
      data: { source: 'incorporate', report_id: report.id },
    }
    if (existingSnap) {
      await dal.update(Collections.PRICING_BENCHMARK_SNAPSHOTS, (s) => s.id === existingSnap.id, () => snap)
    } else {
      await dal.insert(Collections.PRICING_BENCHMARK_SNAPSHOTS, snap)
    }

    return row
  }

  async function rollbackBenchmarkWrite(report, { env = 'live' } = {}) {
    const segmentId = resolveSegmentId(report)
    const benchmark = await getBenchmarkForSegment(segmentId, env)
    if (!benchmark || benchmark.source_report_id !== report.id) return null

    const previous = benchmark.data?.previous_price_point
    const now = new Date().toISOString()
    if (previous != null && Number.isFinite(Number(previous))) {
      await dal.update(Collections.PRICING_BENCHMARKS, (b) => b.id === benchmark.id, (b) => ({
        ...b,
        price_point: Number(previous),
        source_report_id: b.data?.prior_source_report_id || null,
        updated_at: now,
        data: { ...b.data, rolled_back_from_report_id: report.id, rolled_back_at: now },
      }))
    } else {
      await dal.remove(Collections.PRICING_BENCHMARKS, (b) => b.id === benchmark.id)
    }

    const snapshotDate = (report.incorporated_at || report.reviewed_at || now).toString().slice(0, 10)
    await dal.remove(
      Collections.PRICING_BENCHMARK_SNAPSHOTS,
      (s) => s.segment_id === segmentId
        && (s.env || 'live') === env
        && String(s.snapshot_date).slice(0, 10) === snapshotDate
        && s.source_report_id === report.id,
    )
    return true
  }

  async function getSeries(segmentId, { window = '90d', env = 'live' } = {}) {
    const days = parseWindowDays(window)
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rows = await dal.findAll(
      Collections.PRICING_BENCHMARK_SNAPSHOTS,
      (s) => s.segment_id === segmentId
        && (s.env || 'live') === env
        && String(s.snapshot_date).slice(0, 10) >= cutoff,
    )
    const sorted = rows.sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)))
    const currency = sorted[0]?.currency || 'USD'
    return {
      points: sorted.map((row) => ({
        date: String(row.snapshot_date).slice(0, 10),
        price: Number(row.price),
        confidence_low: row.confidence_low != null ? Number(row.confidence_low) : null,
        confidence_high: row.confidence_high != null ? Number(row.confidence_high) : null,
      })),
      currency,
      segment_id: segmentId,
      window,
      env,
    }
  }

  async function enqueueBenchmarkRefresh({ segmentId = null, propertyType = null, requestedBy = null } = {}) {
    if (!recalculationJobService?.invalidateAll && !recalculationJobService?.enqueue) {
      logger?.warn?.({ segmentId }, 'No recalculation job service; skipping benchmark refresh enqueue')
      return null
    }
    try {
      if (segmentId && recalculationJobService.enqueue) {
        // Segment refreshes map to an all-scope invalidate keyed by property type when known.
        return recalculationJobService.invalidateAll
          ? recalculationJobService.invalidateAll({ enqueueJob: true, propertyType })
          : recalculationJobService.enqueue({ force_recompute: true }, requestedBy)
      }
      return recalculationJobService.invalidateAll
        ? recalculationJobService.invalidateAll({ enqueueJob: true, propertyType })
        : null
    } catch (err) {
      logger?.warn?.({ err: err.message, segmentId }, 'Benchmark refresh enqueue failed')
      return null
    }
  }

  return {
    getBenchmarkForSegment,
    computeBenchmarkDelta,
    writeBenchmarkFromReport,
    rollbackBenchmarkWrite,
    getSeries,
    enqueueBenchmarkRefresh,
  }
}

function parseWindowDays(window) {
  const match = String(window || '90d').match(/^(\d+)d$/i)
  if (!match) return 90
  return Math.min(Math.max(Number(match[1]), 1), 365)
}
