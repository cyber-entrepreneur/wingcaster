# Cursor dispatch — Backend Week 2: WF-03 portal-publish bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~10-12 days with parallel agents; ~20 days serial (largest bundle)
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-03] error_class + [BE-DESIGN-01] portal_registry (both merged).

**Unblocks:** Wave 2 (WF-03 portal moderation cluster).

---

## 1. Scope

6 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-01]** Property Finder Group publisher adapter (2-3 days) — Phase-1 critical path per D19
- **[BE-BLOCKER-10]** `GET /api/publishing/jobs/:id` aggregation + retry endpoints (3-5 days)
- **[BE-BLOCKER-11]** `GET /api/publishing/tracker` + `/summary` endpoints (2-3 days)
- **[BE-BLOCKER-12]** `portal_submission.status_changed` push template (0.5 day)
- **[BE-BLOCKER-17]** Per-portal validator modules (~8 days, 1 per portal × 8)
- **[BE-DESIGN-02]** Tenure-risk scoring service (3-5 days, stub OK for v1)

## 2. Parallelization directive

Spawn 5 concurrent backend agents.

**Agent 1 — BE-BLOCKER-01 (PF Group adapter):** implement `backend/src/lib/notifications/portals/property_finder.js` extending `PortalPublisher` base class from BE-DESIGN-01. Country-variant support (UAE / KSA / EG / LB / JO / QA / KW / BH / OM). Publish + inbound-lead-fetch + validate methods. Metering integration. Real-Postgres integration test with mocked PF API. Branch: `feat/be-pf-group-adapter`.

**Agent 2 — BE-BLOCKER-10:** `GET /api/publishing/jobs/:id` composing distribution_attempts + portal_registry + credit reservations for AGT-PUB-003 receipt. Retry POST endpoints per failed attempt. `publishing_job.completed` push template. Branch: `feat/be-publishing-aggregation`.

**Agent 3 — BE-BLOCKER-11:** `GET /api/publishing/tracker` (list, cursor-paginated, filterable by portal + status + listing + date range) + `GET /api/publishing/tracker/summary` (KPI aggregate). Branch: `feat/be-publishing-tracker`.

**Agent 4 — BE-BLOCKER-12 + BE-BLOCKER-17:** Small template row (0.5 day) + 8 per-portal validators in `backend/src/lib/portal-validators/{bayut,property_finder,dubizzle,olx,aqar,wasalt,aqarmap,3akarat}.js`. Each exports `validate(listing, portalContext) → {checks: [{code, severity, message, expected, actual}]}` per rules sourced from [PORTAL_LIST_RESEARCH_2026-09-04.md](../design/PORTAL_LIST_RESEARCH_2026-09-04.md) §C. Branch: `feat/be-portal-validators`.

**Agent 5 — BE-DESIGN-02 stub:** `backend/src/lib/moderation/tenure-risk.js` — takes agent + submission, returns risk tier (low / medium / high / unknown). v1 stub returns "unknown" for all; scoring rules deferred to Phase 2 when signal data accumulates. Branch: `feat/be-tenure-risk-stub`.

## 3. Migration allocation

Sequential from current highest at branch time.

## 4. Non-negotiables

1. PF Group adapter passes Real-Postgres integration test with mocked API responses.
2. Per-portal validators implement PORTAL_LIST_RESEARCH §C rules verbatim (trakheesi_number for Bayut UAE, agency_license for PF UAE, advertiser_license Fal for Bayut KSA, developer_registration for Aqarmap primary/off-plan, etc.).
3. Tenure-risk stub gracefully returns unknown; PA-MOD-002 renders "risk unknown" copy per its brief.
4. Every aggregation endpoint tested for N+1 query patterns (use JOIN, not per-portal loops).
5. Kickoff §5a RESOLVED markers.

## 5. Definition of done

- All 5 branches merged.
- Kickoff marks [BE-BLOCKER-01/10/11/12/17] + [BE-DESIGN-02] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 2.
