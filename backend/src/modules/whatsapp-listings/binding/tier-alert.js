import { randomUUID } from 'crypto'
import { query } from '../../../db.js'
import { getIntakeConfig } from './config.js'
import { getModuleLogger } from '../logger.js'

function utcDayBounds(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function runTierUtilizationAlert({ now = new Date(), logger = getModuleLogger() } = {}) {
  const cfg = await getIntakeConfig()
  const { start, end } = utcDayBounds(now)
  const cap = cfg.WHATSAPP_INTAKE_TIER_CAP_PER_NUMBER
  const alertPercent = cfg.WHATSAPP_INTAKE_TIER_ALERT_PERCENT

  const rows = await query(
    `SELECT shared_number_index, COUNT(*)::int AS send_count
       FROM wa_listings.processed_messages
      WHERE processed_at >= $1::timestamptz
        AND processed_at < $2::timestamptz
        AND shared_number_index IS NOT NULL
      GROUP BY shared_number_index`,
    [start, end],
  )

  const byIndex = new Map(rows.map((r) => [Number(r.shared_number_index), Number(r.send_count)]))
  const perNumber = cfg.sharedNumbers.map((number, index) => {
    const sendCount = byIndex.get(index) || 0
    const percent = cap > 0 ? (sendCount / cap) * 100 : 0
    return {
      shared_number_index: index,
      e164: number.e164,
      send_count: sendCount,
      tier_cap: cap,
      percent: Math.round(percent * 10) / 10,
    }
  })

  for (const entry of perNumber) {
    logger.warn({
      shared_number_index: entry.shared_number_index,
      e164: entry.e164,
      send_count: entry.send_count,
      tier_cap: entry.tier_cap,
      percent: entry.percent,
      window_start: start,
      window_end: end,
    }, 'whatsapp intake tier utilization')
  }

  const over = perNumber.filter((entry) => entry.percent > alertPercent)
  if (over.length) {
    await query(
      `INSERT INTO public.audit_log (id, type, action, entity_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        randomUUID(),
        'whatsapp_intake_tier_alert',
        'tier_utilization',
        'whatsapp_intake',
        JSON.stringify({ window_start: start, window_end: end, numbers: over }),
      ],
    )
  }

  return { window_start: start, window_end: end, perNumber, alerted: over.length }
}
