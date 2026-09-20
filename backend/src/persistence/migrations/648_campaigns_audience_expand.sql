-- Wave 1D — expand campaigns with nullable audience_id; lift inline rules into audiences.
-- Expand-contract: legacy tags_filter / audience_rules in campaigns.data remain readable.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS audience_id TEXT;

CREATE INDEX IF NOT EXISTS idx_campaigns_audience_id
  ON public.campaigns (audience_id);

-- Lift existing inline audience shape into first-class audience rows (idempotent).
INSERT INTO public.audiences (
  id, agency_id, agent_id, name, type, rules, member_source, estimated_size, data
)
SELECT
  'aud_' || c.id,
  c.agency_id,
  c.agent_id,
  COALESCE(c.name, 'Campaign audience') || ' audience',
  'dynamic',
  jsonb_build_object(
    'tags_filter', COALESCE(c.data->'tags_filter', c.tags, '[]'::jsonb),
    'audience_rules', COALESCE(c.data->'audience_rules', '[]'::jsonb)
  ),
  'crm',
  NULL,
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'campaigns', 'id', c.id),
    'lifted_at', to_jsonb(CURRENT_TIMESTAMP)
  )
FROM public.campaigns c
WHERE c.audience_id IS NULL
  AND (
    jsonb_array_length(COALESCE(c.data->'tags_filter', c.tags, '[]'::jsonb)) > 0
    OR jsonb_array_length(COALESCE(c.data->'audience_rules', '[]'::jsonb)) > 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.audiences a
    WHERE a.id = 'aud_' || c.id
  );

UPDATE public.campaigns c
SET audience_id = 'aud_' || c.id,
    updated_at = CURRENT_TIMESTAMP
WHERE c.audience_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.audiences a WHERE a.id = 'aud_' || c.id
  );
