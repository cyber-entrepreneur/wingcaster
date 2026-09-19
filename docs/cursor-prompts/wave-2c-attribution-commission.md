# Wave 2C — Attribution & Commission Engine (the moat)

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged (Wave 1 must be emitting business/engagement Events per `docs/event-taxonomy-catalog.md`). Migration block: **730–749**.

## MISSION
Turn the Event spine into WingCaster's differentiator: attribute the real-estate funnel — impression → click → lead → qualified → viewing → offer → transaction → **commission** — so the platform reports *which marketing produced property revenue*, not "Instagram engagement."

Read `docs/canonical-object-model.md` §H (Conversion, AttributionCredit), `docs/event-taxonomy-catalog.md` (§4A business, §5 funnel mapping, §5B causal vs contextual), and `docs/campaign-and-social-publishing-reconciliation.md` Diagram 3.

## SCOPE — BACKEND
1. **Migrations (730–749):** `conversions` (attribution-neutral business transition: `id · contact_id · from_stage · to_stage · occurred_at · value_micros · currency`, **no authoritative primary execution**) and `attribution_credits` (`id · conversion_id · execution_id(touchpoint) · model(last/first/linear/position/data_driven) · credit_weight`). RLS on both.
2. **Conversion materialiser:** consume `events` (business/engagement) → create `Conversion` rows for each funnel transition (per §5 mapping). Idempotent (a given business Event yields at most one Conversion).
3. **Attribution engine:** given a Conversion, gather the correlated touchpoint Events (`execution_id`, via `correlation_id`/`causation_event_id`), and compute `attribution_credits` per model. **Re-runnable** — recomputing a model rewrites only its credit rows, never mutates Conversions. Launch: `last_touch`/`first_touch`/`linear`/`position_based`. `data_driven` = fast-follow stub that errors clearly if unconfigured (no fake output).
4. **Commission linkage:** `transaction.closed`/`commission.earned` values are **read/attested from the finance ledger** (do not recompute in marketing). Define the read boundary explicitly (canonical-model open Q).
5. **Campaign rollups:** derive per-Campaign (and per-Execution for standalone) metrics — leads · qualified · viewings · offers · reservations · transactions · GTV · commission · marketing cost · **ROI/ROAS** — from Conversions + AttributionCredits + cost (spend from paid Executions / MetricObservation). Respect P1: standalone Executions with `campaign_id = NULL` still attribute via `execution_id` — never fabricate a campaign.

## SCOPE — FRONTEND
1. Campaign performance view: the funnel + commission/ROAS, with an attribution-model switcher (recompute view without changing data).
2. A per-property / per-execution attribution drill-down (the causal chain).
3. `--lc-*` tokens; accessible; responsive.

## OUT OF SCOPE
Experiment analysis (2D). Data-driven attribution modelling (fast-follow). Paid spend ingestion beyond reading what 2A/MetricObservation record.

## ACCEPTANCE CRITERIA
- [ ] Business Events materialise Conversions idempotently across the full funnel.
- [ ] AttributionCredits computed per model; switching models recomputes credits without touching Conversions.
- [ ] `execution_id` is the attribution key; `campaign_id = NULL` executions still attribute (P1). No fabricated campaigns.
- [ ] Commission/GTV values sourced from the finance ledger, not recomputed.
- [ ] Campaign rollups (funnel → commission → ROAS) correct; tenant-isolated via `withTenant`.

## TEST MATRIX
1. Funnel Events → correct Conversions; re-ingest → no duplicate Conversions.
2. last/first/linear/position credits sum correctly per Conversion; model switch re-runs cleanly.
3. Standalone (no-campaign) Execution attributes via execution_id.
4. Commission rollup matches ledger fixture; ROAS math correct.
5. Tenant isolation on conversions/attribution_credits.
