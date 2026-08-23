# Stage 13e — commercial.* → fin_public.* read-path inventory

Operator-facing log of every application read against a `commercial.*`
table that has (or lacks) a `fin_public.*` / `fin.*` mirror. Stage 13d
landed two views in migration 261 (`usage_events`, `ledger_entries`).
Each migrated call site is one file so a prod bug is a one-file revert.

`commercial.*` stays read-only as a safety net for 90 days. Stage 13f
drops it only after R084 + R096 have been GREEN for that window and a
fresh Finance attestation exists (`ready_for_stage_13f` on
`GET /api/admin/fin/cutover/readiness`).

Do **not** migrate dual-write INSERT paths, `record_consumption`
readback of just-written rows, backfill, or parity comparison queries
— those keep `commercial.*` until 13f.

| file:line | legacy table | new source | migrated_at | PR/commit | notes |
|---|---|---|---|---|---|
| `billing/routes.js:117` (`GET /api/billing/usage`) | `commercial.usage_events` | `fin_public.usage_events` via `billing/usage-reads.js` | 2026-08-23 | this PR | DL-222. Commercial shape projected from `event_type` + DL-175 `dimensions`. |
| `billing/routes.js:137` (`GET /api/billing/usage/summary`) | `commercial.usage_events` | `fin_public.usage_events` via `billing/usage-reads.js` | 2026-08-23 | this PR | DL-222 |
| `billing/routes.js:171` (`GET /api/admin/billing/usage`) | `commercial.usage_events` | `fin_public.usage_events` via `billing/usage-reads.js` | 2026-08-23 | this PR | DL-222 |
| `billing/routes.js:256` (`GET /api/admin/billing/telemetry`) | `commercial.usage_events` | `fin_public.usage_events` via `billing/usage-reads.js` | 2026-08-23 | this PR | DL-222 |
| `billing/ledger.js:140` (`quotaBalance`) | `commercial.ledger_entries` | — (stays commercial) | — | — | DL-221. 261 view cannot reconstruct `quota_key` / `billing_period` / `type`. Dual-write consumption is `authorizeUsage`, not `rated_usage`. |
| `billing/ledger.js:153` (`periodSummary`) | `commercial.ledger_entries` | — (stays commercial) | — | — | DL-221. Same reconstruction gap. |
| `billing/reporting/reconciliation.js:71` (`queryQuotaLedger`) | `commercial.ledger_entries` | — (stays commercial) | — | — | DL-223. Same reconstruction gap. |
| `billing/reporting/reconciliation.js:56` (`querySubscriptions`) | `commercial.billing_subscriptions` | — | — | — | Commercial-only (DL-210). No `fin_public` view. |
| `billing/notifications/wire-hooks.js:141` | `commercial.billing_subscriptions` | — | — | — | DL-225. Dunning copy; commercial-only. |
| `billing/notifications/wire-hooks.js:153` | `commercial.notification_events` | — | — | — | DL-225. Commercial-only. |
| `billing/notifications/routes.js:58` | `commercial.notification_events` | — | — | — | DL-225. Commercial-only. |
| `modules/whatsapp-listings/*` | — | — | — | — | DL-224. No `commercial.*` reads; publish credits use `ai_credit_*`. |
| `fin/cutover/parity/worker.js` | `commercial.usage_events` / `ledger_entries` | — (compare until 13f) | — | — | Parity legacy side. Not an application read. |
| `fin/cutover/backfill/*` | `commercial.usage_events` / `ledger_entries` | — (compare until 13f) | — | — | Stage 13b backfill source. |
| `fin/reconciliation/checks.js` | — | — | — | — | No `commercial.*` in `comparison_query`. R097–R099 are fin-internal. |

## How to revert one migrated read

1. Open the file in the `file:line` column.
2. Restore `FROM commercial.foo` / `findAll('usage_events', …)`.
   For the four billing usage routes that is: delete the
   `listUsageEvents` import and call `findAll` again; `usage-reads.js`
   can stay unused.
3. Run the existing regression test at that call site.
4. Land. Do not revert the quiet-period logger or R097–R099 with it.

## Ops watch (post-merge, not this PR)

- Read `GET /api/admin/fin/cutover/readiness` (or the Overview Quiet
  period tile) daily: R097 / R098 / R099.
- Investigate every `COMMERCIAL_WRITE_ATTEMPT` row
  (`GET /api/admin/fin/cutover/quiet-period/events`). Should be zero
  after freeze + this read-path pass; anything later is a bug.
- Re-attest about every 25 days so R099 stays GREEN (30-day window).
- Stage 13f is blocked until `ready_for_stage_13f` is true.
