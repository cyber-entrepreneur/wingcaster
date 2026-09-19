-- AGT-LST-014 / WF-34: agent challenge to the selected canonical primary.

CREATE TABLE IF NOT EXISTS public.canonical_primary_disputes (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL REFERENCES public.canonical_properties(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  requester_agent_id TEXT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  requester_agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  mandate_type TEXT NOT NULL DEFAULT 'exclusive'
    CHECK (mandate_type IN ('exclusive')),
  mandate_reference TEXT NOT NULL,
  evidence_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  resolved_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_canonical_primary_dispute_pending
  ON public.canonical_primary_disputes (canonical_id, requester_agent_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_canonical_primary_disputes_queue
  ON public.canonical_primary_disputes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_primary_disputes_listing
  ON public.canonical_primary_disputes (listing_id, created_at DESC);
