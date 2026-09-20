-- Wave 2D — experiment shared vocabularies (land BEFORE table migrations).
-- Dimension / allocation / status from docs/canonical-object-model.md §H.

CREATE OR REPLACE FUNCTION public.growth_os_is_experiment_dimension(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'creative',
    'copy',
    'cta',
    'channel',
    'timing',
    'journey_path'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_experiment_allocation(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'even',
    'bandit'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_experiment_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'draft',
    'running',
    'concluded'
  );
$$;
