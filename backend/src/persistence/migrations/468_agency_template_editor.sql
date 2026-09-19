-- AGN-TPL-002 — agency template editor indexes.

CREATE INDEX IF NOT EXISTS idx_message_templates_agency_status
  ON public.message_templates(owner_id, approval_status, updated_at DESC)
  WHERE owner_type = 'agency';
