-- AGN-TPL-001 — agency message templates list index.

CREATE INDEX IF NOT EXISTS idx_message_templates_agency_list
  ON public.message_templates(owner_id, updated_at DESC)
  WHERE owner_type = 'agency';
