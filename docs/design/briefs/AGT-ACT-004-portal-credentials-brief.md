# Screen Brief — AGT-ACT-004 · Activation wizard — Portal credentials (delta)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-ACT-001-activation-welcome-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-ACT-004` (row 57 in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5). Wave-4 Phase-1 add-on per Rev 8.

**Inherits everything from AGT-ACT-001.** Read that anchor first — Broadcast callouts, ACT-vs-ONB coexistence contract, progress-bar persistence, backend `activation_state` contract, anti-patterns, and DoD all apply verbatim. Deltas below.

---

## ⚠️ BLOCKED — backend dependency

**This screen is blocked until `[BE-DESIGN-01]` dynamic `portal_registry` ships (Week 2 backend per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a).**

The blocker:
- `backend/src/lib/notifications/realestate.js` currently hardcodes a 4-entry `PORTALS` map (olx, property_finder, bayut, dubizzle).
- `credits/features.js` hardcodes feature codes per portal.
- Per user directive 2026-09-06, portals must be **dynamically registered** via a new `portal_registry` table so BD can add portals without a code deploy.
- Required backend deliverables: (1) `portal_registry` schema + migration; (2) `PortalPublisher` adapter base class + per-portal adapters; (3) dynamic feature registration reading from `portal_registry` at boot; (4) `GET /api/portal_registry?country=<code>` endpoint returning the active portals for a given user's country; (5) per-portal `POST /api/portal_credentials` endpoint accepting the credentials payload each adapter defines.

**Consequence:**
- **AGT-ACT-001 is NOT blocked.** The welcome hub renders this step in Locked variant with helper "Available soon — we're finalizing your country's portal list" when `portal_registry` is empty for the user's country.
- **THIS screen ships in one of two states:**
  1. **If Week 2 backend lands on schedule** → ships in Wave 4 alongside AGT-ACT-001/002/003/005, fully functional.
  2. **If Week 2 slips** → this screen is deferred to Wave 8+ per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §6 Week 4 note ("if Week 2 slips, ship AGT-ACT-004 in Wave 8+"). AGT-ACT-001..003/005 still ship in Wave 4 with Step 3 gracefully locked.

The Cursor dispatch prompt for this brief MUST include a check: `GET /api/portal_registry` returns an HTTP 200 with a non-empty array for at least one country before merging.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-004 |
| Screen name | Activation wizard — Portal credentials |
| Route | `/activate/portal-credentials` |
| Backend prerequisites | ⏳ **`[BE-DESIGN-01]` dynamic `portal_registry` (Week 2 backend)** — see blocker section above · ⏳ per-portal credential storage endpoints |
| Depends on | AGT-ACT-001 + PA-POR-001..003 (portal admin surface — same source of truth for the portal list) |
| Current state | MISSING — new sub-screen, blocked by `[BE-DESIGN-01]` |

---

## Purpose

Guide the agent through connecting their credentials for whichever portals (Bayut, Property Finder, Dubizzle, etc.) are active in their country, so WingCaster can publish listings on their behalf. Country-aware — a UAE agent sees UAE portals; a KSA agent sees Aqar.fm; a Lebanese agent sees LB-specific portals. The portal list is **read from the dynamic `portal_registry`**, not hardcoded.

---

## What this screen is (and is NOT)

