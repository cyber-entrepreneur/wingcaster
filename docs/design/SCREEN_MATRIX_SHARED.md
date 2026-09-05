# Wingcaster — Screen Matrix: Shared / Cross-Persona

Sister documents:
- `SCREEN_MATRIX_AGENT.md` — mobile-first, dual-mode (Guided/Pro), RTL-required
- `SCREEN_MATRIX_AGENCY.md` — desktop-first, mobile-responsive, RTL-required
- `SCREEN_MATRIX_PA.md` — desktop-only, dense, en-only
- `SCREEN_MATRIX_INDEX.md` — master index + workflow crosswalk

This document defines the conventions used across all four matrices, then enumerates the **cross-persona screens** — those that any authenticated user, or any public visitor, may reach.

Written 2026-09-03. Reflects `origin/main @ b989e6b`.

---

## 0. Conventions

### 0.1 Screen ID

`<PERSONA>-<DOMAIN>-<NNN>`

| Persona | Code |
|---|---|
| Shared (any authed user or public) | `SHR` |
| Agent | `AGT` |
| Agency | `AGN` |
| Platform Admin | `PA` |

Domain codes are 3 letters, defined per matrix. Numbers increment per (persona × domain), zero-padded to 3 digits.

Examples: `SHR-AUT-001` (Shared → Auth → screen 1). `AGT-LST-014` (Agent → Listings → screen 14). `PA-FIN-023` (PA → Fin console → screen 23).

### 0.2 Workflow ID

`WF-<NN>` — globally unique across the platform. A workflow is a stateful multi-screen process where an item transitions between states (draft → submitted → approved). Workflow screens carry the workflow ID + subtype in a **workflow role** line.

Workflow subtypes (the vocabulary from the design conversation):

| Subtype | Role in the workflow |
|---|---|
| **Initiator** | Kicks off the workflow (create/draft) |
| **Composition** | Edit the item while in DRAFT |
| **Submission** | The "send for review" action + confirmation |
| **Approval queue** | Reviewer's list of items pending decision |
| **Approval detail** | One item shown for evaluation + accept/reject/request-changes |
| **Recipient** | Submitter sees the outcome (approved/rejected) |
| **Escalation** | Reviewer defers to higher tier |
| **Delegation** | Reassign pending review to another approver |
| **Audit / history** | Immutable trail of decisions |
| **Recall** | Submitter cancels an in-flight review |
| **Action outcome** | Confirmation after an approve/reject/withdraw completes |

### 0.3 Screen entry format (depth b)

```
### <SCREEN-ID> — <Screen title>

Purpose: <one-sentence what the user is doing here>
Route: <URL path or "modal" / "drawer">   Persona: <shared|agent|agency|pa>
Device: <mobile 375px | tablet 768px | desktop 1440px | responsive>
Mode: <n/a | guided | pro | both>
Current state: <EXISTS | PARTIAL | MISSING> — <file path if EXISTS/PARTIAL, gap notes>
Workflow role: <n/a | WF-NN role=<subtype>>
Key components: <bulleted list of major UI pieces>
Primary actions: <what the user can do here, and where each goes (→ SCREEN-ID)>
State variants: <loading | empty | error | permission-denied | offline | rate-limited — as applicable>
Entry from: <(comma-separated list of SCREEN-IDs, or "URL/deep-link", "notification", "email link", "public link")>
Exit to: <SCREEN-IDs on success, cancel, and error paths>
Metering: <n/a | FEATURE_NAME (from backend features.js)>
Notes: <RTL specifics, accessibility, empty state copy hooks, i18n keys, dark-mode notes, workflow-role notes>
```

### 0.4 Current-state semantics

- **EXISTS** — the page/component is on `origin/main` and functional
- **PARTIAL** — file exists but is missing state variants, mode support, RTL, or backend coverage
- **MISSING** — no file; needs to be created

Every EXISTS/PARTIAL entry cites a file path so a reviewer can jump to the code.

### 0.5 Cross-cutting variants NOT enumerated individually

Every screen implicitly has all of these variants unless otherwise noted. They are called out inline in `Notes:` only when a screen has non-obvious behavior:

- **Light + Dark theme** — every screen (design system tokens carry both)
- **English + Arabic RTL** — every Agent + Agency + Shared screen; PA is en-only per design brief
- **Loading / skeleton** — every data-backed screen
- **Empty state** — every list/index screen
- **Error state** — every screen (retry affordance, plain-language message)
- **Offline state** — every screen (Capacitor wrapper detects offline)
- **Permission-denied** — every screen behind auth (renders "not authorized" card)

### 0.6 What "screen" means here

A **screen** is a distinct user-facing view with its own purpose, primary action set, and identity. Rules:

- A **modal / drawer** counts as its own screen when it has non-trivial content (form, list, decision surface). A confirm dialog with one message + two buttons does NOT get its own entry.
- A **tab within a page** counts as its own screen when the tab has its own components + actions + state variants (e.g., Listing Detail → Analytics tab is its own screen: `AGT-LST-011`).
- A **wizard step** counts as its own screen. A 5-step wizard = 5 screens.
- A **state variant** (loading, empty, error) does NOT get its own screen entry — it lives in the parent screen's `State variants:` line.
- A **Guided vs Pro** variant of the same functional screen gets ONE entry with `Mode: both` when the difference is density-only. Two entries when the flow diverges (e.g., single-form vs wizard).

---

## 1. SHR-AUT — Authentication (public & anon)

### SHR-AUT-001 — Login (CORRECTED 2026-09-04 per user feedback — 6 identity paths)

