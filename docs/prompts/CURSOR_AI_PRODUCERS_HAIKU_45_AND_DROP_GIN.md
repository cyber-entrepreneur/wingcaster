# Cursor dispatch — AI producers: Haiku 4.5 default + drop unused GIN index

**PR title:** `chore(ai): bump Anthropic default to Haiku 4.5 and drop unused ai_ratings GIN index`

**Base branch:** `main`

**Estimated effort:** ~1 day of Cursor work + review. Small, focused housekeeping PR — no domain changes, no API changes.

**Depends on:** PR #42 (AI producers) has merged (2026-09-04, squash `d2ff584`). Both items in this PR were flagged as non-blocking follow-ups in the PR #42 architect-owner review and parked as post-merge work.

**Rev 1 — 2026-09-05:** initial draft.

---

## 1. Why this PR

Two parked follow-ups from PR #42 review:

1. **Stale Anthropic model default.** `backend/src/lib/credits/ai-producers/config.js` defaults to `claude-3-haiku-20240307` (Haiku 3, March 2024). Claude Haiku 4.5 launched 2025-10-01 with materially better structured-output reliability, lower cost per M-token, and higher throughput. The prompt that produced PR #42 was written before Haiku 4.5 shipped, so Cursor picked what was current then. Time to catch up.
2. **Unused GIN index on `properties.ai_ratings`.** Migration 310 added `idx_properties_ai_ratings_gin`, but no reader today filters into the JSONB. The index adds write cost on every `rateProperty` save with no read benefit. Drop it; re-add when a reader actually needs it.

Both changes are cheap and reversible.

---

## 2. Scope

### 2.1 Bump Anthropic default to Haiku 4.5

**Before you write any code — load the `claude-api` skill** to get canonical, current pricing and model-id information for Haiku 4.5. Do not guess pricing from memory; the skill is the source of truth. If the skill isn't available in your session, fetch pricing directly from Anthropic's docs.

**Model id:** `claude-haiku-4-5-20251001`

**Files to update:**

- **`backend/src/lib/credits/ai-producers/config.js`**
  - Update `ANTHROPIC_MODEL_ALIASES` (top of file) so the short alias `claude-haiku-4-5` (add) resolves to `claude-haiku-4-5-20251001`. Keep the existing `claude-3-haiku` → `claude-3-haiku-20240307` alias so any operator with an env-var override for the old model still works.
  - Change the default fallback in `resolveAnthropicModel` from `'claude-3-haiku-20240307'` to `'claude-haiku-4-5-20251001'`.
  - Change the default value inside `producerConfig()` for both `ANTHROPIC_MODEL_POST_CREATION` and `ANTHROPIC_MODEL_PROPERTY_RATING` from `'claude-3-haiku'` to `'claude-haiku-4-5'`.

- **`backend/src/lib/ai-pricing.js`**
  - Add a new entry keyed `'claude:claude-haiku-4-5-20251001'` with `inputPerMillionMicroUsd` and `outputPerMillionMicroUsd` values from the current Anthropic pricing page (via the `claude-api` skill or the Anthropic docs; convert USD/M-token to micro-USD/M-token by multiplying by 1_000_000).
  - **Keep** the existing `'claude:claude-3-haiku-20240307'` entry — cost estimation must still resolve for any historical `ai_call_usage` rows already logged against the old model.

- **`backend/src/lib/credits/ai-stubs.postgres.test.js`**
  - Line 208: assertion `expect(logs[0].model).toBe('claude-3-haiku-20240307')` → `'claude-haiku-4-5-20251001'`.
  - Line 257: same update in the `rateProperty × Anthropic happy path` test.
  - Anywhere else in this file that names the specific Haiku 3 model id, update to Haiku 4.5.

- **`docs/deployment/RAILWAY_ENV_VARS.md`**
  - Update the "Metered AI producers" section: `ANTHROPIC_MODEL_POST_CREATION` and `ANTHROPIC_MODEL_PROPERTY_RATING` defaults now `claude-haiku-4-5`, resolved to `claude-haiku-4-5-20251001`.

