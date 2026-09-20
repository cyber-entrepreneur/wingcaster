-- Wave 1D — audience vocabularies (enum-first; land before table migrations).

CREATE OR REPLACE FUNCTION public.growth_os_is_audience_type(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('static', 'dynamic');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_audience_member_source(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('crm', 'followers', 'lookalike', 'uploaded');
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_audience_membership_state(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'matched', 'contactable', 'frequency_capped', 'opted_out', 'conflicting'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_audience_inclusion(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('include', 'exclude');
$$;
