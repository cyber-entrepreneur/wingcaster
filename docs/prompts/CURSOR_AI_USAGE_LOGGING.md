# Cursor prompt — AI per-call token-usage logging

Small focused PR. Ships before any pricing work. Adds the observability needed to answer "how much did tenant X cost us in AI last month?" and "which provider gave us best cost-per-successful-call?" — neither of which the platform can answer today.

**Verified state on `origin/main` (commit `d4d475c`) before you start:** every AI provider file returns `{ text, raw }`, discards the `usage` block from the response. Adapter passes it through unchanged. No persistence for per-call cost. Credits charged flat per WhatsApp draft, not per token.

## Scope

Six providers + one adapter + one pipeline + one classifier + one new helper + one new migration + one pricing table + tests. ~250-350 lines.

## Files to modify (verified paths on `origin/main`)

### 1. Providers — extract `usage` from response

Each provider currently returns `{ text: cleanJsonResponse(text), raw: data }`. Change to `{ text, raw, usage: { inputTokens, outputTokens } }`. Extraction paths per API:

| File | Extraction |
|---|---|
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/claude.js` | `data.usage.input_tokens`, `data.usage.output_tokens` |
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/openai.js` | `data.usage.prompt_tokens`, `data.usage.completion_tokens` |
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/gemini.js` | `data.usageMetadata.promptTokenCount`, `data.usageMetadata.candidatesTokenCount` |
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/deepseek.js` | `data.usage.prompt_tokens`, `data.usage.completion_tokens` (OpenAI-compat) |
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/kimi.js` | `data.usage.prompt_tokens`, `data.usage.completion_tokens` (OpenAI-compat) |
| `backend/src/modules/whatsapp-listings/infrastructure/ai/providers/qwen.js` | `data.usage.prompt_tokens`, `data.usage.completion_tokens` (DashScope compat mode) |

For each: if the field is missing (older API responses, partial responses), record `0` and log a warn — don't throw. The call succeeded; observability is best-effort.

### 2. Adapter — attach `provider` + `model` + `fallbackFrom`

`backend/src/modules/whatsapp-listings/infrastructure/ai/adapter.js`.

Every adapter method (`extractProperty`, `classifyIntent`, `selectHeroImage`, `generateCaption`) currently returns whatever the provider returned. Change the wrapping so the return shape is `{ text, raw, usage, provider, model, fallbackFrom }`:

- `provider`: the provider name that actually served the call (`claude`/`openai`/`gemini`/`kimi`/`deepseek`/`qwen`) — critical for cost attribution, not the requested one
- `model`: the provider's `MODEL` constant (import each provider's constant, or expose via `provider.getModel()`)
- `fallbackFrom`: `null` if primary succeeded; otherwise the provider that was tried first

The fallback loop already tracks which providers failed — surface that upward.

### 3. New helper — `backend/src/lib/ai-usage-logger.js`

```js
import { v4 as uuidv4 } from 'uuid'
import { insert } from '../persistence/postgres-adapter.js'
import { AI_PRICING } from './ai-pricing.js'
import { logger } from './logger.js'

/**
 * Cost estimation. Returns cost in micro-USD (multiply cents by 10000).
 * NULL if we don't have a pricing entry for this provider+model.
 */
export function estimateCostMicroUsd(provider, model, inputTokens, outputTokens) {
  const key = `${provider}:${model}`
  const price = AI_PRICING[key]
  if (!price) return null
  const inputCost = (Number(inputTokens) || 0) * price.inputPerMillionMicroUsd / 1_000_000
  const outputCost = (Number(outputTokens) || 0) * price.outputPerMillionMicroUsd / 1_000_000
  return Math.round(inputCost + outputCost)
}

/**
 * Record a single AI call. Best-effort — a failed insert must NOT break the
 * caller. The call already succeeded; observability is optional.
 */
export async function recordAiCall({
  tenantId = null,
  feature,
  callType,
  providerResult,
  relatedEntityType = null,
  relatedEntityId = null,
  extras = {},
}) {
  try {
    const usage = providerResult.usage || { inputTokens: 0, outputTokens: 0 }
    const cost = estimateCostMicroUsd(providerResult.provider, providerResult.model, usage.inputTokens, usage.outputTokens)
    await insert('ai_call_usage', {
      id: uuidv4(),
      tenant_id: tenantId,
      feature,
      call_type: callType,
      provider: providerResult.provider,
      model: providerResult.model,
      input_tokens: Number(usage.inputTokens) || 0,
      output_tokens: Number(usage.outputTokens) || 0,
      cost_estimate_micro_usd: cost,
      fallback_from: providerResult.fallbackFrom || null,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      occurred_at: new Date().toISOString(),
      data: extras,
    })
  } catch (err) {
    logger.warn({ err, feature, callType }, 'recordAiCall failed — call succeeded, log did not')
  }
}
```

### 4. New pricing table — `backend/src/lib/ai-pricing.js`

Values in micro-USD per 1M tokens (multiply cents by 10000 to get micro-USD). Verify these numbers against each provider's live pricing before merge:

```js
export const AI_PRICING = {
  'claude:claude-3-haiku-20240307':      { inputPerMillionMicroUsd: 2_500,    outputPerMillionMicroUsd: 12_500 },
  'openai:gpt-4o-mini':                  { inputPerMillionMicroUsd: 1_500,    outputPerMillionMicroUsd: 6_000 },
  'gemini:gemini-1.5-flash':             { inputPerMillionMicroUsd: 750,      outputPerMillionMicroUsd: 3_000 },
  'kimi:moonshot-v1-8k-vision-preview':  { inputPerMillionMicroUsd: 16_500,   outputPerMillionMicroUsd: 16_500 },
  'deepseek:deepseek-chat':              { inputPerMillionMicroUsd: 2_700,    outputPerMillionMicroUsd: 11_000 },
  'qwen:qwen-vl-max':                    { inputPerMillionMicroUsd: 30_000,   outputPerMillionMicroUsd: 90_000 },
}
```

Adding a model = one entry here. Cost estimate returns NULL for unknown models so recording still works even if we forget to add a new model.

### 5. Migration — `backend/src/persistence/migrations/291_ai_call_usage.sql`

Auto-applied (no letter suffix). Next available number after `290_fin_backfill_constraints.sql`.

```sql
-- AI per-call usage log. Every downstream feature call records one row.
-- Best-effort insert (writer never fails the caller). Powers per-tenant AI
-- cost attribution, provider comparison, fallback-spike detection.

