# Screen Brief — SHR-SET-002 · Account / profile

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` §7 (`SHR-SET-002`). One of the Wave-1 settings-shell children per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 13. This brief is a **delta from the SHR-SET-001 anchor** — the settings shell (top-bar + left sub-nav + right pane on desktop; stacked list on mobile) is inherited unchanged. This brief only specifies the pane content, per-field behavior, and the identifier-change hand-offs.

---

## 🎨 Broadcast alignment (inherits from anchor)

**This brief inherits the Broadcast token contract from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND the settings-shell chrome from `SHR-SET-001` (top-bar with wordmark + tenant switcher + language selector, left sub-nav with grouped category links, right pane housing the active sub-page).** Do not re-render the shell. Do not restyle the sub-nav. Do not introduce new radii, shadows, or type ramps.

**Screen-specific Broadcast callouts (deltas only):**
- Pane title: `var(--lc-type-heading-1)` — "Account". Sub-title `var(--lc-type-body-lg)` muted.
- Field sections are separated by `1px solid var(--lc-border)` rules, no card wrappers (labels live outside the input on the left column at ≥1024px, above the input at mobile).
- Avatar block uses `--lc-surface-raised` with `--lc-elevation-sm`; 96×96 avatar with a `--lc-radius-pill` frame.
- Verification badges: `<Badge>` primitive — verified pairs `--lc-status-published-bg` + `--lc-status-published-fg` + check glyph `●`; unverified pairs `--lc-status-draft-bg` + `--lc-status-draft-fg` + hollow glyph `○`. Never color alone.
- "Change email" / "Change phone" buttons: `<Button variant="outline">` next to the identifier input, NOT a modal trigger inside the field — visually associated but keyboard-tabbable as its own control.
- Save bar: sticky bottom of pane at mobile, inline right-aligned at desktop. Primary `--lc-action-primary`, hover darkens.
- Locale + timezone selects: `<Select>` primitive. The Locale row includes a "Change display language →" inline link that deep-links to `SHR-NAV-006` (language selector) — the field itself stores the account preference; SHR-NAV-006 is the session/device runtime toggle.
- Danger zone (bottom): `--lc-border-strong` top-rule, `--lc-status-underOffer-fg` (amber) heading — NOT red. Only the terminal "Delete account" button that opens SHR-SET-005 is `--lc-status-unpublished-fg`.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-SET-002 |
| Screen name | Account / profile |
| Persona | All authenticated (solo agent, agent-in-agency, agency owner, PA) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/settings/account` (deep-linkable; sub-nav highlights "Account" on entry) |
| Current state | PARTIAL — `GET /api/auth/me` + `PUT /api/auth/me` exist (`backend/src/server.js:1130,1169`); no dedicated UI page. Legacy fragments may live inside profile-edit widgets on other pages. |
| Workflow role | Enabler for WF-16 (delete account) via danger-zone link; hosts the identifier-change trigger which delegates to `SHR-AUT-002b` (OTP re-verify) for email/phone changes |
| Backend prerequisites | ✅ `GET /api/auth/me` · ✅ `PUT /api/auth/me` · ⏳ Avatar-upload storage endpoint (see §Backend contract — likely new: `POST /api/users/me/avatar`) · ✅ Timezone list source (IANA static list, no endpoint) |

---

## Purpose

The user manages their **personal identity** — the fields tied to their own login, not to a tenant. Every account (regardless of persona) has exactly one row here: display name, avatar, primary email, primary phone, username, preferred locale, preferred timezone. Persona doesn't change the fields — it only changes which downstream surfaces (agency profile, PA console, etc.) can consume them.

Two identifier changes (email, phone) have security consequences and are NOT edited inline — they route through the OTP re-verify flow (`SHR-AUT-002b`) with the new identifier as the challenge target. Everything else is inline autosave-on-blur (name, locale, timezone) or explicit save (username, because it changes the public handle).

Success outcome: the user sees a toast confirming the field saved; verification badges stay accurate; deep-links to language switcher / delete account work.

---

## Design goals

1. **The identity fields feel scannable, not form-heavy.** Left-column labels at desktop; stacked at mobile. No card chrome around each field.
2. **Verification is legible without being noisy.** One `<Badge>` per verifiable identifier, right-aligned to the input, always tint + glyph + label.
3. **Identifier changes route through OTP.** Never let the user overwrite the primary email or phone without proving control of the new value — the field is read-only until the "Change" button starts the OTP handshake.
4. **Locale field is the STORED preference; the top-bar switcher is the RUNTIME preference.** Both must exist; deep-link between them explicitly ("Change display language →" link next to the locale row).
5. **RTL Arabic first-class.** Field labels mirror; identifier inputs (email, phone) stay LTR even in Arabic context.

