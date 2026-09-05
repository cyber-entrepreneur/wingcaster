-- Guest folio. Charges/payments/refunds are append-only; voids reverse.

CREATE TABLE vrm.folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  reservation_id UUID NOT NULL REFERENCES vrm.reservations(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'SETTLED', 'WRITTEN_OFF')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_actor_type TEXT NOT NULL,
  updated_by_actor_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (reservation_id)
);

CREATE TRIGGER trg_folios_bump_version
  BEFORE UPDATE ON vrm.folios
  FOR EACH ROW EXECUTE FUNCTION vrm.trg_bump_version();

CREATE TABLE vrm.folio_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  folio_id UUID NOT NULL REFERENCES vrm.folios(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  charge_kind TEXT NOT NULL CHECK (charge_kind IN (
    'ROOM', 'TAX', 'FEE', 'DAMAGE', 'ADJUSTMENT', 'REVERSAL'
  )),
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  reverses_charge_id UUID REFERENCES vrm.folio_charges(id),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT,
  CHECK (
    (charge_kind = 'REVERSAL' AND reverses_charge_id IS NOT NULL AND amount_minor <= 0)
    OR (charge_kind <> 'REVERSAL' AND reverses_charge_id IS NULL)
  )
);

REVOKE UPDATE, DELETE ON vrm.folio_charges FROM PUBLIC;

CREATE TABLE vrm.folio_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  folio_id UUID NOT NULL REFERENCES vrm.folios(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  method TEXT NOT NULL CHECK (method IN (
    'CARD', 'BANK', 'CASH', 'OTA_COLLECT', 'WALLET', 'OTHER'
  )),
  psp_reference TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CAPTURED', 'FAILED', 'REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT
);

CREATE UNIQUE INDEX folio_payments_psp_uniq
  ON vrm.folio_payments (tenant_id, psp_reference)
  WHERE psp_reference IS NOT NULL;

REVOKE UPDATE, DELETE ON vrm.folio_payments FROM PUBLIC;

CREATE TABLE vrm.folio_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES vrm.tenants(id),
  folio_id UUID NOT NULL REFERENCES vrm.folios(id),
  payment_id UUID NOT NULL REFERENCES vrm.folio_payments(id),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT
);

REVOKE UPDATE, DELETE ON vrm.folio_refunds FROM PUBLIC;
