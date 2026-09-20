-- Wave 1C — Creative Asset Service tables (expand-only).

CREATE TABLE IF NOT EXISTS public.creatives (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL DEFAULT 'listing',
  subject_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  approval_state TEXT NOT NULL DEFAULT 'not_required',
  status TEXT NOT NULL DEFAULT 'draft',
  channel_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT creatives_source_check
    CHECK (public.growth_os_is_creative_source(source)),
  CONSTRAINT creatives_approval_state_check
    CHECK (public.growth_os_is_creative_approval_state(approval_state)),
  CONSTRAINT creatives_status_check
    CHECK (public.growth_os_is_creative_status(status))
);

CREATE INDEX IF NOT EXISTS idx_creatives_agency ON public.creatives (agency_id);
CREATE INDEX IF NOT EXISTS idx_creatives_agent ON public.creatives (agent_id);
CREATE INDEX IF NOT EXISTS idx_creatives_subject ON public.creatives (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_creatives_approval_state ON public.creatives (approval_state);

CREATE TABLE IF NOT EXISTS public.creative_variants (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  creative_id TEXT NOT NULL,
  label TEXT NOT NULL,
  copy JSONB NOT NULL DEFAULT '{}'::jsonb,
  experiment_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_creative_variants_creative ON public.creative_variants (creative_id);
CREATE INDEX IF NOT EXISTS idx_creative_variants_agency ON public.creative_variants (agency_id);
CREATE INDEX IF NOT EXISTS idx_creative_variants_agent ON public.creative_variants (agent_id);
CREATE INDEX IF NOT EXISTS idx_creative_variants_experiment ON public.creative_variants (experiment_id)
  WHERE experiment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creative_renditions (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  creative_variant_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  asset_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT creative_renditions_provider_check
    CHECK (public.growth_os_is_creative_rendition_provider(provider)),
  CONSTRAINT creative_renditions_status_check
    CHECK (public.growth_os_is_creative_rendition_status(status))
);

CREATE INDEX IF NOT EXISTS idx_creative_renditions_variant ON public.creative_renditions (creative_variant_id);
CREATE INDEX IF NOT EXISTS idx_creative_renditions_channel ON public.creative_renditions (channel_key);
CREATE INDEX IF NOT EXISTS idx_creative_renditions_agency ON public.creative_renditions (agency_id);
CREATE INDEX IF NOT EXISTS idx_creative_renditions_agent ON public.creative_renditions (agent_id);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_version INTEGER NOT NULL DEFAULT 1,
  requested_by TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  reviewers JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT approval_requests_subject_type_check
    CHECK (public.growth_os_is_approval_subject_type(subject_type)),
  CONSTRAINT approval_requests_state_check
    CHECK (public.growth_os_is_approval_request_state(state))
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_subject ON public.approval_requests (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_agency ON public.approval_requests (agency_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_agent ON public.approval_requests (agent_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_state ON public.approval_requests (state);