---

## Layout

### Desktop / tablet ≥1024px (inside the SHR-SET-001 shell right pane)

Reading top-to-bottom inside the pane:

1. **Pane title row** — "Account" (H1) + one-line sub "Your personal identity across WingCaster."
2. **Avatar section** — left-aligned 96×96 circular avatar; right of it: current display name (large mono-numeric-agnostic label) + upload/remove buttons.
3. **Personal details block** — left-column labels (200px), right-column inputs (max 480px):
   - Full name (text input, autosave-on-blur)
   - Username (text input, explicit Save button next to it — changes public handle)
   - Preferred display language (Select) + "Change display language →" inline link right of the select
   - Preferred timezone (Select — searchable, IANA list)
4. **Identifiers block** — same two-column shape:
   - Primary email (read-only input + verification badge + "Change email" outline button)
   - Primary phone (read-only input + verification badge + "Change phone" outline button)
5. **Sign-in method summary** — one-liner meta paragraph: "You sign in with email + password. You can add OAuth providers on the Security page." Link to `SHR-SET-security-methods` (out of scope; deep-link only).
6. **Save bar** — right-aligned "Save changes" primary button. Enabled only when a dirty explicit-save field (username) has changes. Autosave fields (name, locale, timezone) show inline "Saved" pill on blur.
7. **Danger zone** — bottom of pane, separated by top-rule + heading "Danger zone" in amber:
   - "Delete account" outline button — opens `SHR-SET-005` (delete-account flow).

### Mobile ≤767px

Same order, single column, stacked:
- Sub-nav becomes a full-screen tap-through (see SHR-SET-001); the pane becomes the whole viewport.
- Avatar section stays at top; upload/remove buttons stack below the avatar.
- Every field label sits above its input.
- Verification badges wrap to the row BELOW the read-only identifier input on narrow widths.
- Save bar becomes sticky bottom-of-pane with the button full-width.
- Danger zone is last, requires a scroll to reach.

### Field-row anatomy (all viewports)

Each field row contains:
- **Label** (`var(--lc-type-body-sm)` weight 600, `--lc-text-primary`).
- **Helper text** (optional, `var(--lc-type-caption)` muted).
- **Input** (`<Input>` primitive; read-only variant uses `--lc-surface-sunken` + no border-focus interaction).
- **Right-side widget** (badge OR button OR link — max one).
- **Inline "Saved ✓" pill** — 200ms fade-in on blur when autosave succeeded, fades out after 1.5s.

---

## Explicit copy (English)

Arabic mirror strings in the AR MDX pass — placeholder-mark `[TRANSLATION-PENDING]` for now.

| Slot | Copy |
|---|---|
| Pane title | Account |
| Pane sub | Your personal identity across WingCaster. |
| Avatar section heading | Profile photo |
| Avatar upload button | Upload photo |
| Avatar remove button | Remove |
| Avatar helper | JPG or PNG, square, at least 200×200. Max 2 MB. |
| Personal block heading | Personal details |
| Full name label | Full name |
| Full name helper | Shown to your teammates and inside conversations. |
| Username label | Username |
| Username helper | Your public handle. Changing it breaks old links. |
| Username save button | Save username |
| Locale label | Preferred display language |
| Locale helper | Used across email and in-app copy for you. |
| Locale change-link | Change display language → |
| Timezone label | Preferred timezone |
| Timezone helper | Used for reminders, timestamps, and reports. |
| Identifiers block heading | Sign-in identifiers |
| Email label | Email |
| Email verified badge | Verified |
| Email unverified badge | Not verified |
| Email change button | Change email |
| Email helper | Changing your email starts a one-time verification. |
| Phone label | Phone |
| Phone verified badge | Verified |
| Phone unverified badge | Not verified |
| Phone change button | Change phone |
| Phone helper | Changing your phone starts an SMS verification. |
| Sign-in method summary | You sign in with **{method}**. Manage sign-in methods on the Security page. |
| Sign-in methods link | Go to security → |
| Save bar button | Save changes |
| Save bar clean state | All changes saved. |
| Autosave pill | Saved ✓ |
| Danger zone heading | Danger zone |
| Delete account button | Delete account |
| Delete account helper | Permanently delete your WingCaster account. This starts a 30-day cool-down. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Pane title | plain `<h1>` styled `var(--lc-type-heading-1)` |
| Avatar | `<Avatar>` (Radix) + `Camera` icon overlay for upload affordance |
| Upload button | `<Button variant="outline">` + `Upload` icon |
| Remove button | `<Button variant="ghost">` — destructive text color |
| Text inputs | `<Input>` |
| Read-only identifier inputs | `<Input readOnly>` with `--lc-surface-sunken` background |
| Verification badge | `<Badge>` (status tokens) + glyph |
| Change email / Change phone | `<Button variant="outline">` |
| Locale + Timezone | `<Select>` (searchable via `Command` for timezone) |
| Change-language link | `<Link>` styled with `--lc-text-brand` |
| Save button | `<Button variant="default">` |
| Autosave pill | Custom `<span>` — `--lc-status-published-bg` + `--lc-status-published-fg` |
| Delete account button | `<Button variant="outline">` — text color `--lc-status-unpublished-fg` |
| Toast (save success / error) | `<Sonner>` (bottom-center) |
| Confirm-remove-avatar | `<AlertDialog>` (Radix) |

