-- AGT-WLA-005: preserve the AI-produced draft before agent corrections so
-- per-field accepted-without-correction accuracy can be measured honestly.

ALTER TABLE wa_listings.drafts
  ADD COLUMN IF NOT EXISTS original_extracted_property JSONB;
