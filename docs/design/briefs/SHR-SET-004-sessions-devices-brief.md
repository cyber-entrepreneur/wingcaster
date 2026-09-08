# Screen Brief — SHR-SET-004 · Sessions & devices

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` §7 (`SHR-SET-004`). One of the Wave-1 settings-shell children per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 15. This brief is a **delta from the SHR-SET-001 anchor** — the settings shell (top-bar + left sub-nav + right pane on desktop; stacked list on mobile) is inherited unchanged. This brief only specifies the pane content, per-session behavior, step-up integration, and the Capacitor-device registration list.

---

## 🎨 Broadcast alignment (inherits from anchor)

**This brief inherits the Broadcast token contract from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND the settings-shell chrome from `SHR-SET-001`.** Do not re-render the shell.

**Screen-specific Broadcast callouts (deltas only):**
- Pane title `var(--lc-type-heading-1)` — "Sessions & devices". Sub `var(--lc-type-body-lg)` muted.
- Two sections in the pane: **Active sessions** (browser + web app JWT sessions) and **Registered devices** (Capacitor mobile app push-token registrations from `user_push_tokens` migration 312). Split by `1px solid var(--lc-border)` horizontal rule + section H2.
- Session row: `<div>` row (not card) with left column icon (Monitor / Smartphone / Tablet from lucide-react), middle column device meta stack, right column "Current" badge OR "Sign out" outline button.
- Current-session marker: `<Badge>` — `--lc-status-published-bg` + `--lc-status-published-fg` + check glyph `●` + label "This device".
- Meta stack per row: line 1 device+browser summary (`var(--lc-type-body)`), line 2 IP + location (`var(--lc-type-body-sm)` `--lc-text-muted`), line 3 "Last active {relative time}" (`var(--lc-type-caption)` `--lc-text-muted`, timestamp via `<Numeric>` for the delta-time value in mono).
- "Sign out everywhere except this device" button: `<Button variant="outline">` — full-width on mobile, right-aligned at desktop. Requires step-up (`SHR-MFA-007`).
- Warning banner (above the Active-sessions list) when >1 session exists in unusual locations: `<Alert>` primitive with `--lc-status-underOffer-*` (amber) — NOT red. Copy: "You have {n} active sessions. Review anything you don't recognize."
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-SET-004 |
| Screen name | Sessions & devices |
| Persona | All authenticated (solo agent, agent-in-agency, agency owner, PA) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/settings/security/sessions` (deep-linkable; sub-nav highlights "Security → Sessions & devices" on entry) |
| Current state | MISSING — backend has stateless-JWT auth today (`token_version` bumped on password change) but NO per-session tracking table. UI missing entirely. |
| Workflow role | Enabler for WF-16 sub-step (per-session revoke on suspicious activity); consumer of `SHR-MFA-007` (step-up) for sign-out-everywhere; consumer of `<StepUpProvider>` per kickoff §5 Wave-4 shared components |
| Backend prerequisites | ⏳ NEW `user_sessions` table + tracking (see §Backend contract — this is the main new surface) · ⏳ NEW `GET /api/auth/sessions` · ⏳ NEW `DELETE /api/auth/sessions/:sessionId` · ⏳ NEW `DELETE /api/auth/sessions/all-except-current` (requires elevated token) · ✅ `GET /api/auth/push-tokens` (`backend/src/lib/notifications/push-routes.js:38`) · ✅ `DELETE /api/auth/push-token/:id` · ✅ `DELETE /api/auth/push-token/all` · ✅ Elevation middleware `requireElevated()` |

---

## Purpose

The user sees **where they are signed in** and can revoke individual sessions or all-except-current. This is an enterprise-security-baseline expectation — every SaaS user expects this control.

WingCaster's auth is stateless JWT with a `token_version` bump on password change (see `backend/src/auth-2fa.js` and `backend/src/auth.js`). To power this screen we need a lightweight per-session record: `session_id`, `user_id`, `user_agent_string`, `ip_country`, `ip_city`, `created_at`, `last_active_at`, `revoked_at`. The JWT carries `session_id` in its claims; the middleware checks it against the table on each request (or per-N-request sampling for performance).

