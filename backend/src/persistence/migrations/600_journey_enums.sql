-- Wave 1A — journey shared vocabularies (land BEFORE table migrations).

CREATE OR REPLACE FUNCTION public.growth_os_is_journey_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'draft', 'active', 'paused', 'archived'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_journey_run_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'active', 'completed', 'exited', 'suppressed'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_journey_node_type(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'trigger', 'wait', 'send', 'condition', 'branch',
    'lead_score', 'goal', 'exit', 'experiment'
  );
$$;
