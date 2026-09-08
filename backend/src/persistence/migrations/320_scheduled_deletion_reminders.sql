-- BE-BLOCKER-19 / Wave 0.5 Agent 5
-- Scheduled-deletion reminder cron support + public view/cancel email templates.
--
-- Idempotent: safe to re-run. Creates deletion_requests if a prior wave
-- migration has not landed yet, then ensures reminders_sent exists for
-- cron send idempotency.

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- initiated | pending_email | pending_totp | scheduled | cancelled | completed | expired
  status TEXT NOT NULL DEFAULT 'initiated',
  reason TEXT,
  reason_notes TEXT,
  liveness_word TEXT,
  scheduled_for TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reminders_sent TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
  ON public.deletion_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled
  ON public.deletion_requests (scheduled_for)
  WHERE status = 'scheduled' AND cancelled_at IS NULL;

-- Spec: ADD COLUMN IF NOT EXISTS for cron idempotency keys (tminus7 / tminus1).
ALTER TABLE public.deletion_requests
  ADD COLUMN IF NOT EXISTS reminders_sent TEXT[];

-- Backfill nulls if an older draft created the column without a default.
UPDATE public.deletion_requests
   SET reminders_sent = '{}'::text[]
 WHERE reminders_sent IS NULL;

ALTER TABLE public.deletion_requests
  ALTER COLUMN reminders_sent SET DEFAULT '{}'::text[];

ALTER TABLE public.deletion_requests
  ALTER COLUMN reminders_sent SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Platform email templates (seed). Idempotent via WHERE NOT EXISTS on the
-- global (code, language, territory_id IS NULL) unique slot.
-- ---------------------------------------------------------------------------

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'scheduled_deletion_confirm_t0',
  'Account deletion scheduled (T0)',
  'Sent when a user confirms account deletion and the 30-day cool-down begins.',
  'email',
  'auth',
  'en',
  NULL,
  'Your Wingcaster account will be deleted on {{deletion_date}}',
  '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
     <h1 style="margin:0 0 12px 0;font-size:22px;">Deletion scheduled</h1>
     <p style="margin:0 0 16px 0;">Hi {{name}}, your Wingcaster account is scheduled for deletion on <b>{{deletion_date}}</b> ({{days_remaining}} days from today).</p>
     <p style="margin:0 0 16px 0;">We will email you a reminder one week and one day before that date. You can cancel any time before then.</p>
     <p style="margin:24px 0;"><a href="{{cancel_url}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">Cancel deletion</a></p>
     <p style="color:#6b7280;font-size:13px;margin:0;">If you did not request this, cancel immediately and change your password.</p>
   </div>',
  'Hi {{name}}, your Wingcaster account is scheduled for deletion on {{deletion_date}} ({{days_remaining}} days from today).

We will email you a reminder one week and one day before that date. You can cancel any time before then:

{{cancel_url}}

If you did not request this, cancel immediately and change your password.',
  'raw',
  '["name", "deletion_date", "days_remaining", "cancel_url"]'::jsonb,
  '["support_email"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'scheduled_deletion_confirm_t0'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'scheduled_deletion_reminder_tminus7',
  'Account deletion reminder (T-7)',
  'Sent seven days before a scheduled account deletion.',
  'email',
  'auth',
  'en',
  NULL,
  'Reminder: your Wingcaster account will be deleted in 7 days',
  '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
     <h1 style="margin:0 0 12px 0;font-size:22px;">Deletion in 7 days</h1>
     <p style="margin:0 0 16px 0;">Hi {{name}}, this is a reminder that your Wingcaster account is scheduled for deletion on <b>{{deletion_date}}</b>.</p>
     <p style="margin:0 0 16px 0;">Changed your mind? Cancel before that date — after it, the deletion cannot be reversed.</p>
     <p style="margin:24px 0;"><a href="{{cancel_url}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">Cancel deletion</a></p>
   </div>',
  'Hi {{name}}, this is a reminder that your Wingcaster account is scheduled for deletion on {{deletion_date}}.

Changed your mind? Cancel before that date — after it, the deletion cannot be reversed:

{{cancel_url}}',
  'raw',
  '["name", "deletion_date", "cancel_url"]'::jsonb,
  '["days_remaining", "support_email"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'scheduled_deletion_reminder_tminus7'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'scheduled_deletion_reminder_tminus1',
  'Account deletion reminder (T-1)',
  'Sent one day before a scheduled account deletion.',
  'email',
  'auth',
  'en',
  NULL,
  'Final reminder: your Wingcaster account will be deleted tomorrow',
  '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
     <h1 style="margin:0 0 12px 0;font-size:22px;">Deletion tomorrow</h1>
     <p style="margin:0 0 16px 0;">Hi {{name}}, your Wingcaster account will be permanently deleted on <b>{{deletion_date}}</b> (tomorrow).</p>
     <p style="margin:0 0 16px 0;">If you want to keep the account, cancel now. After tomorrow this cannot be reversed.</p>
     <p style="margin:24px 0;"><a href="{{cancel_url}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">Cancel deletion</a></p>
   </div>',
  'Hi {{name}}, your Wingcaster account will be permanently deleted on {{deletion_date}} (tomorrow).

If you want to keep the account, cancel now. After tomorrow this cannot be reversed:

{{cancel_url}}',
  'raw',
  '["name", "deletion_date", "cancel_url"]'::jsonb,
  '["days_remaining", "support_email"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'scheduled_deletion_reminder_tminus1'
     AND language = 'en'
     AND territory_id IS NULL
);
