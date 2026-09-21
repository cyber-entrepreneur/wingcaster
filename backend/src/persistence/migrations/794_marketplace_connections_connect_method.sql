-- PR0 — connect_method on marketplace_connections + agency_id backfill.

ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS connect_method TEXT;

ALTER TABLE public.marketplace_connections
  DROP CONSTRAINT IF EXISTS marketplace_connections_connect_method_check;

ALTER TABLE public.marketplace_connections
  ADD CONSTRAINT marketplace_connections_connect_method_check
  CHECK (connect_method IS NULL OR connect_method IN ('oauth', 'manual'));

UPDATE public.marketplace_connections AS mc
SET agency_id = a.agency_id
FROM public.agents AS a
WHERE mc.agent_id = a.id
  AND mc.agency_id IS NULL
  AND a.agency_id IS NOT NULL;
