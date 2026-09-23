-- Adopt each paid tier's marketing price as its real billing price
-- (PLACEHOLDER amounts, per the launch decision). Migration 339 seeded the six
-- marketing tiers with display-only `price_usd_monthly_minor` while the billing
-- `monthly_price_minor` stayed 0. This copies the marketing amount into the
-- billing column so checkout, proration and invoices reflect a real price.
--
-- Published versions are normally immutable for economic fields
-- (trg_package_version_immutable). This is a controlled, one-time pre-launch
-- data seed run as the migration owner, so we disable that trigger for the
-- duration of the UPDATE only. FINAL prices are a business decision and will be
-- set later through the PA admin draft → approve → publish (new-version) flow,
-- which does NOT bypass the trigger.

ALTER TABLE public.product_package_versions DISABLE TRIGGER trg_package_version_immutable;

UPDATE public.product_package_versions v
   SET monthly_price_minor = v.price_usd_monthly_minor
  FROM public.product_packages p
 WHERE p.id = v.package_id
   AND v.state = 'PUBLISHED'
   AND v.monthly_price_minor = 0
   AND v.price_usd_monthly_minor IS NOT NULL
   AND v.price_usd_monthly_minor > 0
   AND p.code IN ('semsar', 'boutique', 'small_team', 'agency', 'brokerage', 'enterprise');

ALTER TABLE public.product_package_versions ENABLE TRIGGER trg_package_version_immutable;
