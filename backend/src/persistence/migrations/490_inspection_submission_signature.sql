-- PA-INS-002 — Inspection submit form.
--
-- Field inspectors sign off on the findings they submit for an assignment.
-- The submit form (web/src/pages/inspector/InspectorSubmitPage.tsx) captures
-- a signature at the leaf and persists it alongside the existing photo/notes/
-- dimension-score payload. Stored as TEXT: a data-URL (canvas capture) or an
-- uploaded image URL. Nullable so historical submissions remain valid.

ALTER TABLE area_intelligence.inspection_submissions
  ADD COLUMN IF NOT EXISTS signature TEXT;
