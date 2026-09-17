-- T4 — Fine-grained per-resource token scope (H2 v2).
--
-- H2 shipped action scopes (`listings:write`). GitHub fine-grained PAT and
-- Stripe restricted keys go a step further: a token can be limited to a
-- SPECIFIC resource ("this token can only touch repo X" or "this token can
-- only charge on account Y"). WingCaster's token surface adds that with a
-- `resource_scopes` JSONB column.
--
-- Shape: array of `{ resource_type, resource_id }` records. Empty array =
-- no per-resource restriction (matches every action-scope check).
-- Example: `[{"resource_type":"agency","resource_id":"agency-abc"}]` means
-- the token can only act on that one agency. The route middleware validates
-- the incoming request's target against this list at runtime.

ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS resource_scopes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN api_tokens.resource_scopes IS
  'Optional per-resource restriction: array of {resource_type, resource_id}. Empty = no restriction. Enforced by requireApiTokenResource middleware.';
