# Stage 13f — commercial.* DROP runbook

**Scope:** Final, irreversible deprecation of `commercial.*` tables. The `commercial`
schema remains as an empty tombstone (migration 291). Quota reads/writes use
`quota.*` per DL-226 option (a).

**MERGE = code + migration 289 (quota projection) + migration 291 (tombstone).**
Migration **290a** (the DROP) is **operator-only** and does **not** auto-apply.

Rollback after DROP = **prod snapshot restore only**. There is no in-DB rollback migration.

---

## Preconditions (operator sign-off)

- [ ] Stage 13e gates GREEN for 30 consecutive days (R097 / R098 / R099).
- [ ] Quota edge case resolved: `quota.ledger_entries` is live and
      `billing/ledger.js` reads/writes quota (DL-226 option a). **Do not proceed**
      if any quota read still targets `commercial.ledger_entries`.
- [ ] `GET /api/admin/fin/cutover/deprecation-readiness` reports
      `fks_outside_commercial: 0`.
- [ ] Finance attestation signed within the last 7 days (operational) and 30 days
      (R099 / deprecation gate).
- [ ] Verified prod database snapshot in the past 24h with a **tested** restore
      procedure. Record snapshot ID, timestamp, and verifier for `snapshot_note`.
- [ ] Customer comms sent: tenants notified that `commercial.*` data is being
      permanently removed on the target date.
- [ ] Admin activity is quiet (no dashboard sessions with stale `commercial.*`
      references that would 500 mid-DROP).

---

## Pre-flight (T-30d)

1. Verify all Stage 13e gates GREEN for 30 consecutive days (R097/R098/R099).
2. Verify quota edge case is resolved (DL-226 option a). If quota reads still
   target `commercial.*`, **DO NOT proceed**.
3. Verify `pg_constraint` has **zero** FKs from non-`commercial` schemas into
   `commercial.*` (`deprecation-readiness` endpoint reports this).

## Pre-flight (T-7d)

4. Fresh Finance attestation signed within last 7 days.
5. Verified prod database snapshot in the past 24h with tested restore procedure.
   Snapshot ID + timestamp + who verified is what the operator types into
   `snapshot_note`.
6. Customer comms: notify tenants that `commercial.*` data is being permanently
   removed on the target date.
7. Confirm admin activity is quiet (no dashboard sessions with stale references to
   `commercial.*` that would 500 mid-DROP).

## Flip (T-0)

8. Deploy this PR to prod. Migration **289** (quota projection) and **291**
   (tombstone `COMMENT ON SCHEMA` + `REVOKE CREATE`) auto-apply. **290a** (the
   DROP) does **not** auto-apply.
9. Verify `GET /api/admin/fin/cutover/deprecation-readiness` returns
   `ready_for_drop: true` and all six gates true (plus snapshot note supplied at
   invoke time).
10. Operator invokes `POST /api/admin/fin/cutover/deprecate-commercial` with:

    ```json
    {
      "snapshot_note": "<snapshot-id>@<timestamp>, restored to staging <yyyy-mm-dd> by <name>"
    }
    ```

    `snapshot_note` must be **≥ 20 characters** (DL-230).

11. Verify `SELECT count(*) FROM pg_tables WHERE schemaname='commercial'` returns `0`.
12. Verify `SELECT nspname FROM pg_namespace WHERE nspname='commercial'` returns the
    tombstoned schema (empty).
13. Verify `GET /api/admin/fin/cutover/readiness` shows `deprecation.dropped_at`
    populated.

## Post-flip (T+1h through T+48h)

14. Watch application error logs for any `relation commercial.<table> does not exist` —
    indicates a missed read-path migration; hot-patch.
15. Confirm normal application behavior for a representative sample of tenants.

## Rollback (only if T+0..T+1h and via prod snapshot restore)

16. This is **DESTRUCTIVE**. There is no in-DB rollback. Restore from the snapshot
    noted in step 10. Coordinate with Finance and Ops. Notify customers of the restore.

## Do NOT (in 13f)

- Drop the `commercial` **schema** itself. Keep as tombstone.
- Re-create any table in `commercial.*` post-DROP.
- Run 290a before all gates are GREEN and snapshot verification is recorded.

## Advisory lock

`FIN_CUTOVER_DEPRECATE = 1033` — mutex on the DROP endpoint (DL-231).

## Reconciliation

**R100** — informational: DRIFT when `FIN_ONLY` + 90-day quiet period elapsed but
`commercial.*` tables remain; GREEN after DROP (DL-232).
