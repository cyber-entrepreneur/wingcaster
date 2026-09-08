# Cursor dispatch — Backend Week 7: WF-31 + capability packs bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~5-6 days with parallel agents; ~7-9 days serial
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-30] agency_onboarding_state merged.

**Unblocks:** Wave 7 (WF-31 ownership + AGN-ROL governance + AGN-DSH-002).

---

## 1. Scope

2 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-29]** Capability packs schema + endpoints (~3-4 days)
- **[BE-BLOCKER-31]** WF-31 ownership-transfer backend bundle (~4-5 days)

## 2. Parallelization directive

**Agent 1 — BE-BLOCKER-29 (capability packs):** migration adds `capability_packs JSONB NOT NULL DEFAULT '[]'::jsonb` to `tenant_memberships`. Seed 4 pack definitions (Finance / Marketer / Read-only / Custom) in a new `capability_pack_definitions` table. New endpoints:
- `GET /api/agency/capability-packs` — list definitions
- `GET /api/agency/capability-packs/:id` — pack detail
- `PATCH /api/agency/members/:userId/capability-packs` — assign packs to a member (server enforces two-person WF-20 via `fin.approval_requests` when granting any Financial capability)
Branch: `feat/be-capability-packs`.

**Agent 2 — BE-BLOCKER-31 (WF-31 ownership transfer):** new `ownership_transfer_requests` table (id, agency_id, initiator_user_id, target_user_id, status enum [pending/accepted/declined/cancelled/expired/executed/reversed], initiated_at, expires_at, decided_at, executed_at, reversed_at, reversal_deadline_at). 8 routes:
- `GET /api/agencies/:id/ownership-transfer/state`
- `POST /api/agencies/:id/ownership-transfer/otp/send` (initiator email OTP)
- `POST /api/agencies/:id/ownership-transfer/initiate` (creates request; requires SHR-MFA-007 step-up + email OTP + typed agency-name)
- `POST /api/agencies/:id/ownership-transfer/:transferId/accept` (target accepts; same 3-factor)
- `POST /api/agencies/:id/ownership-transfer/:transferId/decline` (target declines with reason)
- `POST /api/agencies/:id/ownership-transfer/:transferId/cancel` (initiator cancels while pending)
- `POST /api/agencies/:id/ownership-transfer/:transferId/acknowledge` (executed → both parties acknowledge)
- `POST /api/agencies/:id/ownership-transfer/:transferId/reverse` (within 30-day reversal window; same 3-factor)

Crons: 14-day pending → expired; 30-day reversal window closes → permanent.

5 notification templates: `initiator-accepted`, `target-invited`, `target-declined`, `transfer-executed`, `reversal-window-expiring`.

Reuses SHR-MFA-007 step-up + email-OTP infrastructure with new `purpose='ownership_transfer_initiate'` tag on the OTP.

Branch: `feat/be-wf31-ownership-transfer`.

## 3. Non-negotiables

1. **Ownership transfer atomicity** — success flips `tenant_memberships.role` from admin → owner (target) and owner → admin (former owner) + adjusts capability_packs + notifies both parties + writes audit — all in one transaction.
2. **30-day reversal window enforced by cron** — after 30 days pass, `reversal_deadline_at` passes and `/reverse` returns 410 Gone.
3. **Custom pack has no create action in v1** — server rejects `POST /capability-pack-definitions` with 405.
4. **Financial capability grant triggers two-person** — checked server-side on `PATCH /members/:userId/capability-packs`.
5. **OTP purpose tag** for WF-31 distinguishes from other flows (delete-account, recovery, etc.) so email templates render correct copy.
6. Kickoff RESOLVED markers.

## 4. Definition of done

- Both branches merged.
- Kickoff marks [BE-BLOCKER-29/31] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 7.
