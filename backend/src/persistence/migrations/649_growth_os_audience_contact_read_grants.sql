-- Wave 1D — read grants for audience resolution under growth_os_app_role.
-- resolveAudience evaluates CRM contacts inside withTenant (same pattern as mig 552).

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.contacts TO growth_os_app_role;
