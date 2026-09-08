# Cursor dispatch — Screen Matrix Wave 7: WF-31 Ownership Transfer + Agency Governance

**PR title:** `feat(screen-wave-7): WF-31 ownership transfer + AGN-ROL role management + AGN-DSH-002 agency onboarding checklist`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~5-7 days with parallel agents; ~10-13 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0-6 merged + Shared Components Prep.**
- **Week 7 backend bundle merged:**
  - `[BE-BLOCKER-29]` capability_packs schema + endpoints (~3-4 days)
  - `[BE-BLOCKER-30]` `agency_onboarding_state` table (Wave 0.5)
  - `[BE-BLOCKER-31]` WF-31 ownership-transfer backend bundle (~4-5 days)
- **`<OwnershipTransferChallenge>` extracted** as shared component in Shared Components Prep.

**Screen Matrix workstream context:** Week 7. Ships enterprise governance (ownership transfer) + role/capability visibility + agency activation checklist.

---

## 1. Why this dispatch

Ownership transfer is enterprise table stakes. Capability packs today are invisible to admins (they assign blindly). Agency onboarding checklist is the paid-conversion driver for path-c signups.

## 2. Read briefs

- AGN-SET-005 (anchor — ownership transfer initiator with 3-factor challenge)
- AGN-SET-005b (delta — recipient accept/decline)
- AGT-REC-006 (delta — agent-side outcome, REC-family)
- AGN-ROL-001 (anchor — roles overview with capability-pack cards)
- AGN-ROL-002 (delta — role permissions detail with capability matrix)
- AGN-DSH-002 (agency onboarding checklist)

## 3. Parallelization

**Phase A — spawn concurrently (3 agents):**

1. **WF-31 ownership transfer cluster** — build AGN-SET-005 + -005b + AGT-REC-006 under `pages/agency/settings/ownership/` + `pages/agent/inbox/ownership-transfer/`. Uses `<OwnershipTransferChallenge>` from Shared Prep for the 3-factor challenge (password step-up + email OTP + typed agency-name). 3-factor rule reuses SHR-MFA-007 step-up + email-OTP infra with new `purpose='ownership_transfer_initiate'` tag but composition is WF-31-specific. AGT-REC-006 uses REC-family primitives. 30-day reversal window on outcome + status timeline. Touches only ownership-transfer paths.

2. **AGN-ROL cluster** — build AGN-ROL-001 (`pages/agency/settings/roles/RolesOverviewPage.tsx`) + AGN-ROL-002 (`pages/agency/settings/roles/RolePermissionsDetailPage.tsx`). Path B capability packs on JSONB (per D1 decision). Custom pack is edit-only (no new Custom-pack creation in v1). Any Financial capability grant on Custom pack triggers WF-20 two-person via [BE-BLOCKER-29] `capability_packs` write. Touches only `pages/agency/settings/roles/`.

3. **AGN-DSH-002 checklist** — build `pages/agency/OnboardingChecklistPage.tsx`. Analogous to AGT-ONB-005 (widget-on-dashboard) but agency-specific 7-task checklist (branding / invites / billing / portal / listing / roles / 2FA). Uses `<OnboardingChecklistCard>` from Shared Prep. Dismiss-with-7-day-undo. Backend: `agency_onboarding_state` from [BE-BLOCKER-30]. Touches only `pages/agency/Onboarding*.tsx`.

**Phase B — sequential:**

4. **WF-31 integration test** — full transfer cycle: owner initiates (3-factor) → target admin accepts (3-factor) → transfer executes atomically → both parties see outcome → 30-day reversal window enforced by cron → reverse action works within window.

5. **Capability packs integration test** — assign pack via AGN-ROL-001 → viewer sees only enabled routes on next login → Financial capability edit triggers two-person → after approval, capability grants.

6. **A11y + visual agent** — high-stakes flows (ownership transfer, capability grants) need extra a11y scrutiny.

## 4. Non-negotiables

1. **3-factor challenge composition = password step-up + email OTP + typed agency-name.** Reuses SHR-MFA-007 + email-OTP infra with WF-31-specific tag. NOT the SHR-SET-005 3-factor variant (different factors: liveness word + email link + TOTP).
2. **Ownership transfer atomicity** — success flips ownership + adjusts capability packs + notifies both parties within one transaction.
3. **30-day reversal window enforced by cron** — after 30 days, ownership is permanent.
4. **Custom pack has no create action in v1** — only edit the seeded custom pack.
5. **Capability grant on Financial capabilities triggers WF-20 two-person.**
6. **Agency onboarding checklist state distinct from agent's** — per [BE-BLOCKER-30] rationale (same user can be agent AND agency owner with unrelated checklists).
7. **`no-raw-hex.test.ts` + RTL + dark + a11y.**

## 5. Coordination

| # | Agent | Branch | Est. days |
|---|---|---|---|
| 1 | WF-31 | `feat/wave-7-wf31` | 3-4 |
| 2 | AGN-ROL | `feat/wave-7-roles` | 2-3 |
| 3 | AGN-DSH-002 | `feat/wave-7-agency-checklist` | 1-2 |
| 4 | WF-31 integration | `feat/wave-7-wf31-e2e` | 1-2 |
| 5 | Packs integration | `feat/wave-7-packs-e2e` | 1 |
| 6 | A11y + visual | `feat/wave-7-quality` | 1 |

## 6. Definition of done

1. All 6 screens land.
2. Full ownership transfer cycle proven including 30-day reversal.
3. Capability pack visibility + two-person Financial gate proven.
4. Agency checklist tracks state distinct from agent's onboarding state.
5. CI + Chromatic green.
6. Blocker index: mark [BE-BLOCKER-29/30/31] as **UI-CONSUMED**.

## 7. Out of scope

- Wave 8+.
- Backend prereqs.
- Custom pack creation (Phase 2 — v1 is edit-only).
