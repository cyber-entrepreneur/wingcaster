-- BE-BLOCKER-32 / BE-VERIFY-11 — env-scoped package catalog (LIVE ≠ TEST).
-- Idempotent. Migration slot 350 reserved for PA-PKG bundle.

ALTER TABLE public.product_packages
  ADD COLUMN IF NOT EXISTS environment TEXT;

UPDATE public.product_packages
   SET environment = 'LIVE'
 WHERE environment IS NULL;

ALTER TABLE public.product_packages
  ALTER COLUMN environment SET DEFAULT 'LIVE';

ALTER TABLE public.product_packages
  ALTER COLUMN environment SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_product_packages_environment'
       AND conrelid = 'public.product_packages'::regclass
  ) THEN
    ALTER TABLE public.product_packages
      ADD CONSTRAINT chk_product_packages_environment
      CHECK (environment IN ('LIVE', 'TEST'));
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'product_packages_code_key'
       AND conrelid = 'public.product_packages'::regclass
  ) THEN
    ALTER TABLE public.product_packages DROP CONSTRAINT product_packages_code_key;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_packages_environment_code
  ON public.product_packages (environment, code);

CREATE INDEX IF NOT EXISTS idx_product_packages_environment_active
  ON public.product_packages (environment, active);

CREATE INDEX IF NOT EXISTS idx_product_packages_environment_id
  ON public.product_packages (environment, id);
