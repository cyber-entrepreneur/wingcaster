# Wave 2B — Publishing Control Plane & Content Calendar

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged. Migration block: **720–729** (mostly read-model/UI; migrations only if you add indexes/views).

## MISSION
Give agencies the operational **control room**: a unified calendar + list over **all Executions** (journeys, social, portals, later paid), with drafts, previews, network validation, and drag-to-reschedule. For agencies running hundreds of listings this is the primary daily surface.

Read `docs/campaign-and-social-publishing-reconciliation.md` Part 6.2 (D17) and `docs/canonical-object-model.md` §D (Execution).

## SCOPE — BACKEND
1. **Read model over `executions`** (Wave 0): a calendar/list API filtered by **date-range × property × campaign × agent × channel × office × status × kind**. Add covering indexes (migration block 720–729) for the calendar's hot query paths (e.g. `(agency_id, scheduled_at)`, `(status, scheduled_at)`); everything is additive.
2. **Reschedule** = update `Execution.scheduled_at` via Wave 0 `executions.js` (`scheduleExecution`), all under `withTenant`. Respect Execution status (can't reschedule a `published`/`processing` one).
3. **Draft & preview**: draft Executions (`status='draft'`) render a per-channel preview (reuse 1C renditions / 1B post preview); no side effects.
4. **Network validation** before publish: per-channel rule checks (e.g. IG needs media, caption length limits, missing connection, expired token, missing creative) surfaced as blockers/warnings — reuse channel `capabilities` (Wave 0) + 1B validation.

## SCOPE — FRONTEND
1. **Calendar** (day/week/month) + **list** views of Executions, with the filter set above and **drag-to-reschedule** (optimistic update → `scheduleExecution`). `--lc-*` tokens; accessible; responsive; performant at hundreds of items (virtualize).
2. Status chips per Execution (draft/scheduled/queued/published/failed…), quick preview, and a blockers/warnings panel from network validation.
3. Bulk actions where safe (reschedule/cancel drafts). No destructive bulk without confirm.

## OUT OF SCOPE
Creating Executions (that's the composers in 1A/1B/1C/2A). Attribution numbers (2C). Paid-specific calendar affordances beyond showing paid Executions.

## ACCEPTANCE CRITERIA
- [ ] Calendar + list render Executions across all kinds with the full filter set; performant at ≥500 items.
- [ ] Drag-to-reschedule updates `scheduled_at` via the canonical layer under `withTenant`; disallowed for non-reschedulable statuses.
- [ ] Draft preview + pre-publish network validation (blockers/warnings) work per channel.
- [ ] All reads/writes tenant-isolated (via `withTenant`); RLS-safe.

## TEST MATRIX
1. Filter query correctness (each dimension + combinations).
2. Reschedule updates the Execution; blocked on published/processing.
3. Network validation flags missing media/expired connection.
4. Tenant isolation: agency A's calendar excludes agency B's Executions.
5. FE: drag-reschedule optimistic update + rollback on failure.
