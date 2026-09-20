-- Wave 2F — SEO / owned-web shared vocabularies (land BEFORE table migrations).

CREATE OR REPLACE FUNCTION public.growth_os_is_seo_page_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'draft',
    'published',
    'indexed',
    'archived'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_seo_target_surface(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'agency_white_label',
    'own_white_label',
    'external_site',
    'bazaar'
  );
$$;

-- Expand event taxonomy with seo.page.generated (delivery category).
CREATE OR REPLACE FUNCTION public.growth_os_is_event_name(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IN (
    'lead.created',
    'lead.qualified',
    'lead.assigned',
    'lead.contacted',
    'viewing.booked',
    'viewing.completed',
    'offer.made',
    'reservation.created',
    'transaction.closed',
    'commission.earned',
    'message.submitted',
    'message.delivered',
    'message.failed',
    'post.published',
    'post.failed',
    'portal.submitted',
    'ad.delivered',
    'seo.page.generated',
    'email.opened',
    'email.clicked',
    'message.read',
    'message.replied',
    'link.clicked',
    'unsubscribe.requested',
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
    WHEN 'lead.assigned' THEN 'business'
    WHEN 'lead.contacted' THEN 'business'
    WHEN 'viewing.booked' THEN 'business'
    WHEN 'viewing.completed' THEN 'business'
    WHEN 'offer.made' THEN 'business'
    WHEN 'reservation.created' THEN 'business'
    WHEN 'transaction.closed' THEN 'business'
    WHEN 'commission.earned' THEN 'business'
    WHEN 'message.submitted' THEN 'delivery'
    WHEN 'message.delivered' THEN 'delivery'
    WHEN 'message.failed' THEN 'delivery'
    WHEN 'post.published' THEN 'delivery'
    WHEN 'post.failed' THEN 'delivery'
    WHEN 'portal.submitted' THEN 'delivery'
    WHEN 'ad.delivered' THEN 'delivery'
    WHEN 'seo.page.generated' THEN 'delivery'
    WHEN 'email.opened' THEN 'engagement'
    WHEN 'email.clicked' THEN 'engagement'
    WHEN 'message.read' THEN 'engagement'
    WHEN 'message.replied' THEN 'engagement'
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