---

## Sample content (for v0 / mockup)

Show the desktop layout with:
- **Avatar:** placeholder image labeled "SA" (initials)
- **Full name:** filled `Sara Al Mansoori`
- **Username:** filled `sara.almansoori` (Save button disabled — clean)
- **Locale:** English (US) selected; change-language link visible
- **Timezone:** `Asia/Dubai` selected
- **Email:** `sara.almansoori@example.com` read-only; verified badge (green + ●); Change button visible
- **Phone:** `+971 5X XXX 4321` read-only; unverified badge (grey + ○); Change button visible
- **Sign-in method summary:** "You sign in with **email + password**."
- **Save bar:** "All changes saved." (clean state)
- **Danger zone:** collapsed at bottom, Delete account button visible

---

## Interactions

**Field-level:**
- **Full name, locale, timezone** → autosave on blur. On success: inline pill "Saved ✓". On failure: toast + inline error under input; field remains dirty.
- **Username** → NOT autosave. User types → Save button enables. Click Save → PATCH → success toast + Save button disables. Server may reject with `USERNAME_TAKEN` — inline error, keep dirty.
- **Avatar upload** → click Upload → file picker (JPG / PNG only, ≤ 2 MB) → crop dialog (Radix `Dialog`, square aspect) → confirm → optimistic UI + POST. On success: replace avatar. On failure: revert + toast.
- **Avatar remove** → confirm dialog "Remove your profile photo?" → DELETE → avatar shows initials fallback.
- **Change email button** → open `SHR-AUT-002b` (OTP re-verify) with the new email as the challenge input. On success: `PATCH /api/auth/me` with the new email, verification badge flips to verified, toast "Email updated."
- **Change phone button** → same flow, SMS OTP.
- **Locale change-link** → deep-link to `SHR-NAV-006` (top-bar language selector) — this switches the RUNTIME language for the session/device; the stored account preference is independent.
- **Delete account button** → routes to `/settings/account/delete` (SHR-SET-005). Cannot be pressed if `agency_owner_with_members` is true — server-side check surfaces via disabled state + tooltip.

**Save-bar behavior:**
- Autosave fields do NOT engage the Save bar.
- Only username (explicit save) engages it.
- If both autosave failed AND username is dirty → toast + Save bar shows "Some changes couldn't save."

**Keyboard:**
- Tab order: avatar upload → avatar remove → full name → username → save username → locale → change-language link → timezone → email change → phone change → sign-in methods link → delete account.
- Enter inside username input triggers Save.
- Escape inside file/dialog closes without saving.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Route resolving / GET in flight | Skeleton fields (avatar circle + 6 field rows). No save bar. |
| **Loaded — clean** | GET returned | All fields populated. Save bar shows "All changes saved." |
| **Autosave in flight** | Field blur (name/locale/timezone) | Small `Loader2` spinning next to the field. Save bar disabled. |
| **Autosave success** | 200 | Field pill "Saved ✓" fades in for 1.5s. |
| **Autosave error** | 4xx/5xx | Inline error under field + destructive toast. Field remains dirty. |
| **Username dirty** | User typed in username | Save button enables. |
| **Username saving** | POST in flight | Save button shows `Loader2` + "Saving…" |
| **Username taken** | 409 `USERNAME_TAKEN` | Inline error: "That username is taken." Save re-enables. |
| **Avatar uploading** | POST /avatar in flight | Avatar shows progress overlay (0-100%). |
| **Avatar upload too large** | Client-side check fails | Inline error before upload: "File is too large — max 2 MB." |
| **Email/phone unverified** | User has value but `email_verified_at` is null | Badge shows "Not verified" + inline helper "Verify → resend link." |
| **OTP change in progress** | User clicked Change email/phone and left | Come-back state: banner at top "You're mid-way through changing your email. Continue →" (deep-link back into SHR-AUT-002b). |
| **Blocked from delete** | Agency owner with members OR past-due | Delete button disabled + tooltip on hover: "Transfer ownership first" OR "Settle unpaid invoices first". |
| **RTL** | Locale = ar | Whole pane mirrors; label column moves to right; identifier inputs stay LTR. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; avatar frame and badges maintain contrast. |
| **Offline** | Network unreachable | Save bar disabled; banner at top: "You're offline — changes will not save." |

