-- Contact authorship — who created and last modified a contact. Populated by the
-- create/update routes (and getOrCreateContact) from req.user; resolved to agent
-- names at read time. Plain TEXT (no FK) so a system/agent id from any source is
-- accepted without a constraint failure.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;
