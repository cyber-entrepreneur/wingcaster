-- public.territories unique code index. Listing-disclosure metadata lives
-- on public.territories (code, name, currency). Legacy billing tables that
-- used to ship in this file were stripped (DL-244).

CREATE UNIQUE INDEX IF NOT EXISTS uq_territories_code ON public.territories(code);
