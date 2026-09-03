-- PR C — fin_app_role must UPDATE/DELETE draft quotas and flags.
-- PR B revoked those privileges globally so "add or update quota (DRAFT only)"
-- could not be implemented. Immutability triggers on published/deprecated
-- parents still block child-row mutations.
--
-- Does not change PR A/B table shapes. No new advisory lock.

GRANT UPDATE, DELETE ON public.package_feature_quotas TO fin_app_role;
GRANT UPDATE, DELETE ON public.package_feature_flags TO fin_app_role;
