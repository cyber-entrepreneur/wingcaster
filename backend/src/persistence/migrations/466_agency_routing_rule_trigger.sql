-- AGN-ROU-002 — structured trigger on tenant lead routing policies.

ALTER TABLE public.tenant_lead_routing_policies
  ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'inquiry';

ALTER TABLE public.tenant_lead_routing_policies
  DROP CONSTRAINT IF EXISTS tenant_lead_routing_policies_trigger_check;

ALTER TABLE public.tenant_lead_routing_policies
  ADD CONSTRAINT tenant_lead_routing_policies_trigger_check
  CHECK (trigger IN ('inquiry', 'comment', 'whatsapp_message'));

CREATE INDEX IF NOT EXISTS idx_tenant_lead_routing_policy_trigger
  ON public.tenant_lead_routing_policies(tenant_id, trigger, enabled, priority);
