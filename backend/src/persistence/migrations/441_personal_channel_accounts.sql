-- AGT-CHN-003: multiple named accounts per social platform, with one primary.

ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS handle TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS health TEXT;

UPDATE public.marketplace_connections
SET
  account_name = COALESCE(
    account_name,
    data->>'account_name',
    data->'settings'->>'handle',
    platform || ' account'
  ),
  handle = COALESCE(
    handle,
    data->>'handle',
    data->'settings'->>'handle'
  )
WHERE account_name IS NULL OR handle IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY agent_id, platform
      ORDER BY created_at ASC, id ASC
    ) AS position
  FROM public.marketplace_connections
  WHERE status <> 'disconnected'
)
UPDATE public.marketplace_connections AS connection
SET is_primary = (ranked.position = 1)
FROM ranked
WHERE connection.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_connections_primary
  ON public.marketplace_connections (agent_id, platform)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_agent_platform
  ON public.marketplace_connections (agent_id, platform, created_at);
