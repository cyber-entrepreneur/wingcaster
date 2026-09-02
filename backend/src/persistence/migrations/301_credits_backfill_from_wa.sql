-- PR A — backfill credit_wallets / grants / consumptions from whatsapp-listings
-- ai_credit_* tables, then rename the legacy tables for one release cycle.
--
-- Deviation: tenant mapping uses public.tenants (personal_owner_user_id /
-- agency_id / 'personal:'||id / 'agency:'||id) then fin.tenants, with a
-- deterministic synthetic UUID when no fin tenant exists. Spec's
-- `fin.tenants.public_tenant_id = scope_id` join does not match the
-- 'personal:' / 'agency:' public tenant id format.
--
-- Deviation: NUMERIC(12,6) amounts are scaled by 100 (centi-credits) into
-- BIGINT so 0.05 / 0.02 pipeline costs survive as 5 / 2. Reserved balances
-- are zeroed (no reservation rows existed to satisfy R111).
--
-- Deviation: a balancing migration grant/consumption is inserted so R110
-- holds after copy (legacy remaining was a cache, not sum(txs)).

INSERT INTO public.credit_wallets (
  tenant_id, currency, credits_remaining, credits_reserved,
  scope, scope_id, fin_tenant_id, updated_at
)
SELECT DISTINCT ON (b.scope, b.scope_id)
  COALESCE(ft.id, public.credit_synthetic_tenant_id(b.scope, b.scope_id)) AS tenant_id,
  'USD',
  GREATEST(ROUND(COALESCE(b.credits_remaining, 0) * 100), 0)::bigint,
  0::bigint,
  b.scope,
  b.scope_id,
  ft.id,
  COALESCE(b.updated_at, NOW())
FROM public.ai_credit_balances b
LEFT JOIN public.tenants pt ON (
  (b.scope = 'agent' AND (
    pt.personal_owner_user_id = b.scope_id
    OR pt.id = b.scope_id
    OR pt.id = ('personal:' || b.scope_id)
  ))
  OR
  (b.scope = 'agency' AND (
    pt.agency_id = b.scope_id
    OR pt.id = b.scope_id
    OR pt.id = ('agency:' || b.scope_id)
  ))
)
LEFT JOIN fin.tenants ft ON ft.public_tenant_id = pt.id
WHERE b.scope IN ('agent', 'agency')
ORDER BY b.scope, b.scope_id, ft.id NULLS LAST
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO fin.reconciliation_notes (id, note, data, created_at)
SELECT gen_random_uuid(),
       'credits migration: unmapped wallet (no fin.tenants row)',
       jsonb_build_object(
         'scope', w.scope,
         'scope_id', w.scope_id,
         'tenant_id', w.tenant_id
       ),
       NOW()
FROM public.credit_wallets w
WHERE w.fin_tenant_id IS NULL
  AND w.scope IS NOT NULL;

-- Grants from top_up and refund (both increase remaining).
INSERT INTO public.credit_grants (
  id, tenant_id, source, amount, currency, grant_ref, granted_at, data
)
SELECT
  CASE
    WHEN x.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN x.id::uuid
    ELSE gen_random_uuid()
  END,
  w.tenant_id,
  'migration',
  GREATEST(ROUND(ABS(COALESCE(x.amount, 0)) * 100), 1)::bigint,
  'USD',
  jsonb_build_object(
    'legacy_transaction_id', x.id,
    'legacy_description', x.description,
    'legacy_type', x.type,
    'idempotency_key', 'migration:' || x.id
  ),
  COALESCE(x.created_at, NOW()),
  COALESCE(x.data, '{}'::jsonb)
FROM public.ai_credit_transactions x
JOIN public.credit_wallets w
  ON w.scope = x.scope AND w.scope_id = x.scope_id
WHERE x.type IN ('top_up', 'refund')
  AND COALESCE(x.amount, 0) > 0
ON CONFLICT DO NOTHING;

-- Consumptions
INSERT INTO public.credit_consumptions (
  id, tenant_id, feature, call_type, request_id, credits_amount,
  related_entity_type, related_entity_id, consumed_at, data
)
SELECT
  CASE
    WHEN x.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN x.id::uuid
    ELSE gen_random_uuid()
  END,
  w.tenant_id,
  'whatsapp-listings',
  'draft',
  'legacy:' || x.id,
  GREATEST(ROUND(ABS(COALESCE(x.amount, 0)) * 100), 1)::bigint,
  CASE WHEN x.related_draft_id IS NULL THEN NULL ELSE 'draft' END,
  x.related_draft_id,
  COALESCE(x.created_at, NOW()),
  COALESCE(x.data, '{}'::jsonb)
FROM public.ai_credit_transactions x
JOIN public.credit_wallets w
  ON w.scope = x.scope AND w.scope_id = x.scope_id
WHERE x.type = 'consumption'
  AND COALESCE(x.amount, 0) <> 0
ON CONFLICT DO NOTHING;

-- Balancing grant (positive gap) so remaining == SUM(grants) - SUM(consumptions).
INSERT INTO public.credit_grants (
  id, tenant_id, source, amount, currency, grant_ref, granted_at, data
)
SELECT
  gen_random_uuid(),
  w.tenant_id,
  'migration',
  gap.amount,
  w.currency,
  jsonb_build_object(
    'idempotency_key', 'migration-balance-grant:' || w.tenant_id::text,
    'reason', 'R110 balance after legacy cache copy'
  ),
  NOW(),
  '{}'::jsonb
FROM public.credit_wallets w
JOIN LATERAL (
  SELECT (w.credits_remaining
          - COALESCE((SELECT SUM(g.amount) FROM public.credit_grants g WHERE g.tenant_id = w.tenant_id), 0)
          + COALESCE((SELECT SUM(c.credits_amount) FROM public.credit_consumptions c WHERE c.tenant_id = w.tenant_id), 0)
         )::bigint AS amount
) gap ON TRUE
WHERE gap.amount > 0;

-- Balancing consumption (negative gap).
INSERT INTO public.credit_consumptions (
  id, tenant_id, feature, call_type, request_id, credits_amount, consumed_at, data
)
SELECT
  gen_random_uuid(),
  w.tenant_id,
  'whatsapp-listings',
  'migration_balance',
  'legacy-balance:' || w.tenant_id::text,
  (-gap.amount)::bigint,
  NOW(),
  jsonb_build_object('reason', 'R110 balance after legacy cache copy')
FROM public.credit_wallets w
JOIN LATERAL (
  SELECT (w.credits_remaining
          - COALESCE((SELECT SUM(g.amount) FROM public.credit_grants g WHERE g.tenant_id = w.tenant_id), 0)
          + COALESCE((SELECT SUM(c.credits_amount) FROM public.credit_consumptions c WHERE c.tenant_id = w.tenant_id), 0)
         )::bigint AS amount
) gap ON TRUE
WHERE gap.amount < 0;

ALTER TABLE public.ai_credit_balances RENAME TO ai_credit_balances_deprecated_20260902;
ALTER TABLE public.ai_credit_transactions RENAME TO ai_credit_transactions_deprecated_20260902;
