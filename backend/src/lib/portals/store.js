/**
 * CRUD helpers for public.portal_registry and activation tables.
 * HTTP admin surface: ./admin-routes.js (BE-BLOCKER-35 / PA-POR-*).
 */
import { randomUUID } from 'node:crypto'
import { query, transaction } from '../../db.js'
import {
  assertActivationFilesPresent,
  deriveAdapterStatus,
} from './activation-gates.js'

const CODE_RE = /^[a-z][a-z0-9_]{2,63}$/

export function isValidPortalCode(code) {
  return CODE_RE.test(String(code || ''))
}

/** Heuristic: reject JSONB string values that look like raw secrets (PA-POR-002). */
export function findSecretInJsonb(value, path = '') {
  if (value == null) return null
  if (typeof value === 'string') {
    if (value.length > 32 && !value.includes('/')) return path || '(root)'
    return null
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findSecretInJsonb(value[i], `${path}[${i}]`)
      if (hit) return hit
    }
    return null
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const hit = findSecretInJsonb(v, path ? `${path}.${k}` : k)
      if (hit) return hit
    }
  }
  return null
}

function portalSnapshot(row) {
  return {
    id: row.id,
    code: row.code,
    display_name: row.display_name,
    description: row.description,
    logo_url: row.logo_url,
    country_codes: row.country_codes,
    primary_language: row.primary_language,
    adapter_class_name: row.adapter_class_name,
    publisher_config: row.publisher_config,
    inbound_config: row.inbound_config,
    validator_ref: row.validator_ref,
    is_active: row.is_active,
    effective_from: row.effective_from,
    deprecated_at: row.deprecated_at,
    current_version: row.current_version,
  }
}


function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function sameCountryCodes(a, b) {
  const norm = (xs) => JSON.stringify([...(xs || [])].map(String).sort())
  return norm(a) === norm(b)
}

function slaHoursOf(config) {
  const v = config?.sla_hours
  return v == null || v === '' ? null : Number(v)
}

function publisherConfigWithoutSla(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config || {}
  const { sla_hours: _sla, ...rest } = config
  return rest
}

/** Map portal field diffs to PA-POR-003 history event types (may be multiple). */
export function portalUpdateHistoryEventTypes(before, after) {
  const events = []
  if (String(before?.adapter_class_name || '') !== String(after?.adapter_class_name || '')) {
    events.push('adapter_upgraded')
  }
  if (slaHoursOf(before?.publisher_config) !== slaHoursOf(after?.publisher_config)) {
    events.push('sla_changed')
  }
  if (!sameCountryCodes(before?.country_codes, after?.country_codes)) {
    events.push('country_coverage_changed')
  }
  if (String(before?.validator_ref || '') !== String(after?.validator_ref || '')) {
    events.push('validator_ruleset_changed')
  }

  const pubSansSlaChanged = !sameJson(
    publisherConfigWithoutSla(before?.publisher_config),
    publisherConfigWithoutSla(after?.publisher_config),
  )
  const inboundChanged = !sameJson(before?.inbound_config, after?.inbound_config)
  if (pubSansSlaChanged || inboundChanged) {
    events.push('publisher_config_changed')
  } else {
    const metaChanged =
      before?.display_name !== after?.display_name
      || before?.description !== after?.description
      || before?.logo_url !== after?.logo_url
      || before?.primary_language !== after?.primary_language
    if (metaChanged && events.length === 0) {
      events.push('publisher_config_changed')
    }
  }

  if (events.length === 0) {
    events.push('publisher_config_changed')
  }
  return events
}

async function insertVersionRow(clientOrNull, portal, createdByUserId) {
  const run = clientOrNull
    ? (sql, params) => clientOrNull.query(sql, params).then((r) => r.rows)
    : query
  await run(
    `INSERT INTO public.portal_registry_versions (
       portal_code, version, snapshot, created_by_user_id
     ) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (portal_code, version) DO NOTHING`,
    [
      portal.code,
      portal.current_version || 1,
      JSON.stringify(portalSnapshot(portal)),
      createdByUserId || null,
    ],
  )
}

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

