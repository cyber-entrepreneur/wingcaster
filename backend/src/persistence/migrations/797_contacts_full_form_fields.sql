-- Full CRM contact form — promote the queryable/lookup fields to typed columns.
-- Everything else on the full form (address, socials, phones[]/emails[], family,
-- property interests, source-of-funds, financial institutions, etc.) persists in
-- the contacts.data JSONB via the table-mapper and needs no schema change.
--
-- These are all new nullable columns on a single table (no shared CHECK/enum
-- constraint is touched), so this ships as one migration. Enum-like values
-- (contact_role, qualification_status) are validated at the API layer (Zod),
-- matching the existing free-text `source` column, so the set can evolve without
-- a follow-up migration.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_name            TEXT,
  ADD COLUMN IF NOT EXISTS last_name             TEXT,
  ADD COLUMN IF NOT EXISTS contact_role          TEXT,
  ADD COLUMN IF NOT EXISTS organization_name     TEXT,
  ADD COLUMN IF NOT EXISTS reports_to_contact_id TEXT REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qualification_status  TEXT,
  ADD COLUMN IF NOT EXISTS budget_amount         NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS budget_currency       TEXT,
  ADD COLUMN IF NOT EXISTS email_opt_out         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_call           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_owner          BOOLEAN NOT NULL DEFAULT false;

-- Lookups by role / qualification (agent CRM filters) and by the self-referential
-- "reports to" edge.
CREATE INDEX IF NOT EXISTS idx_contacts_contact_role ON public.contacts (contact_role);
CREATE INDEX IF NOT EXISTS idx_contacts_qualification_status ON public.contacts (qualification_status);
CREATE INDEX IF NOT EXISTS idx_contacts_reports_to_contact_id ON public.contacts (reports_to_contact_id);
