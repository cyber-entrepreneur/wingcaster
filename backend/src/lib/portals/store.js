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
  const id = row.id || randomUUID()
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
       deprecated_at = EXCLUDED.deprecated_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      id,
      row.code,
      row.display_name,
      row.description || null,
      row.logo_url || null,
      row.country_codes || [],
      row.primary_language || null,
      row.adapter_class_name,
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

export async function requestPortalActivation({
  portalId,
  requestedBy,
  reason = null,
  proposedIsActive = true,
  proposedPublisherConfig = {},
  proposedInboundConfig = {},
  proposedCountryCodes = null,
  proposedEffectiveFrom = null,
}) {
  const rows = await query(
    `INSERT INTO public.portal_registry_pending_activations (
       portal_id, requested_by, reason, proposed_is_active,
       proposed_publisher_config, proposed_inbound_config,
       proposed_country_codes, proposed_effective_from
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::text[],$8)
     RETURNING *`,
    [
      portalId,
      requestedBy,
      reason,
      proposedIsActive,
      JSON.stringify(proposedPublisherConfig),
      JSON.stringify(proposedInboundConfig),
      proposedCountryCodes,
      proposedEffectiveFrom,
    ],
  )
  const pending = rows[0]
  await query(
    `INSERT INTO public.portal_activation_history (
       portal_id, action, actor_id, pending_activation_id, from_state, to_state, note
     ) VALUES ($1,'activation_requested',$2,$3,'{}'::jsonb,$4::jsonb,$5)`,
    [
      portalId,
      requestedBy,
      pending.id,
      JSON.stringify({ pending_id: pending.id, proposed_is_active: proposedIsActive }),
      reason,
    ],
  )
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
    if (pending.status !== 'pending') {
      const err = new Error(`pending activation is ${pending.status}`)
      err.code = 'INVALID_STATE'
      throw err
    }

    const portalQ = await client.query(
      `SELECT * FROM public.portal_registry WHERE id = $1 FOR UPDATE`,
      [pending.portal_id],
    )
    const portal = portalQ.rows[0]
    const fromState = {
      is_active: portal.is_active,
      publisher_config: portal.publisher_config,
      inbound_config: portal.inbound_config,
      country_codes: portal.country_codes,
      effective_from: portal.effective_from,
    }

    if (!approve) {
      await client.query(
        `UPDATE public.portal_registry_pending_activations
            SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
                review_note = $3, updated_at = NOW()
          WHERE id = $1`,
        [pendingId, reviewerId, reviewNote],
      )
      await client.query(
        `INSERT INTO public.portal_activation_history (
           portal_id, action, actor_id, pending_activation_id, from_state, to_state, note
         ) VALUES ($1,'activation_rejected',$2,$3,$4::jsonb,'{}'::jsonb,$5)`,
        [pending.portal_id, reviewerId, pendingId, JSON.stringify(fromState), reviewNote],
      )
      return { pending: { ...pending, status: 'rejected' }, portal }
    }

    const toState = {
      is_active: pending.proposed_is_active,
      publisher_config: pending.proposed_publisher_config,
      inbound_config: pending.proposed_inbound_config,
      country_codes: pending.proposed_country_codes || portal.country_codes,
      effective_from: pending.proposed_effective_from || new Date().toISOString(),
    }

    const updated = await client.query(
      `UPDATE public.portal_registry
          SET is_active = $2,
              publisher_config = COALESCE($3::jsonb, publisher_config),
              inbound_config = COALESCE($4::jsonb, inbound_config),
              country_codes = COALESCE($5::text[], country_codes),
              effective_from = COALESCE($6::timestamptz, NOW()),
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        pending.portal_id,
        pending.proposed_is_active,
        JSON.stringify(pending.proposed_publisher_config || {}),
        JSON.stringify(pending.proposed_inbound_config || {}),
        pending.proposed_country_codes,
        pending.proposed_effective_from,
      ],
    )

    await client.query(
      `UPDATE public.portal_registry_pending_activations
          SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(),
              review_note = $3, updated_at = NOW()
        WHERE id = $1`,
      [pendingId, reviewerId, reviewNote],
    )

    const action = pending.proposed_is_active ? 'activate' : 'deactivate'
    await client.query(
      `INSERT INTO public.portal_activation_history (
         portal_id, action, actor_id, pending_activation_id, from_state, to_state, note
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
      [
        pending.portal_id,
        action,
        reviewerId,
        pendingId,
        JSON.stringify(fromState),
        JSON.stringify(toState),
        reviewNote,
      ],
    )

    return { pending: { ...pending, status: 'approved' }, portal: updated.rows[0] }
  })
}

export async function listPortalActivationHistory(portalId) {
  return query(
    `SELECT * FROM public.portal_activation_history
      WHERE portal_id = $1
      ORDER BY created_at DESC`,
    [portalId],
  )
}
