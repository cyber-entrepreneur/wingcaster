/**
 * Lightweight CRUD helpers for public.portal_registry and activation tables.
 * Used by tests and future PA-POR admin surfaces — no HTTP routes here.
 */
import { randomUUID } from 'node:crypto'
import { query, transaction } from '../../db.js'

export async function listPortalRegistry({ activeOnly = false } = {}) {
  return query(
    `SELECT * FROM public.portal_registry
      WHERE ($1::boolean IS NOT TRUE OR is_active = true)
      ORDER BY code`,
    [activeOnly],
  )
}

export async function getPortalByCode(code) {
  const rows = await query(
    `SELECT * FROM public.portal_registry WHERE code = $1`,
    [code],
  )
  return rows[0] || null
}

export async function upsertPortalRegistry(row) {
  const id = row.id || row.code || randomUUID()
  const rows = await query(
    `INSERT INTO public.portal_registry (
       id, code, display_name, description, logo_url, country_codes,
       primary_language, adapter_class_name, publisher_config, inbound_config,
       validator_ref, is_active, effective_from, deprecated_at
     ) VALUES (
       $1,$2,$3,$4,$5,COALESCE($6::text[], '{}'),$7,$8,
       COALESCE($9::jsonb, '{}'::jsonb), COALESCE($10::jsonb, '{}'::jsonb),
       $11, COALESCE($12, false), $13, $14
     )
     ON CONFLICT (code) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       description = EXCLUDED.description,
       logo_url = EXCLUDED.logo_url,
       country_codes = EXCLUDED.country_codes,
       primary_language = EXCLUDED.primary_language,
       adapter_class_name = EXCLUDED.adapter_class_name,
       publisher_config = EXCLUDED.publisher_config,
       inbound_config = EXCLUDED.inbound_config,
       validator_ref = EXCLUDED.validator_ref,
       is_active = EXCLUDED.is_active,
       effective_from = EXCLUDED.effective_from,
       deprecated_at = EXCLUDED.deprecated_at
     RETURNING *`,
    [
      id,
      row.code,
      row.display_name,
      row.description || null,
      row.logo_url || null,
      row.country_codes || [],
      row.primary_language || null,
      row.adapter_class_name || `portals/${row.code}.js`,
      JSON.stringify(row.publisher_config || {}),
      JSON.stringify(row.inbound_config || {}),
      row.validator_ref || null,
      row.is_active ?? false,
      row.effective_from || null,
      row.deprecated_at || null,
    ],
  )
  return rows[0]
}

export async function insertPendingActivation(row = {}) {
  const inserted = await query(
    `INSERT INTO public.portal_registry_pending_activations (
       id, portal_code, action, state, submitter_user_id, approver_user_id,
       submitter_notes, approver_notes, effective_from
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      row.id || randomUUID(),
      row.portal_code || row.portalCode,
      row.action || (row.proposedIsActive === false ? 'deactivate' : 'activate'),
      row.state || 'pending',
      row.submitter_user_id || row.submitterUserId || row.requestedBy,
      row.approver_user_id ?? row.approverUserId ?? null,
      row.submitter_notes ?? row.submitterNotes ?? row.reason ?? null,
      row.approver_notes ?? row.approverNotes ?? null,
      row.effective_from ?? row.effectiveFrom ?? row.proposedEffectiveFrom ?? null,
    ],
  )
  return inserted[0]
}

export async function appendActivationHistory(row = {}) {
  const inserted = await query(
    `INSERT INTO public.portal_activation_history (
       id, portal_code, event_type, submitter_user_id, approver_user_id,
       notes, before_json, after_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
     RETURNING *`,
    [
      row.id || randomUUID(),
      row.portal_code || row.portalCode,
      row.event_type || row.eventType || row.action,
      row.submitter_user_id ?? row.submitterUserId ?? row.actor_id ?? null,
      row.approver_user_id ?? row.approverUserId ?? null,
      row.notes ?? row.note ?? null,
      JSON.stringify(row.before_json ?? row.beforeJson ?? row.from_state ?? null),
      JSON.stringify(row.after_json ?? row.afterJson ?? row.to_state ?? null),
    ],
  )
  return inserted[0]
}

export async function requestPortalActivation({
  portalCode,
  portalId,
  requestedBy,
  reason = null,
  proposedIsActive = true,
  proposedEffectiveFrom = null,
}) {
  const portal = portalCode
    ? await getPortalByCode(portalCode)
    : (await query(`SELECT * FROM public.portal_registry WHERE id = $1`, [portalId]))[0]
  if (!portal) {
    const err = new Error('portal not found')
    err.code = 'NOT_FOUND'
    throw err
  }
  const pending = await insertPendingActivation({
    portal_code: portal.code,
    action: proposedIsActive ? 'activate' : 'deactivate',
    submitter_user_id: requestedBy,
    submitter_notes: reason,
    effective_from: proposedEffectiveFrom,
  })
  await appendActivationHistory({
    portal_code: portal.code,
    event_type: 'submitted',
    submitter_user_id: requestedBy,
    notes: reason,
    before_json: { is_active: portal.is_active },
    after_json: { pending_id: pending.id, action: pending.action },
  })
  return pending
}

export async function applyPortalActivationDecision({
  pendingId,
  reviewerId,
  approve,
  reviewNote = null,
}) {
  return transaction(async (client) => {
    const pendingQ = await client.query(
      `SELECT * FROM public.portal_registry_pending_activations WHERE id = $1 FOR UPDATE`,
      [pendingId],
    )
    const pending = pendingQ.rows[0]
    if (!pending) {
      const err = new Error('pending activation not found')
      err.code = 'NOT_FOUND'
      throw err
    }
    if (pending.state !== 'pending') {
      const err = new Error(`pending activation is ${pending.state}`)
      err.code = 'INVALID_STATE'
      throw err
    }

    const portalQ = await client.query(
      `SELECT * FROM public.portal_registry WHERE code = $1 FOR UPDATE`,
      [pending.portal_code],
    )
    const portal = portalQ.rows[0]
    const fromState = { is_active: portal.is_active, effective_from: portal.effective_from }
    const nextState = approve ? 'approved' : 'rejected'
    const nextActive = pending.action === 'activate'

    await client.query(
      `UPDATE public.portal_registry_pending_activations
          SET state = $2, approver_user_id = $3, approver_notes = $4, resolved_at = NOW()
        WHERE id = $1`,
      [pendingId, nextState, reviewerId, reviewNote],
    )

    let updatedPortal = portal
    if (approve) {
      const updated = await client.query(
        `UPDATE public.portal_registry
            SET is_active = $2,
                effective_from = COALESCE($3::timestamptz, NOW())
          WHERE code = $1
          RETURNING *`,
        [pending.portal_code, nextActive, pending.effective_from],
      )
      updatedPortal = updated.rows[0]
    }

    await client.query(
      `INSERT INTO public.portal_activation_history (
         portal_code, event_type, submitter_user_id, approver_user_id,
         notes, before_json, after_json
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        pending.portal_code,
        nextState,
        pending.submitter_user_id,
        reviewerId,
        reviewNote,
        JSON.stringify(fromState),
        JSON.stringify({ is_active: approve ? nextActive : portal.is_active, state: nextState }),
      ],
    )

    return {
      pending: { ...pending, state: nextState, approver_user_id: reviewerId },
      portal: updatedPortal,
    }
  })
}

export async function listPortalActivationHistory(portalCode) {
  return query(
    `SELECT * FROM public.portal_activation_history
      WHERE portal_code = $1
      ORDER BY created_at DESC`,
    [portalCode],
  )
}
