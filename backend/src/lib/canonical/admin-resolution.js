import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../../db.js'

function canonicalData(row) {
  if (!row?.data || typeof row.data !== 'object') return {}
  return row.data
}

function appendAudit(data, entry) {
  const audit = Array.isArray(data.resolution_audit) ? [...data.resolution_audit] : []
  audit.unshift(entry)
  return { ...data, resolution_audit: audit.slice(0, 50) }
}

async function loadCanonical(id) {
  const rows = await query(
    `SELECT id, primary_listing_id, location, city, neighborhood, latitude, longitude,
            created_at, updated_at, data
       FROM canonical_properties
      WHERE id = $1`,
    [id],
  )
  return rows[0] || null
}

async function loadSiblings(canonicalId) {
  return query(
    `SELECT p.id, p.title, p.price, p.price_unit, p.status, p.agent_id, p.agency_id,
            p.updated_at, p.created_at,
            COALESCE(p.data->>'listed_date', '') AS listed_date,
            COALESCE(p.data->>'photos', '') AS photos,
            a.name AS agent_name,
            ag.name AS agency_name
       FROM properties p
       LEFT JOIN agents a ON a.id = p.agent_id
       LEFT JOIN agencies ag ON ag.id = p.agency_id
      WHERE p.canonical_id = $1
        AND COALESCE(p.status, 'active') <> 'deleted'
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC`,
    [canonicalId],
  )
}

function mapQueueRow(row) {
  const data = canonicalData(row)
  return {
    id: row.id,
    address: row.address_label || row.location || row.city || row.id,
    city: row.city,
    neighborhood: row.neighborhood,
    sibling_count: Number(row.sibling_count || 0),
    primary_listing_id: row.primary_listing_id,
    primary_agency_name: row.primary_agency_name,
    on_hold: Boolean(data.resolution_hold),
    dispute_count: Math.max(0, Number(row.sibling_count || 0) - 1),
    updated_at: row.updated_at,
  }
}

export async function listCanonicalResolutionQueue() {
  const rows = await query(
    `SELECT cp.id,
            cp.primary_listing_id,
            cp.location,
            cp.city,
            cp.neighborhood,
            cp.updated_at,
            cp.data,
            COUNT(p.id)::int AS sibling_count,
            primary_ag.name AS primary_agency_name,
            COALESCE(cp.location, cp.city, cp.neighborhood, cp.id) AS address_label
       FROM canonical_properties cp
       JOIN properties p ON p.canonical_id = cp.id
         AND COALESCE(p.status, 'active') <> 'deleted'
       LEFT JOIN properties primary_p ON primary_p.id = cp.primary_listing_id
       LEFT JOIN agencies primary_ag ON primary_ag.id = primary_p.agency_id
      GROUP BY cp.id, primary_ag.name
     HAVING COUNT(p.id) >= 2
         OR COALESCE((cp.data->>'resolution_hold')::boolean, false) = true
         OR COALESCE((cp.data->>'ungroup_override')::boolean, false) = true
      ORDER BY COALESCE((cp.data->>'resolution_hold')::boolean, false) DESC,
               COUNT(p.id) DESC,
               cp.updated_at DESC
      LIMIT 200`,
  )
  return rows.map(mapQueueRow)
}

export async function getCanonicalResolutionDetail(id) {
  const canonical = await loadCanonical(id)
  if (!canonical) return null
  const siblings = await loadSiblings(id)
  const data = canonicalData(canonical)
  const primary = siblings.find((row) => row.id === canonical.primary_listing_id) || siblings[0] || null
  return {
    id: canonical.id,
    primary_listing_id: canonical.primary_listing_id,
    location: canonical.location,
    city: canonical.city,
    neighborhood: canonical.neighborhood,
    on_hold: Boolean(data.resolution_hold),
    hold_reason: data.hold_reason || null,
    siblings: siblings.map((row) => ({
      id: row.id,
      title: row.title,
      price: row.price,
      price_unit: row.price_unit,
      status: row.status,
      agent_name: row.agent_name,
      agency_name: row.agency_name,
      listed_date: row.listed_date,
      photos: row.photos,
      updated_at: row.updated_at,
      is_primary: row.id === canonical.primary_listing_id,
    })),
    primary_agency_name: primary?.agency_name || null,
    dispute_count: Math.max(0, siblings.length - 1),
    updated_at: canonical.updated_at,
  }
}

