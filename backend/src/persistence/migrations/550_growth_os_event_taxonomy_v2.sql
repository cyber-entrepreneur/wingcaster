-- Growth-OS Wave 0 — event taxonomy v2 (docs/event-taxonomy-catalog.md §1–§3B).
-- Expand-contract: idempotency_key dedup, typed actor/object, identity refs, MetricObservation.

CREATE OR REPLACE FUNCTION public.growth_os_is_actor_type(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('agent', 'contact', 'system', 'ai');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_metric_aggregation_type(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('cumulative', 'gauge');
$$;

-- v2 launch [L] / starred event_name vocabulary (replaces 549 list).
CREATE OR REPLACE FUNCTION public.growth_os_is_event_name(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IN (
    -- business [L] + starred human commercial actions
    'lead.created',
    'lead.qualified',
    'lead.assigned',
    'lead.contacted',
    'viewing.booked',
    'viewing.completed',
    'offer.made',
    'reservation.created',
    'transaction.closed',
    'commission.earned',
    -- delivery [L]
    'message.submitted',
    'message.delivered',
    'message.failed',
    'post.published',
    'post.failed',
    'portal.submitted',
    -- engagement [L] — discrete interactions only (no cumulative post metrics)
    'email.opened',
    'email.clicked',
    'message.read',
    'message.replied',
    'link.clicked',
    'unsubscribe.requested',
    -- system [L starred]
    'execution.created',
    'consent.granted',
    'consent.withdrawn',
    'journey.entered',
    'journey.node.suppressed'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_event_name_category(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE v
    WHEN 'lead.created' THEN 'business'
    WHEN 'lead.qualified' THEN 'business'
    WHEN 'lead.assigned' THEN 'business'
    WHEN 'lead.contacted' THEN 'business'
    WHEN 'viewing.booked' THEN 'business'
    WHEN 'viewing.completed' THEN 'business'
    WHEN 'offer.made' THEN 'business'
    WHEN 'reservation.created' THEN 'business'
    WHEN 'transaction.closed' THEN 'business'
    WHEN 'commission.earned' THEN 'business'
    WHEN 'message.submitted' THEN 'delivery'
    WHEN 'message.delivered' THEN 'delivery'
    WHEN 'message.failed' THEN 'delivery'
    WHEN 'post.published' THEN 'delivery'
    WHEN 'post.failed' THEN 'delivery'
    WHEN 'portal.submitted' THEN 'delivery'
    WHEN 'email.opened' THEN 'engagement'
    WHEN 'email.clicked' THEN 'engagement'
    WHEN 'message.read' THEN 'engagement'
    WHEN 'message.replied' THEN 'engagement'
    WHEN 'link.clicked' THEN 'engagement'
    WHEN 'unsubscribe.requested' THEN 'engagement'
    WHEN 'execution.created' THEN 'system'
    WHEN 'consent.granted' THEN 'system'
    WHEN 'consent.withdrawn' THEN 'system'
    WHEN 'journey.entered' THEN 'system'
    WHEN 'journey.node.suppressed' THEN 'system'
    ELSE NULL
  END;
$$;

-- Events: add v2 columns, migrate dedup key, split actor/object.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS subject_identity_id TEXT,
  ADD COLUMN IF NOT EXISTS identity_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS object_type TEXT,
  ADD COLUMN IF NOT EXISTS object_id TEXT;

UPDATE public.events
SET idempotency_key = provider_event_id
WHERE idempotency_key IS NULL
  AND provider_event_id IS NOT NULL;

-- Backfill typed actor/object only while legacy columns still exist (re-apply safe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'actor'
  ) THEN
    UPDATE public.events
    SET
      actor_type = split_part(actor, ':', 1),
      actor_id = NULLIF(split_part(actor, ':', 2), '')
    WHERE actor IS NOT NULL
      AND actor LIKE '%:%'
      AND actor_type IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'object_ref'
  ) THEN
    UPDATE public.events
    SET
      object_type = split_part(object_ref, ':', 1),
      object_id = NULLIF(split_part(object_ref, ':', 2), '')
    WHERE object_ref IS NOT NULL
      AND object_ref LIKE '%:%'
      AND object_type IS NULL;
  END IF;
END $$;

UPDATE public.events
SET idempotency_key = 'legacy:' || id
WHERE idempotency_key IS NULL;

DROP INDEX IF EXISTS public.uq_events_provider_event_id;

ALTER TABLE public.events
  ALTER COLUMN provider_event_id DROP NOT NULL;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS actor,
  DROP COLUMN IF EXISTS object_ref;

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_idempotency_key
  ON public.events (idempotency_key);

ALTER TABLE public.events
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_actor_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_actor_type_check
    CHECK (public.growth_os_is_actor_type(actor_type));

-- Re-apply event_name constraints with v2 vocabulary (drops legacy message.sent / post.impression rows if any).
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_name_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_name_check
    CHECK (public.growth_os_is_event_name(event_name));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_name_category_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_name_category_check
    CHECK (public.growth_os_event_name_category(event_name) = event_category);

CREATE INDEX IF NOT EXISTS idx_events_idempotency_key ON public.events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_events_subject_identity ON public.events (subject_identity_id);
CREATE INDEX IF NOT EXISTS idx_events_object ON public.events (object_type, object_id);

-- MetricObservation: cumulative platform counters (§3B) — not Events.
CREATE TABLE IF NOT EXISTS public.metric_observations (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  execution_id TEXT REFERENCES public.executions(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  metric_value BIGINT NOT NULL,
  aggregation_type TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT,
  provider_ref TEXT,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT metric_observations_aggregation_type_check
    CHECK (public.growth_os_is_metric_aggregation_type(aggregation_type))
);

CREATE INDEX IF NOT EXISTS idx_metric_observations_subject
  ON public.metric_observations (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_metric_observations_execution
  ON public.metric_observations (execution_id);
CREATE INDEX IF NOT EXISTS idx_metric_observations_metric_name
  ON public.metric_observations (metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_observations_observed_at
  ON public.metric_observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_observations_agency
  ON public.metric_observations (agency_id);
CREATE INDEX IF NOT EXISTS idx_metric_observations_agent
  ON public.metric_observations (agent_id);

ALTER TABLE public.metric_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_observations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metric_observations_tenant_guc ON public.metric_observations;
CREATE POLICY metric_observations_tenant_guc ON public.metric_observations
  FOR ALL
  USING (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR agency_id = NULLIF(current_setting('app.agency_id', true), '')
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR agency_id = NULLIF(current_setting('app.agency_id', true), '')
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_observations TO growth_os_app_role;
