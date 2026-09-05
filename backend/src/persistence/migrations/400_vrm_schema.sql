-- Vacation Rental Management control plane.
-- Enterprise inventory + operations schema. Independent of fin.* SaaS billing.

CREATE SCHEMA IF NOT EXISTS vrm;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMENT ON SCHEMA vrm IS
  'Vacation rental PMS, channel manager, automation, and owner accounting.';

CREATE OR REPLACE FUNCTION vrm.trg_bump_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION vrm.trg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := OLD.updated_at;
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    -- Application must stamp updated_at; refuse silent clock drift.
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION vrm.platform_admin_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    current_setting('vrm.platform_admin', true) = 'on'
    AND current_setting('vrm.elevated', true) = 'on'
$$;

CREATE OR REPLACE FUNCTION vrm.tenant_visible(p_tenant_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    current_setting('vrm.bypass', true) = 'on'
    OR vrm.platform_admin_bypass()
    OR (
      current_setting('vrm.tenant_id', true) IS NOT NULL
      AND current_setting('vrm.tenant_id', true) <> ''
      AND p_tenant_id = current_setting('vrm.tenant_id', true)::uuid
    )
$$;

-- ---------------------------------------------------------------------------
-- Tenants (PMC / operator organisations). public_tenant_id is TEXT because
-- public.users/agencies use TEXT primary keys.
-- ---------------------------------------------------------------------------

CREATE TABLE vrm.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  public_tenant_id TEXT,
  legal_name TEXT NOT NULL,
  trading_name TEXT NOT NULL,
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  default_currency CHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (environment, public_tenant_id)
);

CREATE TRIGGER trg_tenants_bump_version
  BEFORE UPDATE ON vrm.tenants
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  kind TEXT NOT NULL CHECK (kind IN (
    'OPERATOR', 'OWNER', 'GUEST', 'VENDOR', 'CHANNEL', 'PLATFORM'
  )),
  public_user_id TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  phone_e164 TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX principals_public_user_uniq
  ON vrm.principals (tenant_id, public_user_id)
  WHERE public_user_id IS NOT NULL;

CREATE TRIGGER trg_principals_bump_version
  BEFORE UPDATE ON vrm.principals
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  principal_id UUID NOT NULL REFERENCES vrm.principals(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  role TEXT NOT NULL CHECK (role IN (
    'operator.owner',
    'operator.admin',
    'operator.revenue',
    'operator.front_desk',
    'operator.housekeeping_lead',
    'operator.finance',
    'operator.readonly',
    'owner.viewer',
    'owner.payout_admin',
    'vendor.housekeeper',
    'vendor.maintenance',
    'guest.self',
    'channel.ingest',
    'platform.auditor'
  )),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (principal_id, role)
);

CREATE TRIGGER trg_memberships_bump_version
  BEFORE UPDATE ON vrm.memberships
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  property_kind TEXT NOT NULL CHECK (property_kind IN (
    'SINGLE_UNIT', 'MULTI_UNIT', 'HOTEL', 'RESORT'
  )),
  timezone TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  country_code CHAR(2) NOT NULL,
  region TEXT,
  locality TEXT,
  address_line TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  check_in_from TIME NOT NULL DEFAULT TIME '15:00',
  check_out_until TIME NOT NULL DEFAULT TIME '11:00',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, code)
);

CREATE TRIGGER trg_properties_bump_version
  BEFORE UPDATE ON vrm.properties
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.unit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  property_id UUID NOT NULL REFERENCES vrm.properties(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  max_occupancy INTEGER NOT NULL CHECK (max_occupancy >= 1),
  bedrooms INTEGER NOT NULL CHECK (bedrooms >= 0),
  bathrooms NUMERIC(3, 1) NOT NULL CHECK (bathrooms >= 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TRIGGER trg_unit_types_bump_version
  BEFORE UPDATE ON vrm.unit_types
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  property_id UUID NOT NULL REFERENCES vrm.properties(id),
  unit_type_id UUID NOT NULL REFERENCES vrm.unit_types(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'OUT_OF_SERVICE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TRIGGER trg_units_bump_version
  BEFORE UPDATE ON vrm.units
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();
