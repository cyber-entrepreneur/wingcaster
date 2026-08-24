-- Stage 13f — DROP commercial.* tables (DL-227). Operator-only (letter-suffixed).
-- IRREVERSIBLE. Rollback = restore from prod snapshot per CUTOVER_13F_RUNBOOK.md.

DO $$
DECLARE
  t RECORD;
  fk RECORD;
  fk_list TEXT := '';
  write_attempts BIGINT;
  env TEXT;
BEGIN
  env := COALESCE(NULLIF(current_setting('fin.environment', true), ''), 'LIVE');

  IF NOT EXISTS (
    SELECT 1
      FROM fin.cutover_active_environment
     WHERE environment = env
       AND mode = 'FIN_ONLY'
  ) THEN
    RAISE EXCEPTION 'CUTOVER_NOT_FIN_ONLY: fin.cutover_active_environment.mode must be FIN_ONLY for %', env;
  END IF;

  SELECT COUNT(*)::bigint
    INTO write_attempts
    FROM fin.cutover_quiet_period_events
   WHERE environment = env
     AND kind = 'COMMERCIAL_WRITE_ATTEMPT'
     AND occurred_at > CURRENT_TIMESTAMP - interval '90 days';

  IF write_attempts > 0 THEN
    RAISE EXCEPTION 'CUTOVER_QUIET_PERIOD_VIOLATED: % COMMERCIAL_WRITE_ATTEMPT row(s) in the last 90 days', write_attempts;
  END IF;

  FOR fk IN
    SELECT
      nsp.nspname AS owning_schema,
      rel.relname AS owning_table,
      c.conname AS constraint_name,
      fnsp.nspname AS referenced_schema,
      frel.relname AS referenced_table
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class frel ON frel.oid = c.confrelid
      JOIN pg_namespace fnsp ON fnsp.oid = frel.relnamespace
     WHERE c.contype = 'f'
       AND fnsp.nspname = 'commercial'
       AND nsp.nspname <> 'commercial'
  LOOP
    fk_list := fk_list || format(
      E'\n  %s.%s constraint %s -> %s.%s',
      fk.owning_schema, fk.owning_table, fk.constraint_name,
      fk.referenced_schema, fk.referenced_table
    );
  END LOOP;

  IF fk_list <> '' THEN
    RAISE EXCEPTION 'CUTOVER_FK_PREFLIGHT_FAILED: non-commercial FK(s) reference commercial.*:%', fk_list;
  END IF;

  FOR t IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'commercial'
     ORDER BY tablename
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS commercial.%I CASCADE', t.tablename);
  END LOOP;
END
$$;
