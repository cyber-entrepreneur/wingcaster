-- BE-BLOCKER-29 — capability packs schema + two-person finance grant action.
-- 1. tenant_memberships.capability_packs JSONB assignment column
-- 2. capability_pack_definitions seeded with Finance / Marketer / Read-Only / Custom
-- 3. fin.approval_requests.action_kind CAPABILITY_PACK_FINANCE_GRANT
-- Numbering: 338 is highest on main; 340+ reserved for Agent 2.

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS capability_packs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tenant_memberships.capability_packs IS
  'Assigned capability pack slugs/ids (AGN-ROL-001). JSON array of strings.';

CREATE TABLE IF NOT EXISTS public.capability_pack_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seeded BOOLEAN NOT NULL DEFAULT true,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  editable BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT capability_pack_definitions_slug_unique UNIQUE (slug),
  CONSTRAINT capability_pack_definitions_custom_editable_check CHECK (
    (is_custom = false AND editable = false)
    OR (is_custom = true AND editable = true)
  )
);

CREATE INDEX IF NOT EXISTS idx_capability_pack_definitions_sort
  ON public.capability_pack_definitions (sort_order, slug);

COMMENT ON TABLE public.capability_pack_definitions IS
  'Seeded agency capability packs (BE-BLOCKER-29 / AGN-ROL-001). v1: one Custom slot, no create.';

INSERT INTO public.capability_pack_definitions (
  id, slug, name, description, capabilities, is_seeded, is_custom, editable, sort_order, data
) VALUES (
  'finance',
  'finance',
  'Finance',
  'Billing, invoices, credit adjustments, payout approvals, revenue reports.',
  '[
    {"key":"billing.payments.write","label":"Bill payments","description":"Initiate bill payments to vendors.","domain":"billing","is_financial":true},
    {"key":"billing.payouts.approve","label":"Approve payouts","description":"Approve outgoing payouts.","domain":"billing","is_financial":true},
    {"key":"billing.invoices.read","label":"View invoices","description":"View agency invoices and billing history.","domain":"billing","is_financial":true},
    {"key":"billing.credits.adjust","label":"Adjust credits","description":"Grant or adjust credit balances.","domain":"billing","is_financial":true},
    {"key":"billing.revenue.read","label":"View revenue reports","description":"View revenue and financial reports.","domain":"billing","is_financial":true},
    {"key":"billing.subscriptions.manage","label":"Manage subscriptions","description":"Change package subscriptions and billing cadence.","domain":"billing","is_financial":true},
    {"key":"settings.access.read","label":"View access settings","description":"View roles and permission settings.","domain":"settings","is_financial":false}
  ]'::jsonb,
  true, false, false, 10,
  '{"requires_two_person":true,"kind":"seeded"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.capability_pack_definitions (
  id, slug, name, description, capabilities, is_seeded, is_custom, editable, sort_order, data
) VALUES (
  'marketer',
  'marketer',
  'Marketer',
  'Listing publishing, portal syndication, social broadcast, campaign metrics.',
  '[
    {"key":"listings.publish","label":"Publish listings","description":"Publish listings to portals and Bazaar.","domain":"listings","is_financial":false},
    {"key":"listings.create","label":"Create listing","description":"Create new property listings.","domain":"listings","is_financial":false},
    {"key":"listings.edit","label":"Edit listing","description":"Modify existing listings.","domain":"listings","is_financial":false},
    {"key":"publishing.portal.syndicate","label":"Portal syndication","description":"Syndicate listings to external portals.","domain":"publishing","is_financial":false},
    {"key":"broadcasts.send","label":"Send broadcasts","description":"Send social and marketing broadcasts.","domain":"publishing","is_financial":false},
    {"key":"campaigns.manage","label":"Manage campaigns","description":"Create and manage marketing campaigns.","domain":"publishing","is_financial":false},
    {"key":"campaigns.metrics.read","label":"Campaign metrics","description":"View campaign performance metrics.","domain":"analytics","is_financial":false},
    {"key":"settings.access.read","label":"View access settings","description":"View roles and permission settings.","domain":"settings","is_financial":false}
  ]'::jsonb,
  true, false, false, 20,
  '{"requires_two_person":false,"kind":"seeded"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.capability_pack_definitions (
  id, slug, name, description, capabilities, is_seeded, is_custom, editable, sort_order, data
) VALUES (
  'read_only',
  'read_only',
  'Read-Only',
  'View everything, change nothing. For auditors and shadowing staff.',
  '[
    {"key":"listings.read","label":"View listings","description":"View property listings.","domain":"listings","is_financial":false},
    {"key":"crm.leads.read","label":"View leads","description":"View CRM leads and inquiries.","domain":"crm","is_financial":false},
    {"key":"crm.contacts.read","label":"View contacts","description":"View contact records.","domain":"crm","is_financial":false},
    {"key":"publishing.read","label":"View publishing","description":"View publishing and syndication status.","domain":"publishing","is_financial":false},
    {"key":"analytics.reports.read","label":"View reports","description":"View analytics reports.","domain":"analytics","is_financial":false},
    {"key":"billing.invoices.read","label":"View billing","description":"View invoices (read-only).","domain":"billing","is_financial":false},
    {"key":"billing.revenue.read","label":"View revenue reports","description":"View revenue reports (read-only).","domain":"billing","is_financial":false},
    {"key":"settings.access.read","label":"View access settings","description":"View roles and permission settings.","domain":"settings","is_financial":false},
    {"key":"settings.team.read","label":"View team","description":"View agency members.","domain":"settings","is_financial":false},
    {"key":"campaigns.metrics.read","label":"View campaign metrics","description":"View campaign metrics.","domain":"analytics","is_financial":false},
    {"key":"listings.archive.read","label":"View archives","description":"View archived listings.","domain":"listings","is_financial":false},
    {"key":"crm.pipeline.read","label":"View pipeline","description":"View opportunity pipeline.","domain":"crm","is_financial":false}
  ]'::jsonb,
  true, false, false, 30,
  '{"requires_two_person":false,"kind":"seeded"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.capability_pack_definitions (
  id, slug, name, description, capabilities, is_seeded, is_custom, editable, sort_order, data
) VALUES (
  'custom',
  'custom',
  'Custom',
  'Your agency''s own capability set. Edit any capability on or off.',
  '[]'::jsonb,
  true, true, true, 40,
  '{"requires_two_person":false,"kind":"custom"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE',
    'PRICE_REPORT_INCORPORATE', 'COMPARABLE_REMOVE',
    'CAPABILITY_PACK_FINANCE_GRANT'
  ));
