-- AGT-REV-001: agent responses and moderation flags for received reviews.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS agent_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flag_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(30),
  ADD COLUMN IF NOT EXISTS flag_details TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_flag_status_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_flag_status_check
  CHECK (flag_status IN ('none', 'pending', 'resolved', 'dismissed'));

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_flag_reason_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_flag_reason_check
  CHECK (
    flag_reason IS NULL
    OR flag_reason IN ('spam', 'abusive', 'privacy', 'conflict', 'false_claim', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_reviews_flag_queue
  ON public.reviews(flag_status, flagged_at DESC)
  WHERE flag_status = 'pending';
