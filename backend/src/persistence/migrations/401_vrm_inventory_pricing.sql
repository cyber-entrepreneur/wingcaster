-- Rate plans, LOS/CTA restrictions, and per-date inventory.

CREATE TABLE vrm.rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  property_id UUID NOT NULL REFERENCES vrm.properties(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  refundable BOOLEAN NOT NULL,
  payment_policy TEXT NOT NULL CHECK (payment_policy IN (
    'PAY_NOW', 'PAY_LATER', 'DEPOSIT'
  )),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TRIGGER trg_rate_plans_bump_version
  BEFORE UPDATE ON vrm.rate_plans
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.rate_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  rate_plan_id UUID NOT NULL REFERENCES vrm.rate_plans(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  stay_date DATE NOT NULL,
  min_los INTEGER NOT NULL DEFAULT 1 CHECK (min_los >= 1),
  max_los INTEGER CHECK (max_los IS NULL OR max_los >= min_los),
  closed BOOLEAN NOT NULL DEFAULT false,
  closed_to_arrival BOOLEAN NOT NULL DEFAULT false,
  closed_to_departure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  UNIQUE (rate_plan_id, stay_date)
);

CREATE TABLE vrm.daily_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  unit_type_id UUID NOT NULL REFERENCES vrm.unit_types(id),
  rate_plan_id UUID NOT NULL REFERENCES vrm.rate_plans(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  stay_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  UNIQUE (unit_type_id, rate_plan_id, stay_date)
);

-- Allotment calendar. Vacation rentals typically allotment=1 per unique unit.
CREATE TABLE vrm.inventory_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  unit_id UUID NOT NULL REFERENCES vrm.units(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  stay_date DATE NOT NULL,
  allotment INTEGER NOT NULL CHECK (allotment >= 0),
  stop_sell BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (unit_id, stay_date)
);

CREATE TRIGGER trg_inventory_days_bump_version
  BEFORE UPDATE ON vrm.inventory_days
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

-- Source-of-truth occupancy. Exclusion constraint is the double-booking fence.
CREATE TABLE vrm.unit_occupancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  unit_id UUID NOT NULL REFERENCES vrm.units(id),
  reservation_id UUID NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  stay_start DATE NOT NULL,
  stay_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED')),
  source TEXT NOT NULL CHECK (source IN (
    'DIRECT', 'CHANNEL', 'OWNER_BLOCK', 'MAINTENANCE', 'HOLD'
  )),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  released_at TIMESTAMPTZ,
  released_by_actor_type TEXT,
  released_by_actor_id TEXT,
  CHECK (stay_end > stay_start),
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(stay_start, stay_end, '[)') WITH &&
  ) WHERE (status = 'ACTIVE')
);

CREATE INDEX unit_occupancies_reservation_idx
  ON vrm.unit_occupancies (reservation_id)
  WHERE status = 'ACTIVE';
