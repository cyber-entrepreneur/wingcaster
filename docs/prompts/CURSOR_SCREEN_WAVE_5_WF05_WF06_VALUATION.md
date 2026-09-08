# Cursor dispatch — Screen Matrix Wave 5: WF-05 + WF-06 Valuation Review clusters

**PR title:** `feat(screen-wave-5): WF-05 comparable-report review + WF-06 agent price-report review (both sides)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~7-9 days with parallel agents; ~13-16 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0, 1, 2, 3, 4B merged.** Shells, signup, portal moderation family established, MFA step-up available.
- **Shared Components Prep merged.** REC-family, PA-queue-family, forms (`<EvidenceUploader>`, `<ContextEchoCard>`), PII (`<PIIMask>`, `<TwoPersonProgress>`, `<Timeline>`).
- **Week 5 backend bundle merged:**
  - `[BE-BLOCKER-24]` `comparable_reports.expires_at` + auto-expire cron
  - `[BE-BLOCKER-25]` `agent_price_reports.expires_at` + auto-expire cron
  - `[BE-BLOCKER-26]` WF-06 PA-PVA-009 backend bundle (8 items — ~5-7 days)
  - `[BE-BLOCKER-27]` seed `valuation.price_reports.submit` feature code on Pro tiers
  - `[BE-BLOCKER-28]` WF-05 PA-PVA-008 backend bundle (~12-14 days — BIG)
- **REC-family anchor extension merged.** `<StatusHero>` needs `emphasis="default"` variant for approved-and-quarantined / approved-as-signal-only states — one-PR amendment to `components/recipient/StatusHero.tsx`.

**Screen Matrix workstream context:** Week 5 of the workflow-cluster dispatch model. Resolves TWO simultaneous deadlock cycles (WF-05 + WF-06) — agents report data-quality issues, PA reviews, decisions flow back.

---

## 1. Why this dispatch

Agents report bad comparables + missing prices today into a black hole — PA has no queue, no per-item detail, no way to close the loop. Data quality degrades because reporters stop reporting when they never see outcomes.

**Two deadlock cycles resolved simultaneously:**
- **WF-05 (comparable-report review):** AGT-APR-004 (initiator) → PA-PVA-008/008b (PA review) → AGT-REC-002 (outcome)
- **WF-06 (agent price-report review):** AGT-APR-005 (Pro-tier initiator) → PA-PVA-009/009b (PA review + incorporate to benchmark) → AGT-REC-003 (outcome)

## 2. Read these files FIRST

**Wave 5 briefs (8):**
- [`AGT-APR-004-submit-bad-comparable-report-brief.md`](../design/briefs/AGT-APR-004-submit-bad-comparable-report-brief.md)
- [`AGT-APR-005-submit-price-report-brief.md`](../design/briefs/AGT-APR-005-submit-price-report-brief.md)
- [`AGT-REC-002-comparable-report-outcome-brief.md`](../design/briefs/AGT-REC-002-comparable-report-outcome-brief.md)
- [`AGT-REC-003-price-report-outcome-brief.md`](../design/briefs/AGT-REC-003-price-report-outcome-brief.md)
- [`PA-PVA-008-bad-comparable-report-queue-brief.md`](../design/briefs/PA-PVA-008-bad-comparable-report-queue-brief.md)
- [`PA-PVA-008b-bad-comparable-report-detail-brief.md`](../design/briefs/PA-PVA-008b-bad-comparable-report-detail-brief.md)
- [`PA-PVA-009-agent-price-report-queue-brief.md`](../design/briefs/PA-PVA-009-agent-price-report-queue-brief.md)
- [`PA-PVA-009b-agent-price-report-detail-brief.md`](../design/briefs/PA-PVA-009b-agent-price-report-detail-brief.md)

**Shared:** [BROADCAST_ALIGNMENT_REFERENCE.md](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md), [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md)

## 3. Parallelization directive

**Phase A — spawn concurrently (5 agents):**

1. **REC-family anchor extension agent** — MUST LAND FIRST. Add `emphasis="default"` variant to `<StatusHero>` in `components/recipient/StatusHero.tsx` per AGT-REC-002/003 briefs. This is a Shared Components Prep amendment. Touches only `components/recipient/StatusHero.tsx` + its test file. Ships as own small PR merged before other agents proceed.

2. **AGT-APR-004/005 submitter agent** — build `pages/agent/reports/BadComparableReportPage.tsx` + `pages/agent/reports/PriceReportPage.tsx`. Both use `<EvidenceUploader>` + `<ContextEchoCard>` from Shared Prep. Tier gate on AGT-APR-005 via `package_feature_flags['valuation.price_reports.submit']` seeded by [BE-BLOCKER-27]. Touches only `pages/agent/reports/`.

3. **AGT-REC-002/003 outcome agent** — build `pages/agent/reports/ComparableReportOutcomePage.tsx` + `pages/agent/reports/PriceReportOutcomePage.tsx`. Both inherit REC-family primitives verbatim. Introduces `ImpactPanel` (REC-002 — shows how many valuations were affected) + `WeightingPanel role="meter"` (REC-003 — shows how much weight PA gave to the report) + shared `OriginalReportAccordion` (both). Touches only `pages/agent/reports/`.

4. **PA-PVA-008/008b agent — WF-05 review** — build `pages/admin/valuation/BadComparableQueuePage.tsx` + `pages/admin/valuation/BadComparableDetailPage.tsx`. **PA-queue-family with WF-05 deliberate deviations documented:** bulk confirm-remove OMITTED (removal re-runs valuations across the market — bad bulk could invalidate thousands); no inline row Approve/Reject (all 4 decision affordances live on detail — mirroring PA-ACR discipline); two-person triggered by market-impact tier not tenure risk; reporter-pattern amber dot as new WF-05 signal. 4 decision affordances: `/confirm-remove`, `/confirm-quarantine`, `/reject-as-invalid`, `/request-info`. Bulk supported for reject-as-invalid + request-info ONLY. Touches only `pages/admin/valuation/`.

5. **PA-PVA-009/009b agent — WF-06 review** — build `pages/admin/valuation/PriceReportQueuePage.tsx` + `pages/admin/valuation/PriceReportDetailPage.tsx`. PA-queue-family standard pattern (bulk allowed). Detail includes new `incorporate: boolean` action per [BE-BLOCKER-26] — true → benchmark write (single-approver commit if |delta|<10%, else two-person via `fin.approval_requests`). Touches only `pages/admin/valuation/`.

**Phase B — sequential AFTER Phase A merges:**

6. **WF-05 + WF-06 cross-loop test agent** — end-to-end for BOTH workflows. WF-05: agent submits bad comparable → PA queue populates → PA reviews → confirm-remove (with two-person for high market impact) → agent sees outcome with impact panel. WF-06: Pro agent submits price report → PA queue populates → PA reviews → incorporate=true → benchmark writes → agent sees outcome with weighting panel showing PA's assigned weight.

7. **A11y + visual agent** — WF-05 has the highest risk profile (bulk actions ONLY for low-impact decisions, market-wide implications visible). Extra scrutiny on the two-person progress indicator on high-impact remove.

## 4. Non-negotiables

1. **`<StatusHero>` extension MUST land before Agents 3 + 4 + 5 start** — approved-and-quarantined / approved-as-signal-only depend on it.
2. **WF-05 bulk-confirm-remove OMISSION is deliberate + code-commented.** `<PAQueueBulkBar>` props on PA-PVA-008 filter out the confirm-remove action.
3. **Two-person rule triggered by market-impact tier on WF-05** — not tenure risk. High-market-impact confirmed removals become `REMOVE_PROPOSED` and surface in PA-APR-001 for a second PA; valuation recalculation defers until second approval lands.
4. **Reporter-pattern amber dot** on WF-05 queue rows when the same reporter has filed multiple reports — signal for coordinated reporting (informational, not policy gate).
5. **WF-06 incorporate action is atomic + audited.** Benchmark writes must be transactional with the review decision.
6. **AGT-APR-005 tier gate is server-side** — feature flag check on POST; frontend just renders the upsell copy if flag missing.
7. **`<PIIMask>` on any applicant / reporter identifier display** — WF-05/06 exposes reporter attribution.
8. **`no-raw-hex.test.ts` + RTL + dark + a11y.**

## 5. Coordination table

| # | Agent | Branch | Est. days |
|---|---|---|---|
| 1 | REC extension | `feat/wave-5-rec-extension` | 0.5 |
| 2 | Submitters | `feat/wave-5-submitters` | 2 |
| 3 | Outcomes | `feat/wave-5-outcomes` | 2 |
| 4 | WF-05 PA queue | `feat/wave-5-wf05-pa` | 3 |
| 5 | WF-06 PA queue | `feat/wave-5-wf06-pa` | 2-3 |
| 6 | Integration test | `feat/wave-5-e2e` | 2 |
| 7 | A11y + visual | `feat/wave-5-quality` | 1 |

## 6. Definition of done

1. All 8 primary screens land in one PR pair.
2. `<StatusHero>` extension merged before Agents 3-5.
3. Both WF-05 + WF-06 cross-loops proven end-to-end.
4. WF-05 bulk-safety anti-pattern verified (no confirm-remove in bulk bar).
5. WF-06 incorporate→benchmark write is transactional + audited.
6. CI + Chromatic green.
7. Blocker index: mark [BE-BLOCKER-24/25/26/27/28] as **UI-CONSUMED**.

## 7. Out of scope

- Wave 6+ screens.
- Backend prereqs.
- Bulk confirm-remove for WF-05 (permanently omitted per PII/market-safety design).
