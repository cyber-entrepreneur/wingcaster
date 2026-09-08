# Cursor dispatch — Backend Week 5: WF-05 + WF-06 valuation bundles

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~12-15 days with parallel agents; ~25-30 days serial (biggest bundle after Week 3)
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 merged. Prompt 1 packages seed migration landed (packages target_audience feature flags).

**Unblocks:** Wave 5 (WF-05 + WF-06 valuation cluster).

---

## 1. Scope

5 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-24]** `comparable_reports.expires_at` + auto-expire cron (0.5 day)
- **[BE-BLOCKER-25]** `agent_price_reports.expires_at` + auto-expire cron (0.5 day)
- **[BE-BLOCKER-26]** WF-06 PA-PVA-009 backend bundle (8 items — ~5-7 days)
- **[BE-BLOCKER-27]** Seed `valuation.price_reports.submit` feature code on Pro tiers (0.5 day)
- **[BE-BLOCKER-28]** WF-05 PA-PVA-008 backend bundle (~12-14 days — BIGGEST single item)

## 2. Parallelization directive

**Agents 1-3 (small, quick):**

- **Agent 1 — BE-BLOCKER-24 + 25:** two expires_at columns + one shared daily cron in `backend/src/workers/`. Same shape. Branch: `feat/be-report-expiry`.
- **Agent 2 — BE-BLOCKER-27:** migration seeding `valuation.price_reports.submit` feature code on Pro-tier package versions in `package_feature_flags`. Branch: `feat/be-price-report-feature`.

**Agent 3 — BE-BLOCKER-26 (WF-06 PA-PVA-009 bundle):** in `backend/src/modules/property-valuation/`:
- List-route pagination + filters + joins
- Per-item detail route
- Benchmark-series route
- Extend `POST /:id/review` with `incorporate: boolean` (true → benchmark write; single-approver commit when |delta|<10%, else two-person via `fin.approval_requests`)
- Benchmark-refresh worker enqueue
- Benchmark writer in the module
- `request_info` state
Branch: `feat/be-wf06-pa-pva-009`.

**Agents 4-6 — BE-BLOCKER-28 (WF-05 PA-PVA-008 bundle, split across 3 agents):**

- **Agent 4** — list-response extension (masking + market impact + evidence + reporter/comparable + is_own + env + pagination + counts) + single-item `GET /:reportId` + reporter-history + audit-trail endpoints. Branch: `feat/be-wf05-endpoints-core`.
- **Agent 5** — REPLACE generic `/review` with 4 WF-05 decision endpoints: `/confirm-remove`, `/confirm-quarantine`, `/reject-as-invalid`, `/request-info`. Two-person trigger by market-impact tier (not tenure risk). High-impact confirmed removals record as `REMOVE_PROPOSED` and appear in PA-APR-001 for a second PA; valuation recalculation deferred until second approval lands. Branch: `feat/be-wf05-decisions`.
- **Agent 6** — bulk-reject-as-invalid + bulk-request-info + undo endpoints + affected-valuations endpoint. Branch: `feat/be-wf05-bulk-affected`.

## 3. Migration allocation

Sequential from current highest at branch time.

## 4. Non-negotiables

1. **WF-05 has NO bulk confirm-remove** (deliberate per PA-PVA-008 brief §family deviations). Bulk only for reject-invalid + request-info.
2. **Two-person trigger by market-impact tier** for WF-05, NOT tenure risk (that's WF-03).
3. **WF-06 incorporate is transactional** — benchmark write must roll back if review status write fails.
4. **`agent_price_reports.expires_at` cron identical shape** to `comparable_reports.expires_at` cron — reuse worker.
5. Kickoff RESOLVED markers for all 5 blockers.

## 5. Definition of done

- All 6 branches merged.
- Kickoff marks [BE-BLOCKER-24/25/26/27/28] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 5.
