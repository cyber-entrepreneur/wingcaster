-- PA-PKG-006: package version deprecate lookups (subscriber impact + state filters).

CREATE INDEX IF NOT EXISTS idx_product_package_versions_pkg_state
  ON public.product_package_versions (package_id, state);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_pkg_version_active
  ON public.tenant_subscriptions (package_version_id)
  WHERE status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END');
