# Wave 1A — Journeys (rename + reconcile + branch-capable engine)

> Prepend `_house-rules.md`. Prerequisite: Wave 0 merged. Migration block: **600–619**.

## MISSION
Turn today's mislabelled "campaign manager" (a CRM drip builder) into **Journeys** — a versioned, branch-capable orchestration engine whose `send` nodes emit **canonical Executions** (Wave 0) and honour **Consent** (Wave 0). Simultaneously **reconcile the three overlapping builders** (#294 Pro on `main`, #302 goal picker never landed, #311 wizard blocked) into ONE Journey builder: **Wizard = create, Pro = edit**.

Read `docs/campaign-and-social-publishing-reconciliation.md` Parts 0–1 and `docs/canonical-object-model.md` §D (Orchestration) — they are binding.

## BACKGROUND FACTS (verified — study before coding)
- Shared model: `web/src/components/campaigns/campaign-builder-shared.ts` (`CampaignFormState`: `trigger`, `target_channel`, `tags_filter`, `audience_rules`, `steps[]`; a step = `{delay_hours, channel(email|whatsapp|sms), subject, body}` — **text only**).
- Hook: `web/src/components/campaigns/useCampaignBuilderForm.ts`; views `CampaignBuilderProView.tsx`, `CampaignStepEditor` (Pro, on `main`).
- #294 = Pro single-page (landed). #302 = `campaign-goals.ts` goal presets (New listing/Price drop/Open house/Custom) — **never landed**. #311 = 6-step wizard (Goal→Audience→Content→Channels→Schedule→Review) — **blocked, doubly stale, carries its own copy of `campaign-goals.ts`; its `goal_id`/`audience_source` are UI-only and never persisted**.
- Backend: `createCampaign` in `web/src/api/client.ts` → payload `{name,description,status,trigger,target_channel,tags_filter,steps}`; existing `campaigns` table (+ steps).

## SCOPE — BACKEND
1. **Migrations (block 600–619, enum-first):** `journeys`, `journey_versions` (immutable `graph JSONB` DAG + `version`), `journey_runs` (per-contact: `journey_version_id`, `contact_id`, `current_node_id`, `state JSONB`, `status(active/completed/exited/suppressed)`, entered/exited stamps), `journey_node_runs` (`journey_run_id`, `node_id`, `node_type`, `input`, `result`, `execution_id?`, `occurred_at`). RLS on all. Node types in `graph`: `trigger·wait·send·condition·branch·lead_score·goal·exit·experiment`.
2. **Migrate `campaigns` → `journeys` (expand-contract):** create canonical rows, back the old table with a view or forward-trigger so existing reads keep working; the old linear `steps[]` maps to a `graph` where each step = a `wait`→`send` pair. **Do not drop `campaigns`.**
3. **Runtime engine** (`backend/src/domain/journeys/…`): enrolment (trigger + `entry_audience_id`), traversal of the graph honouring `wait`/`condition`/`branch`/`goal`/`exit`. A `send` node:
   - calls `consent.checkEligibility({contactId, channel, purpose:'marketing'|'nurture'})` (Wave 0) — deny → record `suppressed`, do not send;
   - creates an **Execution** (`kind='message'`, via Wave 0 `executions.js`), links it on the `journey_node_run`;
   - records `journey_node_run` + (if you implement it) a transition reason.
   Schema + engine must **support branches now even if the v1 UI only exposes linear** — do not hard-code linear in the data model.
4. Send nodes carry an optional `creative_id` (nullable; owned by 1C) so a step can attach branded media later.

## SCOPE — FRONTEND (reconcile the three builders)
1. **Rename** the surface to **Journeys** across routes/nav/copy (keep URL redirects; expand-contract — don't 404 old links).
2. **Land the goal picker once:** re-implement `campaign-goals.ts` on the `useCampaignBuilderForm` architecture (NOT #311's stale copy). Seed the presets.
3. **Reconcile:** Wizard (from #311, rebased onto the hook) = the **create** flow; Pro single-page (#294) = the **edit** flow. Both share `useCampaignBuilderForm` + `campaign-builder-shared`. Delete the dead `goal_id`/`audience_source` UI-only fields **or** persist `goal_id` if product wants reporting (pick one; if unsure, delete — don't leave dead state).
4. Port `CampaignBuilderPage.wizard.test.tsx` to the reconciled builder. Ensure web CI is green (this has flaked before on unstable hook mocks returning fresh objects each render + effects depending on them — hoist mocks to a stable ref).

## OUT OF SCOPE
Audience internals (consume 1D's `audiences`; until it lands, keep today's `audience_rules`/`tags_filter` shape). Creative rendering (1C). Paid/SEO. ContactPolicy/frequency engine (later wave) — but leave the `checkEligibility` call site so it's a one-line addition later.

## MODULE ACCEPTANCE CRITERIA
- [ ] A journey can be authored (wizard), edited (Pro), versioned, and run; a contact traverses the graph.
- [ ] A `send` node emits a canonical `Execution(kind=message)` and is blocked by a denied/withdrawn/expired consent (proven by test).
- [ ] `campaigns` still readable by existing code (expand-contract), no data loss.
- [ ] #294/#302/#311 reconciled into ONE builder; goal picker single-sourced; wizard test ported; **web CI green**.
- [ ] Branch/condition nodes representable in `graph` and executable, even if UI v1 is linear.

## TEST MATRIX (minimum)
1. Migration idempotency + RLS isolation on all four tables.
2. Journey run traverses wait→condition(branch)→send; correct node_runs recorded.
3. Send emits Execution; consent-denied send → `suppressed`, no Execution.
4. `campaigns`→`journeys` migration parity (spot-checked) + old view still returns rows.
5. FE: wizard creates a journey; Pro edits it; goal preset pre-fills; `wizard.test.tsx` passes.
