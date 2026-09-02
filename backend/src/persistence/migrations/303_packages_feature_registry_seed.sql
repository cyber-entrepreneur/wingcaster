-- PR B — seed every feature the platform meters today.
-- Cross-checked against:
--   backend/src/lib/ai-pricing.js (provider list prices, used for AI estimates)
--   backend/src/lib/notifications/{instagram,facebook,tiktok,x,linkedin}.js
--   backend/src/whatsapp.js + modules/whatsapp-listings
--   backend/src/lib/notifications/sms.js
--   backend/src/modules/listings-ai
--   backend/src/contact-360.js (lead score + lead summary)
--   backend/src/lib/comment-classifier.js
--   backend/src/modules/area-intelligence
--   backend/src/modules/property-valuation (market pricing)
--   backend/src/modules/social-cards (BannerBear)
--
-- credits_per_unit is in centi-credits (scale 100); 100 = 1.00 credit.
-- cost_per_unit_micro_usd is a best-current-estimate for audits, not enforcement.
-- ON CONFLICT is omitted: this file runs once via schema_migrations.

-- Cost sources (retrieved 2026-09-02):
--   Meta WhatsApp conversation-window (utility, Saudi/UAE band):
--     https://developers.facebook.com/docs/whatsapp/pricing
--   Twilio SMS outbound (UAE / MENA blended):
--     https://www.twilio.com/en-us/sms/pricing/ae
--   OpenAI gpt-4o-mini input/output:
--     https://platform.openai.com/docs/pricing  (also backend/src/lib/ai-pricing.js)
--   Anthropic Claude 3 Haiku:
--     https://www.anthropic.com/pricing
--   BannerBear image render (starter per-image equivalent):
--     https://www.bannerbear.com/pricing/
--   Social / portal publishes: platform-owned API tokens, no per-post vendor invoice
--     → cost_source = platform_bulk, cost_per_unit_micro_usd NULL until a bill exists.