CREATE TABLE IF NOT EXISTS public.ai_call_usage (
  id UUID PRIMARY KEY,
  tenant_id TEXT,
  feature TEXT NOT NULL,
  call_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_estimate_micro_usd BIGINT CHECK (cost_estimate_micro_usd IS NULL OR cost_estimate_micro_usd >= 0),
  fallback_from TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_call_usage_tenant_occurred
  ON public.ai_call_usage (tenant_id, occurred_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_call_usage_feature_occurred
  ON public.ai_call_usage (feature, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_call_usage_related
  ON public.ai_call_usage (related_entity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_call_usage_provider_model_occurred
  ON public.ai_call_usage (provider, model, occurred_at DESC);
```

### 6. Wire the call sites

`backend/src/modules/whatsapp-listings/application/pipeline.js` — after each successful `aiAdapter.X(...)`, call `recordAiCall({ tenantId, feature: 'whatsapp-listings', callType: 'X', providerResult, relatedEntityType: 'draft', relatedEntityId: draftId })`. Call sites to instrument (already found in code):

- Line ~221: `aiAdapter.extractProperty(...)` — callType `'extractProperty'`
- Line ~266: `aiAdapter.selectHeroImage(...)` — callType `'selectHeroImage'`
- Line ~294: `aiAdapter.generateCaption({ platform: 'instagram', ... })` — callType `'generateCaption:instagram'`
- Line ~295: `aiAdapter.generateCaption({ platform: 'tiktok', ... })` — callType `'generateCaption:tiktok'`
- Line ~296: `aiAdapter.generateCaption({ platform: 'x', ... })` — callType `'generateCaption:x'`

`backend/src/modules/whatsapp-listings/application/intent.js` — line ~58: `aiAdapter.classifyIntent(...)` — callType `'classifyIntent'`.

Tenant id: use the session's `agent_id` when present, else `agency_id`. Related entity: the draft being processed if there is one, else the session id (type `'session'`).

## Testing expectations

- **Unit test per provider**: mock the fetch response with the canonical shape for that provider (record real responses in test fixtures if easier), assert `usage` is extracted correctly. Include a "usage field missing" case that returns `{ inputTokens: 0, outputTokens: 0 }` and logs a warn.
- **Unit test for `estimateCostMicroUsd`**: known-model + known-tokens → known-cost. Unknown-model → `null`. Zero tokens → `0`.
- **Unit test for `recordAiCall`**: happy path inserts row; DB failure logs warn but does not throw.
- **Integration test for whatsapp draft flow**: one full draft creates 5+ rows in `ai_call_usage` (extract + hero + 3 captions + intent). Assert each row has provider + model + tokens > 0.
- **Fallback test**: when primary provider is forced to fail (mock throw), row has `fallback_from` populated and `provider` reflects the actual server.

## Out of scope

- Do NOT change `CreditService.reserve()` / `.consume()` behavior. Flat-per-draft charging continues to work exactly as today. This PR is observability only.
- Do NOT wire ai_call_usage into the whatsapp-listings admin UI. Follow-up.
- Do NOT hook cost data into any pricing calculation. Cost is recorded, not enforced.
- Do NOT touch `fin.*` schema. This lives in `public.ai_call_usage`.

## Definition of done

- All 6 provider files return the new shape.
- Adapter returns `{ text, raw, usage, provider, model, fallbackFrom }`.
- Migration 291 applies cleanly on a fresh DB and on a DB carrying existing usage.
- Every existing call site is instrumented.
- Fast + Real-Postgres + Web suites all green.
- A single `SELECT provider, COUNT(*), SUM(cost_estimate_micro_usd) FROM ai_call_usage GROUP BY provider` after running the integration test suite returns non-zero for each provider that was exercised.

## Branch + PR

Branch: `feat/ai-call-usage-logging`
PR title: `AI per-call usage logging (providers + adapter + ai_call_usage table)`
Base: `main`
