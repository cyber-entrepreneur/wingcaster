-- BE-BLOCKER-35 follow-up — backfill portal_registry_versions v1 for seeded portals.
-- 355 created the versions table without seeding rows for the 4 portals from 323,
-- so GET /api/admin/portals/:code?version=1 404'd. Additive; do not edit 355.
-- Idempotent via ON CONFLICT (portal_code, version) DO NOTHING.

INSERT INTO public.portal_registry_versions (
  portal_code,
  version,
  snapshot,
  created_by_user_id
)
SELECT
  pr.code,
  1,
  jsonb_build_object(
    'id', pr.id,
    'code', pr.code,
    'display_name', pr.display_name,
    'description', pr.description,
    'logo_url', pr.logo_url,
    'country_codes', to_jsonb(pr.country_codes),
    'primary_language', pr.primary_language,
    'adapter_class_name', pr.adapter_class_name,
    'publisher_config', COALESCE(pr.publisher_config, '{}'::jsonb),
    'inbound_config', COALESCE(pr.inbound_config, '{}'::jsonb),
    'validator_ref', pr.validator_ref,
    'is_active', pr.is_active,
    'effective_from', pr.effective_from,
    'deprecated_at', pr.deprecated_at,
    'current_version', 1
  ),
  NULL
FROM public.portal_registry pr
WHERE pr.code IN ('olx', 'property_finder', 'bayut', 'dubizzle')
ON CONFLICT (portal_code, version) DO NOTHING;
