-- AGN-REP-001 — indexes for agency reports home summary queries.
-- Hot paths: filter properties/campaigns by agency + status, website analytics
-- events by collection + recency (legacy_collections bucket).

CREATE INDEX IF NOT EXISTS idx_properties_agency_status_created_at
  ON properties(agency_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_agency_status
  ON campaigns(agency_id, status);

CREATE INDEX IF NOT EXISTS idx_legacy_collections_website_analytics_created_at
  ON legacy_collections(collection, created_at DESC)
  WHERE collection = 'website_analytics';