---

## Accessibility

- Every input has a visible `<label htmlFor>` — never placeholder-only.
- Save button has `aria-disabled` reflecting dirty state; screen readers hear "Save changes, disabled — no changes to save".
- Autosave "Saved ✓" pill announced via `aria-live="polite"`.
- Verification badges include screen-reader-only text describing the state ("Email verified" / "Email not verified").
- Change email / Change phone buttons announced with their consequence ("Change email — starts a one-time verification").
- Delete-account button announced with its category ("Delete account — destructive").
- Avatar upload button is a real `<button>` with the file input hidden behind it.
- File picker input has `accept="image/jpeg,image/png"` + `capture` attribute on mobile.
- Focus visible on every interactive element (two-tone Broadcast focus ring).
- Confirm-remove-avatar dialog traps focus + Escape closes + close-on-outside-click.
- No color-only status differentiation — verification badges use tint + glyph + label.
- Tap targets ≥ 44×44 CSS px on mobile.

---

## Anti-patterns (do not do these)

- ❌ Do not allow direct edit of primary email / phone. They are read-only inputs — always routed through OTP.
- ❌ Do not autosave the username. It changes the public handle; require explicit intent.
- ❌ Do not wrap every field in a `<Card>` — the pane is one long form. Cards create visual noise here.
- ❌ Do not put the delete button at the top of the pane. Danger zone is at the bottom for a reason.
- ❌ Do not colour the delete button red as a primary button. Outline + destructive-text is enough; the destructive terminal button lives INSIDE the SHR-SET-005 flow.
- ❌ Do not use the locale field as a runtime language toggle. It is the STORED preference; the deep-link into SHR-NAV-006 is the runtime toggle.
- ❌ Do not fabricate a "last sign-in from …" field here — that surface lives on SHR-SET-004 (Sessions & devices). This screen is identity only.
- ❌ Do not show tenant-scoped fields (agency name, tenant plan, etc.). This screen is user-scoped. Tenant edits live in AGN-SET-001 / AGT-SET-001.

---

## Backend contract

**Endpoints:**

- `GET /api/auth/me` → already exists (`backend/src/server.js:1130`). Response includes:
  ```json
  {
    "user": {
      "id": "...",
      "display_name": "Sara Al Mansoori",
      "username": "sara.almansoori",
      "email": "sara@example.com",
      "email_verified_at": "2026-08-01T...",
      "phone": "+971512345678",
      "phone_verified_at": null,
      "avatar_url": "...",
      "preferred_locale": "en",
      "preferred_timezone": "Asia/Dubai",
      "sign_in_methods": ["password", "google"],
      "created_at": "..."
    }
  }
  ```
- `PUT /api/auth/me` → already exists (`backend/src/server.js:1169`). Accepts partial fields:
  ```json
  { "display_name": "...", "username": "...", "preferred_locale": "en|ar", "preferred_timezone": "Asia/Dubai" }
  ```
  Server-side validation:
  - `username`: unique across users, `^[a-z0-9._-]{3,32}$` (returns 409 `USERNAME_TAKEN` on collision).
  - `preferred_locale`: one of `en`, `ar`.
  - `preferred_timezone`: IANA validation.
  - **Email + phone are IGNORED in this PUT** — must use the OTP re-verify flow. If provided, respond 400 `USE_OTP_FOR_IDENTIFIER_CHANGE`.

- `POST /api/users/me/avatar` (⏳ NEW backend surface required) — multipart/form-data, single field `file`. Server stores in object storage, returns `{ avatar_url }`. Server enforces JPG/PNG + ≤ 2 MB.
- `DELETE /api/users/me/avatar` (⏳ NEW) — removes stored avatar, response 204. Front-end falls back to initials.
- `POST /api/auth/email/change/start` (⏳ verify existing OR new) — takes new email, sends OTP to it. Response 202.
- `POST /api/auth/email/change/verify` — takes OTP, on success rewrites `users.email` + `email_verified_at`.
- `POST /api/auth/phone/change/start` + `POST /api/auth/phone/change/verify` — symmetric to email.

