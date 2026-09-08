# Cursor dispatch — Screen Matrix Wave 2: WF-03 Portal Moderation cluster

**PR title:** `feat(screen-wave-2): WF-03 portal-publish outcome + tracker + PA moderation (both sides)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~6-8 days with parallel agents; ~12-15 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0 (PR #52 + PR #53) merged.** Shells + nav chrome + branding cleanup.
- **Wave 0.5 backend prereqs merged.** Specifically `[BE-DESIGN-01]` dynamic portal_registry + `[BE-BLOCKER-03]` error_class schema.
- **Shared Components Prep PR merged.** REC-family + PA-queue-family + `<PortalStatusPill>` primitives available for import.
- **Week 2 backend bundle merged.** Specifically:
  - `[BE-BLOCKER-01]` Property Finder Group publisher adapter
  - `[BE-BLOCKER-10]` `GET /api/publishing/jobs/:id` aggregation endpoint + retry endpoints
  - `[BE-BLOCKER-11]` `GET /api/publishing/tracker` + `/summary` endpoints
  - `[BE-BLOCKER-12]` `portal_submission.status_changed` push template
  - `[BE-BLOCKER-17]` per-portal validator modules
  - `[BE-DESIGN-02]` tenure-risk scoring service (stub OK for v1)

**Screen Matrix workstream context:** Week 2 of the workflow-cluster dispatch model. Resolves the WF-03 portal-moderation **deadlock cycle** — this is the **primary metered revenue surface**. Agent submits → PA reviews → outcome flows back to agent's tracker + receipt. See [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §6 Week 2.

---

## 1. Why this dispatch

Portal publishing is where agents pay credits and expect visible confirmation. Today the outcome + tracker + PA moderation queue all don't exist — agents pay, publishing runs (soon, per Wave 0.5 [BE-BLOCKER-01]), and no one sees anything. **This is a trust surface AND a revenue-leak surface.**

**Deadlock resolution:** agent submits via AGT-PUB-005 (existing PARTIAL, minor updates) → per-portal publisher runs → PA reviews via PA-MOD-001/002 → agent sees per-portal outcome via AGT-PUB-003 (receipt) + AGT-PUB-006 (persistent tracker across all their listings).

## 2. Read these files FIRST

**Wave 2 briefs (4):**
1. [`docs/design/briefs/AGT-PUB-003-publish-outcome-receipt-brief.md`](../design/briefs/AGT-PUB-003-publish-outcome-receipt-brief.md) — Per-publish outcome receipt (REC-family user)
2. [`docs/design/briefs/AGT-PUB-006-portal-tracker-brief.md`](../design/briefs/AGT-PUB-006-portal-tracker-brief.md) — Cross-listing portal tracker ledger
3. [`docs/design/briefs/PA-MOD-001-portal-moderation-queue-brief.md`](../design/briefs/PA-MOD-001-portal-moderation-queue-brief.md) — PA queue **anchor for PA-queue family**
4. [`docs/design/briefs/PA-MOD-002-portal-moderation-detail-brief.md`](../design/briefs/PA-MOD-002-portal-moderation-detail-brief.md) — PA per-submission review

**Shared references (mandatory):**
- [`BROADCAST_ALIGNMENT_REFERENCE.md`](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md) — token contract
- [`docs/design/BACKEND_BLOCKER_INDEX.md`](../design/BACKEND_BLOCKER_INDEX.md) — verify Week 2 backend items landed before starting
- [`docs/design/PORTAL_LIST_RESEARCH_2026-09-04.md`](../design/PORTAL_LIST_RESEARCH_2026-09-04.md) — portal list authoritative source (PF Group critical path)

## 3. Parallelization directive

Spawn parallel background agents. Every agent works on a disjoint file set.

**Phase A — spawn concurrently (5 agents):**

1. **AGT-PUB-003 receipt agent** — build `web/src/pages/agent/PublishReceiptPage.tsx`. Imports REC-family primitives (`<StatusHero>`, `<PrimaryCtaPerState>`) from `components/recipient/`. Extracts screen-specific compositions `<AggregateOutcomeHero>` (StatusHero adapter with 3-pill counter row), `<CreditsSummary>` (credits-reconciliation block), and imports `<PortalReceiptCard>` from Shared Components Prep. Renders all 8 state variants (ALL_SUCCEEDED / MIXED / ALL_FAILED / IN_REVIEW_ONLY / PARTIAL / cross-country / retry-in-flight / offline). Failure classes displayed per [BE-BLOCKER-03] `error_class` enum with per-class resolution deep links. Route: `/publish/receipt/:jobId`. Touches only `pages/agent/PublishReceiptPage.tsx` + `components/publishing/`.

2. **AGT-PUB-006 tracker agent** — build `web/src/pages/agent/PortalTrackerPage.tsx`. Imports `<PortalStatusPill>` from Shared Prep. Extracts screen-scoped `<TrackerKpiStrip>`, `<TrackerFilterBar>`, `<PortalTrackerRow>`, `<TrackerEmptyState>`. Cross-listing ledger: cursor-paginated table of per-(listing × portal) submissions with live-update rows on `portal_submission.status_changed` push. Route: `/publish/tracker`. Touches only `pages/agent/PortalTrackerPage.tsx` + `components/publishing/`.

3. **PA-MOD-001 queue agent** — build `web/src/pages/admin/PortalModerationQueuePage.tsx`. **This is where the PA-queue-family gets ADOPTED for real** — Wave 1 extracted primitives; this is the first PA-side consumer. Imports `<PAQueueFilterStrip>`, `<PAQueueTable>`, `<PAQueueBulkBar>` (with `showBulk={true}`), `<PAQueueBulkApproveDialog>`, `<PAQueueBulkReasonDialog>`, `<PAQueueKeyboardShortcutsPanel>` from `components/queue/`. All 7 family invariants apply. Env badge from PA-NAV-001 always visible. Route: `/admin/moderation/portals`. Touches only `pages/admin/PortalModerationQueuePage.tsx`.

4. **PA-MOD-002 detail agent** — build `web/src/pages/admin/PortalModerationDetailPage.tsx`. Per-submission review with listing preview + payload diff + per-portal validator lint results (from [BE-BLOCKER-17]) + risk signals (from [BE-DESIGN-02]) + Approve / Reject with reason / Request more info actions. Two-person rule for high-risk. Route: `/admin/moderation/portals/:submissionId`. Touches only `pages/admin/PortalModerationDetailPage.tsx`.

5. **AGT-PUB-005 refactor agent** — existing PARTIAL. Update it to reflect the dynamic portal_registry (list of portals from [BE-DESIGN-01]) + wire the submit action to trigger the new job-based flow that AGT-PUB-003 receipts against. Touches only `pages/agent/PortalSubmitPage.tsx` (or wherever the current AGT-PUB-005 file lives).

**Phase B — sequential AFTER Phase A merges:**

6. **WF-03 integration + cross-loop test agent** — end-to-end: submit → publisher runs → job aggregates → PA queue populates → PA approves → status_changed push fires → tracker row updates + receipt renders → agent sees outcome. Test all 6 failure classes render with correct resolution deep links. Test tenure-risk-driven two-person path. Test bulk operations on PA-MOD-001. Test env-scoped rendering (LIVE vs TEST via PA-NAV-001).

7. **A11y + visual regression agent** — per-brief a11y checks + Chromatic snapshots. Focus on the persistent tracker (heavy data density), PA queue keyboard nav (J/K/A/R/I), and PA-MOD-002 diff panel readability at desktop 1440 + tablet 1024.

## 4. Non-negotiables

1. **Every brief followed exactly** — copy tables, state variants, failure-class enum.
2. **PA-queue-family invariants honored** — env badge, two-person, bulk-reject-requires-reason, 5s undo grace on single-row only, keyboard-first J/K/A/R/I/Enter/X/./?/Esc.
3. **6 failure classes** rendered with correct glyph + label + resolution deep link per AGT-PUB-003 brief §copy table.
4. **Cross-loop test** proves WF-03 deadlock is resolved end-to-end including the push-notification hop.
5. **`no-raw-hex.test.ts` green** — all colors via `--lc-*`.
6. **RTL + dark + a11y** on every screen.
7. **Env-scoped rendering** — PA-MOD-001/002 render TEST data with warning strip; LIVE data without.
8. **Zero touches to Wave 0 / Wave 1 files or Shared Components Prep primitives** (only IMPORT them).
9. **Real-Postgres + Chromatic CI green.**
10. **PR body includes** screenshots of the 8 AGT-PUB-003 state variants + PA queue in bulk-select mode + Vercel preview link + cross-loop test log.

## 5. Coordination table

| # | Agent | Branch | Owns | Depends on | Est. days |
|---|---|---|---|---|---|
| 1 | Receipt | `feat/wave-2-receipt` | `pages/agent/PublishReceiptPage.tsx` + `components/publishing/` | Shared Prep merged | 2 |
| 2 | Tracker | `feat/wave-2-tracker` | `pages/agent/PortalTrackerPage.tsx` + shared publishing components | Shared Prep merged | 2 |
| 3 | PA queue | `feat/wave-2-pa-mod-queue` | `pages/admin/PortalModerationQueuePage.tsx` | Shared Prep merged | 2-3 |
| 4 | PA detail | `feat/wave-2-pa-mod-detail` | `pages/admin/PortalModerationDetailPage.tsx` | Agent 3 merged (env/queue-family compose) | 1-2 |
| 5 | AGT-PUB-005 refactor | `feat/wave-2-submit-refactor` | existing submit page | Week 2 backend merged | 1 |
| 6 | Integration test | `feat/wave-2-e2e` | test file only | Agents 1-5 merged | 1-2 |
| 7 | A11y + visual | `feat/wave-2-quality` | test files only | Agents 1-5 merged | 1 |

## 6. Test discipline

**Unit:** every failure-class glyph + copy matches brief; every state variant renders; queue-family invariants enforced.
**Integration:** publishing-job API contract matches AGT-PUB-003 brief §Backend contract; tracker API contract matches AGT-PUB-006.
**End-to-end:** submit → job → PA queue → PA decision → push → tracker + receipt reflect state. Every path tested (approve, reject with 6 failure classes, request-info, retry).
**A11y:** 44px tap floor, focus rings, aria-live on receipt status changes, J/K keyboard nav on PA queue, focus traps on PA-MOD-002 action modals.
**Visual:** ~20 Chromatic snapshots across LTR/RTL × light/dark × mobile/tablet/desktop, including the 8 receipt state variants + queue in bulk-select mode.
**Real-Postgres:** full lifecycle from `distribution_jobs` INSERT → `distribution_attempts` INSERT with each `error_class` → PA decision → tracker query.

## 7. Definition of done

1. All 4 primary screens + AGT-PUB-005 refactor land in one PR pair.
2. Screen-scoped compositions (`<AggregateOutcomeHero>`, `<CreditsSummary>`, `<TrackerKpiStrip>` family) land under `components/publishing/`.
3. Cross-loop test proves WF-03 end-to-end including push notification hop.
4. All 6 failure classes render with correct resolution UX.
5. PA-queue-family primitives from Shared Prep are actually IMPORTED (grep proves no duplicate implementations).
6. `no-raw-hex.test.ts` + fast + integration + a11y + Real-Postgres + Chromatic CI green.
7. Vercel preview attached; screenshots in PR body.
8. Blocker index updated: mark [BE-BLOCKER-01/03/10/11/12/17] + [BE-DESIGN-01/02] as **UI-CONSUMED**.

## 8. Follow-ups (do NOT include in this PR pair)

- **Advanced retry logic** — v1 supports retry per failed attempt; auto-retry-with-backoff is Phase 2.
- **AGT-PUB-004 retry-failed screen** — deferred; AGT-PUB-003 receipt handles retry actions in v1.
- **AGT-PUB-007 schedule-publish** — Phase 2.
- **PA-MOD-003 audit view** — Phase 2 (audit written but no dedicated PA screen v1).
- **Cross-portal SLA dashboard** for PA — Phase 2.
- **Per-country pricing tier visualization** in AGT-PUB-003 credits summary — Phase 2 when multi-currency ships.

## 9. Out of scope

- Anything in Wave 0 / Wave 1 file surface.
- Any Wave 3+ screen.
- Backend prereqs — all Week 2 backend items land in the standalone Week 2 backend dispatch.
- Portal-registry admin UI (PA-POR-001..003) — Wave 6.
- Marketing site pricing.
- Real Arabic content (English + [TRANSLATION-PENDING] mirror per standard).
- Any per-portal integration beyond the base publisher adapter (Wave 0.5 [BE-DESIGN-01] + [BE-BLOCKER-01] PF Group only in Phase 1).