**IS:** a country-scoped list of portals the agent can connect, each with its own credential form (per-portal shape defined by the adapter's `publisher_config` JSONB). One-at-a-time or bulk-connect flow.

**IS NOT:** the portal admin surface (that's PA-POR-001..003 — Product Admin-only). This screen is the *agent-facing* consumer of the same `portal_registry` data.

---

## Layout deltas from AGT-ACT-001

Single-column, centered, max-width 720px.

**Zone 1 — Header + breadcrumb:** breadcrumb `Activation wizard → Step 3 · Add your portal credentials`.

**Zone 2 — Persistent progress bar:** same treatment as other AGT-ACT sub-screens.

**Zone 3 — Task intro:**
- H1: "Add your portal credentials"
- Sub: "Connect the portals you already list on. WingCaster will publish, refresh, and unpublish for you — no more copy-paste."
- Country pill: reads user's `country_code` (from `activation_state`). E.g. `Portals available in United Arab Emirates`. Small text link "Wrong country?" opens a `<Dialog>` explaining that country is set from the user's profile + how to change it.

**Zone 4 — Portal list (from `GET /api/portal_registry?country=<code>`):**
- Rendered as a vertical stack of portal rows. Each row = `<Card>` with `--lc-elevation-sm`.
- Row anatomy:
  - Left: `<ChannelMark>` for the portal (24×24) or portal logo if channel-mark doesn't cover it — fall back to a generic `<Building>` icon.
  - Middle: portal display name (`var(--lc-type-heading-3)`) + one-line description from `portal_registry.publisher_config.description` (`var(--lc-type-body-sm)`, `--lc-text-muted`).
  - Right: state pill + primary CTA.
- **Row state pill variants** (tint + glyph + label — never color-alone):
  - **Not connected** → `--lc-status-draft-*`, glyph `○`, label "Not connected."
  - **Connecting** → `--lc-status-underOffer-*`, glyph `◐`, label "Connecting…" (spinner replaces the glyph while an API call is in flight).
  - **Connected** → `--lc-status-published-*`, glyph `●`, label "Connected · {masked_username}."
  - **Failed** → `--lc-status-unpublished-*`, glyph `✕`, label "Connection failed — retry."
- Row primary CTA:
  - Not connected → "Connect →" opens the credential drawer for that portal.
  - Connecting → disabled spinner.
  - Connected → "Manage" — links to PA-POR-* equivalent agent surface (or opens the credential drawer in edit mode).
  - Failed → "Retry" opens the credential drawer with prior values pre-filled + error message inline.

**Zone 5 — Credential drawer (`<Sheet>` from Radix, right-side on desktop, bottom on mobile):**
- Rendered per-portal. Form fields read from `portal_registry.publisher_config.credentials_schema` (JSON Schema shape).
- Typical fields per portal: `username`, `password`, `api_key` (Property Finder), `agency_id` (Bayut), etc.
- Every field uses `<Input>` with visible `<Label>` (Broadcast rule — never placeholder-only labels).
- Primary CTA "Save & test connection →" runs a POST that both stores + validates the credentials with a live handshake.
- On success → sheet closes, row transitions to Connected state.
- On failure → inline error under the offending field.

**Zone 6 — Footer:**
- Primary CTA "Mark step complete →" — enabled after **at least one** portal shows Connected state. Rationale: any single connected portal is enough activation; the user isn't forced to connect all portals to progress.
- Secondary "I'll do this later" (ghost).
- Tertiary link "None of these portals are relevant to me" — POSTs defer with `reason: portal_list_not_applicable` for analytics.

---

## Explicit copy deltas

| Slot | Copy |
|---|---|
| Breadcrumb | Activation wizard → Step 3 · Add your portal credentials |
| H1 | Add your portal credentials |
| Sub | Connect the portals you already list on. WingCaster will publish, refresh, and unpublish for you — no more copy-paste. |
| Country pill | Portals available in **{country_name}** |
| Country change link | Wrong country? |
| Country change dialog title | Change your country? |
| Country change dialog body | Your portal list is set from your profile country. Update it in Settings → Account → Region. |
| Country change dialog CTA | Open Settings |
| Row state — not connected | Not connected |
| Row state — connecting | Connecting… |
| Row state — connected | Connected · **{masked_username}** |
| Row state — failed | Connection failed — retry |
| Row CTA — not connected | Connect → |
| Row CTA — connecting | (spinner, disabled) |
| Row CTA — connected | Manage |
| Row CTA — failed | Retry |
| Drawer title | Connect to **{portal_name}** |
| Drawer sub | Your credentials are encrypted at rest and used only to publish your listings. |
| Drawer primary CTA | Save & test connection → |
| Drawer secondary | Cancel |
| Drawer test-in-progress | Testing connection with **{portal_name}**… |
| Drawer test-success | Connected — your **{portal_name}** credentials work. |
| Drawer test-failure (generic) | We couldn't sign in to **{portal_name}** with those credentials. Double-check and try again. |
| Drawer test-failure (invalid_credentials) | Those credentials didn't sign in. Check the username/password and retry. |
| Drawer test-failure (portal_down) | **{portal_name}** is temporarily unreachable. Try again in a few minutes. |
| Drawer test-failure (quota_exceeded) | Your **{portal_name}** account is over quota. Increase your plan on their side and retry. |
| Footer primary (enabled after 1+ connected) | Mark step complete → |
| Footer secondary | I'll do this later |
| Footer tertiary | None of these portals are relevant to me |
| Empty state (portal_registry empty for country) | We're still setting up the portal list for **{country_name}**. This step will unlock as soon as it's live — usually within a week. |
| Empty state secondary CTA | Notify me when portals are ready |

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Portal registry empty for country** | `GET /api/portal_registry?country=<code>` returns `[]` | Render the empty-state copy (see §Copy). Show a `Notify me` CTA that POSTs to a subscription endpoint (out of scope for MVP; render as a stub if the endpoint isn't ready). Footer primary CTA disabled with helper "No portals to connect yet." |
| **Portal registry has entries, none connected** | Registry has ≥1 portal, `activation_state.steps[portal_credentials].state === "not_started"` | Full portal list rendered. Each row Not connected. Footer primary disabled. |
| **≥1 portal connected** | ≥1 row in Connected state | Footer primary CTA enabled. |
| **Already complete on load** | `activation_state.steps[portal_credentials].state === "complete"` | Show auto-complete banner + the current connected portals list (read-only) + "Return to activation wizard →" primary CTA. |
| **Deferred** | User clicked defer or tertiary | Return to `/activate`. Card in Skipped variant. |
| **Credential POST error** | Network fail / 500 | Destructive toast inside the drawer. Form re-enabled. |
| **Credential test failure (adapter-specific)** | Adapter returns `error_class` per BE-BLOCKER-03 enumeration | Map `error_class` to friendly copy per the drawer error table above. |

---

## Interactions (deltas)

**On mount:**
- Parallel: `GET /api/agent/activation_state` + `GET /api/portal_registry?country=<user_country>` + `GET /api/portal_credentials` (returns which portals this user has already connected).
- Merge into per-row state (not_connected / connected / failed).

**On row "Connect" click:**
- Open the credential drawer for that portal.
- Form fields render from `portal_registry.publisher_config.credentials_schema`.

**On drawer "Save & test connection" click:**
- POST `/api/portal_credentials` with `{ portal_code, credentials }`.
- Backend stores encrypted + attempts a live handshake via the portal's adapter.
- On 200 → close drawer, row transitions to Connected, small success toast.
- On 4xx (invalid credentials or portal-side rejection) → inline error under the failing field.
- On 5xx (WingCaster-side error) → drawer-level destructive toast.

**On "Mark step complete" click:**
- POST `activation_state/complete` with `step_id: "portal_credentials"`, `completed_via: dashboard_action`, `metadata: { connected_count: N, portal_codes: [...] }`.
- Return to `/activate`.

**On country change link:**
- Open dialog explaining country is set from profile. Provide a CTA to `/settings/account` — do NOT allow changing country inline (that's a Settings responsibility).

---

## Anti-patterns (deltas)

- ❌ Do not hardcode the portal list. The list comes from `portal_registry` — if a new portal is added on the backend, it appears here without a frontend deploy.
- ❌ Do not require all portals connected. One connected portal is enough — the "Mark step complete" enables at 1+.
- ❌ Do not gate this screen behind WhatsApp binding or first-listing publication. Portals are an independent axis.
- ❌ Do not leak the encrypted credentials back to the UI. Once saved, show masked identifier (e.g. `sara_almansoori@***`) — never the password.
- ❌ Do not display `error_class: unknown_error` verbatim to the user. Map to friendly copy; log the raw class server-side.
- ❌ Do not skip the "your credentials are encrypted at rest" trust cue in the drawer. Portal credentials are sensitive — users need to see the reassurance.
- ❌ Do not build this screen without confirming `[BE-DESIGN-01]` has shipped. If it hasn't, the Cursor dispatch reroutes the screen to Wave 8+ per the kickoff doc.

---

## Downstream implementation notes (deltas)

- **New file:** `web/src/pages/ActivationPortalCredentialsPage.tsx` — route `/activate/portal-credentials`.
- **New shared primitive:** `PortalRow` — reused between this screen and AGT-CHN-001 (channel connections). Renders portal channel-mark + state pill + CTA. Extract into `web/src/components/portals/PortalRow.tsx`.
- **New shared primitive:** `PortalCredentialDrawer` — form-schema-driven drawer. Reads `credentials_schema` from `portal_registry`. Extract into `web/src/components/portals/PortalCredentialDrawer.tsx`.
- **Data hooks:**
  - `usePortalRegistry(countryCode)` — TanStack Query wrapping `GET /api/portal_registry?country=<code>`. Empty-array-safe.
  - `useConnectedPortals()` — wraps `GET /api/portal_credentials`.
  - `useConnectPortal()` — mutation for the drawer's Save & test.
- **Backend contract confirmations required before merge:**
  - `GET /api/portal_registry?country=<code>` returns 200 with `[{code, display_name, publisher_config: {description, credentials_schema}}, ...]`.
  - `POST /api/portal_credentials` accepts `{portal_code, credentials}` and returns `{status: "connected", masked_identifier}` on success or `{error_class, error_message}` on failure (per BE-BLOCKER-03 enumeration).
- **Test discipline:**
  - Integration: mock `portal_registry` with 3 portals (Bayut, PF, Dubizzle) → render 3 rows.
  - Integration: connect one → row transitions correctly, footer CTA enables.
  - Integration: portal_registry empty → empty-state renders, footer CTA disabled.
  - Integration: credential test failure per `error_class` renders correct friendly copy.
  - a11y: drawer traps focus, Escape closes, form-schema-generated fields have visible labels.
- All Broadcast + a11y + RTL + dark-mode requirements from AGT-ACT-001 apply verbatim.

---

## Definition of done (deltas)

- [ ] `[BE-DESIGN-01]` dynamic `portal_registry` shipped (Week 2 backend). If not shipped by Wave 4 dispatch, this brief is deferred to Wave 8+.
- [ ] `GET /api/portal_registry?country=<code>` verified live for at least UAE.
- [ ] `POST /api/portal_credentials` verified live for at least one portal adapter.
- [ ] v0 iteration states: 3-portal list all not-connected, one-connected-two-not, drawer open with credential form, drawer test-failure state, empty-state (registry empty for country), already-complete-on-load, mobile, RTL, dark.
- [ ] Cross-brief regression: PA-POR-001..003 (Product Admin surface — Week 6) and this agent-facing surface both read the same `portal_registry`. Any schema change proposed by PA-POR-* Cursor dispatch must include a rerun of this screen's integration tests.
