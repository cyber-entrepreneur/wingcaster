# Screen Brief — SHR-MFA-002 · TOTP setup (show QR) — DELTA

**Delta brief.** Inherits from `SHR-MFA-001-2fa-settings-brief.md` (enrollment anchor). This document specifies ONLY what differs; assume the anchor's layout patterns, Broadcast tokens, copy voice, RTL rules, and settings-shell chrome apply here unless otherwise stated.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md`.** Delta callouts only:

- QR code renders on `--lc-surface-raised` with `20px` padding + `var(--lc-radius-lg)` corners. QR foreground `#000000` and background `#FFFFFF` per QR spec (this is the ONE place raw hex is legal — the QR PNG data URL isn't reading tokens; hard-code both mode variants render identical PNG output).
- Secret display: `var(--lc-font-mono)` + `tabular-nums` + `letter-spacing: 0.05em` — reveal-on-tap on mobile to prevent shoulder-surfing.
- "Continue" primary CTA: `--lc-action-primary` fill. Only enabled after QR has rendered (proves the secret arrived).
- "Cancel" secondary: `<Button variant="ghost">` — routes back to SHR-MFA-001.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-002 |
| Screen name | TOTP setup — scan QR |
| Route | `/settings/2fa/enroll` (stage 1 of 3-step enrollment) |
| Current state | PARTIAL — embedded in `web/src/pages/TotpSettingsPage.tsx` (stage='scan'). Extract to routed page per SHR-MFA-001 refactor note. |
| Backend prerequisites | ✅ `POST /api/auth/2fa/totp/setup` MERGED — requires current password confirmation, returns `{ secret, provisioning_uri, issuer, account }`. Secret is NOT persisted server-side until SHR-MFA-003 verify succeeds. |

---

## Purpose

Show the user a QR code that encodes a fresh TOTP provisioning URI + the secret in text form, so they can add WingCaster to their authenticator app. This screen does NOT enable 2FA — enrollment only commits when SHR-MFA-003 verifies the first code. Cancelling here leaves the account unchanged.

---

## Delta from anchor

**Layout** — single-column, ~640px max-width (same as SHR-MFA-001):

- **Password gate** (renders FIRST when arriving from SHR-MFA-001, before setup call): a small `<Card>` with a single password input and "Continue" button. On submit, POSTs `/api/auth/2fa/totp/setup` with `{ current_password }`. On 200, replaces itself with the QR step. On 401, inline error. Passes step-up-lite for the setup endpoint per backend contract.
- **QR step** (after setup call succeeds):
  - Stepper indicator top: `[1] Set up · 2 Verify · 3 Save codes` — `[1]` filled, others muted.
  - H1: "Scan this with your authenticator app"
  - Sub: "Open Google Authenticator, 1Password, Authy, or another authenticator app, then scan the code below."
  - **QR panel** — 240×240px on desktop / 200×200px on mobile QR image inside a 20px-padded `--lc-surface-raised` card, centered.
  - **"Can't scan?" collapsible** — reveals the plaintext secret with a Copy button + issuer + account. Secret rendered in `var(--lc-font-mono)` grouped as `XXXX-XXXX-XXXX-XXXX` for readability. Copy button flips to Copied ✓ for 1500ms.
  - **App-picker helper** — a small text row: "Don't have one? Try [Google Authenticator ↗] · [1Password ↗] · [Authy ↗]" — links open in new tab.
  - **Continue CTA** — primary, "Continue" → routes to SHR-MFA-003 (`/settings/2fa/enroll?stage=verify`). Enabled only after the QR image has rendered successfully.
  - **Cancel** — ghost button, routes back to SHR-MFA-001 without committing.

**Copy delta:**

| Slot | Copy |
|---|---|
| Password gate H2 | Confirm your password |
| Password gate sub | For your security, please confirm your current password before enabling two-factor. |
| Stepper labels | Set up · Verify · Save codes |
| H1 | Scan this with your authenticator app |
| Sub | Open Google Authenticator, 1Password, Authy, or another authenticator app, then scan the code below. |
| Can't-scan heading | Can't scan? Enter this code instead |
| Secret aria-label | TOTP secret key — read carefully |
| Copy secret button | Copy code |
| Copy secret button (copied) | Copied ✓ |
| App-picker heading | Don't have an authenticator app? |
| Continue CTA | Continue |
| Cancel | Cancel |
| Error — password wrong | Current password is incorrect. |
| Error — setup failed | We couldn't start two-factor setup. Try again. |

**Interactions delta:**

- QR is rendered CLIENT-SIDE from `provisioning_uri` using the `qrcode` library — the secret never passes through a server-rendered image (matches existing `TotpSettingsPage.tsx` implementation).
- Secret text is HIDDEN by default on mobile (a "Tap to reveal" placeholder overlay). On tap: reveals + auto-re-hides after 30 seconds if no interaction.
- Copy button uses `navigator.clipboard.writeText`. Show a `Copied ✓` state for 1500ms; screen-reader announces "Secret copied to clipboard".
- Navigation guard: if the user tries to leave via browser back or nav-drawer, show a lightweight confirm: "Cancel two-factor setup? Your progress will be lost."
- On mount, if the URL has `?reset=1` (from SHR-MFA-001 Reset authenticator action), first trigger step-up (SHR-MFA-007) → then Disable → THEN this setup flow. Chain lives in the parent settings shell orchestrator, not this screen.

**State variants delta:**

| Variant | Behavior |
|---|---|
| **Password gate** | Only password field visible; QR not yet requested. |
| **Loading — setup** | Skeleton QR block + shimmering secret line. |
| **QR ready** | Full QR + secret + continue enabled. |
| **QR failed to render** | Fallback: "Could not display QR. Enter the code manually below." — expand the secret block by default. |
| **Setup failed** | Inline error card + retry button. |
| **Cancel confirm** | Modal per navigation guard. |

**Anti-patterns delta:**

- ❌ Do not render QR server-side. Client-only via `qrcode` library. Matches existing security posture.
- ❌ Do not skip the password gate. Backend requires `current_password` on `/api/auth/2fa/totp/setup`.
- ❌ Do not persist the secret in localStorage or sessionStorage. It's held in React state and dies with the page.
- ❌ Do not enable Continue before QR renders. Users must have had at least the opportunity to scan.
- ❌ Do not show the secret unmasked by default on mobile — shoulder-surfing risk.

**Backend contract delta:**

`POST /api/auth/2fa/totp/setup` — auth required + valid session, body `{ current_password }`. Response `{ secret, provisioning_uri, issuer, account }`. 401 on wrong password, 409 if already enabled.

**Shared primitives:**

- `PasswordGateCard` — reused by SHR-MFA-006 (disable flow also needs password confirmation before step-up).
- `EnrollmentStepper` — 3-step visual indicator, shared with SHR-MFA-003 + SHR-MFA-005.
- `RevealableSecret` — the mono display + copy + reveal-on-tap combo, potentially reusable for other secret-display surfaces (API keys — future).

**Definition of done:** password gate + QR ready + can't-scan expanded + mobile + RTL + dark states rendered; JSX committed; shared primitives extracted.