The **Registered devices** section reuses the existing `user_push_tokens` table (migration 312) — one row per Capacitor mobile app installation. These are NOT sessions (they carry no auth state — they receive push notifications only), but users think of them as devices, so they belong on the same screen with a clear label distinction.

Success outcome: user sees their sessions with legible device labels; can sign out of any one; can sign out of all-except-current after a step-up challenge; can also see and remove Capacitor mobile-app registrations.

---

## Design goals

1. **Legibility over precision.** "Chrome on macOS · Dubai, UAE · 2 minutes ago" is more useful than a raw UA string. Server-side UA parsing.
2. **Current session is unmistakable.** Never let the user accidentally sign THIS device out — that would strand them.
3. **Bulk sign-out is protected.** "Sign out everywhere except this device" requires step-up because it's a security-consequence action.
4. **Push-tokens are labeled as devices, not sessions.** Users think of "my iPhone" as one thing; the fact that it's a session AND a push-token registration is our implementation detail.
5. **No false precision on IP location.** Country + city only. NEVER lat/long, NEVER street-level. If the geolocation lookup returns low confidence, show country only.

---

## Layout

### Desktop / tablet ≥1024px (inside the SHR-SET-001 shell right pane)

Reading top-to-bottom:

1. **Pane title row** — "Sessions & devices" (H1) + sub "Review where you're signed in and revoke any session you don't recognize."
2. **Warning banner** (conditional — shown when session count > 1 OR any session is in a country different from the current session's country):
   - Amber `<Alert>` — "You have {n} active sessions. Review anything you don't recognize."
3. **Active sessions section:**
   - Section H2 "Active sessions" + right-aligned "Sign out everywhere except this device" outline button.
   - Sessions list — each row:
     - Column 1 (48px): device icon (Monitor / Smartphone / Tablet).
     - Column 2 (flex): meta stack — device+browser, IP+location, last-active.
     - Column 3 (right): either the "This device" badge OR "Sign out" outline button.
   - Rows separated by `1px solid var(--lc-border)`.
4. **Registered devices section:**
   - Section H2 "Registered mobile devices" + one-line sub "Devices where you've installed the WingCaster mobile app. These receive push notifications."
   - If empty: empty-state "No mobile devices registered. Install the WingCaster app to enable push notifications." + App Store / Play Store links.
   - If non-empty: rows — same shape as sessions but the right column is a `Remove` outline button (destructive-text). Meta shows platform (iOS / Android / Web) + device_id (if provided) + created_at + last_used_at.

### Mobile ≤767px

Same order, single column, stacked:
- Warning banner width = 100%.
- Session row layout stacks: icon top-left, meta below, action button below meta (full-width).
- Bulk sign-out button becomes a full-width button below the section header.

### Session-row anatomy (all viewports)

- **Icon** (48×48 container, 20×20 icon): Monitor for desktop, Smartphone for mobile, Tablet for tablet, Globe for unknown.
- **Meta stack** (space-y-1):
  - Line 1: `Chrome 141 on macOS 26` (`var(--lc-type-body)`).
  - Line 2: `192.0.2.42 · Dubai, UAE` (`var(--lc-type-body-sm)` `--lc-text-muted`). IP is display-only, monospace via `<Numeric>` wrapping.
  - Line 3: `Last active 2 minutes ago` (`var(--lc-type-caption)` `--lc-text-muted`). Time delta calculated client-side, refreshed on visibility change.
- **Right action:**
  - If `is_current === true`: `<Badge>` "This device" (green + ●). No sign-out button.
  - Else: `<Button variant="outline">` "Sign out". On click: confirm modal (see Interactions).

### Registered-device-row anatomy

- **Icon** (48×48): Smartphone / Tablet / Globe by `platform`.
- **Meta stack:**
  - Line 1: `iPhone` (from `device_id` if present, else `iOS mobile app`).
  - Line 2: `Registered on {shortDate}`.
  - Line 3: `Last used {relative time}` (from `last_used_at`).
- **Right action:** `<Button variant="outline">` "Remove" with destructive-text color. Confirms and DELETEs.

---

## Explicit copy (English)

Arabic mirror strings in the AR MDX pass — placeholder `[TRANSLATION-PENDING]` for now.

| Slot | Copy |
|---|---|
| Pane title | Sessions & devices |
| Pane sub | Review where you're signed in and revoke any session you don't recognize. |
| Warning banner (multiple sessions) | You have {n} active sessions. Review anything you don't recognize. |
| Warning banner (foreign country) | A session is signed in from **{country}** — different from this device. Review it below. |
| Active sessions H2 | Active sessions |
| Bulk sign-out button | Sign out everywhere except this device |
| Bulk sign-out helper | Signs out every other browser and mobile app. You'll stay signed in here. |
| Current-device badge | This device |
| Sign-out button | Sign out |
| Sign-out confirm title | Sign out this session? |
| Sign-out confirm body | You'll need to sign in again on **{device}** to use WingCaster there. |
| Sign-out confirm CTA | Sign out session |
| Sign-out confirm cancel | Keep signed in |
| Sign-out success toast | Session signed out. |
| Sign-out failure toast | Couldn't sign the session out. Try again. |
| Bulk confirm title | Sign out of every other device? |
| Bulk confirm body | You'll stay signed in here. Every other browser and mobile app will need to sign in again. This may take a minute to propagate. |
| Bulk confirm step-up prompt | Confirm with your 2-step verification to continue. |
| Bulk confirm CTA | Sign out other devices |
| Bulk success toast | Signed out of {n} sessions. |
| Devices H2 | Registered mobile devices |
| Devices sub | Devices where you've installed the WingCaster mobile app. These receive push notifications. |
| Devices empty title | No mobile devices registered. |
| Devices empty body | Install the WingCaster app to receive push notifications on the go. |
| Device App Store link | Get it on the App Store ↗ |
| Device Play Store link | Get it on Google Play ↗ |
| Device platform ios | iPhone / iPad |
| Device platform android | Android |
| Device platform web | Web push |
| Device registered on | Registered on {shortDate} |
| Device last used | Last used {relativeTime} |
| Device remove button | Remove |
| Device remove confirm title | Remove this device? |
| Device remove confirm body | You'll stop receiving push notifications on **{device}**. Sign-in on the device is unaffected — sign out separately if you want that too. |
| Device remove CTA | Remove device |
| Device remove toast | Device removed. |
| Loading toast (bulk) | Signing out of other sessions… |
| Time relative — just now | just now |
| Time relative — minutes | {n} minute(s) ago |
| Time relative — hours | {n} hour(s) ago |
| Time relative — days | {n} day(s) ago |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Pane title | plain `<h1>` styled `var(--lc-type-heading-1)` |
| Warning banner | `<Alert>` (shadcn) — amber tokens |
| Section H2 | plain `<h2>` styled `var(--lc-type-heading-2)` |
| Session row | plain flex layout; NOT `<Card>` — rows are separated by border rule |
| Device icons | `Monitor` / `Smartphone` / `Tablet` / `Globe` from `lucide-react` |
| IP/time monospace | `<Numeric>` wrapping the value |
| Current-device badge | `<Badge>` (status.published tokens) |
| Sign-out button | `<Button variant="outline">` |
| Bulk sign-out button | `<Button variant="outline">` — destructive text |
| Confirm dialog (per-session) | `<AlertDialog>` (Radix) |
| Confirm dialog (bulk) | `<StepUpModal>` — from Wave-4 shared components (kickoff §5 Wave-4). Wraps `<AlertDialog>` + step-up challenge inline. |
| Remove-device button | `<Button variant="outline">` — destructive text |
| Confirm dialog (remove device) | `<AlertDialog>` |
| Empty-state (devices) | Custom composed layout — illustration placeholder + text + external-link buttons |
| Toasts | `<Sonner>` (bottom-center) |
| App Store / Play links | `<Button variant="outline">` + `ExternalLink` icon |

---

## Sample content (for v0 / mockup)

Show the desktop layout with:
- **Warning banner:** visible (3 active sessions).
- **Active sessions:**
  - Row 1 (current, Monitor icon): "Chrome 141 on macOS 26" · "192.0.2.42 · Dubai, UAE" · "Last active just now" · "This device" badge.
  - Row 2 (Smartphone icon): "Safari on iOS 26" · "192.0.2.88 · Dubai, UAE" · "Last active 2 hours ago" · "Sign out" button.
  - Row 3 (Monitor icon): "Firefox 143 on Windows 11" · "203.0.113.7 · Riyadh, Saudi Arabia" · "Last active 3 days ago" · "Sign out" button (highlighted subtly because different country than current).
- **Bulk sign-out button** visible top-right of section.
- **Registered mobile devices:**
  - Row 1 (Smartphone icon): "iPhone" · "Registered on Aug 12, 2026" · "Last used 5 minutes ago" · "Remove" button.
  - Row 2 (Smartphone icon): "Samsung Galaxy S24" · "Registered on Sep 03, 2026" · "Last used 1 day ago" · "Remove" button.

---

## Interactions

**Per-session sign-out:**
- Click "Sign out" on a row → `<AlertDialog>` "Sign out this session? You'll need to sign in again on **Firefox on Windows** to use WingCaster there."
- Confirm → `DELETE /api/auth/sessions/:sessionId` → row removes with 200ms slide-out. Toast "Session signed out."
- On failure → destructive toast "Couldn't sign the session out. Try again." — row remains.
- If the user attempts to sign out THEIR current session (should be impossible — no button — but defensively): 403 with `CANNOT_REVOKE_CURRENT` → toast "You can't sign this device out from here — use the top-bar sign-out."

**Bulk sign-out (Sign out everywhere except this device):**
- Click the bulk button → `<StepUpModal>` opens:
  - Copy: "Sign out of every other device? You'll stay signed in here. Every other browser and mobile app will need to sign in again."
  - Step-up challenge inline: 6-digit TOTP `<OtpInput>` OR "Use a backup code instead" link.
  - Primary CTA: "Sign out other devices" (disabled until step-up passes).
  - Cancel: closes modal.
- On step-up success: `DELETE /api/auth/sessions/all-except-current` with the elevated token header.
- Server-side: bumps `token_version` on the user AND deletes all `user_sessions` rows except the current one AND (optionally) deletes all `user_push_tokens` — matrix note: this is a policy decision; if push_tokens are also cleared, name the section as "Signed out of {n} sessions AND {m} devices" — else keep them separate.
- On success: toast "Signed out of {n} sessions." Rows removed from Active-sessions list (all but current).
- On failure: toast + retain rows.

**Remove device (Capacitor push registration):**
- Click "Remove" → `<AlertDialog>` "Remove this device? You'll stop receiving push notifications on **iPhone**. Sign-in on the device is unaffected."
- Confirm → `DELETE /api/auth/push-token/:id` → row removes; toast.
- Note: this does NOT sign the user out of the mobile app — a mobile-app session is a separate `user_sessions` row. Copy is explicit about this.

**Passive refresh:**
- The "last active" time delta is client-rendered from timestamps; recompute every 60s (or on tab-focus). No server poll.
- Reload button? — No. If the user wants to refresh, they route away and back.

**Keyboard:**
- Tab order: bulk sign-out button → session-row sign-out buttons (top to bottom) → devices section → device-row remove buttons.
- Enter on any Sign-out / Remove opens the confirm dialog.
- Escape inside dialogs closes.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Route resolving / initial GETs in flight | Skeleton: 3 session-row shapes + 2 device-row shapes. Bulk button disabled. |
| **Loaded — only current** | Only 1 session, no other devices | No warning banner. Section shows one row. Bulk button hidden. Devices empty state visible. |
| **Loaded — normal** | 2+ sessions | Warning banner visible with count. Bulk button visible. |
| **Loaded — foreign country flag** | Any non-current session's country ≠ current session's country | Warning banner uses "foreign country" variant. The foreign-country row gets a subtle amber border-left `2px solid var(--lc-status-underOffer-fg)`. |
| **Sign-out in flight** | DELETE :id in flight | Row's Sign-out button shows `Loader2` + "Signing out…" |
| **Sign-out error** | 4xx/5xx | Row's button re-enables + destructive toast. |
| **Bulk step-up open** | User clicked bulk button | Modal open, focus trapped, OTP input focused. |
| **Bulk step-up wrong code** | OTP verify returned wrong | Inline error on OTP input; modal stays open. |
| **Bulk in flight** | DELETE all-except-current in flight | Modal button `Loader2` + "Signing out other devices…" |
| **Bulk success** | 200 | Modal closes; toast; rows animate out. |
| **Bulk failure** | 4xx/5xx | Modal stays; destructive toast inside modal. |
| **Devices empty** | Zero push-token rows | Empty state with App Store + Play links. |
| **Device-remove in flight** | DELETE /push-token/:id in flight | Row's Remove button spinner. |
| **RTL** | Locale = ar | Whole pane mirrors; IP + times stay LTR; icons keep canonical direction. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. |
| **Offline** | Network unreachable | Sign-out and Remove buttons disabled; banner "You're offline — can't manage sessions." |

---

## Accessibility

- Each session row is a `<li>` inside a `<ul aria-label="Active sessions">`.
- The "This device" badge includes screen-reader-only text ("This is the device you're currently using").
- Sign-out buttons have `aria-label` "Sign out session on {device}, {location}".
- Warning banner has `role="status"` for polite screen-reader announcement.
- Bulk step-up modal: `<AlertDialog>` traps focus; OTP input has `autoComplete="one-time-code"` for iOS keyboard suggestion; Escape closes.
- Time-relative labels have full ISO timestamp in `title` attribute for keyboard/screen-reader inspection.
- Focus visible everywhere (two-tone Broadcast focus ring).
- Tap targets ≥ 44×44 CSS px.
- No color-only differentiation — foreign-country flag uses border + banner copy, not color alone.

---

## Anti-patterns (do not do these)

- ❌ Do not render a "Sign out" button on the current session row. It creates the accidental-stranding risk. Users sign THIS device out via the top-bar user menu.
- ❌ Do not surface raw User-Agent strings. Server parses them into "Chrome 141 on macOS 26"-style summaries.
- ❌ Do not fabricate confidence in geolocation. Country + city only; if lookup is low-confidence, show country only. NEVER lat/long. NEVER "near {street}".
- ❌ Do not conflate push-token removal with sign-out. They are two different actions; copy must be explicit.
- ❌ Do not require step-up for a single per-session sign-out — only for bulk. Single-row is low-risk.
- ❌ Do not use red for the warning banner. This is a review-nudge, not an alarm; amber (`--lc-status-underOffer-*`).
- ❌ Do not silently drop push-tokens on password change. If the backend policy is "bump token_version + also clear push_tokens", say so in the bulk-success toast.
- ❌ Do not poll `/api/auth/sessions` more than once per minute. Client-side time-delta refresh is stateless.

---

## Backend contract

**New endpoints required (⏳):**

- `GET /api/auth/sessions` — returns the list of active sessions for the current user:
  ```json
  {
    "sessions": [
      {
        "id": "sess_abc",
        "is_current": true,
        "device_kind": "desktop|mobile|tablet|unknown",
        "device_summary": "Chrome 141 on macOS 26",
        "ip": "192.0.2.42",
        "ip_country_iso": "AE",
        "ip_country": "United Arab Emirates",
        "ip_city": "Dubai",
        "created_at": "...",
        "last_active_at": "..."
      }
    ]
  }
  ```

- `DELETE /api/auth/sessions/:sessionId` — revokes one session. Requires that `sessionId` belongs to the current user. If `:sessionId` matches the caller's own session → 403 `CANNOT_REVOKE_CURRENT`.

- `DELETE /api/auth/sessions/all-except-current` — requires elevated token header (see `requireElevated()` middleware in `backend/src/auth-2fa.js`). Bumps user's `token_version` AND deletes all non-current `user_sessions` rows AND (policy TBD) optionally clears `user_push_tokens`. Response: `{ revoked: <n> }`.

**New backend surface required:**

A `user_sessions` table (⏳ new migration — file as `[BE-BLOCKER-09]`):
```sql
CREATE TABLE public.user_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jwt_jti TEXT NOT NULL UNIQUE,           -- links to JWT 'jti' claim
  device_summary TEXT NOT NULL,           -- server-parsed UA string
  device_kind TEXT NOT NULL CHECK (device_kind IN ('desktop','mobile','tablet','unknown')),
  ip TEXT,
  ip_country_iso TEXT,
  ip_country TEXT,
  ip_city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_jti ON public.user_sessions(jwt_jti);
```

Auth middleware changes (⏳):
- On login: insert a row + include `jti` (session id) in the issued JWT.
- On every authed request: sample-update `last_active_at` (every N requests, not every request — cost).
- On revoke: set `revoked_at`; middleware rejects tokens whose `jti` is revoked.
- Continue existing `token_version` bumping for password-change / bulk revoke.

**Existing endpoints (reused):**

- `GET /api/auth/push-tokens` (`backend/src/lib/notifications/push-routes.js:38`) — returns the list of Capacitor device registrations. Response already shaped correctly for this UI (`id`, `platform`, `device_id`, `created_at`, `last_used_at`).
- `DELETE /api/auth/push-token/:id` — removes one registration.
- `DELETE /api/auth/push-token/all` — clears all (used by the bulk-sign-out policy option only).

**Capacitor-device-token tracking note:** The push-tokens migration 312 gives us **platform + device_id + created_at + last_used_at** per registration — enough for the Registered-devices section as spec'd. It does NOT include IP or geolocation for the mobile install, and it does NOT include a device-model string (e.g. "iPhone 15 Pro") beyond whatever the app passes as `device_id`. For richer labels, the mobile app should pass a human-readable `device_id` like `"iPhone 15 Pro"` at registration (an app-side change, not a schema extension). If the app currently passes an opaque device ID, the row displays "iOS device" / "Android device" as fallback.

**Errors surfaced:**
- `CANNOT_REVOKE_CURRENT` (403) — toast: "You can't sign this device out from here."
- `SESSION_NOT_FOUND` (404) — toast: "That session no longer exists." (silent refetch).
- `STEP_UP_REQUIRED` (401 with `elevation` hint) — bulk button retries after step-up modal.
- `INVALID_ELEVATION_TOKEN` (401) — bulk modal shows inline error "Verification expired. Try again."

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/settings/SessionsPage.tsx`. Rendered inside `<SettingsShell>`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/settings/security/sessions" element={<SettingsShell><SessionsPage /></SettingsShell>} />`.
- **Component decomposition:**
  - `SessionsList` — active sessions list with row-map.
  - `SessionRow` — icon + meta + action button.
  - `BulkSignOutButton` — hosts `<StepUpModal>` and the DELETE call.
  - `RegisteredDevicesList` — push-tokens list.
  - `DeviceRow` — icon + meta + Remove button.
  - `useSessions()` hook — GET + optimistic DELETE.
  - `usePushTokens()` hook — GET + optimistic DELETE.
  - `formatUA()` helper — falls back if server didn't already return a summary (defensive; expect server to do this).
  - `formatRelativeTime()` — uses `Intl.RelativeTimeFormat`.
- **New backend surface required:** `[BE-BLOCKER-09]` — `user_sessions` table + migration + auth middleware wiring + three new routes. This is the primary blocker for this brief.
- **Shared components consumed:** `<StepUpModal>`, `<StepUpProvider>`, `useStepUp` hook, `<OtpInput>`, `<BackupCodeInput>` — per kickoff §5 Wave-4 (must be built alongside).
- **Test discipline:**
  - Unit: SessionRow renders every state (current / other / foreign-country).
  - Integration: mock GET returns 3 sessions; DELETE :id removes; DELETE all requires elevated token; bulk button opens step-up modal.
  - Real-Postgres: session table migration + row-insert on login + row-delete on revoke + row-delete cascade on user delete.
  - Contract: JWT jti binding tested (revoked jti rejects subsequent requests).
  - RTL: `screens.rtl.test.tsx` extension.
  - Broadcast: `no-raw-hex.test.ts` stays green.

---

## Broadcast alignment callouts

Delta from anchor — see SHR-SET-001 for shell chrome tokens.

- Pane title `var(--lc-type-heading-1)`; sub `var(--lc-type-body-lg)` `--lc-text-muted`.
- Warning banner `<Alert>` — `--lc-status-underOffer-bg` + `--lc-status-underOffer-fg` — amber, not red.
- Session rows separated by `1px solid var(--lc-border)`; padding `var(--lc-space-lg)` vertical.
- Icon container 48×48 with `--lc-surface-sunken` background + `--lc-radius-md`.
- Device summary line `var(--lc-type-body)` `--lc-text-primary`.
- IP + location line `var(--lc-type-body-sm)` `--lc-text-muted`; IP wrapped in `<Numeric>` mono.
- Last-active line `var(--lc-type-caption)` `--lc-text-muted`; relative-time value `<Numeric>` mono.
- Current-device badge `--lc-status-published-*`, `--lc-radius-pill`.
- Sign-out button `<Button variant="outline">`, `--lc-radius-md`.
- Bulk sign-out button `<Button variant="outline">` with destructive text `--lc-status-unpublished-fg`, `--lc-radius-md`.
- Foreign-country session row: `border-left: 2px solid var(--lc-status-underOffer-fg)`.
- Step-up modal `--lc-elevation-lg`. OTP input boxes 44×44, `var(--lc-type-data)` mono.
- Remove-device button same as Sign-out.
- Empty-state illustration `--lc-surface-sunken` background.
- Focus rings two-tone via base CSS.
- Motion: row-remove slide-out 240ms `--lc-easing-in-out`; modal open 180ms; button spinner 120ms.
- Radii: rows no radius (list rules); icon container `--lc-radius-md`; buttons `--lc-radius-md`; modal `--lc-radius-lg`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before the brief):