export async function getPortalVersion(code, version) {
  const rows = await query(
    `SELECT * FROM public.portal_registry_versions
      WHERE portal_code = $1 AND version = $2`,
    [code, version],
  )
  return rows[0] || null
}

export async function getPendingActivation(portalCode) {
  const rows = await query(
    `SELECT * FROM public.portal_registry_pending_activations
      WHERE portal_code = $1 AND state = 'pending'
      ORDER BY created_at DESC
      LIMIT 1`,
    [portalCode],
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

export async function createPortal(body, { actorId } = {}) {
  if (!isValidPortalCode(body?.code)) {
    const err = new Error('Invalid portal code format')
    err.code = 'INVALID_CODE_FORMAT'
    err.httpStatus = 400
    throw err
  }
  if (!body?.display_name) {
    const err = new Error('display_name is required')
    err.code = 'INVALID_INPUT'
    err.httpStatus = 400
    throw err
  }
  const secretHit = findSecretInJsonb(body.publisher_config)
    || findSecretInJsonb(body.inbound_config)
  if (secretHit) {
    const err = new Error(`Looks like a raw secret at ${secretHit}`)
    err.code = 'SECRET_IN_JSONB'
    err.httpStatus = 400
    throw err
  }
  if (await getPortalByCode(body.code)) {
    const err = new Error('Portal code already in use')
    err.code = 'PORTAL_CODE_TAKEN'
    err.httpStatus = 409
    throw err
  }

  const created = await upsertPortalRegistry({ ...body, is_active: false })
  await insertVersionRow(null, created, actorId)
  await appendActivationHistory({
    portal_code: created.code,
    event_type: 'created',
    submitter_user_id: actorId,
    notes: 'portal registry row created',
    before_json: null,
    after_json: portalSnapshot(created),
  })
  return created
}

export async function updatePortal(code, body, { actorId } = {}) {
  if (body && Object.prototype.hasOwnProperty.call(body, 'code')) {
    const err = new Error('Portal code is immutable')
    err.code = 'CODE_IMMUTABLE'
    err.httpStatus = 400
    throw err
  }
  const portal = await getPortalByCode(code)
  if (!portal) {
    const err = new Error('portal not found')
    err.code = 'NOT_FOUND'
    err.httpStatus = 404
    throw err
  }
  const secretHit = findSecretInJsonb(body?.publisher_config)
    || findSecretInJsonb(body?.inbound_config)
  if (secretHit) {
    const err = new Error(`Looks like a raw secret at ${secretHit}`)
    err.code = 'SECRET_IN_JSONB'
    err.httpStatus = 400
    throw err
  }

  const next = {
    display_name: body.display_name ?? portal.display_name,
    description: body.description !== undefined ? body.description : portal.description,
    logo_url: body.logo_url !== undefined ? body.logo_url : portal.logo_url,
    country_codes: body.country_codes ?? portal.country_codes,
    primary_language: body.primary_language !== undefined
      ? body.primary_language
      : portal.primary_language,
    adapter_class_name: body.adapter_class_name ?? portal.adapter_class_name,
    publisher_config: body.publisher_config ?? portal.publisher_config,
    inbound_config: body.inbound_config ?? portal.inbound_config,
    validator_ref: body.validator_ref !== undefined ? body.validator_ref : portal.validator_ref,
  }
  if (body.sla_hours != null) {
    next.publisher_config = { ...(next.publisher_config || {}), sla_hours: Number(body.sla_hours) }
  }

  return transaction(async (client) => {
    const updatedQ = await client.query(
      `UPDATE public.portal_registry SET
         display_name = $2,
         description = $3,
         logo_url = $4,
         country_codes = COALESCE($5::text[], country_codes),
         primary_language = $6,
         adapter_class_name = $7,
         publisher_config = COALESCE($8::jsonb, publisher_config),
         inbound_config = COALESCE($9::jsonb, inbound_config),
         validator_ref = $10,
         current_version = current_version + 1
       WHERE code = $1
       RETURNING *`,
      [
        code,
        next.display_name,
        next.description,
        next.logo_url,
        next.country_codes,
        next.primary_language,
        next.adapter_class_name,
        JSON.stringify(next.publisher_config || {}),
        JSON.stringify(next.inbound_config || {}),
        next.validator_ref,
      ],
    )
    const updated = updatedQ.rows[0]
    await insertVersionRow(client, updated, actorId)
    const beforeSnap = portalSnapshot(portal)
    const afterSnap = portalSnapshot(updated)
    const eventTypes = portalUpdateHistoryEventTypes(beforeSnap, afterSnap)
    for (const eventType of eventTypes) {
      await client.query(
        `INSERT INTO public.portal_activation_history (
           portal_code, event_type, submitter_user_id, notes, before_json, after_json
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
        [
          code,
          eventType,
          actorId || null,
          'registry version bump',
          JSON.stringify(beforeSnap),
          JSON.stringify(afterSnap),
        ],
      )
    }
    return updated
  })
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
    err.httpStatus = 404
    throw err
  }

  if (proposedIsActive) {
    assertActivationFilesPresent(portal)
  }

  const open = await getPendingActivation(portal.code)
  if (open) {
    const err = new Error('portal already has a pending activation request')
    err.code = 'PENDING_EXISTS'
    err.httpStatus = 409
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
      err.httpStatus = 404
      throw err
    }
    if (pending.state !== 'pending') {
      const err = new Error(`pending activation is ${pending.state}`)
      err.code = 'INVALID_STATE'
      err.httpStatus = 409
      throw err
    }

    if (String(pending.submitter_user_id) === String(reviewerId)) {
      const err = new Error('You cannot act on your own activation submission')
      err.code = 'OWN_SUBMISSION'
      err.httpStatus = 403
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

    if (approve && nextActive) {
      assertActivationFilesPresent(portal)
    }

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
                effective_from = COALESCE($3::timestamptz, NOW()),
                deprecated_at = CASE WHEN $2::boolean THEN NULL ELSE deprecated_at END
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

export async function withdrawPortalActivation({ portalCode, pendingId = null, actorId }) {
  return transaction(async (client) => {
    let pending
    if (pendingId) {
      const q = await client.query(
        `SELECT * FROM public.portal_registry_pending_activations WHERE id = $1 FOR UPDATE`,
        [pendingId],
      )
      pending = q.rows[0]
    } else {
      const q = await client.query(
        `SELECT * FROM public.portal_registry_pending_activations
          WHERE portal_code = $1 AND state = 'pending'
          FOR UPDATE`,
        [portalCode],
      )
      pending = q.rows[0]
    }
    if (!pending) {
      const err = new Error('pending activation not found')
      err.code = 'NOT_FOUND'
      err.httpStatus = 404
      throw err
    }
    if (pending.state !== 'pending') {
      const err = new Error(`pending activation is ${pending.state}`)
      err.code = 'INVALID_STATE'
      err.httpStatus = 409
      throw err
    }
    if (String(pending.submitter_user_id) !== String(actorId)) {
      const err = new Error('Only the submitter can withdraw this request')
      err.code = 'FORBIDDEN'
      err.httpStatus = 403
      throw err
    }

    await client.query(
      `UPDATE public.portal_registry_pending_activations
          SET state = 'withdrawn', resolved_at = NOW()
        WHERE id = $1`,
      [pending.id],
    )
    await client.query(
      `INSERT INTO public.portal_activation_history (
         portal_code, event_type, submitter_user_id, notes, before_json, after_json
       ) VALUES ($1,'withdrawn',$2,$3,$4::jsonb,$5::jsonb)`,
      [
        pending.portal_code,
        actorId,
        'withdrawn by submitter',
        JSON.stringify({ pending_id: pending.id, action: pending.action }),
        JSON.stringify({ state: 'withdrawn' }),
      ],
    )
    return { ...pending, state: 'withdrawn' }
  })
}

export async function deprecatePortal(code, { actorId, notes = null } = {}) {
  const portal = await getPortalByCode(code)
  if (!portal) {
    const err = new Error('portal not found')
    err.code = 'NOT_FOUND'
    err.httpStatus = 404
    throw err
  }
  if (portal.is_active) {
    const err = new Error('Portal must be deactivated before deprecation')
    err.code = 'STILL_ACTIVE'
    err.httpStatus = 400
    throw err
  }
  const rows = await query(
    `UPDATE public.portal_registry
        SET deprecated_at = COALESCE(deprecated_at, NOW())
      WHERE code = $1
      RETURNING *`,
    [code],
  )
  const updated = rows[0]
  await appendActivationHistory({
    portal_code: code,
    event_type: 'deprecated',
    submitter_user_id: actorId,
    notes: notes || 'deprecated',
    before_json: { deprecated_at: portal.deprecated_at },
    after_json: { deprecated_at: updated.deprecated_at },
  })
  return updated
}

export async function listPortalActivationHistory(portalCode, options) {
  if (!options || Object.keys(options).length === 0) {
    return query(
      `SELECT * FROM public.portal_activation_history
        WHERE portal_code = $1
        ORDER BY created_at DESC`,
      [portalCode],
    )
  }
  return listPortalActivationHistoryPage(portalCode, options)
}

export async function listPortalActivationHistoryPage(portalCode, {
  events = null,
  actor = null,
  from = null,
  to = null,
  page = 1,
  pageSize = 25,
} = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const params = [portalCode]
  const where = ['portal_code = $1']

  if (events && events.length && !events.includes('all')) {
    params.push(events)
    where.push(`event_type = ANY($${params.length}::text[])`)
  }
  if (actor) {
    params.push(actor)
    where.push(`(submitter_user_id = $${params.length} OR approver_user_id = $${params.length})`)
  }
  if (from) {
    params.push(from)
    where.push(`created_at >= $${params.length}::timestamptz`)
  }
  if (to) {
    params.push(to)
    where.push(`created_at <= $${params.length}::timestamptz`)
  }

  const whereSql = where.join(' AND ')
  const countRows = await query(
    `SELECT count(*)::int AS n FROM public.portal_activation_history WHERE ${whereSql}`,
    params,
  )
  const total = countRows[0]?.n || 0
  params.push(limit, offset)
  const rows = await query(
    `SELECT * FROM public.portal_activation_history
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  return { rows, total, page: Math.max(Number(page) || 1, 1), pageSize: limit }
}

/** Admin list with PA-POR-001 filters. Connected-agent counts stub to 0. */
export async function listPortalsAdmin({
  status = 'all',
  active = 'true',
  country = null,
  q = null,
  page = 1,
  pageSize = 25,
  sort = 'last_change:desc',
  envName = 'live',
} = {}) {
  const all = await query(`SELECT * FROM public.portal_registry ORDER BY code`)
  const enriched = []
  for (const row of all) {
    const adapterStatus = deriveAdapterStatus(row)
    const pending = await getPendingActivation(row.code)
    const lastHist = await query(
      `SELECT created_at, submitter_user_id, approver_user_id
         FROM public.portal_activation_history
        WHERE portal_code = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [row.code],
    )
    enriched.push({
      ...row,
      adapter_status: adapterStatus,
      pending_activation: pending || null,
      connected_agents_env: 0,
      connected_agents_env_name: envName,
      connected_agencies_env: 0,
      last_change_at: lastHist[0]?.created_at || row.updated_at || row.created_at,
      last_change_by: lastHist[0]
        ? { id: lastHist[0].approver_user_id || lastHist[0].submitter_user_id }
        : null,
      sla_hours: row.publisher_config?.sla_hours ?? null,
    })
  }

  let filtered = enriched
  if (status === 'live') filtered = filtered.filter((p) => p.adapter_status === 'live')
  else if (status === 'stub') filtered = filtered.filter((p) => p.adapter_status === 'stub')
  else if (status === 'deprecated') {
    filtered = filtered.filter((p) => p.adapter_status === 'deprecated' || p.deprecated_at)
  }

  if (active === 'true') filtered = filtered.filter((p) => p.is_active === true)
  else if (active === 'false') filtered = filtered.filter((p) => p.is_active === false)

  if (country) {
    const codes = String(country).split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    if (codes.length) {
      filtered = filtered.filter((p) => (
        (p.country_codes || []).some((c) => codes.includes(String(c).toUpperCase()))
      ))
    }
  }

  if (q && String(q).trim().length >= 2) {
    const needle = String(q).trim().toLowerCase()
    filtered = filtered.filter((p) => (
      String(p.code).toLowerCase().includes(needle)
      || String(p.display_name || '').toLowerCase().includes(needle)
      || String(p.adapter_class_name || '').toLowerCase().includes(needle)
    ))
  }

  const [sortField, sortDir] = String(sort || 'last_change:desc').split(':')
  const dir = sortDir === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    let av
    let bv
    if (sortField === 'code') { av = a.code; bv = b.code }
    else if (sortField === 'display_name') { av = a.display_name; bv = b.display_name }
    else if (sortField === 'connected') { av = a.connected_agents_env; bv = b.connected_agents_env }
    else if (sortField === 'country_count') {
      av = (a.country_codes || []).length
      bv = (b.country_codes || []).length
    } else {
      av = a.last_change_at ? new Date(a.last_change_at).getTime() : 0
      bv = b.last_change_at ? new Date(b.last_change_at).getTime() : 0
    }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })

  const countries = new Set()
  for (const p of enriched) {
    for (const c of p.country_codes || []) countries.add(c)
  }
  const counts = {
    total: enriched.length,
    live: enriched.filter((p) => p.adapter_status === 'live').length,
    stub: enriched.filter((p) => p.adapter_status === 'stub').length,
    deprecated: enriched.filter((p) => p.adapter_status === 'deprecated' || p.deprecated_at).length,
    countries_covered: countries.size,
  }

  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const pageNum = Math.max(Number(page) || 1, 1)
  const offset = (pageNum - 1) * limit
  const pageRows = filtered.slice(offset, offset + limit)

  return {
    portals: pageRows,
    pagination: {
      page: pageNum,
      page_size: limit,
      total: filtered.length,
      has_next: offset + limit < filtered.length,
    },
    counts,
  }
}

export function serializePortalAdmin(row, { envName = 'live' } = {}) {
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    display_name: row.display_name,
    description: row.description,
    logo_url: row.logo_url,
    country_codes: row.country_codes || [],
    primary_language: row.primary_language,
    adapter_class_name: row.adapter_class_name,
    adapter_status: row.adapter_status || deriveAdapterStatus(row),
    publisher_config: row.publisher_config || {},
    inbound_config: row.inbound_config || {},
    validator_ref: row.validator_ref,
    is_active: row.is_active,
    current_version: row.current_version ?? 1,
    connected_agents_env: row.connected_agents_env ?? 0,
    connected_agents_env_name: row.connected_agents_env_name || envName,
    connected_agencies_env: row.connected_agencies_env ?? 0,
    last_change_at: row.last_change_at || row.updated_at || null,
    last_change_by: row.last_change_by || null,
    pending_activation: row.pending_activation || null,
    sla_hours: row.sla_hours ?? row.publisher_config?.sla_hours ?? null,
    deprecated_at: row.deprecated_at,
    effective_from: row.effective_from,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
