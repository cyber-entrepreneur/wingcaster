# Backend Blocker Index

**Purpose:** flat, reviewable catalog of every `[BE-BLOCKER-*]`, `[BE-VERIFY-*]`, `[BE-DESIGN-*]` item surfaced during Phase-1 brief authoring (2026-09-06..08). Companion to [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5a — this doc is the reviewable index; the kickoff has the narrative.

**Author:** Architect-owner
**Rev 2 — 2026-09-09** — Week 4 BE-13/14/15/16 + BE-VERIFY-02 marked RESOLVED

---

## 1. Summary by week

| Week | Blockers | Verifies | Designs | Est. backend days | Cursor dispatch |
|---|---|---|---|---|---|
| **Week 1** | BE-05, BE-06, BE-07, BE-08, BE-09 | — | — | ~3.5 | Separate WF-02 backend agent |
| **Week 2** | BE-01, BE-03, BE-10, BE-11, BE-12, BE-17 | BE-09..17 (subset) | BE-01, BE-02 | ~12-15 | Bulk (parallel to WF-03 UI) |
| **Week 3** | BE-19, BE-21, BE-22 | — | — | ~18-22 | Bulk pre-WF-04 UI |
| **Week 4** | BE-04, BE-13, BE-14, BE-15, BE-16, BE-18, BE-20, BE-23 | BE-19, BE-20, BE-18 (MFA) | — | ~9-11 | Wave 0.5 covers most |
| **Week 5** | BE-24, BE-25, BE-26, BE-27, BE-28 | — | — | ~18-22 | Bulk pre-WF-05/06 UI |
| **Week 6** | BE-32, BE-33, BE-34, BE-35 | BE-11..15 (PA-PKG) | BE-02, BE-04, BE-05, BE-06 | ~13-16 | Bulk pre-WF-20 UI + PA-POR |
| **Week 7** | BE-29, BE-30, BE-31 | — | — | ~8-10 | Bulk pre-WF-31 UI |
| **Week 8+** | BE-36 | — | — | ~2-3 | AGT-CTC-007 |

**Total backend days estimated:** ~85-105 person-days (~17-21 person-weeks). With 3-5 concurrent Cursor backend agents on Wave 0.5 + subsequent bundles: ~4-6 calendar weeks compressed.

---

## 2. Wave 0.5 dispatched — 9 items

Bundled in [CURSOR_WAVE_0_5_BACKEND_PREREQS.md](../prompts/CURSOR_WAVE_0_5_BACKEND_PREREQS.md), dispatch parallel to Wave 0.

- BE-BLOCKER-03 — `distribution_attempts.error_class` schema
- BE-BLOCKER-04 — `conversations.source_channel` decomposition
- BE-BLOCKER-05 — agency free-tier package seed
- BE-BLOCKER-18 — regenerate-backup-codes endpoint
- BE-BLOCKER-19 — scheduled-deletion public endpoints + email templates + cron
- BE-BLOCKER-20 — `agent_onboarding_state` table + endpoints
- BE-BLOCKER-23 — `GET /api/settings/index` capability-gated menu
- BE-BLOCKER-30 — `agency_onboarding_state` table + endpoints
- BE-DESIGN-01 — dynamic `portal_registry` schema + adapter pattern + feature auto-registration

---

## 3. Full catalog by ID

### BE-BLOCKER-01 — Portal publisher adapters (PF Group critical path)

**Slot:** Week 2 · **Est:** 2-3 days per portal · **Depends on:** BE-DESIGN-01 landing first
**Unblocks:** AGT-PUB-003/006, PA-MOD-001/002
**File(s):** `backend/src/lib/notifications/portals/*.js` (per portal), extends `PortalPublisher` base
**Scope:** implement PF Group adapter as Phase-1 critical path (covers UAE + KSA + EG + LB + JO + QA + KW + BH + OM per D19). Other portals stay `NOT_IMPLEMENTED` stubs, added incrementally as BD deals close.

### BE-BLOCKER-02 — (unassigned — reserved)

### BE-BLOCKER-03 — `distribution_attempts.error_class` schema

**Slot:** Week 2 · **Est:** 0.5-1 day · **Status:** Wave 0.5 dispatched
**Unblocks:** AGT-PUB-003 (6 failure classes render + resolution deep links)
**File(s):** new migration + `backend/src/lib/publishing/error-classifier.js`

### BE-BLOCKER-04 — `conversations.source_channel` decomposition

**Slot:** Week 4 · **Est:** 3-5 days · **Status:** Wave 0.5 dispatched
**Unblocks:** AGT-INB-001/002/005, AGN-ROU-002, AGT-CTC-002, AGT-LST-006, AGN-REP-002/003, AGT-ONB-004
**File(s):** new migration + 8 code-site updates with dual-read fallback

### BE-BLOCKER-05 — Agency free-tier package seed

**Slot:** Week 1 · **Est:** 0.5 day · **Status:** Wave 0.5 dispatched
**Unblocks:** SHR-AUT-006 path (c) agency-owner signup
**File(s):** new migration (extends Prompt 1 packages seed)

### BE-BLOCKER-06 — Agency application route rename + schema uplift

**Slot:** Week 1 · **Est:** 1 day
**Unblocks:** AGN-MEM-005
**File(s):** `backend/src/server.js:7152` rename + `agency_applications` migration
**Change:** rename `POST /api/agencies/apply` → `POST /api/agencies/:slug/applications`. Add columns: applicant_user_id, current_listings_count, portfolio_url, availability, referral_source, profile_share_consent, invitation_code, expected_response_by.

### BE-BLOCKER-07 — `agency_invitations` table + endpoints

**Slot:** Week 1 · **Est:** 1-1.5 days
**Unblocks:** AGN-MEM-005 shareable-link path + SHR-AUT-006 path (b) invitation-code prefill
**File(s):** new migration + `GET /api/invitations/:code` + `POST /api/invitations/:code/accept`

### BE-BLOCKER-08 — `agencies.accepting_applications` boolean

**Slot:** Week 1 · **Est:** 0.5 day
**Unblocks:** AGN-MEM-005 (gate)
**File(s):** migration + owner toggle exposed on AGN-SET-001

### BE-BLOCKER-09 — `agency_applications.expires_at` + 30-day auto-expire cron

**Slot:** Week 1 · **Est:** 0.5 day
**Unblocks:** AGT-REC-004 EXPIRED state
**File(s):** migration + cron worker

### BE-BLOCKER-10 — Publishing-job aggregation endpoint

**Slot:** Week 2 · **Est:** 3-5 days · **Depends on:** BE-BLOCKER-03 + BE-DESIGN-01
**Unblocks:** AGT-PUB-003 receipt view + retry endpoints
**File(s):** `GET /api/publishing/jobs/:id` + retry POST endpoints + `publishing_job.completed` push template

### BE-BLOCKER-11 — Publishing tracker endpoints

**Slot:** Week 2 · **Est:** 2-3 days
**Unblocks:** AGT-PUB-006
**File(s):** `GET /api/publishing/tracker` (list, cursor-paginated) + `GET /api/publishing/tracker/summary` (KPI)

### BE-BLOCKER-12 — `portal_submission.status_changed` push template

**Slot:** Week 2 · **Est:** 0.5 day
**Unblocks:** AGT-PUB-006 live-row updates
**File(s):** template row with 5 status-transition variants

### BE-BLOCKER-13 — SSE/WebSocket for AGT-WLB-004 real-time draft streaming

**Slot:** Week 4 · **Est:** 2-3 days (SSE) or 0.5 day (polling fallback) · **Status:** RESOLVED · **Merge:** `03d1aebf04d92f46e909ddf587c1849d088c3270` (#96)
**Unblocks:** AGT-WLB-004 live-draft-canvas
**File(s):** SSE `/api/whatsapp-listings/drafts/:sessionId/progress` + poll `/state` + `WHATSAPP_DRAFT_PROGRESS_MODE` flag

### BE-BLOCKER-14 — Inbound-message poll endpoint for AGT-WLB-003

**Slot:** Week 4 · **Est:** 0.5 day · **Status:** RESOLVED · **Merge:** `5d66c9abc7e1087aaa8ea80aaf325fc3a4e33a05` (#94)
**Unblocks:** AGT-WLB-003
**File(s):** `GET /api/intake/inbound-status/:bindingId`

### BE-BLOCKER-15 — Onboarding events schema + endpoints

**Slot:** Week 4 · **Est:** 1 day · **Status:** RESOLVED · **Merge:** `e449e7f3bc979feda65f773668d010e6b404c179` (#100)
**Unblocks:** step-defer / step-complete / auto-complete tracking for AGT-ONB + AGT-ACT
**File(s):** migration `334_onboarding_events.sql` + `GET/POST /api/agent/activation_state*` + `POST /api/users/me/onboarding-events`

### BE-BLOCKER-16 — `GET /activation-code` idempotency check

**Slot:** Week 4 · **Est:** 0.5 day · **Status:** RESOLVED · **Merge:** `4ddcaaa3cc2776ee4e3a541be82912981b9d5ce7` (#88)
**Unblocks:** AGT-WLB-002 stable code across visits
**File(s):** `GET /api/auth/whatsapp/activation-code` (+ `/current` alias); POST remains regenerate

### BE-BLOCKER-17 — Per-portal validator modules

**Slot:** Week 2 · **Est:** ~8 days (1 day per portal × 8)
**Unblocks:** PA-MOD-001/002 (lint aggregate)
**File(s):** `backend/src/lib/portal-validators/{bayut,property_finder,dubizzle,olx,aqar,wasalt,aqarmap,3akarat}.js`. Each exports `validate(listing, portalContext) → { checks: [{code, severity, message, expected, actual}] }`. Rules sourced from PORTAL_LIST_RESEARCH §C.

### BE-BLOCKER-18 — Regenerate-backup-codes endpoint

**Slot:** Week 4 · **Est:** 0.5 day · **Status:** Wave 0.5 dispatched
**Unblocks:** SHR-MFA-005

### BE-BLOCKER-19 — Scheduled-deletion public endpoints + email templates + cron

**Slot:** Week 3 · **Est:** 2-3 days · **Status:** Wave 0.5 dispatched
**Unblocks:** SHR-AUT-005d

### BE-BLOCKER-20 — `agent_onboarding_state` table + endpoints

**Slot:** Week 4 · **Est:** 1 day · **Status:** Wave 0.5 dispatched
**Unblocks:** AGT-ONB-001..005, AGT-ACT-001..005, AGT-DSH-001 checklist mount

### BE-BLOCKER-21 — WF-04 account-recovery backend bundle (13 items)

**Slot:** Week 3 · **Est:** ~15-18 days
**Unblocks:** PA-ACR-001/002
**Items:** list-response extension, request-info endpoint, evidence upload+storage, account_value_tier derivation, env-scoping audit, reveal-audit endpoint (20/hr rate limit), undo-approve endpoint, masked/PII CSV export, single-case GET, two-person cast-vote + escalation wiring, authenticated evidence image proxy, withdraw-vote, cancel-info-request

### BE-BLOCKER-22 — Two-person-rule bypass in existing account-recovery approve endpoint (CRITICAL)

**Slot:** Week 3 · **Est:** 1-2 days · **Security-adjacent**
**Unblocks:** PA-ACR-002 (blocks its ship until fixed)
**File(s):** refactor `backend/src/server.js:7041` through cast-vote endpoint before PA-ACR-002 UI ships. UI would otherwise expose a security downgrade.

### BE-BLOCKER-23 — `GET /api/settings/index` capability-gated menu

**Slot:** Week 4 · **Est:** 0.5 day · **Status:** Wave 0.5 dispatched
**Unblocks:** SHR-SET-001

### BE-BLOCKER-24 — `comparable_reports.expires_at` + auto-expire cron

**Slot:** Week 5 · **Est:** 0.5 day
**Unblocks:** AGT-REC-002 EXPIRED state

### BE-BLOCKER-25 — `agent_price_reports.expires_at` + auto-expire cron

**Slot:** Week 5 · **Est:** 0.5 day
**Unblocks:** AGT-REC-003 EXPIRED state

### BE-BLOCKER-26 — WF-06 PA-PVA-009 backend bundle (8 items)

**Slot:** Week 5 · **Est:** 5-7 days
**Unblocks:** PA-PVA-009/009b
**Items:** list-route pagination + filters + joins, per-item detail route, benchmark-series route, extend `POST /:id/review` with `incorporate: boolean` (true → benchmark write with single-approver commit for |delta|<10%, else two-person via `fin.approval_requests`), benchmark-refresh worker enqueue, benchmark writer, `request_info` state.

### BE-BLOCKER-27 — Seed `valuation.price_reports.submit` feature code on Pro tiers

**Slot:** Week 5 · **Est:** 0.5 day
**Unblocks:** AGT-APR-005 tier gate
**File(s):** new migration (post-Prompt-1 numbering)

### BE-BLOCKER-28 — WF-05 PA-PVA-008 backend bundle

**Slot:** Week 5 · **Est:** 12-14 days
**Unblocks:** PA-PVA-008/008b
**Items:** list-response extension (masking + market impact + evidence + reporter/comparable + is_own + env + pagination + counts), REPLACE generic `/review` with 4 WF-05 decision endpoints (`/confirm-remove`, `/confirm-quarantine`, `/reject-as-invalid`, `/request-info`) + bulk-reject-as-invalid + bulk-request-info + undo endpoints + affected-valuations + reporter-history + audit-trail + single-item `GET /:reportId`.

### BE-BLOCKER-29 — Capability packs schema + endpoints

**Slot:** Week 7 · **Est:** 3-4 days
**Unblocks:** AGN-ROL-001/002
**File(s):** `capability_packs JSONB` column on `tenant_memberships` + seed pack definitions (Finance/Marketer/Read-only/Custom) + `GET /api/agency/capability-packs[/:id]` + `PATCH /api/agency/members/:userId/capability-packs`

### BE-BLOCKER-30 — `agency_onboarding_state` table + endpoints

**Slot:** Week 7 · **Est:** 1 day · **Status:** Wave 0.5 dispatched
**Unblocks:** AGN-DSH-002

### BE-BLOCKER-31 — WF-31 ownership-transfer backend bundle

**Slot:** Week 7 · **Est:** 4-5 days
**Unblocks:** AGN-SET-005/005b, AGT-REC-006
**Items:** `ownership_transfer_requests` table + 8 routes (state/otp/initiate/accept/decline/cancel/acknowledge/reverse) + 14-day expiry cron + 30-day reversal-window enforcement + 5 notification templates. Reuses SHR-MFA-007 step-up + email-OTP infra with new `purpose='ownership_transfer_initiate'` tag.

### BE-BLOCKER-32 — PA-PKG backend prereqs (7 items)

**Slot:** Week 6 · **Est:** ~6 days
**Unblocks:** PA-PKG-001..004
**Items:** env-scoped catalog audit, feature-registry live fetch audit, own-submission detection, undo-reject endpoint, marketing revalidation confirm ping/SSE (non-blocking), cross-env clone helper (Phase-1 add-on), submitter-only recall, arbitrary-version diff.

### BE-BLOCKER-33 — PA-APR-005/006 backend routes

**Slot:** Week 6 · **Est:** 2 days
**Unblocks:** PA-APR-005/006
**File(s):** `POST /:id/escalate` + `POST /:id/withdraw` + `GET /:id/eligible-escalation-targets` + migration for `WITHDRAWN` enum + escalation columns on `fin.approval_requests`

### BE-BLOCKER-34 — Unified `/execute` endpoint + 7 supporting tickets

**Slot:** Week 6 · **Est:** 3-4 days
**Unblocks:** PA-APR-003
**File(s):** new `POST /api/admin/approvals/:id/execute` consolidating stubs at `backend/src/fin/admin/routes.js:282-288`. Supporting: type-to-confirm phrase generation, value-tier evaluation, risk-signals aggregation, ledger-impact preview, self-approval rejection, idempotency, audit-write. Type-to-confirm is TIERED — only high_value tier; anti-pattern to over-apply.

### BE-BLOCKER-35 — `portal_registry` schema extensions + state tables

**Slot:** Week 6 · **Est:** 2-3 days · **Depends on:** BE-DESIGN-01 landed
**Unblocks:** PA-POR-002/003
**File(s):** extend `portal_registry` (description, logo_url, primary_language, validator_ref, effective_from, deprecated_at) + new `portal_registry_pending_activations` + `portal_activation_history` tables

### BE-BLOCKER-36 — `contact_relationships` CRUD routes

**Slot:** Week 8+ · **Est:** 2-3 days
**Unblocks:** AGT-CTC-007
**File(s):** 7 endpoints — list-mine, list-other-redacted, create, patch, delete-pending, resend-consent-link, public consent landing (`GET /public/relationships/consent?token=…`). Consent link piggybacks HMAC-token infra (`backend/src/lib/webhook-verify.js`) with new `type='relationship_consent'`.

---

## 4. Verify items (grep + confirm; no code)

### BE-VERIFY-01 — SUPERSEDED

Was `distribution_attempts.status` failure-class check. Upgraded to BE-BLOCKER-03 after verification confirmed no enumeration exists.

### BE-VERIFY-02 — AGT-ONB backend hooks work with PR #50 WhatsApp binding

**Status:** RESOLVED — 2026-09-09. Confirmed `POST/GET /api/auth/whatsapp/activation-code`, `binding-status`, and `user_whatsapp_bindings` usable for AGT-ONB/WLB.

### BE-VERIFY-03..08 — Wave 1 (AGN-MEM-002/002b)

Bulk-approve/reject existence, undo grace-period, per-agency step-up policy, risk-signals payload, queue-position + siblings, contact-reveal audit-log

### BE-VERIFY-09..17 — PA-MOD-001/002

Per-portal SLA config, undo endpoints, is_own detection, env-scoped audit, sibling lookup, two_person_reject_required flag, contact-reveal audit, payload preview serialization, notification-preview substitution

### BE-VERIFY-18 — Backup-codes fetch endpoint (by design — none exists)

Confirmed intended contract per PR #49 architecture.

### BE-VERIFY-19 — Partial-PATCH for AGT-ONB-003 draft fields (nice-to-have)

### BE-VERIFY-20 — `bound_at` on binding-status (nice-to-have)

---

## 5. Design items (require product-level decision + spec)

### BE-DESIGN-01 — Dynamic `portal_registry` — STATUS: Wave 0.5 dispatched

Documented at kickoff §5a + Wave 0.5 prompt §4.9

### BE-DESIGN-02 — Tenure-risk scoring service

**Slot:** Week 2 · **Est:** 3-5 days · **Can ship stub for v1**
**Unblocks:** PA-MOD-001 risk-tier column (informs two-person-rule gate)

### BE-DESIGN-04 — Cross-env package clone helper (Phase-1 add-on)

**Slot:** Week 6 · **Est:** 1 day · Non-blocking

### BE-DESIGN-05 — Submitter-only recall endpoint

**Slot:** Week 6 · **Est:** 1 day (part of PA-PKG bundle)

### BE-DESIGN-06 — Arbitrary-version diff endpoint

**Slot:** Week 6 · **Est:** 1 day · Non-blocking with client fallback

---

## 6. Critical-path highlights

**These block Phase-1 launch if not landed:**

1. **[BE-DESIGN-01]** Dynamic portal registry → gates every portal-related surface
2. **[BE-BLOCKER-01]** PF Group publisher → primary metered revenue source
3. **[BE-BLOCKER-22]** Two-person bypass fix → security fix; blocks PA-ACR-002 ship
4. **[BE-BLOCKER-34]** Unified `/execute` endpoint → all WF-20 approvals depend on it
5. **[BE-BLOCKER-04]** `source_channel` decomposition → 14-site blast radius; earlier = safer
6. **[BE-BLOCKER-31]** WF-31 ownership-transfer bundle → nothing works without it

**These can slip to Phase 2 if capacity tight:**

- BE-BLOCKER-13 SSE (falls back to polling, still ships)
- BE-BLOCKER-15 onboarding events (state persistence sufficient for v1)
- BE-DESIGN-02 tenure-risk scoring (stub returns "unknown")
- BE-DESIGN-04, -05, -06 all non-blocking
- BE-VERIFY-19, -20 nice-to-haves

---

## 7. Update discipline

- Every Cursor dispatch that lands a blocker: update this doc's per-blocker entry with **RESOLVED — commit-sha — YYYY-MM-DD**.
- New blockers surfaced by future brief authoring: append with next unused number.
- Kickoff §5a stays as the narrative + reason; this doc stays as the flat catalog.
