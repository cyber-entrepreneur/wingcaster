-- PA-WLA-003 — WhatsApp admin credit grant audit lookups.
-- Additive only: wa_listings.audit_logs exists from migration 013.

CREATE INDEX IF NOT EXISTS idx_wa_audit_logs_admin_credit_grant_created_at
  ON wa_listings.audit_logs (created_at DESC)
  WHERE action = 'admin_credit_grant';
