-- Post-strip cleanup — back-fill FK constraints and sign CHECKs that were
-- reserved-but-forgotten across Stages 1 / 4 / 5 / 8 / 9 / 10.
--
-- Six FK columns were declared as UUID-without-FK during earlier stages
-- because their parent tables did not yet exist (DL-071, DL-080, and
-- equivalent placeholders on fin.lots and fin.usage_limits). The parent
-- tables shipped in Stages 2-10 but the ALTER TABLE follow-ups were never
-- landed. This migration adds them.
--
-- Three sign CHECKs were also missing on money/unit columns that should
-- never be negative in normal operation:
--   fin.lots.consideration_minor          (>= 0)
--   fin.lots.granted_units                (>  0)
--   fin.limit_counters.consumed_units     (>= 0)
--
-- Safe on a fresh DB. On a dev DB carrying test fixtures, ALTER TABLE ADD
-- CONSTRAINT will fail loudly if any orphan row or negative-value row
-- exists — that is data hygiene, not a migration bug. Clean the offending
-- rows and re-run.

-- ---- Foreign keys ----

-- Stage 4 (fin.contracts) shipped fin.credit_facilities in Stage 8.
-- DL-071 header of 116_fin_contracts.sql: "facility_id is UUID without FK
-- until Stage 8 creates fin.credit_facilities". Stage 8 did; the ALTER
-- never landed.
ALTER TABLE fin.contract_components
  ADD CONSTRAINT fk_contract_components_facility
  FOREIGN KEY (facility_id) REFERENCES fin.credit_facilities(id);

-- DL-080 header of 118_fin_rated_usage.sql: "billing_period_id /
-- accounting_period_id are reserved UUIDs without FK until Stage 10 /
-- Stage 9". Stage 10's migration 200 back-filled billing_period_id;
-- Stage 9's follow-up back-filled accounting_events.accounting_period_id
-- but not rated_usage.accounting_period_id.
ALTER TABLE fin.rated_usage
  ADD CONSTRAINT fk_rated_usage_accounting_period
  FOREIGN KEY (accounting_period_id) REFERENCES fin.accounting_periods(id);

-- fin.lots.contract_id was declared nullable UUID in 105_fin_lots.sql
-- (Stage 1) before fin.contracts existed. fin.contracts landed in
-- 116_fin_contracts.sql (Stage 4).
ALTER TABLE fin.lots
  ADD CONSTRAINT fk_lots_contract
  FOREIGN KEY (contract_id) REFERENCES fin.contracts(id);

-- fin.lots.purchase_intent_id was declared nullable UUID in 105_fin_lots.sql
-- (Stage 1) before fin.purchase_intents existed. fin.purchase_intents landed
-- in 170_fin_purchase_intents.sql (Stage 7).
ALTER TABLE fin.lots
  ADD CONSTRAINT fk_lots_purchase_intent
  FOREIGN KEY (purchase_intent_id) REFERENCES fin.purchase_intents(id);

-- fin.usage_limits.contract_component_id was declared nullable UUID in
-- 105_fin_lots.sql (Stage 1) before fin.contract_components existed.
-- fin.contract_components landed in 116_fin_contracts.sql (Stage 4).
ALTER TABLE fin.usage_limits
  ADD CONSTRAINT fk_usage_limits_contract_component
  FOREIGN KEY (contract_component_id) REFERENCES fin.contract_components(id);

-- fin.usage_limits.meter_id was declared nullable UUID in 105_fin_lots.sql
-- (Stage 1) before fin.meters existed. fin.meters landed in 112_fin_meters.sql
-- (Stage 2).
ALTER TABLE fin.usage_limits
  ADD CONSTRAINT fk_usage_limits_meter
  FOREIGN KEY (meter_id) REFERENCES fin.meters(id);

-- ---- Sign CHECKs ----

-- consideration_minor is the amount paid (or notionally paid) to bring a
-- lot into existence. Zero is legitimate for free grants (PROMOTIONAL_GRANT,
-- SUBSCRIPTION_GRANT). Negative is never valid.
ALTER TABLE fin.lots
  ADD CONSTRAINT chk_lots_consideration_nonneg
  CHECK (consideration_minor >= 0);

-- granted_units must be positive. A zero-unit lot is nonsensical (the
-- existing CHECK (remaining_units <= granted_units) already forces
-- remaining to 0 in that case, so no value is ever available to draw).
ALTER TABLE fin.lots
  ADD CONSTRAINT chk_lots_granted_positive
  CHECK (granted_units > 0);

-- limit_counters track period usage; they only ever increase within a
-- period. Negative consumed_units would indicate a broken counter.
ALTER TABLE fin.limit_counters
  ADD CONSTRAINT chk_limit_counters_consumed_nonneg
  CHECK (consumed_units >= 0);
