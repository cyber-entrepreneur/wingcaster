# Cursor dispatch — Screen Matrix Wave 6: Two-person UI + PA-PKG + PA-POR

**PR title:** `feat(screen-wave-6): WF-20 two-person UI + PA-PKG admin + PA-POR portal registry admin`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~7-9 days with parallel agents; ~14-17 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0-4 merged + Shared Components Prep.**
- **Week 6 backend bundle merged:**
  - `[BE-BLOCKER-32]` PA-PKG backend prereqs (7 items — ~6 days)
  - `[BE-BLOCKER-33]` PA-APR-005/006 backend routes (escalate + withdraw + eligible-targets)
  - `[BE-BLOCKER-34]` unified `/execute` endpoint + 7 supporting tickets (~3-4 days)
  - `[BE-BLOCKER-35]` `portal_registry` schema extensions + state tables
  - `[BE-DESIGN-04/05/06]` package clone helper + recall + arbitrary-version diff endpoints
- **Prompt 1 (`CURSOR_PACKAGES_MARKETING_FIELDS.md`) merged** — provides admin route foundation PA-PKG-* extends.
- **[BE-DESIGN-01] `portal_registry` merged** via Wave 0.5.

**Screen Matrix workstream context:** Week 6. Completes the WF-20 two-person rule surface (which every WF-07/08/17-25/27-28 approval flow depends on) + ships PA-managed pricing + portal catalogs.

---

## 1. Why this dispatch

Three clusters land together because they share backends + primitives:
- **WF-20 UI** (PA-APR-003/005/006) — unified `/execute` + `/escalate` + `/withdraw` surfaces used by every approval-driven workflow
- **PA-PKG-001..004** — package admin surface (list / edit / approve / history)
- **PA-POR-001..003** — portal-registry admin (list / add-edit / activation-history) per user's dynamic-catalog directive

## 2. Read briefs

- PA-APR-003 (anchor for WF-20 execute pattern), PA-APR-005 (escalate delta), PA-APR-006 (recall delta)
- PA-PKG-001 (anchor), PA-PKG-002 (edit delta), PA-PKG-003 (approval delta), PA-PKG-004 (history delta)
- PA-POR-001 (anchor), PA-POR-002 (add-edit delta), PA-POR-003 (history delta)

Shared: [BROADCAST_ALIGNMENT_REFERENCE.md](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md), [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md), [CURSOR_PACKAGES_MARKETING_FIELDS.md](CURSOR_PACKAGES_MARKETING_FIELDS.md) for PA-PKG backend contract

## 3. Parallelization

**Phase A — spawn concurrently (3 cluster agents):**

1. **WF-20 two-person UI cluster** — build 3 modals: `PA-APR-003 TwoPersonActionConfirmation.tsx` (execute; type-to-confirm ONLY on high_value tier per anti-pattern), `PA-APR-005 EscalationModal.tsx` (escalation-target picker + rationale), `PA-APR-006 RecallModal.tsx` (submitter-only withdraw). All three under `components/approval/`. Consumed by every approval-detail screen across the platform. `<TwoPersonProgress>` from Shared Prep drives the vote-status display. Touches only `components/approval/`.

2. **PA-PKG cluster** — build 4 pages under `pages/admin/packages/`. Wire against Prompt 1's admin routes + Week 6 [BE-BLOCKER-32] backend items. PA-PKG-002 form structure per [CURSOR_PA_PACKAGE_EDIT_UI.md](CURSOR_PA_PACKAGE_EDIT_UI.md). Two-person approval on price + property-cap changes triggers WF-20 modal cluster from Agent 1. Bulk approval DEFERRED per [UX-DECISION-01] Phase 2. Touches only `pages/admin/packages/`.

3. **PA-POR cluster** — build 3 pages under `pages/admin/portals/`. PA-POR-001 list (with country-code chip list per portal, active/stub/deprecated status filter). PA-POR-002 add/edit form (Identity + Coverage + Adapter + Validators + Metering + SLA + Activation sections). PA-POR-003 activation history timeline. Server-side gate for `is_active=true` flip — checks adapter file + validator file existence via [BE-BLOCKER-35] state-machine table. Adding a stub row does NOT require code deploy (per [[project_dynamic_portal_registry]]). Touches only `pages/admin/portals/`.

**Phase B — sequential:**

4. **WF-20 integration test agent** — verifies every existing approval-detail screen (PA-CRD-005b, PA-INV-004b, etc.) correctly invokes the new modal cluster. Tests self-approval rejection (submitter can't approve own), escalation routing, recall by submitter, type-to-confirm at high_value tier only.

5. **PA-PKG + PA-POR integration test agent** — end-to-end package edit + submit + approve + deploy-to-marketing revalidation. End-to-end portal add + adapter check + activation two-person flow.

6. **A11y + visual agent.**

## 4. Non-negotiables

1. **Type-to-confirm ONLY on high_value tier per [[pa-queue-family-invariants]] anti-pattern.** Never over-apply.
2. **`<TwoPersonProgress>` from Shared Prep** — do NOT re-implement.
3. **PA-POR-002 `is_active=true` requires adapter + validator files to exist** — server-side gate. Frontend disables the toggle if pre-check fails and shows "Adapter file missing" helper.
4. **Dynamic portal registry pattern locked** — see [[project_dynamic_portal_registry]] memory. Adding a stub row = no code deploy. Activating = adapter file + validator + two-person WF-20 flip.
5. **On PA-PKG-002 approve → marketing revalidation dispatch** to `wingcaster-www/api/revalidate` per Prompt 1's `triggerMarketingRevalidate` hook.
6. **`no-raw-hex.test.ts` + RTL + dark + a11y.**

## 5. Coordination

| # | Agent | Branch | Est. days |
|---|---|---|---|
| 1 | WF-20 UI | `feat/wave-6-wf20-ui` | 2-3 |
| 2 | PA-PKG | `feat/wave-6-pa-pkg` | 3-4 |
| 3 | PA-POR | `feat/wave-6-pa-por` | 2-3 |
| 4 | WF-20 integration | `feat/wave-6-wf20-e2e` | 1 |
| 5 | Package + portal integration | `feat/wave-6-pkg-por-e2e` | 1-2 |
| 6 | A11y + visual | `feat/wave-6-quality` | 1 |

## 6. Definition of done

1. All 10 screens land.
2. WF-20 modal cluster used by every existing approval-detail screen (verified via grep + test).
3. Package price change triggers marketing revalidation.
4. Portal registry allows stub-row-then-activate flow.
5. CI + Chromatic green.
6. Blocker index: mark [BE-BLOCKER-32/33/34/35] + [BE-DESIGN-04/05/06] as **UI-CONSUMED**.

## 7. Out of scope

- Wave 7+ screens.
- Backend prereqs.
- Feature-registry admin UI (Phase 2).
- Bulk approval on packages (Phase 2 per UX-DECISION-01).
