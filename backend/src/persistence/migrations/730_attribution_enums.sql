-- Wave 2C — attribution shared vocabularies (land BEFORE table migrations).
-- Funnel stages + attribution models from docs/canonical-object-model.md §H
-- and docs/event-taxonomy-catalog.md §5.

CREATE OR REPLACE FUNCTION public.growth_os_is_funnel_stage(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'impression',
    'click',
    'lead',
    'qualified',
    'viewing',
    'offer',
    'reservation',
    'transaction',
    'commission'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_attribution_model(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'last',
    'first',
    'linear',
    'position',
    'data_driven'
  );
$$;