Purpose: User signs in via any of six identity paths — Google / Apple / Facebook (OAuth) OR Email / Username / Phone Number (each with password). Full spec in `docs/design/briefs/SHR-AUT-001-login-brief.md`.
Route: `/login`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/LoginPage.tsx` — but ONLY supports email+password. Needs (a) three OAuth provider integrations added, (b) identifier-type switcher (Email / Username / Phone) added, (c) RTL variant, (d) mobile pass at 375px.
Workflow role: n/a
Key components: Email input, password input, "Remember me" checkbox, primary Sign-in button, "Forgot password?" link, "Sign in with OTP" secondary CTA, "Create account" link, brand hero (left panel on desktop, top-of-screen on mobile).
Primary actions: Sign in → validates → if 2FA required → SHR-MFA-004; else SHR-NAV-001 (post-auth landing). Forgot password → SHR-AUT-003. OTP → SHR-AUT-002. Create account → SHR-AUT-006.
State variants: loading (submit disabled + spinner), error (invalid credentials — plain-language message), account-locked, MFA-required (branch to SHR-MFA-004), rate-limited (429), offline.
Entry from: URL, expired-session redirect, `/logout` action, public landing "Sign in" button.
Exit to: SHR-NAV-001 (success), SHR-AUT-003 (forgot), SHR-AUT-006 (register), SHR-MFA-004 (2FA branch).
Metering: n/a
Notes: RTL: form fields mirror; email field stays LTR. Password field has visibility toggle. Autofocus email on mount. Enter key submits from any input. Trap focus in error toast for a11y.

### SHR-AUT-002 — Sign in with OTP (request code)

Purpose: User requests a one-time code sent to email or phone for passwordless sign-in.
Route: `/login?method=otp` or modal from SHR-AUT-001   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: PARTIAL — backend routes exist (`POST /api/auth/request-otp`, `POST /api/auth/verify-otp`); no dedicated frontend page found in audit.
Workflow role: n/a
Key components: Contact-method input (email / phone tabs), Send Code button, back to password sign-in link.
Primary actions: Send code → SHR-AUT-002b (verify screen). Back to password → SHR-AUT-001.
State variants: loading (send in progress), error (invalid input), rate-limited (too many recent OTP requests — cool-down banner).
Entry from: SHR-AUT-001, deep-link.
Exit to: SHR-AUT-002b on success, SHR-AUT-001 on cancel.
Metering: n/a (auth is not metered)
Notes: OTP is delivered via Microsoft Graph (email). Copy: "We just sent you a 6-digit code. It expires in 10 minutes."

### SHR-AUT-002b — Verify OTP

Purpose: User enters the 6-digit code they received.
Route: `/login?method=otp&stage=verify`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: MISSING — build alongside SHR-AUT-002.
Workflow role: n/a
Key components: 6-digit code input (auto-advance between boxes), Resend Code button (disabled with countdown), Verify button, Change email/phone link (→ SHR-AUT-002).
Primary actions: Verify → session established → SHR-NAV-001. Resend → new code (60s cool-down).
State variants: loading, error (wrong code, expired code — with retry counter), rate-limited (too many attempts — lock 15 min), success (brief checkmark → redirect).
Entry from: SHR-AUT-002.
Exit to: SHR-NAV-001 on success, SHR-AUT-001 on abandon, SHR-MFA-004 if TOTP is enrolled for the account.
Metering: n/a
Notes: 6-digit boxes should accept paste of full code. Screen-reader announces attempts-remaining.

### SHR-AUT-003 — Forgot password (request)

Purpose: User asks for a password-reset email.
Route: `/forgot-password`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/ForgotPasswordPage.tsx`. Needs RTL + mobile pass.
Workflow role: WF-04 role=Initiator (account-recovery flow when password reset alone insufficient — see SHR-AUT-005).
Key components: Email input, Send Reset Link button, back-to-sign-in link, "Can't access this email? Start account recovery" secondary CTA.
Primary actions: Send reset → confirmation screen (SHR-AUT-003b). Account recovery → SHR-AUT-005.
State variants: loading, error, rate-limited, success (info-only, no email enumeration reveal).
Entry from: SHR-AUT-001.
Exit to: SHR-AUT-003b on submit, SHR-AUT-001 on cancel, SHR-AUT-005 for recovery.
Metering: n/a
Notes: Response is always success (never reveal whether email exists). Copy: "If that email is registered, we've sent a reset link. Check your inbox in a couple of minutes."

### SHR-AUT-003b — Forgot password sent (confirmation)

Purpose: Reassures the user the reset email is on its way and tells them what to do.
Route: `/forgot-password?sent=1` or replace state   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: PARTIAL — inline success state in `ForgotPasswordPage.tsx`; may not be a dedicated route.
Workflow role: n/a
Key components: Success illustration, plain-language explanation, "I didn't get it — resend" (with countdown), "Try a different email" link, "Back to sign-in" link.
Primary actions: Resend, change email → SHR-AUT-003.
State variants: n/a (this IS a state)
Entry from: SHR-AUT-003 on submit.
Exit to: SHR-AUT-001, SHR-AUT-003 for retry.
Metering: n/a
Notes: Don't reveal whether the address was found. Copy is identical regardless of registration state.

### SHR-AUT-004 — Reset password (from email link)

