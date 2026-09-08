-- BE-BLOCKER-04: decompose conversations.source_channel into channel + source.
-- Dual-write window: source_channel is kept populated for 30 days; this
-- migration MUST NOT drop it.
--
-- conversation_messages already has a `channel` column — this file only
-- splits `conversations`.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill from existing source_channel. Re-runs skip rows already filled.
UPDATE conversations SET
  channel = CASE
    WHEN source_channel ILIKE 'whatsapp%' THEN 'whatsapp'
    WHEN source_channel ILIKE 'email%' THEN 'email'
    WHEN source_channel ILIKE 'sms%' THEN 'sms'
    WHEN source_channel ILIKE 'instagram%' OR source_channel ILIKE 'ig_dm%' THEN 'instagram_dm'
    WHEN source_channel ILIKE 'facebook%' OR source_channel ILIKE 'fb_%' THEN 'facebook_messenger'
    WHEN source_channel ILIKE 'tiktok%' THEN 'tiktok'
    WHEN source_channel ILIKE 'x_dm%' OR source_channel ILIKE 'twitter%' THEN 'x_dm'
    WHEN source_channel ILIKE 'linkedin%' THEN 'linkedin'
    WHEN source_channel ILIKE 'telegram%' THEN 'telegram'
    ELSE 'direct'
  END,
  source = CASE
    WHEN source_channel ILIKE '%bazaar%' THEN 'bazaar'
    WHEN source_channel ILIKE '%bayut%' THEN 'bayut'
    WHEN source_channel ILIKE '%property_finder%' THEN 'property_finder'
    WHEN source_channel ILIKE '%dubizzle%' THEN 'dubizzle'
    WHEN source_channel ILIKE '%olx%' THEN 'olx'
    ELSE 'direct'
  END
WHERE channel IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
