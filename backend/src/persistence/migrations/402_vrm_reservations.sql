CREATE TABLE vrm.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  principal_id UUID REFERENCES vrm.principals(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  email TEXT,
  phone_e164 TEXT,
  nationality CHAR(2),
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_guests_bump_version
  BEFORE UPDATE ON vrm.guests
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  property_id UUID NOT NULL REFERENCES vrm.properties(id),
  unit_id UUID NOT NULL REFERENCES vrm.units(id),
  unit_type_id UUID NOT NULL REFERENCES vrm.unit_types(id),
  rate_plan_id UUID NOT NULL REFERENCES vrm.rate_plans(id),
  guest_id UUID NOT NULL REFERENCES vrm.guests(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  confirmation_code TEXT NOT NULL,
  channel_code TEXT NOT NULL CHECK (channel_code IN (
    'DIRECT', 'AIRBNB', 'BOOKING_COM', 'VRBO', 'EXPEDIA', 'ICAL', 'OWNER'
  )),
  external_reservation_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'INQUIRY',
    'HOLD',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED',
    'NO_SHOW',
    'FAILED'
  )),
  stay_start DATE NOT NULL,
  stay_end DATE NOT NULL,
  nights INTEGER NOT NULL,
  adults INTEGER NOT NULL CHECK (adults >= 1),
  children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
  currency CHAR(3) NOT NULL,
  room_total_minor BIGINT NOT NULL CHECK (room_total_minor >= 0),
  tax_total_minor BIGINT NOT NULL CHECK (tax_total_minor >= 0),
  grand_total_minor BIGINT NOT NULL CHECK (grand_total_minor >= 0),
  hold_expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  CHECK (stay_end > stay_start),
  CHECK (nights = (stay_end - stay_start)),
  CHECK (grand_total_minor = room_total_minor + tax_total_minor),
  UNIQUE (tenant_id, confirmation_code)
);

CREATE UNIQUE INDEX reservations_channel_external_uniq
  ON vrm.reservations (tenant_id, channel_code, external_reservation_id)
  WHERE external_reservation_id IS NOT NULL;

CREATE TRIGGER trg_reservations_bump_version
  BEFORE UPDATE ON vrm.reservations
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

ALTER TABLE vrm.unit_occupancies
  ADD CONSTRAINT unit_occupancies_reservation_fk
  FOREIGN KEY (reservation_id) REFERENCES vrm.reservations(id);

CREATE TABLE vrm.reservation_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  reservation_id UUID NOT NULL REFERENCES vrm.reservations(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  trigger TEXT NOT NULL,
  reason_code TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX reservation_status_events_reservation_idx
  ON vrm.reservation_status_events (reservation_id, created_at);

CREATE TABLE vrm.tax_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  reservation_id UUID NOT NULL REFERENCES vrm.reservations(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  tax_code TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  rate_bps INTEGER NOT NULL CHECK (rate_bps >= 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT
);

CREATE TABLE vrm.checkin_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  reservation_id UUID NOT NULL REFERENCES vrm.reservations(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  kind TEXT NOT NULL CHECK (kind IN ('CHECK_IN', 'CHECK_OUT')),
  occurred_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('STAFF', 'SELF', 'SMART_LOCK', 'CHANNEL')),
  notes TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (reservation_id, kind)
);