Purpose: User sets a new password using a signed link from email.
Route: `/reset-password?token=…`   Persona: shared (anon, token-authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/ResetPasswordPage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: New password input, confirm password input, password-strength meter, "Show password" toggles, Update Password button, "This link is invalid or expired" error card.
Primary actions: Update → success screen → auto-redirect to SHR-AUT-001 or SHR-NAV-001 if session was preserved.
State variants: loading (validating token on mount), error (bad token, mismatched confirm, weak password), success (auto-redirect countdown 3s → SHR-AUT-001).
Entry from: Email link (external).
Exit to: SHR-AUT-001 or SHR-NAV-001.
Metering: n/a
Notes: Strength meter must be usable with keyboard-only + screen reader (announce strength changes). Reject the reset if token is older than 60 min.

### SHR-AUT-005 — Account recovery (request)

Purpose: User can't access their email and needs manual PA review to recover the account.
Route: `/account-recovery`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/AccountRecoveryPage.tsx`. Needs RTL + mobile pass. Also needs audit for what identity-proof fields are collected.
Workflow role: WF-04 role=Initiator (account-recovery workflow with PA approval).
Key components: Explanation ("Use this only if you can't access the email on file"), identity fields (name, phone, alternate email, description of the issue, ID upload if required), Submit Request button.
Primary actions: Submit → SHR-AUT-005b (confirmation). Back to sign-in → SHR-AUT-001.
State variants: loading, error, rate-limited (one open recovery request per user at a time).
Entry from: SHR-AUT-003 fallback, direct URL.
Exit to: SHR-AUT-005b, SHR-AUT-001.
Metering: n/a
Notes: Every field should have an "I don't know" affordance so a genuine locked-out user isn't blocked. Uploaded ID must go through secure upload to server.

### SHR-AUT-005b — Account recovery submitted

Purpose: Confirm submission, set expectation for review time.
Route: `/account-recovery?submitted=1`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: PARTIAL — likely inline in `AccountRecoveryPage.tsx`.
Workflow role: WF-04 role=Recipient (submitter side).
Key components: Success card, "We'll review within N business days" copy, request reference ID (for the user to quote in support).
Primary actions: Back to sign-in.
State variants: n/a
Entry from: SHR-AUT-005.
Exit to: SHR-AUT-001.
Metering: n/a
Notes: Corresponding admin review screen is `PA-REC-001` (account recovery queue), see PA matrix.

### SHR-AUT-005c — Account recovery complete (from admin-issued link)

Purpose: PA approved the request; user follows the completion link from email to finalize a new password + revocation of prior sessions.
Route: `/account-recovery/complete?token=…`   Persona: shared (anon, token-authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/AccountRecoveryCompletePage.tsx`. Needs RTL + mobile pass.
Workflow role: WF-04 role=Recipient / Action outcome (post-approval completion).
Key components: New password input, confirm password, revoke-all-sessions checkbox (default ON), enroll-2FA nudge, Finish button.
Primary actions: Finish → session established → SHR-NAV-001.
State variants: loading, invalid/expired token, success.
Entry from: Email link (PA-approved).
Exit to: SHR-NAV-001.
Metering: n/a
Notes: Force 2FA enrollment on next login (soft nudge here, hard requirement on next login).

### SHR-AUT-006 — Register (agent OR agency free-tier signup) (CORRECTED 2026-09-04 per D9 — register-as-agency path)

Purpose: New user creates a WingCaster account. Signup supports THREE registration paths (added 2026-09-04 per D9): (a) solo agent → personal tenant only, (b) agent applying to join an agency → personal tenant + WF-02 pending application, (c) **agency owner registering as an agency** → personal tenant + brand-new agency tenant with owner role auto-assigned. All three paths use the same 6 identity paths (Google / Apple / Facebook / Email+password / Username+password / Phone+password).

**Agency free-tier requirement:** `product_packages` currently seeds only `target_audience='agent'` free-tier via migration 304. Path (c) needs a **new agency-target free-tier package seeded via a migration extension** (304a or 307) so agency owners registering can be auto-provisioned into a free-tier subscription. Without this, path (c) requires post-signup manual PA intervention. **Backend prerequisite: create + seed agency free-tier package.**
Route: `/register`   Persona: shared (anon) → agent post-signup   Device: responsive (mobile-first)   Mode: guided (default)
Current state: EXISTS — `web/src/pages/AgentRegisterPage.tsx`. Needs (a) three OAuth provider registrations (Google / Apple / Facebook) added, (b) identifier-type switcher (Email / Username / Phone) with OTP inline verification for phone + username availability check, (c) new sub-screens SHR-AUT-007 (OAuth-account-link when signing up with a provider whose email matches an existing direct-credentials account) and SHR-AUT-008 (username claim), (d) RTL + Guided-wizard treatment + mobile pass at 375px, (e) branding bug fix — page copy says "Real Estate Bazaar" which is a code bug per memory `wingcaster-vs-bazaar` — should say "WingCaster".
Workflow role: WF-02 role=Initiator (agency-join flow if signup is "I want to join an agency").
Key components: Step 1 identity (name, email, phone), Step 2 password + terms + privacy consent, Step 3 profile basics (city, primary language), Step 4 registration-path branch — **THREE options** (Solo agent / Join an agency / Register as an agency owner), Step 5 branches: (solo) success + tour prompt; (join) pick agency + apply → WF-02; **(agency) agency-detail form (legal name, trading name, license number, city) → creates agency tenant + assigns owner membership + provisions agency free-tier subscription → agency-onboarding checklist**.
Primary actions: Next / Back / Skip (per step); final Submit → SHR-NAV-001 + first-listing tour prompt on Agent dashboard.
State variants: loading, per-step validation errors, network error (with retry), agency-not-found (search inline), OTP verification of email inline (see SHR-AUT-002b).
Entry from: Public landing, `/login` "create account" link, agency-directed invite link.
Exit to: SHR-NAV-001 (solo path lands on personal-tenant dashboard); AGN-MEM-005 confirmation (join-agency path); AGN-DSH-001 with onboarding checklist AGN-DSH-002 (register-as-agency path — agent lands directly in the new agency tenant they just created).
Metering: n/a
Notes: Must be usable one-handed on 375px. Terms + Privacy links open in-place modal (SHR-LEG-001, SHR-LEG-002). Password strength meter mandatory. Email must be verified before free tier is fully provisioned (OTP inline). Language selector (en / ar) at top of every step, with immediate RTL flip on ar.

---

## 2. SHR-MFA — Multi-factor authentication & step-up

### SHR-MFA-001 — 2FA settings

Purpose: Authed user views 2FA status and enrolls / manages TOTP + backup codes.
Route: `/settings/2fa`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/TotpSettingsPage.tsx`. Needs RTL + mobile pass + backup-codes surface.
Workflow role: n/a
Key components: Current status badge (Enabled / Disabled), Enroll TOTP button, Backup Codes section (View / Regenerate — reauth required), Disable button (reauth required), device list (last-used, revoke session).
Primary actions: Enroll → SHR-MFA-002. View backup codes → SHR-MFA-005. Disable → SHR-MFA-006. Revoke session inline.
State variants: loading, error, permission-denied.
Entry from: Navbar user menu, security-nudge banner post-signup, PA-mandated after account recovery.
Exit to: SHR-MFA-002, SHR-MFA-005, SHR-MFA-006.
Metering: n/a
Notes: Copy is calming, not alarming ("Extra protection for your account" not "Your account is at risk"). Never expose the TOTP secret post-enrollment.

### SHR-MFA-002 — TOTP setup (show QR)

Purpose: User scans QR into an authenticator app.
Route: `/settings/2fa/enroll`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — likely embedded in `TotpSettingsPage.tsx`; may need to be a dedicated route.
Workflow role: n/a
Key components: QR code image, secret key (with copy button, revealed by tap), "Which app?" helper (Google Authenticator / 1Password / Authy / etc.), Continue button.
Primary actions: Continue → SHR-MFA-003 (verify code).
State variants: loading, error (secret generation failed).
Entry from: SHR-MFA-001.
Exit to: SHR-MFA-003, SHR-MFA-001 on cancel.
Metering: n/a
Notes: QR must be at least 200×200. Secret key must be tappable-to-reveal on mobile (prevent shoulder-surfing).

### SHR-MFA-003 — TOTP setup (verify + save)

Purpose: User confirms enrollment by entering a code from their app.
Route: `/settings/2fa/enroll?stage=verify`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — embedded flow.
Workflow role: n/a
Key components: 6-digit code input, Verify button, Back link.
Primary actions: Verify → SHR-MFA-005 (show backup codes). Back → SHR-MFA-002.
State variants: loading, error (wrong code — with retry), rate-limited.
Entry from: SHR-MFA-002.
Exit to: SHR-MFA-005 on success.
Metering: n/a
Notes: On success, user is FORCED to save backup codes before returning to SHR-MFA-001.

### SHR-MFA-004 — 2FA challenge at sign-in

Purpose: A user with 2FA enrolled is prompted for their code during login.
Route: `/login?stage=2fa`   Persona: shared (anon-half-authed)   Device: responsive   Mode: n/a
Current state: MISSING or embedded in login flow — needs verification.
Workflow role: n/a
Key components: 6-digit code input, "Use a backup code instead" link, Verify button, Sign in as different user link.
Primary actions: Verify → SHR-NAV-001. Backup code → SHR-MFA-004b.
State variants: loading, error, rate-limited (after N wrong tries, lock).
Entry from: SHR-AUT-001 branch when 2FA required.
Exit to: SHR-NAV-001, SHR-MFA-004b.
Metering: n/a
Notes: Must NOT reveal that the account has 2FA if the account doesn't exist (uniform behavior).

### SHR-MFA-004b — Sign in with backup code

Purpose: User has lost their authenticator and uses one of the one-time backup codes.
Route: `/login?stage=backup`   Persona: shared (anon-half-authed)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Backup code input, Verify button, "I've lost my codes too — recover my account" link (→ SHR-AUT-005).
Primary actions: Verify → SHR-NAV-001 + banner nudging user to view backup codes and regenerate (one code was just consumed).
State variants: loading, error, rate-limited.
Entry from: SHR-MFA-004.
Exit to: SHR-NAV-001, SHR-AUT-005.
Metering: n/a
Notes: Codes are one-time. Post-success banner explains that this code is used up.

### SHR-MFA-005 — Backup codes (view & regenerate)

Purpose: User views their 10 backup codes; can regenerate the full set.
Route: `/settings/2fa/backup-codes`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: 10-code grid (or 2×5), Copy All button, Download as .txt, Print button, Regenerate button (destructive, requires step-up SHR-MFA-007).
Primary actions: Copy / Download / Print. Regenerate → SHR-MFA-007 step-up → new codes displayed.
State variants: loading, error.
Entry from: SHR-MFA-001, SHR-MFA-003 (mandatory on enrollment), notification banner reminders.
Exit to: SHR-MFA-001.
Metering: n/a
Notes: When regenerated, all previous codes are invalidated immediately. Screen must warn user and confirm.

### SHR-MFA-006 — Disable 2FA (dangerous)

Purpose: User turns off 2FA (requires step-up + typed confirmation).
Route: modal from SHR-MFA-001   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING or partial.
Workflow role: n/a
Key components: Warning banner ("This reduces your account security"), reason dropdown (analytics), typed confirmation ("Type DISABLE to confirm"), Disable button (requires step-up SHR-MFA-007 first).
Primary actions: Disable → SHR-MFA-007 step-up → on success, 2FA disabled, backup codes invalidated, notification email sent to user.
State variants: loading, error, permission-denied.
Entry from: SHR-MFA-001.
Exit to: SHR-MFA-001 on success/cancel.
Metering: n/a
Notes: Notification email to user on disable is not optional — it's a security email.

### SHR-MFA-007 — Step-up authentication prompt

Purpose: A sensitive action (change plan, disable 2FA, view credit history, PA credit grant, etc.) requires re-proving identity via password or TOTP.
Route: modal (via `StepUpProvider`) — no dedicated route   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/components/auth/StepUpModal.tsx`. Needs RTL + mobile pass.
Workflow role: n/a (used across many workflows as gate)
Key components: Context banner ("You're about to <action>. Please re-verify your identity."), method-picker tabs (Password / TOTP / Backup code), input, Verify button, Cancel button.
Primary actions: Verify → resume the calling action with an elevated session token; Cancel → return to the calling screen with no action taken.
State variants: loading, error, rate-limited, expired-elevation (already elevated — pass through).
Entry from: Any screen invoking `useStepUp()`.
Exit to: Calling screen (with elevated context) or Cancel.
Metering: n/a
Notes: Elevation duration is short (60s default). Modal must be dismissable via ESC + backdrop tap. Never persist the elevated token in localStorage.

---

## 3. SHR-NAV — Global navigation & shell

### SHR-NAV-001 — Post-auth landing router

Purpose: Deterministically route the just-signed-in user to their persona's home.
Route: `/` (redirect logic)   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: EXISTS — App.tsx `/` → `/dashboard` redirect. Needs persona-aware routing.
Workflow role: n/a
Key components: n/a (no UI — briefly a splash while routing decision runs)
Primary actions: Auto-route: PA → `/admin/fin`, Agency owner/admin → `/agency`, Agent → `/dashboard`, unverified → SHR-AUT-006 completion step.
State variants: loading (default: brand splash 200ms).
Entry from: Any post-sign-in success.
Exit to: `AGT-DSH-001`, `AGN-DSH-001`, `PA-FIN-001`, etc.
Metering: n/a
Notes: Router must survive slow /me responses (skeleton splash, not blank). Persona is derived from `/api/auth/me` + `tenant-context`.

### SHR-NAV-002 — Top navigation bar (desktop) / hamburger + drawer (mobile)

Purpose: Global chrome across all authed pages.
Route: n/a (component wrapping every route)   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/components/layout/Navbar.tsx` (has mobile drawer). Needs bottom tab bar for Agent mobile per design brief.
Workflow role: n/a
Key components: Logo, primary nav links (persona-scoped), search (⌘K trigger), notification bell (unread count), user avatar menu (Profile / Settings / Sign out), language selector, dark-mode toggle. Mobile: hamburger opens drawer with same links.
Primary actions: Nav to any linked page, open notifications (SHR-NAV-004), open command palette (SHR-NAV-005), sign out.
State variants: sticky, elevated on scroll, hidden on public white-label sites (`/site/*`).
Entry from: n/a — persistent chrome.
Exit to: n/a
Metering: n/a
Notes: On Agent mobile per design brief, replace the top hamburger with a BOTTOM tab bar (5 tabs: Dashboard, Listings, Inbox, Contacts, More) and reserve top-right for language + user avatar. RTL flip mirrors the tab order.

### SHR-NAV-003 — Bottom tab bar (Agent mobile only)

Purpose: One-hand-reachable primary navigation for Agent surface on phone.
Route: n/a (component)   Persona: agent   Device: mobile 375px   Mode: both
Current state: MISSING (design brief §3.2 requirement).
Workflow role: n/a
Key components: 5 tabs (Dashboard / Listings / Inbox / Contacts / More), active-tab indicator, badge counts on Inbox + Contacts.
Primary actions: Tap tab → nav to persona home.
State variants: active, inactive, badge, badge-9+.
Entry from: n/a — persistent chrome on Agent surface at mobile breakpoint only.
Exit to: n/a
Metering: n/a
Notes: iOS safe-area-inset-bottom must be respected. Tab labels must be short enough to fit at 360px (test all 5 tabs Arabic + English). "More" tab opens a sheet with Campaigns / Templates / Pricing / Analytics / Settings / Sign out.

### SHR-NAV-004 — Notification center

Purpose: See recent in-app notifications, mark as read, jump to source.
Route: drawer from SHR-NAV-002 / SHR-NAV-003, or `/notifications`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — `web/src/pages/NotificationPreferencesPage.tsx` is prefs only; a notification CENTER (list of recent notifications) may or may not exist.
Workflow role: Various — receives WF-* recipient events.
Key components: List of notifications grouped by day, unread indicator, filter (all / unread / by type), Mark All Read, gear icon → SHR-NAV-004b.
Primary actions: Tap notification → deep-link to source screen (approval outcome, new lead, comment, etc.). Mark read. Settings → SHR-NAV-004b.
State variants: loading, empty ("You're all caught up"), error, offline (cached).
Entry from: SHR-NAV-002 bell, SHR-NAV-003 "More" tab.
Exit to: Various source screens per notification type.
Metering: n/a
Notes: The `POST /api/notifications/:id/retry` action needs a retry affordance for failed sends. Copy per notification type is centralized (i18n key per type).

### SHR-NAV-004b — Notification preferences

Purpose: Per-channel per-event opt-in matrix.
Route: `/notification-preferences`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/NotificationPreferencesPage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Table of event types × channels (Email / Push / SMS / WhatsApp / In-app), checkbox per cell, master toggles per row and column, Save button, "Reset to defaults" link. Billing prefs are a subsection (`GET/PUT /api/billing/notifications/preferences`).
Primary actions: Toggle any cell → autosave debounced. Reset.
State variants: loading, error, save-success toast, per-channel unavailable (e.g., WhatsApp column disabled if user has no linked number).
Entry from: SHR-NAV-004 gear, SHR-SET-001 (settings home).
Exit to: SHR-NAV-004, SHR-SET-001.
Metering: n/a
Notes: Explain each event type in plain language (tooltip on hover / info icon on mobile).

### SHR-NAV-005 — Command palette (⌘K)

Purpose: Fast keyboard-driven navigation & search across the whole app.
Route: overlay from any screen (⌘K / Ctrl+K)   Persona: shared (authed)   Device: desktop + tablet (not mobile)   Mode: pro (auto-available in Guided but not surfaced)
Current state: MISSING (not required by design brief, but proposed for Pro-mode density).
Workflow role: n/a
Key components: Search input, categorized results (Pages / Listings / Contacts / Recent), keyboard shortcuts help.
Primary actions: Type → search → Enter → nav. ESC to close.
State variants: loading (as-you-type), empty ("Try …"), error.
Entry from: ⌘K from any authed screen.
Exit to: Selected result's screen.
Metering: n/a
Notes: Not on the critical path — build after Guided/Pro modes ship.

### SHR-NAV-006 — Language selector

Purpose: Switch between English and Arabic (RTL flip on select).
Route: dropdown in SHR-NAV-002   Persona: shared (any)   Device: responsive   Mode: n/a
Current state: MISSING (design brief §3.5 first-class RTL requirement).
Workflow role: n/a
Key components: Two options (English / العربية), current language indicated, per-user persisted, per-device persisted for anon.
Primary actions: Select → whole app re-renders in new locale + direction.
State variants: n/a
Entry from: SHR-NAV-002 (top navbar), SHR-AUT-006 (register wizard), SHR-AUT-001 (login header).
Exit to: n/a — refresh in place.
Metering: n/a
Notes: Language selection must survive sign-in/out. Anon language stored in localStorage. Signed-in language stored server-side.

### SHR-NAV-008 — Tenant switcher (CORRECTED 2026-09-04 — was missing from first pass)

Purpose: Every user in code always has a personal tenant AND may belong to one or more agency tenants; the switcher lets them select which tenant context they're currently operating in. Every subsequent action (create listing, view inbox, run report) is scoped to the selected tenant.
Route: dropdown in SHR-NAV-002 (top nav) + first item under SHR-NAV-003 "More" tab on mobile   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING — the code has the multi-tenant model (`migration 028`, `identity.js :: createAgentAccount`) but no UI to switch contexts. Every existing page implicitly renders in "personal" tenant only.
Workflow role: n/a
Key components: Current-tenant chip (shows tenant name + affiliation_mode badge: `personal` / `exclusive at Agency X` / `non_exclusive at Agency X`), dropdown listing every membership the user has (personal always first, agencies grouped), each row shows role badge (owner/admin/member/guest), keyboard shortcut hint `⌘K` opens a filtered version if the list is > 5.
Primary actions: Select a tenant → whole app re-renders scoped to that tenant; the URL persists `?tenant=<id>` so deep-links preserve context; server enforces on every API call.
State variants: single-tenant user (renders as static chip, no dropdown), permission-denied per tenant, tenant suspended (row disabled with reason tooltip), tenant deleted (auto-removed).
Entry from: SHR-NAV-002, SHR-NAV-003 More tab.
Exit to: n/a — soft-refreshes the current route in the new tenant context.
Metering: n/a
Notes: Switching tenants MUST update the JWT elevation state — an elevated session on personal tenant does NOT stay elevated when switching to agency. Also updates `x-tenant-id` header on all outbound API calls. Default landing on sign-in: last-used tenant (persisted per-user), else personal.

### SHR-NAV-007 — Theme (dark/light) toggle

Purpose: Switch between light, dark, and system-auto theme.
Route: dropdown in SHR-NAV-002 user menu   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — no toggle audited; design brief §6.1 requires dark mode.
Workflow role: n/a
Key components: Three options (Light / Dark / System), current indicated.
Primary actions: Select → CSS class swap + persist.
State variants: n/a
Entry from: SHR-NAV-002.
Exit to: n/a
Metering: n/a
Notes: Respect `prefers-color-scheme` for "System". PA surface should default to Dark.

---

## 4. SHR-ERR — Error & edge-case screens

### SHR-ERR-001 — 404 Not Found

Purpose: Requested URL doesn't exist.
Route: `*` catch-all   Persona: shared   Device: responsive   Mode: n/a
Current state: PARTIAL — App.tsx redirects `*` to `/dashboard`; no proper 404 page. Should be a real screen.
Workflow role: n/a
Key components: Friendly copy, illustration, primary CTA "Go home", secondary "Search" (opens SHR-NAV-005), report-broken-link link.
Primary actions: Home → SHR-NAV-001. Search → SHR-NAV-005.
State variants: n/a
Entry from: Any unmatched URL.
Exit to: SHR-NAV-001, SHR-NAV-005.
Metering: n/a
Notes: Do NOT expose whether the URL would exist if authed. Redirect logic must not leak resource IDs.

### SHR-ERR-002 — 403 / Permission denied

Purpose: User is authed but not entitled to this resource.
Route: overlay/inline on any protected route   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — `FinAdminGate` renders a "Platform admin required" card for non-admins on `/admin/fin/*`. Need to generalize.
Workflow role: n/a
Key components: Icon, "You don't have access to this page" copy, contextual explanation ("This is for platform admins" / "Only your agency owner can see this"), primary CTA "Go home", secondary "Request access" (opens support / owner-notify flow if applicable).
Primary actions: Home. Request access (creates notification to appropriate party).
State variants: n/a
Entry from: Any protected screen when auth guard fails.
Exit to: SHR-NAV-001.
Metering: n/a
Notes: Never enumerate what the resource IS; only that access is denied.

### SHR-ERR-003 — 500 / Something went wrong

Purpose: Unhandled server error surfaced by the ErrorBoundary.
Route: overlay from ErrorBoundary   Persona: shared   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/components/ErrorBoundary.tsx`. Needs friendlier copy and a "Report" affordance.
Workflow role: n/a
Key components: Illustration, plain-language "Something broke on our end", Try Again button, Report Issue button, Go Home button.
Primary actions: Try Again (retries current render), Report (sends error digest to server), Home.
State variants: n/a
Entry from: React error boundary catches an unhandled exception.
Exit to: SHR-NAV-001 or retry.
Metering: n/a
Notes: NEVER show stack traces to users. Send them to server with a correlation ID user can quote in support.

### SHR-ERR-004 — Offline (Capacitor)

Purpose: The wrapper detected no network; show what's cached and what isn't.
Route: overlay on any screen when navigator.onLine === false   Persona: shared (agent primary target)   Device: mobile (Capacitor)   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Persistent banner "You're offline — some features are unavailable", cached data displayed with "as of HH:MM" timestamp, disabled write actions with tooltip.
Primary actions: Retry Connection.
State variants: partial-offline (some endpoints cached, others not).
Entry from: OS-level connectivity change.
Exit to: n/a (banner dismisses when back online).
Metering: n/a
Notes: Focus in the Agent surface only. Capacitor is not deployed on Agency/PA.

### SHR-ERR-005 — Maintenance / degraded

Purpose: Backend health check returned "degraded"; explain to users what's slow/broken.
Route: banner atop any screen   Persona: shared   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Dismissable banner ("Publishing to Instagram is currently slow; other features are fine"), status page link.
Primary actions: Dismiss, Learn More (opens status page).
State variants: n/a
Entry from: `/api/health` or a dedicated `/api/status` endpoint polled every 60s.
Exit to: n/a
Metering: n/a
Notes: Do NOT block the whole app on partial degradation; only warn.

### SHR-ERR-006 — Rate-limited

Purpose: User hit a rate limit (auth attempts, OTP requests, credit-grant attempts, etc.).
Route: inline on the triggering screen   Persona: shared   Device: responsive   Mode: n/a
Current state: PARTIAL — likely handled ad-hoc; needs consistent component.
Workflow role: n/a
Key components: Icon, "You've done this too many times — try again in <countdown>", contextual next-best-action.
Primary actions: Wait (auto-updates). Contextual alternative (e.g., "Reset password instead" from a failed sign-in rate-limit).
State variants: n/a
Entry from: Any 429 response.
Exit to: n/a — user retries the calling screen.
Metering: n/a
Notes: Explicit countdown, not "later". Reset must be observable.

---

## 5. SHR-LEG — Legal & informational pages

### SHR-LEG-001 — Terms of Service

Purpose: Static legal content.
Route: `/terms`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/TermsPage.tsx`. Content needs legal review. Needs RTL variant + Arabic translation.
Workflow role: n/a
Key components: Body content (Markdown-authored), TOC sidebar (desktop), "Last updated" date, Print/PDF button, language toggle.
Primary actions: Read; Print/PDF; nav to Privacy.
State variants: n/a
Entry from: Public landing, SHR-AUT-006 wizard consent, footer link.
Exit to: SHR-LEG-002, SHR-NAV-001.
Metering: n/a
Notes: The Refund Policy and any Paddle-required policy pages must also exist here — likely SHR-LEG-003 (Refund) and SHR-LEG-004 (Cookie / Data Processing).

### SHR-LEG-002 — Privacy Policy

Purpose: Same shape as SHR-LEG-001, different content.
Route: `/privacy`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/PrivacyPage.tsx`. Content needs legal review. Needs RTL + Arabic.
Workflow role: n/a
Key components: Same as SHR-LEG-001.
Primary actions: Same.
State variants: n/a
Entry from: Public landing, SHR-AUT-006 wizard consent, footer link.
Exit to: SHR-LEG-001, SHR-NAV-001.
Metering: n/a
Notes: Must call out GDPR + KSA PDPL + UAE DP Law compliance since MENA is primary market.

### SHR-LEG-003 — Refund Policy

Purpose: Static legal content, required by Paddle onboarding.
Route: `/refunds`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Same shape.
Primary actions: Read; contact link.
State variants: n/a
Entry from: Marketing website (once built), footer, checkout.
Exit to: SHR-LEG-001, contact.
Metering: n/a
Notes: Content authoring is out of scope for this matrix; design accommodates whatever legal produces.

### SHR-LEG-004 — Cookie / Data Processing Notice

Purpose: Consent banner + full notice page for GDPR/CCPA compliance.
Route: banner (persistent until dismissed) + `/cookies` page   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Banner: "We use cookies …" + Accept / Reject / Manage. Page: full notice, category toggles, Save Preferences.
Primary actions: Accept / Reject / Manage (banner). Save (page).
State variants: n/a
Entry from: Every anonymous public page load.
Exit to: n/a — banner dismisses.
Metering: n/a
Notes: Default posture MUST be reject (per GDPR). Store preference in cookie + server-side per user post-signup.

---

## 6. SHR-PUB — Public read-only pages (indexed)

These pages are reachable without auth and represent public property of a listing, agent, agency, or area.

### SHR-PUB-001 — Public listing view

Purpose: A prospective buyer/renter sees a property listing shared publicly.
Route: `/listings/:id`   Persona: shared (public → agent if authed)   Device: responsive (mobile primary)   Mode: n/a
Current state: EXISTS — `web/src/pages/ListingProfilePage.tsx`. Needs RTL + mobile pass + SEO metadata review.
Workflow role: n/a (but is the target of publish workflows across all social channels)
Key components: Photo/video gallery, hero (price, beds/baths, area with unit), description, amenities grid, map snippet, agent card (→ SHR-PUB-002), inquiry form (→ WF-03 initiator for lead-capture), share buttons, "Similar listings", area intelligence teaser (→ SHR-PUB-004).
Primary actions: Send Inquiry (→ posts to `POST /api/inquiries` → WF-03), Call agent, WhatsApp agent, Share, Save (authed only).
State variants: loading, sold/rented (badge overlay), removed (404-ish "This listing is no longer available"), permission-denied (private listing).
Entry from: Search engines, social media links, direct URL, in-app share.
Exit to: SHR-PUB-002 (agent), SHR-PUB-004 (area), SHR-PUB-005 (agency site).
Metering: `POST /api/properties/:id/events` (view telemetry).
Notes: OG meta tags for each social channel. Schema.org RealEstateListing markup for SEO. Hreflang alternates en / ar.

### SHR-PUB-002 — Public agent profile

Purpose: A prospect sees an agent's public profile with their listings + reviews.
Route: `/agent/:id`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/AgentProfilePage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Agent photo, name, agency badge, contact block, bio, active listings grid, closed-transactions list (public opt-in), reviews section (→ leave a review), follow button.
Primary actions: Contact (call / WhatsApp / message), Follow (authed only), Leave a review (authed only).
State variants: loading, empty listings, inactive agent (subdued).
Entry from: Search, listing agent card, social links.
Exit to: SHR-PUB-001, review submit modal.
Metering: n/a
Notes: Agents can toggle what's public in settings. Never expose personal phone unless agent explicitly opted in.

### SHR-PUB-003 — Public agency profile

Purpose: A prospect sees an agency's public profile with their listings + team.
Route: `/public/agency/:id`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/PublicAgencyPage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Agency logo, name, description, contact block, team grid (agent cards → SHR-PUB-002), listings grid, "Apply to join this agency" CTA (→ WF-02 initiator).
Primary actions: Contact, Apply to join agency (SHR-AUT-006 with agency preselected).
State variants: loading, empty, inactive agency.
Entry from: Search, agency directory.
Exit to: SHR-AUT-006 (with agency), SHR-PUB-001, SHR-PUB-002.
Metering: n/a
Notes: Same public/private toggles as agent profile.

### SHR-PUB-004 — Public area profile

Purpose: A prospect explores a neighborhood — area intelligence view (walkability, schools, amenities, price trends).
Route: `/areas/:slug`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/AreaProfilePage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Area map (large), scoring gauges (from `components/area-intelligence`), amenities near-by, listings in area (grid → SHR-PUB-001), price trend chart, comparison button (→ area comparison view).
Primary actions: Compare (→ area compare), See listings, Signal an issue (report an inaccuracy).
State variants: loading, area-not-scored-yet, empty listings.
Entry from: Search, listing area link.
Exit to: SHR-PUB-001, area comparison, report modal.
Metering: n/a
Notes: Google Maps embed subject to `GET /api/admin/google-usage` budget; fall back to static map on quota hit.

### SHR-PUB-005 — Public white-label site (agency)

Purpose: An agency's branded standalone public site on their own subdomain.
Route: `/site/:subdomain`   Persona: shared (public)   Device: responsive (mobile-first)   Mode: n/a
Current state: EXISTS — `web/src/pages/PublicWhiteLabelSitePage.tsx`. Navbar/Footer hidden per audit. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Fully customized branding (agency-controlled), featured listings grid, agents grid, inquiry form, agency contact.
Primary actions: Send inquiry, browse listings, contact agents.
State variants: loading, site-not-found (404), maintenance.
Entry from: Custom domain.
Exit to: SHR-PUB-005b, SHR-PUB-002.
Metering: n/a
Notes: Server-side rendered if possible for SEO. Analytics beacon `POST /white-label/analytics`.

### SHR-PUB-005b — Public white-label property detail

Purpose: A listing shown under an agency's branded site (same content as SHR-PUB-001 but agency-themed).
Route: `/site/:subdomain/property/:propertyId`   Persona: shared (public)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/PublicWhiteLabelPropertyPage.tsx`.
Workflow role: n/a
Key components: Same as SHR-PUB-001 but agency-themed shell.
Primary actions: Same.
State variants: Same.
Entry from: SHR-PUB-005.
Exit to: SHR-PUB-005.
Metering: `POST /api/properties/:id/events`.
Notes: Same OG/Schema.org considerations.

### SHR-PUB-006 — Public landing / marketing home

Purpose: The wingcaster.com root: pitch, sign-in CTA, register CTA.
Route: `/`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: MISSING — this is the marketing website prerequisite for Paddle onboarding.
Workflow role: n/a
Key components: Hero (pitch, screenshot), features, pricing (→ SHR-PUB-007), testimonials, FAQ, footer with legal.
Primary actions: Sign up (→ SHR-AUT-006), Sign in (→ SHR-AUT-001), Contact.
State variants: n/a
Entry from: Root URL, search engines.
Exit to: SHR-AUT-006, SHR-AUT-001.
Metering: n/a
Notes: Owned by marketing workstream, but must exist for Paddle merchant approval. Design accommodates copy + imagery TBD.

### SHR-PUB-007 — Public pricing

Purpose: Show the tiered subscription options publicly.
Route: `/pricing`   Persona: shared (anon)   Device: responsive   Mode: n/a
Current state: MISSING (`/plans` is the authed tenant view; a public pricing page is separate).
Workflow role: n/a
Key components: Tier comparison cards, per-region currency toggle, FAQ, Sign up CTA.
Primary actions: Sign up (→ SHR-AUT-006 with plan preselected).
State variants: loading pricing from Paddle PricePreview (once integrated).
Entry from: Marketing landing.
Exit to: SHR-AUT-006.
Metering: n/a
Notes: Uses Paddle PricePreview for country-localized pricing. Free tier prominent as entry point.

---

## 7. SHR-SET — Cross-persona settings shell

Persona-specific settings (Agent lead routing, Agency team, PA feature flags) live in their own matrices. This section covers the settings SHELL that hosts them.

### SHR-SET-001 — Settings home

Purpose: Grid/list of every settings area available to the current user.
Route: `/settings`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING — the app has per-area settings pages but no unified home; each page is reached by direct URL only.
Workflow role: n/a
Key components: Cards grouped by category (Account, Security, Notifications, Channels, Billing, Integrations, Advanced). Persona-scoped: PA sees Configuration; Agency owner sees Team + Roles; every user sees Account + Security + Notifications.
Primary actions: Tap any card → area.
State variants: loading (skeletons), permission-denied (per-card).
Entry from: SHR-NAV-002 user menu.
Exit to: Any persona-specific settings page.
Metering: n/a
Notes: Empty settings home = show only the categories the user has any access to.

### SHR-SET-002 — Account (profile)

Purpose: Manage own name, avatar, email, phone, primary language.
Route: `/settings/account`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: PARTIAL — audit didn't find a dedicated account page (`PUT /api/auth/me` exists on backend). May be embedded elsewhere; needs a dedicated page.
Workflow role: n/a
Key components: Avatar (upload/remove), name, primary email (change requires OTP → SHR-AUT-002b), phone (change requires OTP), language, timezone, sign-in method summary, danger zone (delete account).
Primary actions: Save; Change email (→ OTP flow); Change phone (→ OTP flow); Delete account (→ SHR-SET-005 destructive flow with step-up).
State variants: loading, error, save-success toast.
Entry from: SHR-SET-001, SHR-NAV-002.
Exit to: SHR-SET-001.
Metering: n/a
Notes: Delete account triggers GDPR erasure pipeline (`credits/erasure.js` etc.). Requires step-up + typed confirmation.

### SHR-SET-003 — Billing notification preferences

Purpose: Sub-page of SHR-NAV-004b specifically for billing events (invoice sent, payment failed, subscription renewal, credit low, credit exhausted).
Route: `/settings/notifications/billing`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING dedicated page (`GET/PUT /api/billing/notifications/preferences` exists in backend).
Workflow role: n/a
Key components: Same shape as SHR-NAV-004b but scoped to billing events.
Primary actions: Toggle; Save.
State variants: loading, error.
Entry from: SHR-NAV-004b, SHR-SET-001.
Exit to: SHR-NAV-004b.
Metering: n/a
Notes: Merge with SHR-NAV-004b as a section rather than separate page — decide during implementation. Kept separate here because backend has a dedicated endpoint.

### SHR-SET-004 — Sessions & devices

Purpose: See where you're signed in and revoke sessions.
Route: `/settings/sessions`   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING (backend session revocation via `bumpTokenVersion` on password change; UI missing).
Workflow role: n/a
Key components: List of sessions (device, last-active, IP, location), current-session badge, Revoke button per row, Revoke All Other Sessions button (requires step-up).
Primary actions: Revoke one, Revoke all others.
State variants: loading, empty (unlikely — you're always in one), error.
Entry from: SHR-SET-001, SHR-MFA-001.
Exit to: SHR-SET-001.
Metering: n/a
Notes: A "sign out everywhere on password change" toggle here is standard hygiene.

### SHR-SET-005 — Delete account — Confirm intent (CORRECTED 2026-09-04 per user feedback)

Purpose: Step 1 of a 4-screen 3-factor destructive workflow (liveness word → email → TOTP → scheduled). Full spec in `docs/design/briefs/SHR-SET-005-delete-account-brief.md`.
Route: modal from SHR-SET-002   Persona: shared (authed)   Device: responsive   Mode: n/a
Current state: MISSING (feature entirely absent from code).
Workflow role: WF-16 role=Initiator (3-factor self-deletion).
Key components: Warning banner (amber, not red), impact list (deleted at cool-down end / kept for legal / effective now), unique regenerable random word (liveness check — regenerates every attempt), typed confirmation, reason picker, Continue button.
Primary actions: Continue → SHR-SET-005b (waits for email confirmation).
State variants: idle / word-incorrect / blocked-agency-owner / blocked-past-due / submitting / error.
Entry from: SHR-SET-002.
Exit to: SHR-SET-005b.
Metering: n/a
Notes: Full copy + layout + component palette in the brief. Agency owner cannot delete if members remain — nudge to AGN-SET-005 (ownership transfer).

### SHR-SET-005b — Delete account — Check your email

Purpose: Second factor. User must click the link in their email within 15 min to prove they control the address.
Route: `/settings/account/delete/check-email` OR replace-state from SHR-SET-005   Persona: shared (authed but half-way through destructive flow)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-16 role=Composition-wait.
Key components: Masked email display, countdown pill (link expires in mm:ss), Resend button (60s cool-down), Change email link, Cancel deletion button.
Primary actions: Cancel deletion (aborts whole flow, no penalty); wait / Resend.
State variants: waiting / expired / resent.
Entry from: SHR-SET-005.
Exit to: SHR-SET-005c (via email link, in same or new browser).
Metering: n/a
Notes: Also polls — if user clicks email link in same browser, auto-advances.

### SHR-SET-005c — Delete account — Verify with TOTP

Purpose: Third factor. Email-linked TOTP challenge — proves identity via authenticator app or backup code.
Route: `/account-recovery/complete?token=…` variant for deletion path OR `/settings/account/delete/verify?token=…`   Persona: shared (email-token authed)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-16 role=Approval detail (self-second-factor).
Key components: 3-of-4 progress dots, 6-digit TOTP input, "Use a backup code instead" link, Verify button, Cancel deletion (still available).
Primary actions: Verify → schedules deletion for +30 days, signs out all sessions.
State variants: idle / verifying / wrong-code / expired / locked (too many wrong).
Entry from: Email link from SHR-SET-005b.
Exit to: SHR-SET-005d.
Metering: n/a
Notes: If user has no TOTP enrolled, this screen renders as a password re-prompt instead. Locking (too many wrong) cancels the entire deletion request and sends a security-alert email.

### SHR-SET-005d — Delete account — Scheduled

Purpose: Confirms the 30-day cool-down and explains how to cancel it.
Route: `/settings/account/delete/scheduled`   Persona: shared (authed on return)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-16 role=Recipient / Action outcome.
Key components: Hourglass illustration, "will be deleted on {longDate}" headline, cancel-any-time card with Cancel Deletion button, what-to-expect collapsible, contact support link.
Primary actions: Cancel Deletion (undoes at any time before deletion runs); Contact support.
State variants: just-scheduled / approaching (< 7 days) / imminent (< 24h).
Entry from: SHR-SET-005c.
Exit to: SHR-NAV-001 with persistent cool-down banner across all pages.
Metering: n/a
Notes: Cool-down is cancellable at any time. Sign-in during cool-down shows the cancel banner every page.

---

## 7B. SHR-INT — Real Estate Bazaar integration surfaces (WingCaster side)

Added 2026-09-04 per user clarification. Real Estate Bazaar is a SEPARATE consumer marketplace product (Property Finder / Zillow space). These are the WingCaster-side screens that manage the integration boundary. The `properties.marketplace_syndicated` boolean (default `true`, from migration 003) is the schema anchor.

### SHR-INT-001 — Bazaar syndication opt-in (per-listing + tenant default)

Purpose: An agent/agency controls which of their listings appear on Real Estate Bazaar's consumer marketplace.
Route: embedded control in AGT-LST-005 (edit) + AGT-SET-001 (tenant default) + AGN-SET-002 (agency default)   Persona: any authed with listing write access   Device: responsive   Mode: both
Current state: PARTIAL — `properties.marketplace_syndicated` boolean exists; no UI toggle audited.
Workflow role: n/a
Key components: Toggle "Publish this listing on Real Estate Bazaar" (default from tenant setting), Info tooltip explaining what Bazaar is + link, Info about lead attribution.
Primary actions: Toggle → immediate propagation to Bazaar's ingest pipeline.
State variants: loading (persisting), error, blocked (listing missing required Bazaar fields — surface which).
Entry from: AGT-LST-005 sidebar, tenant/agency settings pages.
Exit to: same page.
Metering: n/a
Notes: Server enforces `marketplace_syndicated=false` by dropping/hiding the listing from Bazaar's next sync. Any inbound inquiry from Bazaar carries `source=bazaar` and lands in the unified inbox.

### SHR-INT-002 — Bazaar performance in analytics

Purpose: See how many views + leads Bazaar drove for this listing / this agent / this agency.
Route: analytics tabs on AGT-LST-006, AGN-REP-002, AGT-DSH-001 attention cards   Persona: any authed with read access   Device: responsive   Mode: both
Current state: MISSING dedicated surface.
Workflow role: n/a
Key components: Bazaar as a source column/row in per-channel breakdown, click-through rate + inquiry rate, comparison against social + portal channels, drill to individual Bazaar-sourced inquiries.
Primary actions: Filter; drill.
State variants: loading, empty (no Bazaar syndication yet — nudge to SHR-INT-001), error.
Entry from: AGT-LST-006, AGN-REP-002.
Exit to: AGT-INB-001 filtered to `source=bazaar`.
Metering: n/a
Notes: Bazaar-side attribution requires the outbound sync to include a tracking token; inbound inquiry parses it. Publish-to-lead ROI computable where token present.

---

## 8. SHR-SEO — SEO / feed / robots (server-rendered, no page)

These are text/XML responses, not "screens" in the visual sense, but they need design of the shape/content:

- `GET /api/sitemap.xml` — sitemap of public listings + agents + agencies + areas + white-label sites. Content: `<url><loc><lastmod>`.
- `GET /api/robots.txt` — allow/disallow rules per environment. Content: standard robots directives; block staging.
- `GET /api/feed/properties.xml` — RSS-shaped property feed for aggregators.

Not enumerated as screens. Referenced here for completeness; owned by the SEO/marketing workstream.

---

## Summary — this document

| Domain | Screen count | EXISTS | PARTIAL | MISSING |
|---|---|---|---|---|
| SHR-AUT | 9 | 5 | 2 | 2 |
| SHR-MFA | 7 | 1 | 2 | 4 |
| SHR-NAV | 7 | 2 | 2 | 3 |
| SHR-ERR | 6 | 1 | 3 | 2 |
| SHR-LEG | 4 | 2 | 0 | 2 |
| SHR-PUB | 7 (+ 1 sub) | 6 | 0 | 2 |
| SHR-SET | 5 | 0 | 1 | 4 |
| **Total** | **46** | **17** | **10** | **19** |

**Highest-impact gaps** in Shared:
1. SHR-NAV-003 (Agent bottom tab bar) — foundational for mobile-first Agent UX
2. SHR-NAV-006 (Language selector) — foundational for Arabic RTL
3. SHR-NAV-007 (Theme toggle) — required by design brief §6.1
4. SHR-PUB-006 / SHR-PUB-007 (marketing landing + pricing) — blockers for Paddle
5. SHR-LEG-003 / SHR-LEG-004 (Refund + Cookie) — blockers for Paddle
6. SHR-SET-004 (Sessions/devices) — enterprise-grade security expectation
7. SHR-MFA-005 (Backup codes viewer) — enterprise-grade 2FA UX
