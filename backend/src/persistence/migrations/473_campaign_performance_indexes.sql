-- AGN-REP-006 — indexes for agency campaign performance report queries.
-- Hot paths: filter campaigns by agency + status, aggregate enrollments/messages.

CREATE INDEX IF NOT EXISTS idx_campaigns_agency_status
  ON campaigns(agency_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign_status
  ON campaign_enrollments(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_channel_status
  ON campaign_messages(campaign_id, channel, status);
