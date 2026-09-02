import { createHash } from 'node:crypto'
import { query, transaction } from '../../db.js'

/**
 * Must match public.credit_synthetic_tenant_id() in migration 300.
 */
export function syntheticTenantId(scope, scopeId) {
  const hex = createHash('md5').update(`${scope}:${scopeId}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(12, 15)}-8${hex.slice(16, 19)}-${hex.slice(20, 32)}`
}

export async function lookupFinTenantId(client, scope, scopeId) {
  const sql = scope === 'agency'
    ? `SELECT ft.id
         FROM public.tenants pt
         JOIN fin.tenants ft ON ft.public_tenant_id = pt.id
        WHERE pt.agency_id = $1 OR pt.id = $1 OR pt.id = ('agency:' || $1)
        LIMIT 1`
    : `SELECT ft.id
         FROM public.tenants pt
         JOIN fin.tenants ft ON ft.public_tenant_id = pt.id
        WHERE pt.personal_owner_user_id = $1 OR pt.id = $1 OR pt.id = ('personal:' || $1)
        LIMIT 1`
  const { rows } = await client.query(sql, [String(scopeId)])
  return rows[0]?.id || null
}

export async function resolveWalletIdentity(scope, scopeId) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT tenant_id, fin_tenant_id FROM public.credit_wallets
        WHERE scope = $1 AND scope_id = $2`,
      [scope, String(scopeId)],
    )
    if (existing.rows[0]) return existing.rows[0].tenant_id
    const finTenantId = await lookupFinTenantId(client, scope, String(scopeId))
    return finTenantId || syntheticTenantId(scope, String(scopeId))
  })
}

export async function lockWallet(client, tenantId) {
  const { rows } = await client.query(
    `SELECT * FROM public.credit_wallets WHERE tenant_id = $1 FOR UPDATE`,
    [tenantId],
  )
  return rows[0] || null
}

export async function ensureWallet(client, {
  tenantId,
  currency = 'USD',
  scope = null,
  scopeId = null,
  finTenantId = null,
}) {
  const locked = await lockWallet(client, tenantId)
  if (locked) return locked
  try {
    const inserted = await client.query(
      `INSERT INTO public.credit_wallets (
         tenant_id, currency, credits_remaining, credits_reserved,
         scope, scope_id, fin_tenant_id, updated_at
       ) VALUES ($1, $2, 0, 0, $3, $4, $5, NOW())
       RETURNING *`,
      [tenantId, currency, scope, scopeId, finTenantId],
    )
    return inserted.rows[0]
  } catch (error) {
    if (error.code !== '23505') throw error
    const again = await lockWallet(client, tenantId)
    if (again) return again
    if (scope && scopeId) {
      const byScope = await client.query(
        `SELECT * FROM public.credit_wallets WHERE scope = $1 AND scope_id = $2 FOR UPDATE`,
        [scope, scopeId],
      )
      if (byScope.rows[0]) return byScope.rows[0]
    }
    throw error
  }
}

export { query }