**Errors surfaced:**
- `USERNAME_TAKEN` (409) — inline error.
- `USE_OTP_FOR_IDENTIFIER_CHANGE` (400) — should never reach UI; means the front-end tried to PUT email/phone directly. Log + toast "Something went wrong."
- `VALIDATION_FAILED` (400) — inline field errors.
- `FILE_TOO_LARGE` / `INVALID_MIME` (400) — inline error on avatar upload.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/settings/AccountPage.tsx`. Rendered inside `<SettingsShell>` (from SHR-SET-001).
- **Route registration:** `web/src/App.tsx` — add `<Route path="/settings/account" element={<SettingsShell><AccountPage /></SettingsShell>} />`.
- **Component decomposition:**
  - `AvatarSection` — avatar + upload + remove.
  - `PersonalDetailsBlock` — name + username + locale + timezone.
  - `IdentifiersBlock` — email + phone read-only + Change buttons.
  - `SignInMethodSummary` — one-liner with deep-link.
  - `DangerZone` — delete-account trigger (imports `SHR-SET-005` route).
  - `useAccount()` hook — wraps GET/PUT + optimistic updates.
- **New backend surface required:** avatar upload endpoints (see `[BE-BLOCKER-06]` — file as new blocker in kickoff §5a).
- **Test discipline:**
  - Unit: each component renders + autosave-on-blur behavior + explicit-save behavior.
  - Integration: full field-edit flow → PUT → refetch → refetched value shown.
  - Real-Postgres: avatar upload + delete round-trip.
  - RTL: `screens.rtl.test.tsx` extension covers the pane at ar locale.
  - Broadcast tokens: `no-raw-hex.test.ts` stays green.

---

## Broadcast alignment callouts

Delta from anchor — see SHR-SET-001 for shell chrome tokens.

- Pane title `var(--lc-type-heading-1)`; sub `var(--lc-type-body-lg)` + `--lc-text-muted`.
- Field rows separated by `1px solid var(--lc-border)`, `padding-block: var(--lc-space-lg)`.
- Labels `var(--lc-type-body-sm)` weight 600 `--lc-text-primary`; helpers `var(--lc-type-caption)` `--lc-text-muted`.
- Avatar frame `--lc-radius-pill` + `--lc-elevation-sm`.
- Verified badge `--lc-status-published-*`; unverified `--lc-status-draft-*`.
- Change email/phone buttons `<Button variant="outline">`, `--lc-radius-md`.
- Save button `--lc-action-primary` fill; hover `--lc-action-primary-hover` (DARKER).
- Autosave "Saved ✓" pill `--lc-status-published-bg` + `--lc-status-published-fg`, `--lc-radius-pill`.
- Danger zone heading `--lc-status-underOffer-fg` (amber). Delete button text `--lc-status-unpublished-fg`, outline `--lc-border-strong`.
- Focus rings two-tone via base CSS — do not override.
- Motion: autosave pill fade-in 120ms, fade-out 240ms; dialog open 180ms.
- Radii: inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`; avatar `var(--lc-radius-pill)`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before the brief):

```
I'm designing the WingCaster Account/profile settings pane (SHR-SET-002) — MENA real-estate B2B SaaS. This is a sub-page INSIDE an already-designed settings shell (SHR-SET-001) — do not re-render the shell, only the right pane content. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast design tokens (semantic --lc-* variables only, no raw hex).

First pass: render the desktop 1440px pane at loaded/clean state. Sample data: user "Sara Al Mansoori", username "sara.almansoori", email "sara.almansoori@example.com" (verified), phone "+971 5X XXX 4321" (unverified), English (US) locale, Asia/Dubai timezone, sign in with email+password. Danger zone visible at bottom.

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, autosave-in-flight, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate ambient data.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now mobile 375px viewport, same loaded state. Show the sticky bottom save bar.`
2. `Now show the autosave-in-flight state — spinner next to Full name after blur.`
3. `Now show the username-taken error state after clicking Save on username field.`
4. `Now the RTL Arabic layout at desktop 1440px. Mirror layout, keep email + phone inputs LTR.`
5. `Now dark mode versions of desktop LTR + mobile LTR.`
6. `Now the delete-account-blocked state — user is an agency owner with 3 active members. Delete button disabled with tooltip.`

Save each output's JSX to `web/src/components/settings/AccountPage/` and screenshots to `docs/design/mockups/SHR-SET-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/SHR-SET-002/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief + mockup paths.
- [ ] `[BE-BLOCKER-06]` filed in kickoff §5a — avatar upload endpoints missing.
- [ ] `no-raw-hex.test.ts` stays green after implementation.
- [ ] RTL screenshot test extended with `SHR-SET-002` scenario.
