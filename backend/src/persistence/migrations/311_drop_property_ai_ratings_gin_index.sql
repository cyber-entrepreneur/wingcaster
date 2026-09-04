-- Drop the GIN index added in 310. No reader filters into properties.ai_ratings today,
-- so the index only added write cost on every rateProperty save. Re-add when a reader
-- (analytics dashboard, agent-facing rating search) actually needs it.

DROP INDEX IF EXISTS public.idx_properties_ai_ratings_gin;
