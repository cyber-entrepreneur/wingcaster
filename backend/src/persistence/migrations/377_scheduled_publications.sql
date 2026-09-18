-- AGT-PUB-007 — Schedule publish (later).
--
-- A scheduled publication captures the intent to run a portal publishing
-- job at a future time. When due, a worker (scheduled-publish-worker.js)
-- calls the SAME submitPortalPublishingJob() the immediate publish path
-- uses — scheduling is a thin layer in front of the existing job engine,
-- not a fork of it.
--
-- Recurrence 'weekly' re-arms the row for +7 days after each successful
-- fire (a lightweight "keep the listing fresh" re-post); 'none' fires once
-- and terminates. Scheduled rows surface in the publications tab
-- (AGT-LST-011) as "Scheduled" until fired.

CREATE TABLE IF NOT EXISTS scheduled_publications (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,           -- agent who scheduled it (owns the row)
  agency_id TEXT,                   -- agency scope at schedule time, when applicable
  portals JSONB NOT NULL,           -- array of channel codes or {code, country_code}
  message TEXT,                     -- optional caption carried to the job
  scheduled_at TIMESTAMPTZ NOT NULL,-- next fire time (UTC); the worker's due cursor
  timezone TEXT,                    -- IANA tz the agent picked, kept for display/recurrence
  recurrence TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'pending',
  job_id TEXT,                      -- publishing job created on the most recent fire
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT scheduled_publications_status_check
    CHECK (status IN ('pending', 'processing', 'published', 'cancelled', 'failed')),
  CONSTRAINT scheduled_publications_recurrence_check
    CHECK (recurrence IN ('none', 'weekly'))
);

-- The worker's hot path: pending rows whose time has come, oldest first.
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_due
  ON scheduled_publications(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_property
  ON scheduled_publications(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_publications_agent
  ON scheduled_publications(agent_id, created_at DESC);