INSERT INTO public.metered_features (
  id, code, display_name, category, meter_unit, cost_source,
  credits_per_unit, cost_per_unit_micro_usd, active, data
) VALUES
  -- Publishing / social (per active-property post)
  ('30200000-0000-4000-8000-000000000001', 'publishing.social.instagram',
   'Instagram publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"instagram","source":"lib/notifications/instagram.js"}'::jsonb),
  ('30200000-0000-4000-8000-000000000002', 'publishing.social.facebook',
   'Facebook publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"facebook","source":"lib/notifications/facebook.js"}'::jsonb),
  ('30200000-0000-4000-8000-000000000003', 'publishing.social.tiktok',
   'TikTok publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"tiktok","source":"lib/notifications/tiktok.js"}'::jsonb),
  ('30200000-0000-4000-8000-000000000004', 'publishing.social.x',
   'X (Twitter) publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"x","source":"lib/notifications/x.js"}'::jsonb),
  ('30200000-0000-4000-8000-000000000005', 'publishing.social.linkedin',
   'LinkedIn publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"linkedin","source":"lib/notifications/linkedin.js"}'::jsonb),
  ('30200000-0000-4000-8000-000000000006', 'publishing.social.whatsapp',
   'WhatsApp status / listing card publish', 'publishing.social', 'post', 'platform_bulk',
   100, NULL, true, '{"channel":"whatsapp","source":"whatsapp.js"}'::jsonb),

  -- Publishing / real-estate portals (MENA-relevant; PR D wires adapters)
  ('30200000-0000-4000-8000-000000000011', 'publishing.realestate.olx',
   'OLX publish', 'publishing.realestate', 'post', 'platform_bulk',
   100, NULL, true, '{"portal":"olx","region":"MENA"}'::jsonb),
  ('30200000-0000-4000-8000-000000000012', 'publishing.realestate.property_finder',
   'Property Finder publish', 'publishing.realestate', 'post', 'platform_bulk',
   100, NULL, true, '{"portal":"property_finder","region":"MENA"}'::jsonb),
  ('30200000-0000-4000-8000-000000000013', 'publishing.realestate.bayut',
   'Bayut publish', 'publishing.realestate', 'post', 'platform_bulk',
   100, NULL, true, '{"portal":"bayut","region":"MENA"}'::jsonb),
  ('30200000-0000-4000-8000-000000000014', 'publishing.realestate.dubizzle',
   'dubizzle publish', 'publishing.realestate', 'post', 'platform_bulk',
   100, NULL, true, '{"portal":"dubizzle","region":"MENA"}'::jsonb),

  -- Communication
  -- Meta utility conversation window ~USD 0.0409 (SA/AE band) = 40_900 micro-USD.
  ('30200000-0000-4000-8000-000000000021', 'communication.whatsapp.conversation_window_24h',
   'WhatsApp 24h conversation window', 'communication.whatsapp', 'conversation_window_24h',
   'external_passthrough', 300, 40900, true,
   '{"vendor":"meta","price_url":"https://developers.facebook.com/docs/whatsapp/pricing","band":"SA_AE_utility"}'::jsonb),
  -- Twilio SMS UAE outbound ~USD 0.0613 = 61_300 micro-USD.
  ('30200000-0000-4000-8000-000000000022', 'communication.sms.per_message',
   'SMS outbound message', 'communication.sms', 'message',
   'external_passthrough', 100, 61300, true,
   '{"vendor":"twilio","price_url":"https://www.twilio.com/en-us/sms/pricing/ae"}'::jsonb),

  -- AI content
  -- Estimates assume gpt-4o-mini rates in ai-pricing.js (~USD 0.15 / 0.60 per 1M).
  ('30200000-0000-4000-8000-000000000031', 'ai.post_creation',
   'AI post / listing copy creation', 'ai.content', 'call', 'ai_provider',
   500, 50000, true,
   '{"call_sites":["whatsapp-listings draft","listings-ai describe"],"pricing":"ai-pricing.js openai:gpt-4o-mini"}'::jsonb),
  ('30200000-0000-4000-8000-000000000032', 'ai.listings_describe',
   'Listings AI photo-to-listing', 'ai.content', 'call', 'ai_provider',
   500, 50000, true,
   '{"call_sites":["modules/listings-ai"],"pricing":"ai-pricing.js vision bundle"}'::jsonb),
  ('30200000-0000-4000-8000-000000000033', 'ai.contact_lead_score',
   'Contact 360 lead score', 'ai.content', 'call', 'ai_provider',
   100, 5000, true,
   '{"call_sites":["contact-360.js computeLeadScore"]}'::jsonb),
  ('30200000-0000-4000-8000-000000000034', 'ai.contact_lead_summary',
   'Contact 360 lead summary', 'ai.content', 'call', 'ai_provider',
   200, 10000, true,
   '{"call_sites":["contact-360.js getLeadSummary"]}'::jsonb),
  ('30200000-0000-4000-8000-000000000035', 'ai.comment_classifier',
   'Inbound comment classifier', 'ai.content', 'call', 'ai_provider',
   100, 3000, true,
   '{"call_sites":["lib/comment-classifier.js","modules/comment-router"]}'::jsonb),

  -- AI intelligence
  ('30200000-0000-4000-8000-000000000041', 'ai.area_scoring',
   'Area intelligence scoring', 'ai.intelligence', 'call', 'ai_provider',
   500, 20000, true,
   '{"call_sites":["modules/area-intelligence scoring-worker"]}'::jsonb),
  ('30200000-0000-4000-8000-000000000042', 'ai.market_pricing_analysis',
   'Market pricing analysis', 'ai.intelligence', 'call', 'ai_provider',
   300, 15000, true,
   '{"call_sites":["modules/property-valuation analysis-service"]}'::jsonb),
  ('30200000-0000-4000-8000-000000000043', 'ai.property_rating',
   'Property rating', 'ai.intelligence', 'call', 'ai_provider',
   200, 10000, true,
   '{"call_sites":["area-intelligence inspector / property rating"]}'::jsonb),
  ('30200000-0000-4000-8000-000000000044', 'ai.lead_gen_activation',
   'Lead-gen AI activation', 'ai.intelligence', 'activation', 'ai_provider',
   400, 20000, true,
   '{"call_sites":["campaigns / lead-gen activation"]}'::jsonb),

  -- Assets
  -- BannerBear per-image equivalent ~USD 0.02 = 20_000 micro-USD.
  ('30200000-0000-4000-8000-000000000051', 'assets.render.social_card',
   'Social card render', 'assets.render', 'render', 'platform_bulk',
   100, 20000, true,
   '{"vendor":"bannerbear","call_sites":["modules/social-cards"],"price_url":"https://www.bannerbear.com/pricing/"}'::jsonb)
;
