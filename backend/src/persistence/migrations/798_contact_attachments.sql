-- Private, tenant-scoped attachments for contacts (full form Pre-Approval Letter
-- and future contact files). Bytes live in a PRIVATE store off /uploads; this
-- table holds only metadata. Never expose storage_key or a public URL to clients;
-- downloads are proxied through an auth + ownership gate.

CREATE TABLE IF NOT EXISTS public.contact_attachments (
  id                 TEXT PRIMARY KEY,
  contact_id         TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agency_id          TEXT,
  assigned_agent_id  TEXT,
  kind               TEXT NOT NULL DEFAULT 'other',
  storage_key        TEXT NOT NULL,
  filename           TEXT,
  content_type       TEXT,
  size_bytes         BIGINT,
  sha256             TEXT,
  created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  data               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_contact_attachments_contact_id ON public.contact_attachments (contact_id);
