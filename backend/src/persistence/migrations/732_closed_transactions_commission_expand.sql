-- Wave 2C — expand closed_transactions with attested commission micros.
-- Finance read boundary: property-deal GTV/commission live here (not fin.* SaaS).

ALTER TABLE public.closed_transactions
  ADD COLUMN IF NOT EXISTS commission_micros BIGINT;

ALTER TABLE public.closed_transactions
  ADD COLUMN IF NOT EXISTS gtv_micros BIGINT;

COMMENT ON COLUMN public.closed_transactions.commission_micros IS
  'Attested commission in micros; marketing reads this — never recomputes rates.';
COMMENT ON COLUMN public.closed_transactions.gtv_micros IS
  'Attested GTV in micros (preferred over final_sold_price when set).';
