-- Add `updated_at` to the remaining DAL-mapped tables that never had it.
--
-- The DAL treats `id`, `created_at`, `updated_at` and `data` as present on
-- every table it maps: `columnNames()` always names all four, and both INSERT
-- and UPDATE stamp `updated_at` explicitly. A mapped table without the column
-- therefore fails EVERY write with
--
--   column "updated_at" of relation "<table>" does not exist
--
-- These are all append-only log/history tables, which is why nobody noticed a
-- missing "last modified" column — but the DAL still names it, so the writes
-- fail regardless of whether the value is ever meaningful.
--
-- This is not a new problem or a new remedy: migrations 016, 019, 020, 029 and
-- 037 each patched the same gap for other tables as it surfaced. This one
-- closes the remainder, found once the gated Postgres suite could actually run
-- for the first time.
--
-- Affected (all confirmed present in table-mapper.js):
--   public.distribution_attempts, public.price_history, public.sync_logs,
--   public.webhook_delivery_log, market_pricing.csv_import_logs
--
-- DL-244: billing_subscription_history and notification_events ALTERs
-- that targeted the retired billing schema were removed with that strip.
-- notification_events now lives in public and is created with updated_at
-- in migration 040.

ALTER TABLE distribution_attempts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE webhook_delivery_log
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE market_pricing.csv_import_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