```
I'm designing the WingCaster Sessions & devices settings pane (SHR-SET-004) — MENA real-estate B2B SaaS. This is a sub-page INSIDE an already-designed settings shell (SHR-SET-001) — do not re-render the shell, only the right pane content. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast design tokens (semantic --lc-* variables only, no raw hex).

First pass: render the desktop 1440px pane at loaded state with 3 active sessions and 2 registered mobile devices. Sample data:
- Session 1 (current): Chrome 141 on macOS 26, Dubai UAE, "just now", "This device" badge (no button).
- Session 2: Safari on iOS 26, Dubai UAE, "2 hours ago", "Sign out" button.
- Session 3: Firefox 143 on Windows 11, Riyadh Saudi Arabia (foreign country — subtle amber left-border), "3 days ago", "Sign out" button.
- Warning banner visible at top: "You have 3 active sessions. Review anything you don't recognize."
- Bulk button "Sign out everywhere except this device" top-right of Active sessions.
- Registered devices: iPhone (registered Aug 12 2026, last used 5 min ago) + Samsung Galaxy S24 (registered Sep 3 2026, last used 1 day ago).

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, step-up modal, empty devices state, and dark mode as separate follow-ups.

Follow the copy table exactly. Do not fabricate street-level location — country + city only.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now mobile 375px viewport — same state, rows stack, bulk button becomes full-width.`
2. `Now show the step-up modal open — user clicked the bulk sign-out button, OTP input focused, 6 empty boxes, "Sign out other devices" button disabled.`
3. `Now show the empty devices state — user has never registered a mobile app. App Store + Play Store buttons visible.`
4. `Now the single-session state — only the current session, no warning banner, no bulk button.`
5. `Now the RTL Arabic layout at desktop 1440px. Mirror layout; IPs and timestamps stay LTR.`
6. `Now dark mode versions of desktop LTR + mobile LTR.`
7. `Now the per-session sign-out confirm dialog — user clicked "Sign out" on Firefox row.`

Save each output's JSX to `web/src/components/settings/SessionsPage/` and screenshots to `docs/design/mockups/SHR-SET-004-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/SHR-SET-004/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief + mockup paths.
- [ ] `[BE-BLOCKER-09]` filed — `user_sessions` migration + auth-middleware wiring + 3 new routes.
- [ ] Wave-4 shared components (`<StepUpModal>`, `<OtpInput>`, etc.) available in-code before implementation.
- [ ] `no-raw-hex.test.ts` stays green after implementation.
- [ ] RTL screenshot test extended with `SHR-SET-004` scenario.
- [ ] Policy decision confirmed with owner: does bulk sign-out ALSO clear `user_push_tokens`, or only sessions? (Bulk-success toast copy depends on this.)
