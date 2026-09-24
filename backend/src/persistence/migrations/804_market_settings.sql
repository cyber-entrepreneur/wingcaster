-- Market on/off registry (PA-controlled). A market that is OFF is not offered to
-- agents and its listing-verification triggers never fire (treated as 'none').
-- Launch config: only Lebanon (LB) is ON; every other market is OFF until the PA
-- deliberately enables it. Additive, standalone table — safe for parallel Real-PG.

CREATE TABLE IF NOT EXISTS public.market_settings (
  country_code TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.market_settings (country_code, enabled) VALUES
  ('LB', TRUE),
  ('AE', FALSE),
  ('SA', FALSE),
  ('KW', FALSE),
  ('QA', FALSE),
  ('BH', FALSE),
  ('OM', FALSE),
  ('EG', FALSE),
  ('JO', FALSE)
ON CONFLICT (country_code) DO NOTHING;
