# Cursor dispatch — Screen Matrix Wave 8+: Activation polish

**PR title:** `feat(screen-wave-8): dashboards + Pro variants + listings + inbox + CRM relationships`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~7-10 days with parallel agents; ~14-18 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0-7 merged + Shared Components Prep.**
- **Week 8+ backend bundle merged:**
  - `[BE-BLOCKER-04]` source_channel decomposition (from Wave 0.5) — required by inbox screens
  - `[BE-BLOCKER-36]` `contact_relationships` CRUD routes (~2-3 days)

**Screen Matrix workstream context:** Week 8+. Ships the daily-use core surfaces: dashboards + Pro-mode variants + listings + inbox + CRM contact relationships. Completes Phase-1.

---

## 1. Why this dispatch

The core screens agents open every day: dashboard, listings, inbox, contacts. Plus Pro-mode variants for power users (D-S-06: tablet + desktop only, ≥768px). Plus AGT-CTC-007 mandate/representation editor which makes CRM function.

## 2. Read briefs

- AGT-DSH-001 (existing) + AGT-DSH-002 (Pro variant delta)
- AGT-SET-002 (Guided ↔ Pro mode toggle — small)
- AGT-LST-001 (list mobile Guided anchor) + AGT-LST-002 (Pro table variant delta) + AGT-LST-003 (existing detail) + AGT-LST-004 (manual composer anchor)
- AGT-INB-001 (inbox list anchor) + AGT-INB-002 (conversation detail delta)
- AGT-CTC-007 (contact relationships editor)

Shared: [BROADCAST_ALIGNMENT_REFERENCE.md](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md), [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md)

## 3. Parallelization

**Phase A — spawn concurrently (5 agents):**

1. **Pro variants agent** — build AGT-DSH-002 + AGT-LST-002 as deltas from existing AGT-DSH-001 / AGT-LST-001. Storage in `tenant_memberships.data.ui_mode` (per-tenant-context per the AGT-DSH-002 brief backend answer). Pro variants render ONLY at ≥768px per D-S-06 lock. Also build AGT-SET-002 mode toggle (small, exposes the ui_mode setting). Touches only Pro-variant delta files + settings extension.

2. **Listing surface agent** — refactor existing `ListingsPage.tsx` per AGT-LST-001 brief (preserve `viewMode` pattern). Build AGT-LST-004 manual composer wizard under `pages/agent/listings/ManualListingComposerPage.tsx`. Multi-step wizard with autosave via existing `PUT /api/properties/:id` (per AGT-LST-004 brief finding). Touches only `pages/agent/listings/`.

3. **Inbox agent** — build AGT-INB-001 unified list + AGT-INB-002 conversation detail. **Critical dependency:** refactor 14 `source_channel` code sites to use dual-read fallback per [BE-BLOCKER-04] state. Confirmed sites in `web/src/pages/InboxPage.tsx` lines 37 / 404 / 405 / 449. Touches inbox pages + the 14 dual-read site fixups + `<ChannelMark>` + `<PortalStatusPill>`-style source badge components.

4. **AGT-CTC-007 agent** — build `pages/agent/contacts/RelationshipsEditorPage.tsx`. Uses `contact_relationships` schema (party_type + relationship_type + exclusivity + status + consent_record) from migration 028. 7 endpoints from [BE-BLOCKER-36]. Public consent landing at `/public/relationships/consent?token=...`. Touches only `pages/agent/contacts/RelationshipsEditorPage.tsx` + a public consent landing page.

5. **AGT-DSH-002 mount agent** — small update to AGT-DSH-001 to conditionally render AGT-DSH-002 layout when `ui_mode === 'pro'` + viewport ≥768px. Touches only `pages/agent/DashboardPage.tsx`.

**Phase B — sequential:**

6. **Full-funnel integration test agent** — daily-user path: agent signs in → dashboard renders per mode → clicks listing → creates one via manual composer → publishes → sees receipt → checks inbox → replies to inquiry → adds contact relationship. All screens link cleanly.

7. **A11y + visual agent** — Pro-mode density needs extra a11y verification (dense tables + keyboard nav); consent-landing public page needs public-viewer-safe styling.

## 4. Non-negotiables

1. **Pro variants render only at ≥768px per D-S-06.** Mobile falls back to Guided.
2. **`ui_mode` stored in `tenant_memberships.data`** — per-tenant not per-user. Same user can be Guided in one agency + Pro in another.
3. **`viewMode` pattern preserved on AGT-LST-001** — do NOT rename the existing `'card' | 'list' | 'gallery'` union; extend additively.
4. **Inbox dual-read fallback** — read both `channel` and derived `source_channel` for the 30-day migration window per [BE-BLOCKER-04].
5. **AGT-CTC-007 consent link** uses HMAC-token pattern with `type='relationship_consent'` — no new token infra.
6. **Public consent landing** never trusts URL query params, only signed token.
7. **`no-raw-hex.test.ts` + RTL + dark + a11y.**

## 5. Coordination

| # | Agent | Branch | Est. days |
|---|---|---|---|
| 1 | Pro variants | `feat/wave-8-pro` | 2-3 |
| 2 | Listing | `feat/wave-8-listing` | 3-4 |
| 3 | Inbox | `feat/wave-8-inbox` | 2-3 |
| 4 | Relationships | `feat/wave-8-relationships` | 2 |
| 5 | DSH-002 mount | `feat/wave-8-dsh-mount` | 0.5 |
| 6 | Integration test | `feat/wave-8-e2e` | 2 |
| 7 | A11y + visual | `feat/wave-8-quality` | 1 |

## 6. Definition of done

1. All screens land.
2. Pro-mode toggle + persistence proven.
3. Inbox dual-read tested across the 14 sites.
4. Relationships consent link end-to-end tested.
5. CI + Chromatic green.
6. Blocker index: mark [BE-BLOCKER-04/36] as **UI-CONSUMED**.
7. **Phase 1 complete.** Kickoff status updates from "APPROVED — in flight" to "PHASE 1 SHIPPED".

## 7. Out of scope

- Phase 2 features.
- Any Wave-8+ that was already deferred (AGT-REC-005, AGT-CMP-*, campaigns, complaints, etc.).
- Multi-currency / additional MENA markets beyond Phase 1.
