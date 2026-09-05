# Cursor dispatch — Wire 2 AI producers (createAiPost + rateProperty)

**PR title:** `feat(ai): wire createAiPost + rateProperty producers`

**Base branch:** `main`

**Estimated effort:** 5-6 days of Cursor work + review.

**Runs in parallel with:** any Broadcast-migrated-web work; no `web/` touches here.

**Rev 2 — 2026-09-04:** revised after architect-owner review. **Dropped `activateLeadGen` from this PR** (spec was hand-wavy; deferred to a follow-up ticket that must first define prompt template + I/O schema + sample call/response). Also revised: per-provider test coverage, English-only guard, explicit migration carve-out, PA/Inspector-scoped rateProperty for v1, fail-over on JSON parse-failure instead of naive retry, dropped nightly-reconcile from DoD (belongs in observability workstream).

---

## 1. Why this PR

Per the backend placeholder audit (`docs/design/BACKEND_PLACEHOLDER_AUDIT_2026-09-04.md` §P0-4), two metered AI features throw `NOT_IMPLEMENTED` and this PR wires them:

- **`AI_POST_CREATION`** (`lib/credits/ai-stubs.js :: createAiPost`) — critical for WhatsApp intake path.
- **`AI_PROPERTY_RATING`** (`lib/credits/ai-stubs.js :: rateProperty`) — used by inspector / property-rating flows.

**`AI_LEAD_GEN_ACTIVATION` (`activateLeadGen`) stays stubbed for now.** It ships in a follow-up PR once its prompt template + input schema + output schema + sample I/O are concretely defined. Do not touch it here.

Adjacent AI features already wired (proven pipeline — reference these for pattern):
- `AI_LISTINGS_DESCRIBE` in `modules/listings-ai/routes.js`
- `AI_CONTACT_LEAD_SCORE` + `AI_CONTACT_LEAD_SUMMARY` in `contact-360.js`
- `AI_COMMENT_CLASSIFIER` in `lib/comment-classifier.js`
- `AI_AREA_SCORING` in `modules/area-intelligence`
- `AI_MARKET_PRICING_ANALYSIS` in `modules/property-valuation`

The metering wrapper (`meterFeature` + `withCredits`), cost model (`ai-pricing.js`), and provider adapter pattern are all proven. This is a producer-wiring PR.

**Non-goals:**
- No new provider integrations.
- No changes to `ai-pricing.js` cost model.
- No changes to `meterFeature`/`withCredits` wrappers.
- No frontend work.
- No Arabic prompt engineering (v1 English-only — see §2.4).
- No `activateLeadGen` — separate PR.

---

## 2. Scope

### 2.1 `createAiPost` — AI per-channel post captions

**Caller sequencing (IMPORTANT):**

WhatsApp intake pipeline has TWO AI calls in sequence:
1. **`AI_LISTINGS_DESCRIBE`** runs FIRST — generates the property description (the "what"). Already implemented.
2. **`createAiPost`** runs SECOND — takes the description as INPUT and derives per-channel captions from it (the "how per channel"). NOT re-derived from raw property fields.

