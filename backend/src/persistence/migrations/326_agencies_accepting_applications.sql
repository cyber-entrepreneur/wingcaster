-- BE-BLOCKER-08: agencies.accepting_applications
--
-- Owner/admin toggle for whether prospective agents may apply to join.
-- DEFAULT true preserves existing apply-open behavior; AGN-MEM-005 reads this
-- on the public agency surface to show agency-not-accepting-applications.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS accepting_applications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.agencies.accepting_applications IS
  'When false, public apply / join flows must refuse new applications (AGENCY_NOT_ACCEPTING).';