**Backwards compatibility:** operators who have `ANTHROPIC_MODEL_POST_CREATION=claude-3-haiku` (or the full id) explicitly set in their environment will continue to use Haiku 3 — the alias map preserves that resolution. Only the fresh-install / no-env-var default flips.

### 2.2 Drop the unused GIN index on `properties.ai_ratings`

**New migration:** `NNN_drop_property_ai_ratings_gin_index.sql` — where `NNN` is the next available auto-migration integer at branch time. Numbers currently taken or reserved on/heading-to main: 307/308/309 (PART1 notifications), 310 (property_ai_ratings), 311 (vendor admin PR #44), 312 (push notifications PART2 in flight). **Almost certainly `313`**, but read `backend/src/persistence/migrations/` at branch time and pick the next unused integer to avoid surprises.

Content:

```sql
-- Drop the GIN index added in 310. No reader filters into properties.ai_ratings today,
-- so the index only added write cost on every rateProperty save. Re-add when a reader
-- (analytics dashboard, agent-facing rating search) actually needs it.

DROP INDEX IF EXISTS public.idx_properties_ai_ratings_gin;
```

No other changes needed — the column itself stays, `rateProperty` continues to write it, and reads via `SELECT ai_ratings FROM properties WHERE id = $1` are already efficient (primary-key lookup).

---

## 3. Non-negotiables

1. **Load the `claude-api` skill before writing any pricing values.** No pricing from memory or estimation.
2. **Keep the old pricing table entry** for `claude:claude-3-haiku-20240307` — historical `ai_call_usage` rows must still resolve a cost estimate.
3. **Preserve the `claude-3-haiku` alias** for operators with existing env-var overrides.
4. **Migration number: verify at branch time.** Do not hard-code `313` if 311 or 312 haven't landed yet; read the migrations directory and pick the next integer higher than the highest number present.
5. **Fast + Real-Postgres CI green** before flipping to ready-for-review.
6. **No domain, API, or contract changes.** This PR is defaults + index only.

---

## 4. Test discipline

- **Fast suite green.** The provider-matrix tests in `ai-producers.test.js` don't assert a specific model id — they stub `fetch` — so they should pass unchanged. If any do assert a model id, update to Haiku 4.5.
- **Real-Postgres suite green.** The two assertions in `ai-stubs.postgres.test.js` (lines 208 and 257) are the only ones that name the Haiku model id today; update both.
- **New test (optional but nice):** in `ai-producers.test.js`, one assertion that `producerConfig().anthropic.postCreationModel` resolves to `claude-haiku-4-5-20251001` when no env var is set. Cheap regression guard against future accidental downgrades.
- **Migration test:** the `isAutoMigration` guard at `ai-producers.test.js:95-97` doesn't need updating for the drop-GIN migration — the file name will be numeric-prefixed and pass the existing filter.

---

## 5. Definition of done

1. `config.js` default is Haiku 4.5; `claude-3-haiku` alias still works.
2. `ai-pricing.js` has entries for BOTH Haiku 3 and Haiku 4.5.
3. `ai-stubs.postgres.test.js` model assertions updated.
4. `RAILWAY_ENV_VARS.md` metered-producer defaults updated.
5. New migration `NNN_drop_property_ai_ratings_gin_index.sql` (number verified at branch time) drops the index.
6. Fast + Real-Postgres CI green.
7. PR body notes the operator-facing behavior: no action required; existing env-var overrides preserved; fresh installs get Haiku 4.5.

---

## 6. Follow-up (do NOT include in this PR)

- **Migrate historical `ai_call_usage` cost estimates to Haiku 4.5 pricing** — not needed; historical rows keep their original per-call cost estimate. Only new calls after this PR merges use Haiku 4.5.
- **Deprecate the Haiku 3 pricing entry** — leave it. It's a two-line addition and future forensic analysis of old logs may still need it.
- **Automated model-freshness check** — nice-to-have future automation (CI job that flags when the configured default is >6 months old). Out of scope here.
