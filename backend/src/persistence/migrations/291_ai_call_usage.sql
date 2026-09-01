-- AI per-call usage log. Every downstream feature call records one row.
-- Best-effort insert (writer never fails the caller). Powers per-tenant AI
-- cost attribution, provider comparison, fallback-spike detection.
--
-- created_at / updated_at are required by the DAL insert path
-- (postgres-adapter always writes those columns). occurred_at is the
-- semantic event time used for cost queries.

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
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
