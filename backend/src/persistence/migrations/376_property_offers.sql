-- AGT-LST-010 — Buyer offers received on a listing.
--
-- Distinct from the "property variant" concept behind
-- POST /api/properties/:id/offers (that groups multiple listings of the
-- same physical property under a canonical_id). THIS table records an
-- OFFER A BUYER MADE on a listing: who offered, how much, on what terms,
-- and where the negotiation stands.
--
-- Lifecycle: received → countered → (accepted | rejected | withdrawn).
-- On `accepted` the UI prompts the agent to close the listing
-- (AGT-HTX-002, closed_transactions) — this table does not itself mutate
-- the listing; acceptance is a negotiation state, closure is a separate
-- explicit action so an accepted offer can still fall through.

CREATE TABLE IF NOT EXISTS property_offers (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,          -- agent who recorded the offer (owns the row)
  contact_id TEXT,                 -- linked contact (offeror) when known; NULL for a free-text offeror
  offeror_name TEXT NOT NULL,      -- denormalized display name (contact name snapshot, or free text)
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  terms TEXT,                      -- free-text terms (closing date, deposit, misc.)
  financing_type TEXT,             -- cash | mortgage | mixed | NULL(unspecified) — how the buyer funds it; the strongest signal of offer strength
  expiry_date DATE,                -- when the offer lapses if not accepted; NULL = open-ended
  conditions TEXT,                 -- contingencies (subject to survey / financing / sale of buyer's property / chain)
  status TEXT NOT NULL DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT property_offers_status_check
    CHECK (status IN ('received', 'countered', 'accepted', 'rejected', 'withdrawn')),
  CONSTRAINT property_offers_financing_check
    CHECK (financing_type IS NULL OR financing_type IN ('cash', 'mortgage', 'mixed')),
  CONSTRAINT property_offers_amount_positive
    CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_property_offers_property
  ON property_offers(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_offers_agent
  ON property_offers(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_offers_contact
  ON property_offers(contact_id)
  WHERE contact_id IS NOT NULL;
