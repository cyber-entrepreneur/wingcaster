# Wave 2D — Experimentation (A/B/n + holdouts)

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged; 2C helpful (results read Conversions). Migration block: **750–769**.

## MISSION
Let agents test what actually drives the funnel — creative, copy, CTA, channel, timing, journey path — with reproducible assignment and holdouts, measured against **funnel outcomes, not clicks**.

Read `docs/canonical-object-model.md` §H (Experiment, ExperimentAssignment) and `docs/event-taxonomy-catalog.md` (results derive from Events/Conversions).

## SCOPE — BACKEND
1. **Migrations (750–769):** `experiments` (`id · campaign_id? · dimension(creative/copy/cta/channel/timing/journey_path) · variants JSONB · allocation(even/bandit) · holdout_pct · goal_event · status(draft/running/concluded) · result JSONB`) and `experiment_assignments` (`id · experiment_id · contact_id · variant · assigned_at · assignment_reason · model_version`). RLS on both.
2. **Assignment engine:** deterministic assignment (stable hash of contact×experiment) for `even`; pluggable interface for `bandit` (fast-follow — implement `even` fully, `bandit` behind a clear `NOT_CONFIGURED` error, no fake). Honour `holdout_pct` (a held-out control that receives nothing / the default). Record every assignment in `experiment_assignments` with reason + `model_version` for reproducibility.
3. **Wiring:** Executions (1B/2A) and Creatives (1C) and Journey nodes (1A) carry `experiment_id` + `variant_key`; the composer/journey picks the assigned variant. Events already carry `execution_id`, so results tie back through 2C Conversions.
4. **Results:** compute per-variant funnel outcomes (from Conversions, per `goal_event`) + significance (basic frequentist test at launch; sequential/bandit later). Never claim significance you didn't compute.

## SCOPE — FRONTEND
1. Experiment builder: pick dimension → define variants (reuse 1C creatives / 1A journey paths) → allocation + holdout + goal_event.
2. Results dashboard: per-variant funnel + lift vs control + confidence; "conclude" action promotes a winner.
3. `--lc-*` tokens; accessible; responsive.

## OUT OF SCOPE
Multi-armed bandit optimisation (interface only). AI auto-experimentation (post-PMF). Attribution internals (consume 2C).

## ACCEPTANCE CRITERIA
- [ ] Even allocation is deterministic + reproducible; holdout respected; every assignment recorded with reason + model_version.
- [ ] Bandit path returns a clear `NOT_CONFIGURED` (no stub result).
- [ ] Executions/creatives/journey nodes resolve the assigned variant; results tie to Conversions via execution_id.
- [ ] Significance is genuinely computed; no fabricated confidence.
- [ ] Tenant-isolated via `withTenant`.

## TEST MATRIX
1. Deterministic assignment (same contact×experiment → same variant); holdout share correct.
2. Assignment recorded with reason/model_version; reproducible on re-run.
3. Variant resolution in an Execution/journey node.
4. Result computation from Conversion fixtures; significance math sane.
5. Tenant isolation on experiments/experiment_assignments.
