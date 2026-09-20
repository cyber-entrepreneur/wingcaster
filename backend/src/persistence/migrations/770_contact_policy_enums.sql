-- Wave 2E — ContactPolicy vocabularies (enum-first; land before table migrations).

CREATE OR REPLACE FUNCTION public.growth_os_is_contact_policy_scope(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN ('agency', 'agent');
$$;