export async function changeCanonicalPrimary({ canonicalId, listingId, reason, actorId }) {
  if (!listingId) throw Object.assign(new Error('listing_id required'), { status: 400, code: 'LISTING_ID_REQUIRED' })
  return transaction(async (client) => {
    const canonical = (await client.query(
      `SELECT id, data FROM canonical_properties WHERE id = $1 FOR UPDATE`,
      [canonicalId],
    )).rows[0]
    if (!canonical) throw Object.assign(new Error('Canonical property not found'), { status: 404 })
    const sibling = (await client.query(
      `SELECT id FROM properties
        WHERE id = $1 AND canonical_id = $2 AND COALESCE(status, 'active') <> 'deleted'`,
      [listingId, canonicalId],
    )).rows[0]
    if (!sibling) throw Object.assign(new Error('Listing is not a sibling of this canonical'), { status: 400 })
    const data = appendAudit(canonicalData(canonical), {
      action: 'change_primary',
      listing_id: listingId,
      reason,
      actor_id: actorId,
      at: new Date().toISOString(),
    })
    await client.query(
      `UPDATE canonical_properties
          SET primary_listing_id = $2,
              data = $3::jsonb,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [canonicalId, listingId, JSON.stringify(data)],
    )
    return { id: canonicalId, primary_listing_id: listingId }
  })
}

export async function splitCanonicalListing({ canonicalId, listingId, reason, actorId }) {
  if (!listingId) throw Object.assign(new Error('listing_id required'), { status: 400, code: 'LISTING_ID_REQUIRED' })
  return transaction(async (client) => {
    const canonical = (await client.query(
      `SELECT * FROM canonical_properties WHERE id = $1 FOR UPDATE`,
      [canonicalId],
    )).rows[0]
    if (!canonical) throw Object.assign(new Error('Canonical property not found'), { status: 404 })
    const listing = (await client.query(
      `SELECT * FROM properties
        WHERE id = $1 AND canonical_id = $2 AND COALESCE(status, 'active') <> 'deleted'
        FOR UPDATE`,
      [listingId, canonicalId],
    )).rows[0]
    if (!listing) throw Object.assign(new Error('Listing is not a sibling of this canonical'), { status: 400 })
    const newCanonicalId = uuidv4()
    const splitData = {
      split_from: canonicalId,
      ungroup_override: true,
      resolution_audit: [{
        action: 'split',
        listing_id: listingId,
        reason,
        actor_id: actorId,
        at: new Date().toISOString(),
      }],
    }
    await client.query(
      `INSERT INTO canonical_properties (
         id, primary_listing_id, location, latitude, longitude, city, neighborhood, data, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        newCanonicalId,
        listingId,
        listing.location || canonical.location,
        listing.latitude ?? canonical.latitude,
        listing.longitude ?? canonical.longitude,
        listing.city || canonical.city,
        listing.neighborhood || canonical.neighborhood,
        JSON.stringify(splitData),
      ],
    )
    await client.query(
      `UPDATE properties SET canonical_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [listingId, newCanonicalId],
    )
    const sourceData = appendAudit(canonicalData(canonical), {
      action: 'split_listing',
      listing_id: listingId,
      new_canonical_id: newCanonicalId,
      reason,
      actor_id: actorId,
      at: new Date().toISOString(),
    })
    let nextPrimary = canonical.primary_listing_id
    if (nextPrimary === listingId) {
      const remaining = (await client.query(
        `SELECT id FROM properties
          WHERE canonical_id = $1 AND id <> $2 AND COALESCE(status, 'active') <> 'deleted'
          ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [canonicalId, listingId],
      )).rows[0]
      nextPrimary = remaining?.id || null
    }
    await client.query(
      `UPDATE canonical_properties
          SET primary_listing_id = $2,
              data = $3::jsonb,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [canonicalId, nextPrimary, JSON.stringify(sourceData)],
    )
    return { id: canonicalId, split_listing_id: listingId, new_canonical_id: newCanonicalId }
  })
}

export async function mergeCanonicalProperties({ canonicalId, targetCanonicalId, reason, actorId }) {
  if (!targetCanonicalId) {
    throw Object.assign(new Error('target_canonical_id required'), { status: 400, code: 'TARGET_REQUIRED' })
  }
  if (targetCanonicalId === canonicalId) {
    throw Object.assign(new Error('Cannot merge a canonical into itself'), { status: 400, code: 'SAME_TARGET' })
  }
  return transaction(async (client) => {
    const source = (await client.query(
      `SELECT * FROM canonical_properties WHERE id = $1 FOR UPDATE`,
      [canonicalId],
    )).rows[0]
    const target = (await client.query(
      `SELECT * FROM canonical_properties WHERE id = $1 FOR UPDATE`,
      [targetCanonicalId],
    )).rows[0]
    if (!source || !target) throw Object.assign(new Error('Canonical property not found'), { status: 404 })
    await client.query(
      `UPDATE properties
          SET canonical_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE canonical_id = $1`,
      [canonicalId, targetCanonicalId],
    )
    const targetData = appendAudit(canonicalData(target), {
      action: 'merge_source',
      source_canonical_id: canonicalId,
      reason,
      actor_id: actorId,
      at: new Date().toISOString(),
    })
    await client.query(
      `UPDATE canonical_properties
          SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [targetCanonicalId, JSON.stringify(targetData)],
    )
    await client.query(`DELETE FROM canonical_properties WHERE id = $1`, [canonicalId])
    return { merged_into: targetCanonicalId, removed: canonicalId }
  })
}

export async function holdCanonicalResolution({ canonicalId, reason, release, actorId }) {
  return transaction(async (client) => {
    const canonical = (await client.query(
      `SELECT id, data FROM canonical_properties WHERE id = $1 FOR UPDATE`,
      [canonicalId],
    )).rows[0]
    if (!canonical) throw Object.assign(new Error('Canonical property not found'), { status: 404 })
    const data = canonicalData(canonical)
    const next = release
      ? appendAudit({ ...data, resolution_hold: false, hold_reason: null }, {
        action: 'release_hold',
        reason,
        actor_id: actorId,
        at: new Date().toISOString(),
      })
      : appendAudit({
        ...data,
        resolution_hold: true,
        hold_reason: reason || 'Investigation pending',
      }, {
        action: 'hold',
        reason,
        actor_id: actorId,
        at: new Date().toISOString(),
      })
    await client.query(
      `UPDATE canonical_properties
          SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [canonicalId, JSON.stringify(next)],
    )
    return { id: canonicalId, on_hold: Boolean(next.resolution_hold) }
  })
}
