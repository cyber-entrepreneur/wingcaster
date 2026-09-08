# Screen Brief — SHR-MFA-001 · Two-factor authentication settings (ANCHOR — enrollment family)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-MFA-001`. Wave-4 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 7 + §6 Week 4. **This brief is the anchor for the ENROLLMENT family (001 + 002 + 003)** — SHR-MFA-002 and SHR-MFA-003 are delta briefs that inherit layout, tokens, and interaction language from here.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Never a raw hex, never a Tailwind palette class that hasn't been aliased.

**Screen-specific Broadcast callouts:**

- Screen title ("Two-factor authentication"): `var(--lc-type-heading-1)` — IBM Plex Sans 600 26/32.
- Status hero card sits on `--lc-surface-raised` with `--lc-elevation-sm` and `var(--lc-radius-lg)` corners.
- Status badge inside the hero card: `<Badge>` with the required GLYPH + LABEL pattern. Enabled = `--lc-status-published-{bg,fg,dot}` + `●` glyph + "On"; Disabled = `--lc-status-draft-{bg,fg,dot}` + `○` glyph + "Off". NEVER color alone.
- Primary CTA ("Enable two-factor authentication"): `--lc-action-primary` fill + `--lc-action-primary-text` ink. Hover DARKENS to `--lc-action-primary-hover`.
- Destructive CTA ("Turn off two-factor authentication"): `<Button variant="destructive">` — uses `--lc-status-danger-*` tokens per primitive definition. Requires step-up (SHR-MFA-007) before the modal in SHR-MFA-006 opens.
- Backup-codes remaining counter: `<Numeric>` primitive — mono + tabular-nums, `var(--lc-type-data)`.
- Warning banner ("You have 2 backup codes left. Regenerate them soon."): `--lc-status-warning-bg` + `--lc-status-warning-fg` + `⚠` glyph + text label. NEVER just yellow.
- Method-list rows: `--lc-surface-raised` cards with 1px `--lc-border` divider between rows; row height 64px minimum (respect 44px tap floor).
- Two-tone focus ring is automatic on all interactive elements via base CSS. Do NOT override.
- 44px tap-target floor automatic. Do NOT shrink Enable/Disable/Regenerate buttons.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-MFA-001 |
| Screen name | Two-factor authentication settings |
| Persona | Shared (authed) — any user with a session |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/settings/2fa` |
| Current state | EXISTS — `web/src/pages/TotpSettingsPage.tsx`. This brief supersedes with proper enrollment/operational split, backup-codes surface as its own screen (SHR-MFA-005), and Broadcast alignment. |
| Workflow role | n/a — security surface |
| Backend prerequisites | ✅ `auth-2fa.js` (Phase 7f/1 MERGED) — `/api/auth/2fa/status` returns `{ totp_enabled, preferred_2fa, totp_enrolled_at, backup_codes_remaining }`. Enrollment via `/api/auth/2fa/totp/setup` + `/api/auth/2fa/totp/verify`. Disable via `/api/auth/2fa/totp/disable` (requires step-up). |

---

## Purpose

Give an authenticated user a single, calm place to (a) see whether their account has a second factor turned on, (b) enroll TOTP if they don't, (c) view and regenerate backup codes, and (d) turn 2FA off if they must. Copy is reassuring — "Extra protection for your account" — not alarming. The screen is also the mandatory landing after account recovery when the platform policy nudges the user to enroll (see SHR-AUT-005 exit path).

---

## Design goals

1. **Status legibility at a glance.** A returning user glances at the hero card and knows their state in <1 second. Enabled: green dot + "On" + method + enrolled-since date. Disabled: neutral dot + "Off" + one-line reassurance.
2. **Enrollment feels like setup, not homework.** Enrolling is a 3-step flow (password → scan → verify → save codes) but SHR-MFA-001 shows only the entry — subsequent steps live in SHR-MFA-002 / SHR-MFA-003 / SHR-MFA-005.
3. **Backup codes are surfaced, not hidden.** A dedicated "Backup codes" row shows remaining count + Manage link (→ SHR-MFA-005). If <3 remain, the row goes into warning state.
4. **Destructive is quiet by default.** "Turn off 2FA" is present but visually recessed — outline destructive button in a small "More options" region below the main content, not next to the enrollment CTA.
5. **RTL first-class.** All labels and status pills mirror; the enrolled-since timestamp uses the user's locale (Arabic numerals in ar-EG, Western numerals in ar-AE per Arabic-numerals-convention TBD by copywriter pass).
6. **Never expose the TOTP secret post-enrollment.** The QR + secret only exist during SHR-MFA-002. This screen never shows them again.

---

## Layout

### Desktop / tablet ≥768px

Single-column form-style layout, max-width `640px`, centered inside the settings shell (SHR-SET-001 chrome inherited):

- **Breadcrumb row** — `Settings › Two-factor authentication` (small, `--lc-text-muted`, `var(--lc-type-body-sm)`).
- **Screen title** — "Two-factor authentication" as H1, `var(--lc-type-heading-1)`.
- **Sub** — one line, `var(--lc-type-body)` + `--lc-text-secondary`: "Extra protection for your account. When on, you'll enter a 6-digit code from your authenticator app after your password."
- **Status hero card** — 96px tall on desktop / 112px on mobile, `--lc-surface-raised` + `--lc-elevation-sm`:
  - Left: shield-check icon (24×24 lucide `ShieldCheck` when enabled; `ShieldOff` when disabled), tinted `--lc-status-published-fg` / `--lc-text-muted`.
  - Middle: Status label ("On" / "Off") in `var(--lc-type-heading-3)` + method sub-line ("Authenticator app · enrolled Sep 4, 2026" or "Not set up").
  - Right (enabled only): a tiny `<Badge>` "Recommended" if user is on default recommendation.
- **Methods list** (visible when enabled):
  - **Authenticator app row** — icon (Smartphone lucide) + label + status pill + "Manage" ghost button (opens a dropdown with Reset / Disable).
  - **Backup codes row** — icon (KeySquare lucide) + label + `<Numeric>` counter "8 of 10 codes remaining" + "Manage" ghost button (→ SHR-MFA-005). Row goes into warning state (bg `--lc-status-warning-bg`) when remaining ≤ 2.
- **Primary CTA** (visible when disabled): full-width on mobile / auto-width right-aligned on desktop `<Button>` — "Enable two-factor authentication". Icon `Shield` left of label.
- **"How this works" collapsible** — `<Collapsible>` with the summary "How does two-factor authentication work?" and body of 3 short bullets explaining the flow. Muted, closed by default.
- **More options section** (visible when enabled) — below a `<Separator>`, section heading "More options" in `var(--lc-type-overline)` + `--lc-text-muted`:
  - "Turn off two-factor authentication" destructive-outline button. Small. `<Button variant="destructive" size="default">` — clicking triggers step-up (SHR-MFA-007) which then opens SHR-MFA-006 confirmation modal.

### Mobile ≤767px

Same content, single column, no width cap:
- Screen title in `var(--lc-type-heading-2)` (21/28) instead of heading-1.
- Status hero card + method rows full-width.
- Primary CTA becomes full-width sticky at bottom (respect iOS safe-area inset) when disabled.
- "More options" section stays below the fold — user must scroll to disable, which is on purpose.

---

## Explicit copy (English)

Arabic strings marked `[TRANSLATION-PENDING]` in the AR mirror MDX until copywriter pass.

| Slot | Copy |
|---|---|
| Breadcrumb | Settings › Two-factor authentication |
| H1 | Two-factor authentication |
| Sub | Extra protection for your account. When on, you'll enter a 6-digit code from your authenticator app after your password. |
| Status enabled | **On** — Authenticator app · enrolled {date} |
| Status disabled | **Off** — Not set up |
| Methods heading | Your methods |
| Auth app row label | Authenticator app |
| Auth app row status | Active |
| Backup codes row label | Backup codes |
| Backup codes row counter | {n} of 10 codes remaining |
| Backup codes low-warning | Only {n} codes left. Regenerate them soon. |
| Backup codes empty-warning | You have no backup codes left. If you lose your authenticator, you won't be able to sign in. |
| Manage link | Manage |
| Primary CTA (disabled state) | Enable two-factor authentication |
| Primary CTA sub (disabled state) | Takes about 2 minutes. You'll need an authenticator app like Google Authenticator, 1Password, or Authy. |
| How-this-works heading | How does two-factor authentication work? |
| How-this-works bullet 1 | You'll scan a QR code into an authenticator app. |
| How-this-works bullet 2 | Each time you sign in, you'll enter a 6-digit code the app generates. |
| How-this-works bullet 3 | If you lose your device, you can sign in with a one-time backup code. |
| More options heading | More options |
| Disable CTA | Turn off two-factor authentication |
| Disable CTA sub | Reduces your account security. You'll be asked to confirm. |
| Loading state | Loading your two-factor settings… |
| Error state | Could not load your two-factor settings. Try again. |

---

## Component palette

| Element | Primitive |
|---|---|
| Status hero card | `<Card>` + `<CardContent>` with left icon + middle text + right badge |
| Status badge | `<Badge>` variant matches `--lc-status-published` (on) or `--lc-status-draft` (off) with required glyph |
| Method row | Custom row on `<Card>` with icon + label + counter + ghost `<Button>` |
| Backup-codes counter | `<Numeric>` — mono + tabular |
| Warning banner | Inline banner using `--lc-status-warning-*` tokens + `AlertTriangle` icon |
| Primary CTA | `<Button variant="default" size="lg">` with `Shield` icon |
| Destructive CTA | `<Button variant="destructive">` — outline variant preferred to signal recessed severity |
| Collapsible how-it-works | `<Collapsible>` |
| Loading | Skeleton card matching the hero card shape |
| Icons | `lucide-react`: `ShieldCheck`, `ShieldOff`, `Shield`, `Smartphone`, `KeySquare`, `AlertTriangle`, `ChevronDown` |

---

## Sample content (for v0 / mockup)

**Enabled state (desktop LTR, light):**
- Status hero: green shield icon, "On" heading, "Authenticator app · enrolled Sep 4, 2026" sub, "Recommended" badge on right.
- Auth app row: Smartphone icon, "Authenticator app", "Active" pill, "Manage" ghost.
- Backup codes row: KeySquare icon, "Backup codes", "8 of 10 codes remaining" counter, "Manage" ghost.
- More options: "Turn off two-factor authentication" destructive-outline button.

**Disabled state (mobile LTR, light):**
- Status hero: gray ShieldOff icon, "Off" heading, "Not set up" sub, no badge.
- No methods list.
- Sticky bottom: "Enable two-factor authentication" primary CTA full-width + sub-line about 2 minutes.
- How-this-works collapsible collapsed.

**Backup-codes low-warning state:**
- Backup codes row background tinted `--lc-status-warning-bg`, warning icon added, counter text reads "Only 2 codes left. Regenerate them soon.", "Manage" ghost styled as outline for emphasis.

---

## Interactions

**On mount:**
- GET `/api/auth/2fa/status`. Show skeleton until response.
- On 200: render enabled or disabled variant based on `totp_enabled`.
- On network error: show inline error card + retry button. Do NOT trap the user — settings shell chrome remains navigable.

**On "Enable two-factor authentication" click:**
- Navigate to `/settings/2fa/enroll` (SHR-MFA-002). Route change is fresh page, not a modal — the enrollment flow deserves full attention.

**On "Manage" on Authenticator app row:**
- Opens a `<DropdownMenu>` with items:
  - "Reset authenticator" — redirects to SHR-MFA-002 with `?reset=1` flag (backend rejects re-enrollment while `totp_enabled=true`, so this must first trigger a disable+re-enroll flow via step-up).
  - "Turn off" — same as the destructive CTA at bottom.

**On "Manage" on Backup codes row:**
- Navigate to `/settings/2fa/backup-codes` (SHR-MFA-005).

**On "Turn off two-factor authentication" click:**
- Triggers step-up via `useStepUp()` hook (calls `POST /api/auth/step-up`, opens SHR-MFA-007 modal).
- On successful step-up: opens SHR-MFA-006 confirmation modal.
- On step-up dismissed: no change; user stays on SHR-MFA-001.

**On "How does two-factor authentication work?" click:**
- Toggle `<Collapsible>`. 200ms height transition, `--lc-easing-out`.

**Backup-codes warning threshold:**
- ≤ 2 codes remaining triggers warning row state.
- 0 codes triggers error row state + inline banner at top of methods list: "You have no backup codes left. If you lose your authenticator, you won't be able to sign in. Regenerate now →" (link → SHR-MFA-005).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial mount, no cached status | Skeleton hero card + skeleton row placeholders. |
| **Enabled — normal** | `totp_enabled: true`, backup_codes_remaining ≥ 3 | Full enabled layout. |
| **Enabled — backup-codes low** | `totp_enabled: true`, remaining 1-2 | Warning banner on backup-codes row + counter red-tinted. |
| **Enabled — backup-codes empty** | `totp_enabled: true`, remaining 0 | Top-of-list error banner. Regenerate link prominent. |
| **Disabled** | `totp_enabled: false` | Primary CTA visible. No methods list. |
| **Enrolling — step 1 password modal** | User clicked Enable — but backend requires current-password confirmation | Route to SHR-MFA-002 which opens password gate first. |
| **Step-up in flight** | Disable clicked, step-up modal open | This screen dims behind SHR-MFA-007 modal. |
| **Disable confirm in flight** | Post step-up, SHR-MFA-006 modal open | Same — dimmed behind. |
| **Error — status load failed** | GET /api/auth/2fa/status 5xx | Error card + retry button. No skeleton. |
| **Offline** | Network unreachable | Top banner: "You're offline. Two-factor changes are unavailable until you reconnect." Enable/Disable buttons disabled. |
| **RTL** | Locale = ar | Whole layout mirrors. Timestamps/counters use locale-appropriate numerals. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. Hero card `--lc-surface-raised` becomes dark surface; status glyphs preserve contrast. |
| **Permission denied** | 403 from status endpoint (rare — impersonation guard) | Empty state: "This account cannot manage two-factor settings from this session." |

---

## Accessibility

- Every button has a visible `<Label>` or aria-label — the "Manage" ghost buttons include the row context ("Manage authenticator app").
- Status badge is announced with role + text: "Status: On, authenticator app active."
- Warning banner uses `role="alert"` and `aria-live="polite"` when it appears mid-session (e.g., after regenerate reduces count to 0).
- Method rows are focusable in tab order: auth app row → its Manage → backup codes row → its Manage.
- Backup-codes counter is announced as text ("8 of 10 codes remaining"), NOT just the numeric.
- Destructive button announces its severity: aria-label "Turn off two-factor authentication (reduces account security)".
- All tap targets ≥ 44×44 CSS pixels.
- Focus order flows: breadcrumb → title → hero card (non-interactive, skipped) → auth app Manage → backup codes Manage → How-this-works toggle → Disable button.
- No color-only state indicators — every status has a glyph + text label + tint.

---

## Anti-patterns (do not do these)

- ❌ Do not show the TOTP secret or QR anywhere on this screen. Secret exists only in SHR-MFA-002 during enrollment.
- ❌ Do not use alarming copy — "Your account is at risk" is prohibited. Copy is calming: "Extra protection for your account".
- ❌ Do not place the destructive Disable button next to the primary Enable CTA in the top region. It sits below the fold on mobile / below a Separator on desktop, in "More options".
- ❌ Do not render the backup-codes remaining count in the UI font — every numeral goes through `<Numeric>` per Broadcast rule.
- ❌ Do not skip the step-up gate for Disable. `/api/auth/2fa/totp/disable` requires `requireElevated()` on the backend — the UI MUST call step-up first.
- ❌ Do not show a "Reveal secret" button post-enrollment. There is no endpoint that returns the secret again.
- ❌ Do not show backup codes inline on this screen (that's SHR-MFA-005). This screen only shows the COUNT.
- ❌ Do not use soft-blurred shadows on the hero card — Broadcast elevation is offset (`--lc-elevation-sm`).

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **GitHub two-factor settings** — the clean status hero + methods list model.
- **Stripe two-factor settings** — the enrolled-since timestamp treatment + backup codes remaining counter.
- **1Password two-factor settings** — the calming "Extra protection" copy voice.
- **Google account 2SV** — the "More options" recessed disable pattern.

Do NOT match:
- Bank-style 2FA screens (over-serious, red warnings everywhere).
- Slack's 2FA (buried inside a modal — we want a proper page).

---

## Backend contract

**GET `/api/auth/2fa/status`** — auth required
```json
{
  "totp_enabled": true,
  "preferred_2fa": "totp",
  "totp_enrolled_at": "2026-09-04T14:32:00Z",
  "backup_codes_remaining": 8
}
```

**Downstream endpoints referenced from this screen:**
- `POST /api/auth/2fa/totp/setup` — enrollment step 1 (used by SHR-MFA-002)
- `POST /api/auth/2fa/totp/verify` — enrollment step 2 (used by SHR-MFA-003)
- `POST /api/auth/2fa/totp/disable` — requires elevation (used by SHR-MFA-006)
- `POST /api/auth/step-up` — issues step-up challenge (used by SHR-MFA-007)

**Known backend gap:** There is NO `/api/auth/2fa/backup-codes` GET endpoint — backup codes are shown exactly once during enrollment (see auth-2fa.js line 400 comment: "Shown to the user exactly once — there is no endpoint that can return these again"). SHR-MFA-005 can therefore ONLY offer **Regenerate**, not View. UI must reflect this: the "Manage" link on the backup codes row leads to a screen whose only actions are Copy (of newly regenerated codes) / Download (of newly regenerated codes) / Regenerate (which invalidates existing). If the user hasn't regenerated in this session, SHR-MFA-005 shows a "Regenerate to see codes" empty state, NOT a code grid. **[BE-VERIFY-MFA-01]** — decide whether to add a `/api/auth/2fa/backup-codes` GET that returns cipher-decrypted plaintext (security review required before implementing).

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to refactor:** `web/src/pages/TotpSettingsPage.tsx` → keep filename but restructure. Extract enrollment stages 'password' | 'scan' | 'codes' into their own routed pages (SHR-MFA-002 at `/settings/2fa/enroll`, SHR-MFA-003 at `/settings/2fa/enroll?stage=verify`, SHR-MFA-005 at `/settings/2fa/backup-codes`). SHR-MFA-001 becomes stage='idle' only.
- **Route:** `/settings/2fa` — already registered in `web/src/App.tsx`.
- **Component decomposition:**
  - `TwoFactorStatusHero` — the hero card (icon + status text + optional badge).
  - `MethodRow` — reusable row for the methods list (icon + label + counter + Manage).
  - `BackupCodesRow` — specific composition around `MethodRow` with warning-state logic.
  - `DisableSection` — recessed More Options section.
- **Test discipline:**
  - Unit: status hero renders enabled + disabled + skeleton states.
  - Unit: backup-codes low + empty warning states.
  - Integration: Enable click → routes to SHR-MFA-002.
  - Integration: Disable click → step-up modal opens → SHR-MFA-006 opens on success.
  - RTL: `TotpSettingsPage.rtl.test.tsx` extension exists — add scenarios for enabled+low-codes RTL variant.
  - Broadcast: `no-raw-hex.test.ts` stays green.
- **Shared primitives extracted (also used by SHR-SET-*):**
  - `TwoFactorStatusHero` is shared with SHR-AUT-005 (recovery landing).
  - `MethodRow` will be reused by SHR-SET-004 (sessions/devices).
  - `useStepUp()` hook — already exists in `web/src/hooks/useStepUp.ts` per prior work; import don't rebuild.

---

## Broadcast alignment callouts

- Status hero card: `background: var(--lc-surface-raised)`, `box-shadow: var(--lc-elevation-sm)`, `border-radius: var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`.
- Status badge: MUST use `--lc-status-published-*` (on) or `--lc-status-draft-*` (off) tokens with the required GLYPH.
- Method-row borders: `1px solid var(--lc-border)` between rows.
- Warning row bg: `var(--lc-status-warning-bg)`; foreground text `var(--lc-status-warning-fg)`.
- Primary CTA: `var(--lc-action-primary)` fill, hover DARKER `var(--lc-action-primary-hover)`.
- Destructive CTA: use `<Button variant="destructive">` primitive — tokens defined in the primitive.
- Backup-codes counter: rendered via `<Numeric>` component.
- Focus ring: two-tone via base CSS, do not override.
- Motion: Collapsible height transition `var(--lc-duration-base)` with `var(--lc-easing-out)`. Button hover `var(--lc-duration-fast)`.
- Radii: hero card `var(--lc-radius-lg)`; buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt:

```
I'm designing the WingCaster two-factor authentication settings screen (SHR-MFA-001) — MENA real-estate B2B SaaS. This is the anchor screen of the 2FA enrollment family; child screens (SHR-MFA-002 QR setup, SHR-MFA-003 verify, SHR-MFA-005 backup codes viewer) inherit from here. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

