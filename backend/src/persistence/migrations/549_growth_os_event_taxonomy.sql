-- Growth-OS Wave 0 — event taxonomy catalog (docs/event-taxonomy-catalog.md §1–§4).
-- Seeds launch [L] / starred event_name vocabulary and binds event_category.

CREATE OR REPLACE FUNCTION public.growth_os_is_event_name(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IN (
    -- business [L]
    'lead.created',
    'lead.qualified',
    'viewing.booked',
    'viewing.completed',
    'offer.made',
    'reservation.created',
    'transaction.closed',
    'commission.earned',
    -- delivery [L]
    'message.sent',
    'message.delivered',
    'message.failed',
    'post.published',
    'post.failed',
    'portal.submitted',
    -- engagement [L]
    'email.opened',
    'email.clicked',
    'message.read',
    'message.replied',
    'post.impression',
    'post.engaged',
    'link.clicked',
    'unsubscribe.requested',
    -- system [L starred]
    'execution.created',
    'consent.granted',
    'consent.withdrawn',
    'journey.entered',
    'journey.node.suppressed'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_event_name_category(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE v
    WHEN 'lead.created' THEN 'business'
    WHEN 'lead.qualified' THEN 'business'
    WHEN 'viewing.booked' THEN 'business'
    WHEN 'viewing.completed' THEN 'business'
    WHEN 'offer.made' THEN 'business'
    WHEN 'reservation.created' THEN 'business'
    WHEN 'transaction.closed' THEN 'business'
    WHEN 'commission.earned' THEN 'business'
    WHEN 'message.sent' THEN 'delivery'
    WHEN 'message.delivered' THEN 'delivery'
    WHEN 'message.failed' THEN 'delivery'
    WHEN 'post.published' THEN 'delivery'
    WHEN 'post.failed' THEN 'delivery'
    WHEN 'portal.submitted' THEN 'delivery'
    WHEN 'email.opened' THEN 'engagement'
    WHEN 'email.clicked' THEN 'engagement'
    WHEN 'message.read' THEN 'engagement'
    WHEN 'message.replied' THEN 'engagement'
    WHEN 'post.impression' THEN 'engagement'
    WHEN 'post.engaged' THEN 'engagement'
    WHEN 'link.clicked' THEN 'engagement'
    WHEN 'unsubscribe.requested' THEN 'engagement'
    WHEN 'execution.created' THEN 'system'
    WHEN 'consent.granted' THEN 'system'
    WHEN 'consent.withdrawn' THEN 'system'
    WHEN 'journey.entered' THEN 'system'
    WHEN 'journey.node.suppressed' THEN 'system'
    ELSE NULL
  END;
$$;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_name_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_name_check
    CHECK (public.growth_os_is_event_name(event_name));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_name_category_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_name_category_check
    CHECK (public.growth_os_event_name_category(event_name) = event_category);

-- §2: every event must carry an idempotency key.
ALTER TABLE public.events
  ALTER COLUMN provider_event_id SET NOT NULL;
