# Wave 1C — Creative Asset Service + AI Adaptive Composer — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 merged to `main` (`backend/src/lib/growth-os/`). Run in parallel with 1A/1B/1D.
- **Your migration block:** `620–644` (current live max 552 — re-check).
- **You own:** `creatives`, `creative_variants`, `creative_renditions`, `approval_requests`. Publishing itself is 1B's (call its path). Journey media attachment is 1A consuming your `creative_id`.

---

## HOUSE RULES

### WHO YOU ARE
A senior engineer on **WingCaster** — a B2B real-estate marketing SaaS. Backend: **Node.js ESM + PostgreSQL, multi-tenant with RLS**, tested with **vitest** (Real-PG via `npm run test:pg:docker`). Frontend: **React + Vite + TypeScript**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. The existing code named below.

### BUILD ON WAVE 0 (merged to `main`) — exact contract, do not re-invent
- **Access layer `backend/src/lib/growth-os/`**: use its exports; no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write; RLS strict (mig 551, `TO growth_os_app_role`, GUC set-and-matching); outside it the app role sees **zero rows**; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern** (mirror mig 551 + 543); access via `withTenant`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant` → resolve tenant first); cumulative metrics → `metric_observations`.
- **Consent:** `checkEligibility(...)` before owned-messaging sends (N/A to creative generation itself; relevant when a creative is published — that's 1B).
- **Migration max on `main` is 552.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; cutover explicit + testful.
3. Idempotent migrations; run twice cleanly.
4. Shared enum/CHECK additions in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` (wrong-table gate vs missing seed).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG; FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; logger. Migrations `NNN_*.sql` (max 552; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts`; routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` to dodge the Windows vitest over-parallelisation flake.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs (enum-first → schema → logic → UI), each green, targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: CREATIVE ASSET SERVICE + AI ADAPTIVE COMPOSER

### MISSION
Build the **Creative Asset Service** (Bannerbear = one interchangeable renderer, NOT the architecture) and the **AI Adaptive Composer**: the agent provides an asset + info **once**; AI produces **≥4 platform-native compositions per selected channel** using each platform's standards; the agent reviews a **variant gallery**, edits anything, selects one or many, and publishes — each selected variant fans out to its platform (via 1B / canonical Executions). Ship a **minimal approval gate** for AI-generated public content. Read `docs/campaign-and-social-publishing-reconciliation.md` Part 5 + `docs/canonical-object-model.md` §F/§G.

### BACKGROUND FACTS (verified — reuse, don't rebuild)
- **Per-platform standards exist:** `backend/src/modules/social-cards/dimensions.js` — IG feed 1080×1080 (1:1), IG/FB story + Reel + TikTok 1080×1920 (9:16), X 1600×900 (16:9), LinkedIn 1200×627 (1.91:1), FB feed 1200×630.
- **Templates + adaptive renderer exist:** `social-cards/seed-templates.js` (base 1080²; renderer scales layers; `platform_overrides.<key>`), `social-cards/renderer.js`, `social-cards/bannerbear-adapter.js`. Routes: `POST /api/listings/:id/social-cards/render`, meter `assets.render.social_card`.
- **Per-channel AI captions exist:** `backend/src/lib/credits/ai-producers/create-ai-post.js` `produceAiPost()` returns captions keyed per channel; prompts in `…/prompts/{openai,anthropic}/post-creation.js`. **English-only in v1** (Arabic = Phase 2 — keep the guard).

### SCOPE — BACKEND
1. **Migrations (620–644, enum-first):** `creatives` (concept: subject_ref, source(manual/ai), approval_state, status), `creative_variants` (creative_id, label, `copy JSONB` per-channel, experiment_id? nullable), `creative_renditions` (creative_variant_id, channel_key, dimensions, provider, asset_url, status), and a **minimal** `approval_requests` (subject_type/subject_id, subject_version, requested_by, state(pending/approved/rejected), reviewers, decision_history JSONB). Strict RLS on all.
2. **Creative Asset Service** (`backend/src/domain/creative/…`): a renderer-provider interface with **Bannerbear and the local renderer as implementations** behind it. All rendering goes through this interface — no direct Bannerbear calls in feature code. Inputs: brand system + property data + template → renditions per channel using `dimensions.js`.
3. **AI variant generation:** extend the `produceAiPost` path to return **N≥4 copy variants per channel** (vary angle/tone — reuse tones warm/professional/concise/luxury; keep the English-only guard). Pair copy variants with rendered renditions per platform. Persist as `creative` → `creative_variants` → `creative_renditions`.
4. **Approval gate (launch-critical subset of governance):** when `source='ai'` and the creative targets **public** channels, create an `approval_request` and hold the creative at `approval_state=pending` until a human approves. A single hardcoded policy ("AI public content requires approval") — full policy engine is Wave 2. RE claims + AI generation is a live liability; this gate is not optional.

### SCOPE — FRONTEND
1. **AI Adaptive Composer** (`web/…`): one input form (asset + property + channels + tone) → generate → a **variant gallery** showing ≥4 options per selected channel at correct per-platform dimensions → inline edit of any variant → multi-select → **Publish** (calls 1B's consolidated social publish). Manual per-channel editors remain available as an alternate mode.
2. Surface approval state on AI-generated public creatives; block publish of a `pending` public creative.
3. `--lc-*` tokens; accessible gallery; responsive.

### OUT OF SCOPE
The actual social HTTP publish (1B — call its path). Journey media attachment (1A consumes `creative_id`). Full ApprovalPolicy engine, experiment assignment (Wave 2) — but stamp `experiment_id?` nullable on variants for later.

### ACCEPTANCE CRITERIA
- [ ] One input → **≥4 variants per selected channel**, each rendered at the correct `dimensions.js` size, persisted as creative/variant/rendition.
- [ ] All rendering goes through the Creative Asset Service interface; swapping Bannerbear↔local requires no feature-code change (provider-swap test).
- [ ] Agent can edit a variant and select one/many to publish; publish routes through 1B / canonical Executions.
- [ ] AI-generated **public** creative held `pending` until approved (test); non-AI or private creative not gated.
- [ ] English-only guard preserved. All new tables strict-RLS; access via `withTenant`.

### TEST MATRIX (minimum)
1. Migration idempotency + strict-RLS on all four tables.
2. Generate → ≥4 variants/channel with correct dimensions; renditions persisted.
3. Provider-swap: same Creative renders via local and via Bannerbear through the one interface.
4. Approval gate: AI public creative → `pending`, blocks publish; after approve → publishable.
5. FE: gallery renders variants; edit persists; multi-select publish calls the 1B path.
