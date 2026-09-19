# Wave 1C — Creative Asset Service + AI Adaptive Composer

> Prepend `_house-rules.md`. Prerequisite: Wave 0 merged. Migration block: **620–644**.

## MISSION
Build the **Creative Asset Service** (Bannerbear = one interchangeable renderer, NOT the architecture) and the **AI Adaptive Composer**: the agent provides an asset + info **once**; AI produces **≥4 platform-native compositions per selected channel** using each platform's standards; the agent reviews a **variant gallery**, edits anything, selects one or many, and publishes — each selected variant fans out to its platform (via 1B / Wave 0 Executions). Ship a **minimal approval gate** for AI-generated public content.

Read `docs/campaign-and-social-publishing-reconciliation.md` Part 5 and `docs/canonical-object-model.md` §F (Content) + §G (Approval) — binding.

## BACKGROUND FACTS (verified — reuse, don't rebuild)
- **Per-platform standards already exist:** `backend/src/modules/social-cards/dimensions.js` — IG feed 1080×1080 (1:1), IG/FB story + Reel + TikTok 1080×1920 (9:16), X 1600×900 (16:9), LinkedIn 1200×627 (1.91:1), FB feed 1200×630.
- **Templates + adaptive renderer exist:** `social-cards/seed-templates.js` (base 1080²; renderer scales layers; `platform_overrides.<key>`), `social-cards/renderer.js`, `social-cards/bannerbear-adapter.js`. Routes: `POST /api/listings/:id/social-cards/render`, meter `assets.render.social_card`.
- **Per-channel AI captions exist:** `backend/src/lib/credits/ai-producers/create-ai-post.js` `produceAiPost()` returns captions keyed per channel; prompts in `…/prompts/{openai,anthropic}/post-creation.js`. **English-only in v1** (Arabic = Phase 2 — keep that guard).

## SCOPE — BACKEND
1. **Migrations (block 620–644, enum-first):** `creatives` (concept: subject_ref, source(manual/ai), approval_state, status), `creative_variants` (creative_id, label, `copy JSONB` per-channel, experiment_id? nullable), `creative_renditions` (creative_variant_id, channel_key, dimensions, provider, asset_url, status), and a **minimal** `approval_requests` (subject_type/subject_id, subject_version, requested_by, state(pending/approved/rejected), reviewers, decision_history JSONB). RLS on all.
2. **Creative Asset Service** (`backend/src/domain/creative/…`): a renderer-provider interface with **Bannerbear and the local renderer as implementations** behind it. All rendering goes through this interface — no direct Bannerbear calls in feature code. Inputs: brand system + property data + template → outputs renditions per channel using `dimensions.js`.
3. **AI variant generation:** extend the `produceAiPost` path to return **N≥4 copy variants per channel** (vary angle/tone — reuse existing tones warm/professional/concise/luxury; keep the English-only guard). Pair copy variants with rendered renditions per platform. Persist as `creative` → `creative_variants` → `creative_renditions`.
4. **Approval gate (launch-critical subset of D18):** when `source='ai'` and the creative targets **public** channels, create an `approval_request` and hold the creative at `approval_state=pending` until a human approves. A single hardcoded policy ("AI public content requires approval") — full `ApprovalPolicy` engine is a later wave. Real-estate claims + AI generation is a live liability; this gate is not optional.

## SCOPE — FRONTEND
1. **AI Adaptive Composer** (`web/…`): one input form (asset + property + channels + tone) → generate → a **variant gallery** showing ≥4 options per selected channel at correct per-platform dimensions → inline edit of any variant → multi-select → **Publish** (calls 1B's consolidated social publish / Wave 0 Executions). Manual per-channel editors remain available as an alternate mode.
2. Surface the approval state (pending/approved) on AI-generated public creatives; block publish of a `pending` public creative.
3. `--lc-*` tokens only; accessible gallery; responsive.

## OUT OF SCOPE
The actual social HTTP publish (owned by 1B — call its path). Journey media attachment (1A consumes `creative_id`). Full ApprovalPolicy engine, experimentation assignment (later waves) — but stamp `experiment_id?` nullable on variants for later.

## MODULE ACCEPTANCE CRITERIA
- [ ] One input → **≥4 variants per selected channel**, each rendered at the correct `dimensions.js` size, persisted as creative/variant/rendition.
- [ ] All rendering goes through the Creative Asset Service interface; swapping Bannerbear↔local requires no feature-code change (proven by a provider-swap test).
- [ ] Agent can edit a variant and select one/many to publish; publish routes through 1B / canonical Executions.
- [ ] AI-generated **public** creative is held `pending` until approved (proven by test); non-AI or private creative is not gated.
- [ ] English-only guard preserved (Arabic still refused with the existing code).

## TEST MATRIX (minimum)
1. Migration idempotency + RLS on all four tables.
2. Generate → ≥4 variants/channel with correct dimensions; renditions persisted.
3. Provider-swap: same Creative renders via local and via Bannerbear through the one interface.
4. Approval gate: AI public creative → `pending`, blocks publish; after approve → publishable.
5. FE: gallery renders variants; edit persists; multi-select publish calls the 1B path.
