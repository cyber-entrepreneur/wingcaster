-- One-time free-trial claim per identity. Hashes persist after user delete.
-- Partial unique indexes: a support-waived row does not block a new claim.
--
-- Support waive (manual DB write only — no HTTP endpoint):
--   UPDATE public.free_trial_claims
--      SET waived_at = NOW(),
--          waived_reason = 'Support ticket #NNNN: <reason>'
--    WHERE id = '<claim-id>';

CREATE TABLE IF NOT EXISTS public.free_trial_claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_hash TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  username_hash TEXT NOT NULL,
  original_user_id TEXT,
  original_email TEXT,
  original_phone TEXT,
  original_username TEXT,
  waived_at TIMESTAMPTZ,
  waived_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_email_hash
  ON public.free_trial_claims (email_hash)
  WHERE waived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_phone_hash
  ON public.free_trial_claims (phone_hash)
  WHERE waived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_username_hash
  ON public.free_trial_claims (username_hash)
  WHERE waived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ftc_original_user
  ON public.free_trial_claims (original_user_id);

-- Backfill identities that already hold an open free-tier subscription.
-- Missing phone/username get a per-user absent hash so empty values do not collide.
INSERT INTO public.free_trial_claims (
  id, claimed_at, email_hash, phone_hash, username_hash,
  original_user_id, original_email, original_phone, original_username
)
SELECT
  gen_random_uuid()::text,
  NOW(),
  encode(digest(lower(trim(u.email)), 'sha256'), 'hex'),
  encode(
    digest(
      CASE
        WHEN u.phone IS NULL OR btrim(u.phone) = '' THEN 'absent:phone:' || u.id
        ELSE '+' || regexp_replace(u.phone, '\D', '', 'g')
      END,
      'sha256'
    ),
    'hex'
  ),
  encode(
    digest(
      CASE
        WHEN NULLIF(btrim(COALESCE(a.slug, '')), '') IS NOT NULL
          THEN lower(btrim(normalize(a.slug, NFKC)))
        ELSE 'absent:username:' || u.id
      END,
      'sha256'
    ),
    'hex'
  ),
  u.id,
  u.email,
  u.phone,
  COALESCE(NULLIF(btrim(a.slug), ''), u.name)
FROM public.users u
LEFT JOIN public.agents a ON a.user_id = u.id
JOIN public.credit_wallets w
  ON w.scope = 'personal' AND w.scope_id = u.id
JOIN public.tenant_subscriptions s
  ON s.tenant_id = w.tenant_id
 AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
JOIN public.product_package_versions v ON v.id = s.package_version_id
JOIN public.product_packages p ON p.id = v.package_id AND p.tier = 'free'
WHERE NOT EXISTS (
  SELECT 1 FROM public.free_trial_claims c WHERE c.original_user_id = u.id
);

DO $$
DECLARE
  inserted int;
BEGIN
  SELECT COUNT(*)::int INTO inserted FROM public.free_trial_claims;
  IF inserted = 0 THEN
    RAISE NOTICE 'free_trial_claims backfill: no existing free-tier users; skipped';
  ELSE
    RAISE NOTICE 'free_trial_claims backfill: table now has % row(s)', inserted;
  END IF;
END $$;
