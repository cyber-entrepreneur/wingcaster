-- Wave 1C — Creative Asset Service shared vocabularies (enum-first).

CREATE OR REPLACE FUNCTION public.growth_os_is_creative_source(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('manual', 'ai');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_creative_approval_state(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('not_required', 'pending', 'approved', 'rejected');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_creative_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('draft', 'ready', 'published', 'archived');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_creative_rendition_provider(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('local', 'bannerbear');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_creative_rendition_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('pending', 'rendering', 'ready', 'failed');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_approval_request_state(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('pending', 'approved', 'rejected');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_approval_subject_type(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('creative');
$$;
