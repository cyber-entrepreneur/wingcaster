-- Stage 13f — commercial schema tombstone (DL-229). Auto-applied; safe before DROP.
-- Documents the empty schema and prevents accidental table re-creation.

COMMENT ON SCHEMA commercial IS
  'Stage 13f tombstone — contents dropped at operator command per CUTOVER_13F_RUNBOOK.md. Do not add tables here.';

REVOKE CREATE ON SCHEMA commercial FROM PUBLIC;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT rolname
      FROM pg_roles
     WHERE rolname NOT IN ('postgres', 'rds_superuser', 'fin_migrator')
       AND rolcanlogin IN (true, false)
  LOOP
    BEGIN
      EXECUTE format('REVOKE CREATE ON SCHEMA commercial FROM %I', r.rolname);
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END
$$;
