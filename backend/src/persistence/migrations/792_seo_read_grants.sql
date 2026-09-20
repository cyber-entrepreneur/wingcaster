-- Wave 2F — read grants for SEO property resolution under growth_os_app_role.
-- Mirrors mig 649 (contacts) — properties has no RLS; grant SELECT only.

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.properties TO growth_os_app_role;
