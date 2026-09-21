-- PR6 — catalog sync must bypass tenant RLS on channel_definitions.
-- growth_os_ensure_channel_definition maintains the global platform catalog and is
-- invoked from forward-sync triggers while marketplace_connections writes run under
-- growth_os_app_role + tenant GUCs. FORCE RLS on channel_definitions (mig 543)
-- requires a BYPASSRLS catalog maintainer owner for SECURITY DEFINER to succeed.

DO $$ BEGIN
  CREATE ROLE growth_os_catalog_maintainer NOLOGIN BYPASSRLS;
EXCEPTION
  WHEN duplicate_object THEN
    ALTER ROLE growth_os_catalog_maintainer BYPASSRLS;
END $$;

DO $$ BEGIN
  GRANT growth_os_catalog_maintainer TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.growth_os_ensure_channel_definition(p_platform TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  def_id TEXT;
BEGIN
  IF p_platform IS NULL OR p_platform = '' THEN
    RETURN NULL;
  END IF;
  def_id := 'chnd_' || md5(lower(p_platform));
  INSERT INTO public.channel_definitions (
    id, platform, kind, global_capabilities, created_at, updated_at, data
  ) VALUES (
    def_id,
    p_platform,
    public.growth_os_infer_channel_kind(p_platform),
    '{}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    jsonb_build_object('legacy_source', jsonb_build_object('derived_from', 'forward_sync'))
  )
  ON CONFLICT (id) DO UPDATE SET
    platform = EXCLUDED.platform,
    updated_at = CURRENT_TIMESTAMP;
  RETURN def_id;
END;
$$;

ALTER FUNCTION public.growth_os_ensure_channel_definition(TEXT)
  OWNER TO growth_os_catalog_maintainer;

-- BYPASSRLS bypasses row policies; table ACLs still apply to SECURITY DEFINER owner.
GRANT SELECT, INSERT, UPDATE ON public.channel_definitions TO growth_os_catalog_maintainer;

GRANT EXECUTE ON FUNCTION public.growth_os_ensure_channel_definition(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_os_infer_channel_kind(TEXT) TO growth_os_catalog_maintainer;
