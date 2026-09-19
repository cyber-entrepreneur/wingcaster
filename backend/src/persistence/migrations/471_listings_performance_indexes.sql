-- AGN-REP-002 — indexes for agency listings performance report queries.
-- Hot paths: filter properties by agency + property type, join inquiries/viewings
-- by agency + property, and scan listing_events from legacy_collections.

CREATE INDEX IF NOT EXISTS idx_properties_agency_property_type
  ON properties(agency_id, property_type);

CREATE INDEX IF NOT EXISTS idx_inquiries_agency_property_id
  ON inquiries(agency_id, property_id);

CREATE INDEX IF NOT EXISTS idx_viewings_agency_property_id
  ON viewings(agency_id, property_id);

CREATE INDEX IF NOT EXISTS idx_legacy_collections_listing_events_created_at
  ON legacy_collections(collection, created_at DESC)
  WHERE collection = 'listing_events';
