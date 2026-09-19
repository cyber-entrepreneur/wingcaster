# Campaign & Social Publishing Reconciliation

## Why Growth-OS Wave 0 exists

WingCaster grew three fragmented publish paths that all represent the same
concept — “send this creative to that channel for this tenant”:

1. **Social / marketplace distribute** — `platform_accounts` / `marketplace_connections` + `distribution_jobs` (DAL collection name `distributions`)
2. **Portal publishing jobs** — `publishing_jobs` fan-out into per-destination `distribution_jobs`
3. **Scheduled publications** — `scheduled_publications` arming the same portal job engine later

Attempts live in `distribution_attempts`. Status vocabularies differ by path
(`pending`, `pending_moderation`, `published`, …) with little shared analytics
surface. Downstream work (Journeys, paid, attribution, AI) cannot reliably join
“what we sent” without a single Execution spine.

## What Wave 0 does (expand-contract)

- **Add** canonical tables: `channel_definitions`, `channel_connections`,
  `executions`, `execution_attempts`, `events`, `consent`
- **Backfill** current-state rows from legacy (idempotent, deterministic IDs)
- **Forward-sync** via AFTER INSERT/UPDATE triggers so legacy writers keep
  working untouched while canonical stays current
- **Do not** edit existing publish routes/workers, drop legacy tables, or emit
  historical Events

Cutover of write-sites to canonical APIs is a later wave.

## Migration discipline

Shared CHECK vocabularies / validator functions ship in their **own migration
first** (`525_growth_os_canonical_enums.sql`), separate from table migrations.
Bundling enums with tables breaks Real-PG CI when parallel PRs both introduce
the same literals. Tables reference `growth_os_is_*` functions.

## Access layer

Import from `backend/src/lib/growth-os/`:

- `channels.js` — definitions/connections + `resolveCapabilities`
- `executions.js` — create / schedule / transition / list + `recordExecutionAttempt`
- `events.js` — `ingestEvent` (idempotent on `provider_event_id`)
- `consent.js` — `checkEligibility` / `setConsent`

See also: [canonical-object-model.md](./canonical-object-model.md).
