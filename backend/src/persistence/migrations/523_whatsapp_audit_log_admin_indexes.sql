-- PA-WLA-004 — WhatsApp audit log admin list filters (agent, action, recency).
-- Additive only: wa_listings.audit_logs exists from migration 013.

CREATE INDEX IF NOT EXISTS idx_wa_audit_logs_agent_created_at
  ON wa_listings.audit_logs (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_audit_logs_action_created_at
  ON wa_listings.audit_logs (action, created_at DESC);
