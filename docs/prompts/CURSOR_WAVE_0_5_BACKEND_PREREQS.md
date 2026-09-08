# Cursor dispatch — Wave 0.5: Backend prerequisites (parallel to Wave 0)

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Branches Cursor will create:** one per blocker (see §5) — allows granular review + rollback
**Estimated effort:** ~2.5-3 weeks compressed via parallel agents; ~5-6 weeks serial
**Rev 1 — 2026-09-08**

**Parallel to:** Wave 0 nav-chrome dispatch (`CURSOR_SCREEN_WAVE_0_FOUNDATIONS.md`). This prompt touches ZERO files that Wave 0 touches — dispatch simultaneously.

**Screen Matrix workstream context:** unblocks Weeks 3-4 of the Phase-1 workflow-cluster dispatch model. See [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5a for the full [BE-BLOCKER-*] catalog.

---

## 1. Why this dispatch

Wave 0 (nav chrome) ships user-visible surface. Waves 1-8+ each depend on specific backend prerequisites that are currently missing. This dispatch lands the 9 highest-leverage prereqs in parallel to Wave 0 so no wave stalls on schema/route absence.

**Landing rule:** every blocker below MUST have a migration + route + tests merged to `main` before its downstream Cursor dispatch begins. Frontend agents block on backend agents per the coordination table in §6.

## 2. Read these files FIRST

- [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5a — full [BE-BLOCKER-*] catalog with dependency notes
- [PORTAL_LIST_RESEARCH_2026-09-04.md](../design/PORTAL_LIST_RESEARCH_2026-09-04.md) §127-141 for [BE-DESIGN-01] portal_registry Option 2 metering approach
- Every migration in `backend/src/persistence/migrations/` up to the current highest (check at branch time — likely 315 after PR #50, or 316+ if Prompt 1 packages-marketing-fields has landed)

## 3. Parallelization directive

Spawn one background agent per blocker below. Each agent works on its own branch off `main`. Every agent works on a disjoint set of files. Merge order enforced by the coordination table in §6.

**Coordinator agent responsibilities:**
- Verify no two agents claim the same migration number at branch time (use `ls backend/src/persistence/migrations/` and pick sequential integers)
- Verify no two agents claim the same route path
- Merge in dependency order (§6)
- Final integration: run full Real-Postgres CI on `main` after all merges

## 4. Scope

### 4.1 [BE-BLOCKER-03] `distribution_attempts.error_class` schema migration

**Agent 1** — one branch `feat/be-error-class-schema`

**File to add:** new migration `NNN_distribution_attempts_error_class.sql` (next unused number)

**Change:**
```sql
ALTER TABLE distribution_attempts
  ADD COLUMN error_class TEXT CHECK (error_class IN (
    'auth_expired', 'portal_rules_violation', 'portal_down',
    'quota_exceeded', 'invalid_content', 'unknown_error'
  ));

CREATE INDEX idx_distribution_attempts_error_class
  ON distribution_attempts(error_class) WHERE error_class IS NOT NULL;
```

**Backend code:** add error-class classifier at `backend/src/lib/publishing/error-classifier.js` — takes a raw provider error object, returns one of the 6 codes above (with `unknown_error` fallback). Wire into every `distribution_attempts` INSERT in the publishing pipeline.

**Backfill:** best-effort classifier pass over existing `error_message` rows to backfill `error_class`. Log unclassified count.

**Tests:** Fast + Real-Postgres — INSERT with each error class + classifier unit tests for known provider payloads.

**Estimated:** 0.5-1 day

**Downstream unblocks:** AGT-PUB-003/006 (Week 2)

### 4.2 [BE-BLOCKER-04] `conversations.source_channel` decomposition

**Agent 2** — one branch `feat/be-source-channel-split`

**File to add:** new migration `NNN_conversations_channel_source_split.sql`

**Change:**
```sql
ALTER TABLE conversations
  ADD COLUMN channel TEXT,
  ADD COLUMN source TEXT;

-- Backfill from existing source_channel with lookup logic
UPDATE conversations SET
  channel = CASE
    WHEN source_channel ILIKE 'whatsapp%' THEN 'whatsapp'
    WHEN source_channel ILIKE 'email%' THEN 'email'
    WHEN source_channel ILIKE 'sms%' THEN 'sms'
    WHEN source_channel ILIKE 'instagram%' OR source_channel ILIKE 'ig_dm%' THEN 'instagram_dm'
    WHEN source_channel ILIKE 'facebook%' OR source_channel ILIKE 'fb_%' THEN 'facebook_messenger'
    WHEN source_channel ILIKE 'tiktok%' THEN 'tiktok'
    WHEN source_channel ILIKE 'x_dm%' OR source_channel ILIKE 'twitter%' THEN 'x_dm'
    WHEN source_channel ILIKE 'linkedin%' THEN 'linkedin'
    WHEN source_channel ILIKE 'telegram%' THEN 'telegram'
    ELSE 'direct'
  END,
  source = CASE
    WHEN source_channel ILIKE '%bazaar%' THEN 'bazaar'
    WHEN source_channel ILIKE '%bayut%' THEN 'bayut'
    WHEN source_channel ILIKE '%property_finder%' THEN 'property_finder'
    WHEN source_channel ILIKE '%dubizzle%' THEN 'dubizzle'
    WHEN source_channel ILIKE '%olx%' THEN 'olx'
    ELSE 'direct'
  END
WHERE channel IS NULL;

CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_source ON conversations(source);
```

**Backend code updates:** update all 14 code sites referencing `source_channel` with **dual-read fallback** during migration window (read `channel` if present, else derive from `source_channel`; write both on every INSERT/UPDATE for 30 days, then drop `source_channel` in a follow-up migration). File list to update:
- `backend/src/server.js`
- `backend/src/persistence/table-mapper.js`
- `backend/src/conversations/orchestrator.js`
- `backend/src/modules/comment-router/handlers.js`
- `backend/src/performance-dashboard.js`
- `web/src/pages/InboxPage.tsx` (lines 37, 404, 405, 449 — explicitly confirmed)
- `web/src/pages/CommandCenterPage.tsx`
- `web/src/api/client.ts`

**Tests:** Real-Postgres migration test + backfill correctness assertion + dual-read fallback test

**Estimated:** 3-5 days

**Downstream unblocks:** AGT-INB-001/002/005, AGN-ROU-002, AGT-CTC-002, AGT-LST-006, AGN-REP-002/003, AGT-ONB-004

### 4.3 [BE-BLOCKER-05] Agency free-tier package seed

**Agent 3** — one branch `feat/be-agency-free-tier`

**File to add:** new migration `NNN_agency_free_tier_seed.sql`

**Change:** insert a new row into `product_packages` with `target_audience='agency'`, `tier='free'`, seeded feature_flags matching agent free-tier baseline. Reference `docs/prompts/CURSOR_PACKAGES_MARKETING_FIELDS.md` (Prompt 1) for the packages schema.

**Wire signup path (c):** in `backend/src/lib/auth/*` (or wherever `POST /api/auth/register` lives), after tenant creation for path=agency, auto-subscribe the new agency tenant to the agency free-tier package.

**Tests:** Real-Postgres — path=agency signup flow creates agency tenant + free-tier subscription in one transaction.

**Estimated:** 0.5 day

**Downstream unblocks:** SHR-AUT-006 path (c) — Week 1

### 4.4 [BE-BLOCKER-18] Regenerate-backup-codes endpoint

**Agent 4** — one branch `feat/be-backup-codes-regenerate`

**File to add:** `POST /api/auth/2fa/backup-codes/regenerate` — invalidates existing codes + generates fresh 10-code set + returns them ONCE (per existing MFA policy).

Wire step-up requirement: caller must have valid `elevated_token` from `POST /api/auth/step-up/verify`.

**Tests:** Fast — happy path + step-up-required rejection + existing-code invalidation.

**Estimated:** 0.5 day

**Downstream unblocks:** SHR-MFA-005 (Week 4)

### 4.5 [BE-BLOCKER-19] Scheduled-deletion public endpoints + reminder cron + email templates

**Agent 5** — one branch `feat/be-scheduled-deletion-public`

**Changes:**
- Add `reminders_sent TEXT[]` column to `deletion_requests` (idempotency for cron)
- New endpoint: `GET /api/auth/scheduled-deletion/:token` — public, token-signed only, no session cookie. Reuses existing HMAC token infra (`backend/src/lib/webhook-verify.js`) with new `purpose='scheduled_deletion_view'` variant + 60-day TTL (covers 30-day cooldown + 30-day cancelled-record retention).
- New endpoint: `POST /api/auth/scheduled-deletion/:token/cancel` — public, token-signed only.
- Three email templates in `platform_message_templates`: `scheduled_deletion_confirm_t0`, `scheduled_deletion_reminder_tminus7`, `scheduled_deletion_reminder_tminus1`. Sent via existing Microsoft Graph transport.
- Daily reminder cron in `backend/src/workers/` — checks `deletion_requests` for T-7 and T-1 without corresponding `reminders_sent` entries, sends via Graph, records send.

**Tests:** Real-Postgres — token validation + cancel flow + cron idempotency + email-template rendering.

**Estimated:** 2-3 days

**Downstream unblocks:** SHR-AUT-005d (Week 3)

### 4.6 [BE-BLOCKER-20] `agent_onboarding_state` table + endpoints

**Agent 6** — one branch `feat/be-agent-onboarding-state`

**Changes:**
- New migration adding `agent_onboarding_state` table (user_id PK, step TEXT, path TEXT, checklist JSONB, dismissed_forever BOOLEAN, updated_at)
- `GET /api/user/onboarding-state` — returns caller's state row or `{step: 'welcome', path: null, checklist: {}}` default.
- `PATCH /api/user/onboarding-state` — upsert; body `{step?, path?, checklist_delta?, dismissed_forever?}`.

**Tests:** Real-Postgres — GET before write returns default + PATCH persists + concurrent PATCHes merge safely.

**Estimated:** 1 day

**Downstream unblocks:** AGT-ONB-001..005, AGT-ACT-001..005, AGT-DSH-001 checklist mount (Week 4)

### 4.7 [BE-BLOCKER-23] `GET /api/settings/index` capability-gated menu

**Agent 7** — one branch `feat/be-settings-index`

**Change:** New endpoint that returns ONLY the settings groups + items the caller may see (server-side capability gate). Response shape:
```json
{
  "groups": [
    { "id": "account", "label": "Account", "items": [{"id": "profile", "label": "Account & profile", "route": "/settings/account"}] },
    { "id": "security", "label": "Security", "items": [...] },
    { "id": "billing", "label": "Billing & notifications", "items": [...] },
    { "id": "team", "label": "Team & tenants", "items": [...] },
    { "id": "danger", "label": "Danger zone", "items": [{"id": "delete_account", "label": "Delete account", "route": "/settings/delete-account"}] }
  ]
}
```

Capability lookup: caller's `role` + `capability_packs` from `tenant_memberships` (packs may not exist yet if BE-BLOCKER-29 hasn't landed — treat as `[]` fallback).

**Tests:** Fast — role variants → returned menu contains/excludes expected items.

**Estimated:** 0.5 day

**Downstream unblocks:** SHR-SET-001 (Week 4)

### 4.8 [BE-BLOCKER-30] `agency_onboarding_state` table + endpoints

**Agent 8** — one branch `feat/be-agency-onboarding-state`

**Changes:** Parallel to [BE-BLOCKER-20] but keyed on `agency_id`, distinct checklist shape (branding/invites/billing/portal/listing/roles/2FA). Deliberately separate table for the reasons documented at kickoff [BE-BLOCKER-30] entry.

Endpoints: `GET/PATCH /api/agency/:agencyId/onboarding-state` (requires agency membership + admin capability).

**Tests:** Real-Postgres — same shape as BE-BLOCKER-20 tests but with tenant scoping.

**Estimated:** 1 day

**Downstream unblocks:** AGN-DSH-002 (Week 7)

### 4.9 [BE-DESIGN-01] Dynamic portal registry — schema + adapter pattern + feature auto-registration

**Agent 9** — one branch `feat/be-portal-registry` — **BIGGEST agent, ~1 week**

**Changes:**
- New migration: `portal_registry` table with columns per PA-POR-002 brief §Backend contract:
  ```sql
  CREATE TABLE portal_registry (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    country_codes TEXT[] NOT NULL DEFAULT '{}',
    primary_language TEXT,
    adapter_class_name TEXT NOT NULL,
    publisher_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    inbound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    validator_ref TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    effective_from TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  ```
- Seed the 4 existing portals (olx, property_finder, bayut, dubizzle) as inactive-STUB rows so nothing breaks
- Add `portal_registry_pending_activations` + `portal_activation_history` tables per PA-POR-003 brief
- Adapter base class at `backend/src/lib/notifications/portals/base.js` — defines `class PortalPublisher { async publish(listing, agentContext) {...} async fetchInboundLeads(agentContext) {...} async validateListing(listing) {...} }`
- Refactor `backend/src/lib/notifications/realestate.js` — dynamic load from `portal_registry` at boot instead of hardcoded PORTALS map. Adapter files live at `backend/src/lib/notifications/portals/<code>.js` and extend the base class. Currently all 4 seed rows have stub adapters that throw `NOT_IMPLEMENTED` (matches current behavior; only wiring changes).
- Refactor `backend/src/lib/credits/features.js` — dynamic feature registration from `portal_registry` at boot. Each active portal auto-registers a `PUBLISHING_REALESTATE_<CODE>` feature.
- Add `country_code` dimension on metered publishing events (per PORTAL_LIST_RESEARCH §132 Option 2)

**Tests:** Real-Postgres — registry CRUD + adapter dynamic-load + feature auto-registration + per-country metering event shape.

**Estimated:** 5-7 days

**Downstream unblocks:** [BE-BLOCKER-01] PF Group adapter build-out (Week 2 downstream), PA-POR-001/002/003 (Week 6), AGT-CHN-001, AGT-ACT-004

## 5. Coordination table

| Blocker | Agent | Branch | Files (backend only) | Est. days | Merge order |
|---|---|---|---|---|---|
| BE-BLOCKER-03 | 1 | `feat/be-error-class-schema` | new migration + `lib/publishing/error-classifier.js` | 0.5-1 | Any |
| BE-BLOCKER-04 | 2 | `feat/be-source-channel-split` | new migration + 8 file updates | 3-5 | Any (biggest surface) |
| BE-BLOCKER-05 | 3 | `feat/be-agency-free-tier` | new migration + `lib/auth/` register.js | 0.5 | After Prompt 1 packages migration |
| BE-BLOCKER-18 | 4 | `feat/be-backup-codes-regenerate` | route addition | 0.5 | Any |
| BE-BLOCKER-19 | 5 | `feat/be-scheduled-deletion-public` | new migration + routes + templates + cron | 2-3 | Any |
| BE-BLOCKER-20 | 6 | `feat/be-agent-onboarding-state` | new migration + routes | 1 | Any |
| BE-BLOCKER-23 | 7 | `feat/be-settings-index` | route addition | 0.5 | After BE-BLOCKER-29 IF present (else fallback []) |
| BE-BLOCKER-30 | 8 | `feat/be-agency-onboarding-state` | new migration + routes | 1 | Any |
| BE-DESIGN-01 | 9 | `feat/be-portal-registry` | new migrations + adapter refactor + feature refactor | 5-7 | Any |

**Coordinator merge order:** 1, 3, 4, 6, 7, 8 (small, low-risk) → 2, 5 (medium) → 9 (biggest, most invasive refactor). Serialize final merges so migration numbers stay sequential.

**Migration number allocation:** at branch time, `ls backend/src/persistence/migrations/ | tail -1` to find the current highest. Assign sequential numbers. If Prompt 1 (packages-marketing-fields) has landed with migration 316, allocate 317+ here. Coordinator ensures no collisions.

## 6. Non-negotiables

1. **Zero touches to `web/src/components/nav/*` or `web/src/app/*`** — Wave 0 owns those. Any accidental touch = auto-revert.
2. **All migrations idempotent** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING` for seeds. Re-run-safe.
3. **All new routes protected by appropriate middleware** — `authMiddleware` where auth required; explicit `no-auth` marker on public routes.
4. **Dual-read fallback for BE-BLOCKER-04** — cannot break existing code sites during migration window. All 14 sites read BOTH columns.
5. **BE-DESIGN-01 preserves existing publisher behavior** — the 4 current portals continue throwing `NOT_IMPLEMENTED` post-refactor; only the loading mechanism changes.
6. **Every agent writes tests** — fast + Real-Postgres where the change touches persistence.
7. **Every agent updates `docs/deployment/RAILWAY_ENV_VARS.md`** if it adds required env vars.
8. **Real-Postgres CI green on every merge to main.**

## 7. Definition of done

1. All 9 branches merged to `main`.
2. `main` Real-Postgres CI green after all merges.
3. Kickoff §5a updated: mark each [BE-BLOCKER-*] as **RESOLVED** with commit SHA and merge date.
4. Coordinator posts a summary PR-comment on the parent tracking issue: "Wave 0.5 complete — Weeks 2, 3, 4, 7 unblocked. Weeks 5, 6, 8+ still gated on their own backend bundles ([BE-BLOCKER-26/28/32/33/34/36] respectively — separate dispatch)."

## 8. Follow-ups (NOT in this dispatch)

- **[BE-BLOCKER-01]** PF Group publisher adapter — depends on BE-DESIGN-01 registry existing. Separate ~2-3 day Cursor dispatch, Week 2.
- **[BE-BLOCKER-06/07/08/09]** WF-02 agency-invitations bundle — separate Week 1 dispatch.
- **[BE-BLOCKER-10/11/12]** publishing tracker + push templates — separate Week 2 dispatch.
- **[BE-BLOCKER-21/22]** WF-04 account-recovery bundle + two-person-bypass refactor — separate Week 3 dispatch.
- **[BE-BLOCKER-26/28]** WF-05/06 valuation bundles — separate Week 5 dispatch.
- **[BE-BLOCKER-29]** capability packs — separate Week 7 dispatch.
- **[BE-BLOCKER-31]** WF-31 ownership-transfer — separate Week 7 dispatch.
- **[BE-BLOCKER-32/33/34]** WF-20 two-person UI backend — separate Week 6 dispatch.
- **[BE-BLOCKER-35/36]** portal_registry extensions + contact_relationships CRUD — separate Week 6/8+ dispatches.

## 9. Out of scope

- Any frontend work (Wave 0 owns it).
- Any change to billing/credit/subscription logic.
- Adapter implementations for any specific portal beyond the base class + registry loading.
- Multi-currency support (Phase 2).
- Real portal API integration (Week 2 depends on BE-BLOCKER-01 which is out of scope here).
