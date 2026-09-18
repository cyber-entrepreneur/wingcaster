-- AGN-REP-004 — indexes for agency agent leaderboard queries.
-- Hot paths: rank agents by closed-won opportunities and response-time samples.

CREATE INDEX IF NOT EXISTS idx_opportunities_agency_agent_stage
  ON opportunities(agency_id, agent_id, stage);

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_agent_created_at
  ON conversations(assigned_agent_id, created_at DESC);
