-- BE-BLOCKER-36 — contact_relationships CRUD support
-- * Add `rejected` to the status CHECK (consent decline path)
-- * Contested-exclusivity unique index (active/confirmed exclusive per contact+party)
-- * Cross-tenant visibility flag on contacts for the redacted "other" list

ALTER TABLE public.contact_relationships
  DROP CONSTRAINT IF EXISTS contact_relationships_status_check;

ALTER TABLE public.contact_relationships
  ADD CONSTRAINT contact_relationships_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'active',
    'suspended',
    'ended',
    'expired',
    'rejected'
  ));

-- Only one exclusive representation may be confirmed/active per contact + party_type
-- across all tenants (same contact_id). Pending exclusives are allowed until confirm.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_exclusive_buyer_rep
  ON public.contact_relationships (contact_id, party_type)
  WHERE exclusivity = 'exclusive'
    AND status IN ('confirmed', 'active');

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS cross_tenant_visibility BOOLEAN NOT NULL DEFAULT true;