First pass: render the desktop 1440px layout in ENABLED state — status hero card with green shield + "On" + "Authenticator app · enrolled Sep 4, 2026", methods list with Authenticator app row (Active pill + Manage) and Backup codes row (8 of 10 remaining + Manage), a "How does two-factor authentication work?" collapsible, and a "More options" section below a separator with a destructive-outline "Turn off two-factor authentication" button.

LTR English only for this pass — I'll ask for the DISABLED state, backup-codes-low warning state, mobile, RTL, and dark mode as follow-ups.

Follow the copy table exactly. Never render the TOTP secret on this screen — it's not part of this screen's contract.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Now switch to DISABLED state (`totp_enabled: false`). Show the primary CTA "Enable two-factor authentication".
2. Now ENABLED with backup-codes low (2 of 10) — warning tint on the backup codes row.
3. Now mobile 375px viewport, DISABLED state — sticky bottom CTA.
4. Now RTL Arabic desktop 1440px, ENABLED state.
5. Now dark mode desktop LTR ENABLED.
6. Now the loading skeleton state.

Save each output to `docs/design/mockups/SHR-MFA-001-<state>.png` and JSX to `docs/design/mockups/v0-outputs/SHR-MFA-001/`.

---

## Definition of done for this brief

- [ ] v0 produced all 6 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-4 dispatch prompt references this brief + the mockup paths.
- [ ] `[BE-VERIFY-MFA-01]` filed in kickoff §5a — decide backup-codes retrieval endpoint policy.