Combined cost per WhatsApp intake: ~500 credits DESCRIBE + ~200 credits POST (POST doesn't re-reason from scratch, just adapts per channel). **Update the WhatsApp intake caller in `modules/whatsapp-listings/` to pass the description forward — do not let it re-derive.** Both metered; agent sees a clean charge stack.

**Spec:**
- **Input:** `{ description: string, propertyPayload: object, tone: 'warm'|'professional'|'concise'|'luxury', channels: string[], language: 'en' }` — `language` is a discriminated union but v1 ONLY accepts `'en'` (see §2.4).
- **Output:** `{ captions: { instagram: '...', facebook: '...', tiktok: '...', x: '...', linkedin: '...', whatsapp: '...' }, provider, cost_micro_usd, tokens_in, tokens_out }`
- **Per-channel prompt engineering** (English v1):
  - Instagram: warm, aspirational, 3-5 hashtags, emoji-friendly
  - Facebook: longer, feature-focused, community tone
  - TikTok: hook-first, casual, trending-sound placeholder, ≤5 hashtags
  - X: pithy, ≤280 chars, 1-2 hashtags
  - LinkedIn: professional, market-context, no hashtags
  - WhatsApp: brief, direct, one call-to-action
  Reuse patterns already present in `backend/src/modules/whatsapp-listings/infrastructure/ai/shared.js`.
- **Model:** OpenAI `gpt-4o-mini` per `ai-pricing.js` default. Fallback to Anthropic `claude-3-haiku` (see §2.5).

### 2.2 `rateProperty` — AI property rating (PA/Inspector-scoped for v1)

**Call sites for v1:** Inspector flow only (`modules/area-intelligence/interface/inspector-routes.js`). Agent-triggered rating from AGT-LST-003 is DEFERRED to a follow-up (no Agent screen for "AI rate this property" exists yet in the matrix).

**Spec:**
- **Input:** `{ propertyPayload: object, areaContext: object }`
- **Output (structured, zod-validated):**
  ```
  {
    ratings: {
      quality: number (1-10),
      price_fairness: number (1-10),
      area_fit: number (1-10),
      presentation: number (1-10),
      overall: number (1-10)
    },
    reasoning: {
      quality: string,
      price_fairness: string,
      area_fit: string,
      presentation: string,
      overall: string
    },
    provider, cost_micro_usd, tokens_in, tokens_out
  }
  ```
- **Model:** `gpt-4o-mini`. Structured output via OpenAI `response_format: {type: 'json_object'}` OR Anthropic tool-use on fallback.
- **Storage:** write to `properties.ai_ratings` JSONB column. **See §2.6 for migration carve-out.**

### 2.3 Provider adapter pattern

For each producer:
1. Replace stub body in `lib/credits/ai-stubs.js` with a real implementation
2. Call provider via existing adapter (see `modules/property-valuation/infrastructure/ai-adapter.js` for reference — its `generateMarketContextSentence` shows the shape)
3. Parse response (JSON mode for structured outputs)
4. Return `{ ok: true, result, provider, cost_micro_usd, tokens_in, tokens_out }`
5. **Never touch metering** — the wrapper `meterFeature` handles that
6. **Preserve `opts.work` override** — the existing pattern in `ai-stubs.js:11` must still function for test injection

### 2.4 v1 English-only guard

Per architect-owner review: MENA social media has different hashtag conventions, Fusha vs. Ammiya register choice, grapheme-vs-byte character counting. Same English prompts applied to Arabic produce low-quality output.

**v1 scope: English only.** If `createAiPost` is called with `language !== 'en'`, throw:
```
Error('Arabic prompt templates are Phase 2 — this call cannot generate Arabic captions in v1', { code: 'LANGUAGE_NOT_YET_SUPPORTED' })
```
Meter releases the credit reservation on this error (fail-closed). Do NOT silently fall back to English if Arabic was requested — the caller must know.

Add to non-goals table + follow-up ticket for Arabic prompt authoring.

### 2.5 Provider fallback — verify Haiku parity

Fallback: OpenAI (`gpt-4o-mini`) → Anthropic (`claude-3-haiku`).

**These models are NOT equivalent** — different JSON-mode enforcement, different tokenization, potentially different output quality. Per architect-owner review:

- **Test each producer against BOTH providers** in the test suite. Assert the same zod schema passes for both. If Haiku fails the schema, the fallback path is broken — discover in tests, not production.
- If prompts need slight variants per provider to hit the schema, add them under `lib/credits/ai-producers/prompts/{openai,anthropic}/*.ts`. Document any divergence.

### 2.6 `properties.ai_ratings` migration (explicit carve-out)

**Verify first** whether `properties.ai_ratings` JSONB column exists on `main`. If NOT present, this PR includes migration `305b_property_ai_ratings.sql`:
```sql
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS ai_ratings JSONB;
CREATE INDEX IF NOT EXISTS idx_properties_ai_ratings_gin
  ON properties USING GIN (ai_ratings);
```
This is a scope carve-out from "no migration changes" — necessary to complete rateProperty. Explicit and documented, not stealthy scope creep.

### 2.7 JSON parse-failure strategy (replaces old "retry once")

Per architect-owner review: retrying the same prompt on a JSON parse failure usually produces the same malformed output — cargo-culting. Correct handling:

- Use OpenAI `response_format: {type: 'json_object'}` strictly.
- Use Anthropic tool-use with a defined tool schema on fallback (not `<json>...</json>` string wrapping).
- On parse failure: treat as provider-degraded → fall over to the other provider. Do NOT retry the same prompt on the same provider.
- If BOTH providers parse-fail: fail closed with `{ code: 'AI_STRUCTURED_OUTPUT_FAILED' }`. Metering releases the reservation.

---

## 3. Non-negotiables

1. **Do NOT change** the `meterFeature` wrapper contract in `ai-stubs.js` — the `opts.work` override MUST still function for test injection.
2. **Every real call** logs via `lib/ai-usage-logger.js :: recordAiCall` with `{ feature, provider, model, tokens_in, tokens_out, cost_micro_usd, duration_ms, request_id }`.
3. **Structured outputs** for rateProperty use JSON mode strictly. Zod-validated. No string-parsing hacks.
4. **v1 is English-only** for createAiPost. Non-English calls throw `LANGUAGE_NOT_YET_SUPPORTED`.
5. **Fail closed** — cannot-complete throws with a specific error code; wrapper releases the credit reservation. No silent success.
6. **createAiPost consumes the description from AI_LISTINGS_DESCRIBE** — does NOT re-derive from raw property fields. Caller in `modules/whatsapp-listings/` updated to pass it forward.
7. **rateProperty is PA/Inspector-only for v1.** Do not add an agent call site.
8. **DO NOT touch `activateLeadGen`** — it stays as-stubbed in `ai-stubs.js`. Separate PR.

---

## 4. Test discipline

**You MUST run the full CI locally before pushing.**

- **Fast suite:** `npm run test` — all existing tests pass.
- **Real-Postgres suite:** `npm run test:pg` — all existing tests pass.
- **New tests** in `backend/src/lib/credits/ai-stubs.postgres.test.js`:
  - **Per-producer × per-provider matrix** (4 test blocks: createAiPost×OpenAI, createAiPost×Anthropic, rateProperty×OpenAI, rateProperty×Anthropic):
    - Happy path: metering charges correctly, response shape matches contract, ai-usage log entry created
    - Zod schema passes on the provider's structured output
  - **Provider fallback:** OpenAI down → Anthropic tried → success
  - **Both providers down:** fail closed, credit reservation released
  - **JSON parse failure on primary → falls over to secondary → success**
  - **Both providers parse-fail:** fail closed with `AI_STRUCTURED_OUTPUT_FAILED`
  - **`opts.work` override:** bypasses the real producer path
  - **`createAiPost` language guard:** `language='ar'` throws `LANGUAGE_NOT_YET_SUPPORTED`
- **Delete** the `with-credits.postgres.test.js:148` test that asserts `NOT_IMPLEMENTED` for `createAiPost` and `rateProperty` (it becomes stale). The `activateLeadGen` `NOT_IMPLEMENTED` assertion STAYS (still stubbed).

---

## 5. Definition of done

1. `createAiPost` and `rateProperty` implemented in `lib/credits/ai-stubs.js` (or moved to `lib/credits/ai-producers/` if the file grows).
2. `activateLeadGen` untouched — still `NOT_IMPLEMENTED`.
3. Every producer logs via `ai-usage-logger.js`.
4. Provider fallback verified per-producer via test matrix.
5. Structured outputs use JSON mode strictly + zod validation.
6. `opts.work` override still functions.
7. English-only guard on `createAiPost`.
8. Caller in `modules/whatsapp-listings/` updated so `createAiPost` receives the description from `AI_LISTINGS_DESCRIBE`, not raw property fields.
9. `properties.ai_ratings` column exists (via `305b` migration if it wasn't already there).
10. Fast + Real-Postgres CI green.
11. Manual smoke test in staging: one `createAiPost` (English, WhatsApp intake path) + one `rateProperty` (inspector) end-to-end; verify metering charged correctly, verify no double-charge on the DESCRIBE + POST sequence.

**Removed from DoD:** nightly reconcile check for cost drift (belongs in a separate observability workstream — not this PR).

---

## 6. Environment variables to document

Update `docs/deployment/RAILWAY_ENV_VARS.md` if any are new:
- `OPENAI_API_KEY` (likely already documented)
- `ANTHROPIC_API_KEY` (likely already documented)
- `AI_PROVIDER_PRIMARY` (default 'openai')
- `AI_PROVIDER_FALLBACK` (default 'anthropic')
- `OPENAI_MODEL_POST_CREATION` (default `gpt-4o-mini`)
- `OPENAI_MODEL_PROPERTY_RATING` (default `gpt-4o-mini`)
- `ANTHROPIC_MODEL_POST_CREATION` (default `claude-3-haiku`)
- `ANTHROPIC_MODEL_PROPERTY_RATING` (default `claude-3-haiku`)

---

## 7. Follow-up tickets to create separately (do NOT include in this PR)

1. **`activateLeadGen` producer** — define prompt template, I/O schema, sample call/response, then implement.
2. **Arabic prompt templates for `createAiPost`** — per-channel Arabic conventions, Fusha/Ammiya register choice, grapheme-cluster character counting.
3. **Agent-triggered `rateProperty` call site** — new screen action in AGT-LST-003 or AGT-NVL-001.
4. **Nightly cost-drift reconcile** — observability job that reads `ai_call_usage` + compares actual vs. `ai-pricing.js` estimates.
