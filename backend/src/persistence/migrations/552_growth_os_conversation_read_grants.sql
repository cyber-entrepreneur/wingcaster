-- Growth-OS Wave 0 — read grants for consent WhatsApp 24h window (spec §6).
-- checkEligibility queries conversation_messages/conversations under growth_os_app_role.

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.conversations TO growth_os_app_role;
GRANT SELECT ON public.conversation_messages TO growth_os_app_role;
