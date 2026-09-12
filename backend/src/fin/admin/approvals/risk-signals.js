/** BE-APR-EXEC — risk-signal aggregation for execute-preview. */

import { VALUE_TIERS } from './workflow-map.js'
import { HIGH_VALUE_AMOUNT_MINOR } from './value-tier.js'

function avgGrantMinor(rows) {
  if (!rows.length) return null
  const sum = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0)
  return sum / rows.length
}

export async function aggregateRiskSignals(client, {
  approval, valueTier, amountMinor, environment,
}) {
  const signals = []
  const submitterId = approval.created_by_actor_id

  if (valueTier === VALUE_TIERS.HIGH_VALUE) {
    signals.push({
      severity: 'info',
      label: 'High-value tier — type-to-confirm required',
      detail: null,
    })
  }

  if (amountMinor > 0 && amountMinor >= HIGH_VALUE_AMOUNT_MINOR) {
    signals.push({
      severity: 'warn',
      label: 'Amount meets high-value grant threshold',
      detail: `Request amount ${amountMinor}; threshold ${HIGH_VALUE_AMOUNT_MINOR}.`,
    })
  }

  if (submitterId) {
    const { rows } = await client.query(
      `SELECT COALESCE(
          (payload->>'amount_minor')::numeric,
          (payload->>'units')::numeric,
          0
        ) AS amount
         FROM fin.approval_requests
        WHERE environment = $1
          AND created_by_actor_id = $2
          AND action_kind = $3
          AND created_at >= NOW() - INTERVAL '90 days'
          AND id <> $4
        LIMIT 50`,
      [environment, submitterId, approval.action_kind, approval.id],
    )
    const avg = avgGrantMinor(rows)
    if (avg != null && avg > 0 && amountMinor > avg * 2) {
      const ratio = (amountMinor / avg).toFixed(1)
      signals.push({
        severity: 'warn',
        label: `Amount exceeds submitter's 90-day average by ${ratio}×`,
        detail: `Submitter avg ${Math.round(avg)}; this request ${amountMinor}.`,
      })
    }
  }

  if (approval.tenant_id) {
    const rejected = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM fin.approval_requests
        WHERE tenant_id = $1
          AND environment = $2
          AND status = 'REJECTED'
          AND created_at >= NOW() - INTERVAL '30 days'`,
      [approval.tenant_id, environment],
    )
    const n = rejected.rows[0]?.n || 0
    if (n >= 2) {
      signals.push({
        severity: 'danger',
        label: `Recipient tenant has ${n} rejected requests in the last 30 days`,
        detail: null,
      })
    }
  }

  const actions = await client.query(
    `SELECT actor_id, decision, created_at
       FROM fin.approval_actions
      WHERE request_id = $1
      ORDER BY created_at ASC`,
    [approval.id],
  )
  const firstApprove = actions.rows.find((a) => a.decision === 'APPROVED')
  if (firstApprove) {
    const submittedAt = new Date(approval.created_at).getTime()
    const signedAt = new Date(firstApprove.created_at).getTime()
    const hours = (signedAt - submittedAt) / 3_600_000
    if (Number.isFinite(hours) && hours <= 24) {
      signals.push({
        severity: 'info',
        label: 'First approver signed off within SLA',
        detail: null,
      })
    }
  }

  return signals
}
