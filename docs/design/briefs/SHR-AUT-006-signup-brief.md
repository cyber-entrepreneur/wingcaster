# Screen Brief — SHR-AUT-006 · Register (3 registration paths × 6 identity paths)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-AUT-006`. Wave 1 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9. Unblocks WF-02 (join agency), free-trial dedup (PR #49), and agent+agency activation funnels.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts:**
- Hero heading ("Create your WingCaster account"): `font: var(--lc-type-display)` — Archivo 800 32/38. Sub: `var(--lc-type-body-lg)` muted.
- Registration-path selector (Solo / Join agency / Register as agency): `<RadioGroup>` primitive rendered as three-column card grid on desktop, three-row card stack on mobile. Selected card border `--lc-action-primary`; unselected `--lc-border`. Selected card background tint `--lc-surface-selected`.
- OAuth provider buttons (Google / Apple / Facebook): follow each provider's OWN brand guidelines. Focus rings still `--lc-focus-ring` + `--lc-focus-ring-contrast`.
- Identifier-type tabs (Email / Username / Phone): `<Tabs>` primitive. Active-tab underline `--lc-action-primary`.
- Password field: eye toggle `Eye` / `EyeOff` from lucide-react. Strength meter uses `--lc-status-success` / `--lc-status-warning` / `--lc-status-danger` bars.
- Consent checkboxes: `<Checkbox>` primitive. Terms + Privacy links use `--lc-action-primary` ink.
- "Continue" primary CTA: `--lc-action-primary` fill. Hover `--lc-action-primary-hover` (darker).
- Trust footer ("payments processed by Paddle · your details are encrypted"): `var(--lc-type-caption)`, `--lc-text-muted`.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-AUT-006 |
| Screen name | Create account |
| Persona | Public / anonymous |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/register` (query params: `?path=solo\|join\|agency`, `?agency=<slug>`, `?plan=<tier>`) |
| Current state | PARTIAL — `web/src/pages/AgentRegisterPage.tsx` supports email+password solo-only. This brief supersedes with 3-path × 6-identity pattern. |
| Workflow role | WF-01 (Onboarding) initiator + WF-02 (Join agency) initiator when path=join |
| Backend prerequisites | ✅ Identity normalization (PR #49) · ✅ Free-trial dedup (PR #49) · ✅ Tenant creation (migration 028) · ⏳ Agency free-tier package (a migration extension is required — see §Backend contract) |

---

## Purpose

New user creates a WingCaster account. Per D9 (2026-09-04), signup supports THREE registration paths:

- **(a) Solo agent** — personal tenant only. Free-tier subscription auto-provisioned (Semsar tier if free-tier lookup available; otherwise trial-only per current pricing lock).
- **(b) Agent joining an existing agency** — personal tenant + WF-02 application to a named agency. User can either enter an agency slug/code directly or pick from a list of agencies actively accepting applications.
- **(c) Agency owner registering a new agency** — personal tenant + brand-new agency tenant with owner role auto-assigned. Requires agency name, legal entity type, primary market, and consent to platform TOS on behalf of the agency.

All three paths use the same 6 identity paths for the identity handshake:

1. **Google OAuth**
2. **Apple OAuth**
3. **Facebook OAuth**
4. **Email + password** (with email verification via Microsoft Graph transport per memory)
5. **Username + password** (with a secondary identifier — email or phone — required for recovery)
6. **Phone + password** (with SMS OTP for verification)

Success outcome: authenticated session, tenant context set, redirected to the persona's post-signup landing (solo agent → dashboard; agency-joining agent → WF-02 pending-application screen; agency owner → AGN-DSH-002 onboarding checklist).

---

## Design goals

1. **Path selection is the FIRST decision.** Users must actively pick a path before seeing identity options. Prevents the common failure mode of solo agents accidentally creating agency tenants.
2. **Free-trial abuse is prevented at UI + backend.** Per PR #49, identity normalization (NFKC + toLocaleLowerCase + E.164 phone + SHA-256 hashing) deduplicates across email + phone + username. UI surfaces the "already claimed" error humanely without leaking whether it was email, phone, or username that matched.
3. **6 identity paths without cognitive overload.** OAuth buttons visually grouped; email/username/phone unified under a tab switcher so only one identifier + password form renders at a time.
4. **Enterprise-grade trust cues.** Paddle payment attribution, encrypted-data statement, MENA-jurisdiction compliance callout (GDPR + KSA PDPL + UAE DP Law) visible without being noisy.
5. **RTL Arabic first-class.** Every visual element mirrors correctly; Arabic strings placeholder-marked; identifier inputs stay LTR even in Arabic context (phone numbers, email addresses).

---

## Layout

### Desktop / tablet ≥768px

Two-column split, 60/40:

**Left column (60%) — form area:**
- Top: WingCaster wordmark + language selector (SHR-NAV-006 embedded inline).
- H1: "Create your WingCaster account"
- Sub: "Cast listings, catch leads, close deals — one system for the whole business."
- **Step 1: Path selector.** Three cards laid out as a horizontal row (or a 3-column grid). Each card shows an icon, label, one-line description.
- **Step 2: Identity handshake** (revealed after path is picked). Shows the 3 OAuth buttons at top, "or use your account" separator, then Email/Username/Phone tab switcher + password field + consent checkboxes + Continue CTA.
- **Step 3 fields specific to path** (revealed inline when path=join or path=agency):
  - **path=join:** Agency slug/code input OR "browse agencies accepting applications" link.
  - **path=agency:** Agency name, legal entity type dropdown (LLC / Sole Prop / Free Zone Entity / Other), primary market dropdown (UAE / KSA / EG / LB / Other), consent-on-behalf-of-agency checkbox.
- Bottom: Trust footer — "Payments processed by Paddle" + "Your details are encrypted" + Paddle logo + WingCaster+MENA-compliance icon strip.
- Link: "Already have an account? Sign in →" (right-aligned above the trust footer).

**Right column (40%) — hero panel:**
- Full-height gradient background using `--lc-brand-hero-gradient` tokens.
- Central illustration or screenshot montage showing the WingCaster product (unified inbox + listing detail + WhatsApp intake preview).
- Three rotating value-prop lines beneath the illustration:
  - "Capture leads from every channel."
  - "Cast listings to every portal."
  - "Convert conversations into closings."
- Bottom of hero: Small "Trusted by MENA real-estate professionals" line with 4-5 anonymized-avatar cluster (no fabricated testimonials per user's honesty guardrail).

### Mobile ≤767px

Single column, stacked in scroll:

- Top: sticky top bar with WingCaster wordmark (left) + language selector (right).
- Hero panel collapsed to a compact top block: gradient background, illustration reduced to a single 200px hero image, one value-prop line (rotating).
- H1: "Create your account" (smaller — `var(--lc-type-display-mobile)`).
- Sub: same as desktop.
- Path selector cards: 3-row stack, each card full-width.
- Identity handshake: same as desktop (OAuth + separator + tab switcher + form).
- Path-specific fields inline.
- Trust footer at bottom.
- "Sign in" link floats above the trust footer.

### Path-selector card anatomy (all viewports)

Each of the 3 cards contains:
- **Icon** (24×24 lucide-react): Solo → `User`, Join → `Users`, Agency → `Building2`.
- **Label**: Bold, `var(--lc-type-body-lg)`.
- **Description**: One line, `var(--lc-type-body-sm)`, `--lc-text-muted`.
- **Selected indicator**: When selected, card gets `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)` + a small check icon top-right.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| H1 | Create your WingCaster account |
| Sub | Cast listings, catch leads, close deals — one system for the whole business. |
| Path selector heading | Who is signing up? |
| Path (a) — solo | **Solo agent** — I work independently. Personal workspace only. |
| Path (b) — join | **Agent joining an agency** — I want to work under an existing agency. |
| Path (c) — agency | **Agency owner** — I'm registering a new agency workspace. |
| Path helper (all paths) | You can change or add agencies later from your account. |
| OAuth divider | or use your account |
| OAuth Google | Continue with Google |
| OAuth Apple | Continue with Apple |
| OAuth Facebook | Continue with Facebook |
| Identifier tab — email | Email |
| Identifier tab — username | Username |
| Identifier tab — phone | Phone |
| Email input placeholder | you@example.com |
| Username input placeholder | your.username |
| Phone input placeholder | +971 5X XXX XXXX |
| Password input placeholder | Choose a strong password |
| Password strength labels | Weak · Fair · Strong · Excellent |
| Show password toggle | Show password / Hide password |
| Recovery email helper (username path) | We need a recovery email — required to recover your account if you lose access. |
| Recovery phone helper (username path) | Or a recovery phone — required to recover your account if you lose access. |
| Consent — Terms | I agree to the [Terms of Service] and [Privacy Policy]. |
| Consent — Marketing (optional) | Send me product updates and MENA real-estate insights. |
| Path (b) agency input label | Agency slug or invitation code |
| Path (b) agency input placeholder | e.g. elite-real-estate or a code from your agency owner |
| Path (b) browse link | Or browse agencies accepting applications → |
| Path (c) agency name label | Agency name |
| Path (c) agency name placeholder | e.g. Elite Real Estate |
| Path (c) legal entity label | Legal entity type |
| Path (c) legal entity options | LLC · Sole proprietorship · Free zone entity · Other |
| Path (c) primary market label | Primary market |
| Path (c) primary market options | UAE · KSA · Egypt · Lebanon · Other MENA |
| Path (c) consent on behalf | I am authorized to accept these terms on behalf of the agency. |
| Primary CTA | Continue → |
| Sign-in link | Already have an account? **Sign in** |
| Trust footer | Payments processed by Paddle · Your details are encrypted · GDPR / KSA PDPL / UAE DP Law compliant |
| Value prop 1 | Capture leads from every channel. |
| Value prop 2 | Cast listings to every portal. |
| Value prop 3 | Convert conversations into closings. |
| Anonymized-cluster caption | Trusted by MENA real-estate professionals |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Path selector | `RadioGroup` + `RadioGroupItem` styled as cards |
| Identity path tabs | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` |
| OAuth buttons | `Button` variant="outline" + provider SVG + provider-specific hover/active per brand guidelines |
| Divider | `Separator` with centered `<span>` overlay |
| Text inputs | `Input` |
| Password input | `Input` type="password" with `Eye` / `EyeOff` toggle button inside `InputGroup`-style wrapper |
| Password strength | Custom 4-segment bar component; segments fill left-to-right |
| Legal entity + market dropdowns | `Select` |
| Consent | `Checkbox` + label |
| Primary CTA | `Button` variant="default" size="lg" — full-width on mobile |
| Loading state | `Button disabled` + `Loader2` icon spinning |
| Error toast | `Sonner` toast (destructive variant) — appears bottom-center |
| Path-specific reveal | `Collapsible` — smooth-height transition 200ms |
| Language selector | Embedded `SHR-NAV-006` component |
| Hero illustration | `<img>` or `<Image>` — use a static PNG/WebP for now, no Lottie |

---

## Sample content (for v0 / mockup)

Show the desktop layout with:
- **Path selected:** "Solo agent" card highlighted
- **OAuth section:** three buttons rendered (Google / Apple / Facebook) with correct brand marks
- **Tabs:** "Email" tab active
- **Email input:** filled with `sara.almansoori@example.com`
- **Password input:** dots masked, strength meter showing "Strong" (3/4 segments green)
- **Show password toggle:** currently masked (Eye icon)
- **Consent:** Terms checkbox ticked; marketing checkbox unticked
- **Continue button:** enabled, hover state
- **Sign-in link:** visible at top-right of form area
- **Hero panel:** gradient background, illustration placeholder box labeled "Hero illustration — 480×640", value prop "Cast listings to every portal." showing

---

## Interactions

**On path selection:**
- Selected card gets active state instantly (no delay).
- Path-specific fields (Step 3) slide-in below Step 2 with a 200ms height transition (`Collapsible`).
- Deselecting a path collapses the Step-3 fields.
- Selecting a different path swaps the Step-3 content without collapsing/expanding.

**On OAuth click:**
- Redirects to provider's OAuth flow at `/api/auth/oauth/<provider>/start`. Handle callback at `/api/auth/oauth/<provider>/callback`.
- On return, provider callback determines whether the identity is new (proceed with signup) or existing (redirect to sign-in with a friendly toast).

**On identifier tab switch:**
- The primary identifier input swaps (email/username/phone). Password field remains.
- If path=join or path=agency, the path-specific fields stay visible below the identity form.
- If the user has typed into one tab and switches to another, preserve the value in the tab they typed into (allow flipping back without data loss).

**On Continue click:**
- Validates client-side: format of email/username/phone, password strength ≥ Fair, both consent items where required (marketing is optional; Terms is required), path-specific fields filled where visible.
- On valid: POST to `/api/auth/register` with body per §Backend contract.
- On backend rejection with `FREE_TRIAL_ALREADY_CLAIMED` (PR #49): show a modal explaining "This identifier or a related one has already claimed a free trial. If this is your account, sign in instead. If you believe this is a mistake, contact support." Sign-in CTA + support-email CTA in the modal.
- On other backend errors: destructive toast + inline form errors where applicable.
- On success: redirect per path (see §Purpose success outcome).

**On phone input:**
- Country prefix picker in the input's left affix (default to user's IP-guessed country, but manually changeable).
- Format as user types (E.164). Show canonical format on blur.

**On password input:**
- Strength meter updates on every keystroke (debounced 100ms).
- Eye toggle un-masks the value. Icon changes to EyeOff. Timeout: automatically re-mask after 10 seconds if user isn't actively typing.

**On focus of the recovery-identifier helper (username path):**
- Second input appears (email OR phone — user picks). Both may be provided; at least one required.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial** | Page load | No path selected. Path selector shown. Identity form + path-specific fields hidden. Continue button disabled. |
| **Path selected** | User picks a card | Identity form reveals. Continue disabled until identifier + password + Terms consent are valid. |
| **Path b/c revealed** | Path is join or agency | Step-3 fields render below identity form. Continue additionally requires those fields valid. |
| **OAuth-in-progress** | User clicked OAuth button | The clicked button shows Loader2; other OAuth buttons + identity form disabled during the redirect handshake. |
| **Password too weak** | Strength meter shows Weak | Inline error: "Password must be at least Fair strength." Continue disabled. |
| **Invalid identifier format** | Identifier fails regex | Inline error under the input. Continue disabled. |
| **Terms not agreed** | Terms checkbox unticked | Continue disabled. Small helper next to the checkbox: "Required." |
| **Submitting** | POST in flight | Continue shows Loader2 + "Creating account…". Entire form disabled. |
| **Backend rejection — dup identity** | 409 `FREE_TRIAL_ALREADY_CLAIMED` | Modal: "This account already has a WingCaster identity. Sign in →" |
| **Backend rejection — validation** | 400 with field errors | Inline errors per field returned. Continue re-enables. |
| **Backend rejection — server** | 500 | Destructive toast: "Something went wrong. Please try again." Continue re-enables. |
| **Success — solo** | 201, path=a | Redirect to `/onboarding/welcome` (AGT-ONB-001). |
| **Success — join** | 201, path=b | Redirect to `/join/pending` (WF-02 pending state — new screen, small; or reuse AGT-REC-004 in pending mode). |
| **Success — agency** | 201, path=c | Redirect to `/agency/onboarding` (AGN-DSH-002). |
| **Loading — page** | Route resolving | Skeleton form (path selector + identity form shape). |
| **Empty — hero image failed** | Illustration 404 | Fallback: gradient-only hero with a WingCaster logomark + text. |
| **Offline** | Network unreachable | Show a top-of-form banner: "You're offline. Reconnect to create your account." Continue disabled. |
| **RTL** | Locale = ar | Whole layout mirrors. Identifier inputs (email, phone) stay LTR. Value-prop rotation preserved. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; gradient becomes deeper; hero contrast maintained. |

---

## Accessibility

- Every form control has a visible `<label>` (not just placeholder text). Labels use `htmlFor`.
- Path-selector cards are keyboard-navigable (Left/Right arrows for horizontal, Up/Down for vertical) and Enter/Space to select.
- Tab order flows: language selector → path cards → OAuth buttons → identifier tabs → identifier input → password → toggle → consent checkboxes → path-specific fields → Continue → sign-in link.
- Focus rings visible on every interactive element (two-tone Broadcast focus ring).
- Password strength meter announces changes via `aria-live="polite"` ("Password strength: Fair").
- Error messages tied to inputs via `aria-describedby`.
- Modals (dup-identity rejection) trap focus + Escape to close + close-on-outside-click.
- Skip-to-content link at top of page (jumps past language selector into H1).
- Screen-reader announcements for path selection ("Solo agent selected") + revealed Step-3 fields ("Agency slug field revealed").
- Every tap target ≥ 44×44 CSS pixels including OAuth buttons on mobile.
- No color-only status differentiation — password strength uses labels + bar segments, not just green/red.

---

## Anti-patterns (do not do these)

- ❌ Do not render all 6 identity paths as buttons flat on the page. Cognitive overload. Group as OAuth trio + identifier-tab switcher for the credential trio.
- ❌ Do not require phone verification during signup for path (a) solo. Verify later on first sensitive action (per PR #49 minimum-friction principle). Phone is required only if the user chose the phone identifier path.
- ❌ Do not show the free-tier price or paid-tier upsell on this screen. Signup is not a sales screen — the pricing conversation happened before the user arrived here. Marketing page owns pricing.
- ❌ Do not use full-width country pickers on the phone input. Use a compact prefix picker (dropdown affix) so the phone number stays scannable.
- ❌ Do not enable the Continue button while any required field is invalid. Passive disabled state — no toast on click.
- ❌ Do not fabricate testimonials or agency logos in the hero panel. Per Kimi's honesty guardrail: anonymized avatar cluster + generic "Trusted by MENA real-estate professionals" line only, until real testimonials are collected.
- ❌ Do not show a captcha inline in the form (per WingCaster's no-captcha-for-real-users policy — rate limiting + progressive challenge on suspicious traffic instead). Backend handles it invisibly.
- ❌ Do not leak dedup dimension in the FREE_TRIAL_ALREADY_CLAIMED error message. Never tell the user "your email was matched" vs "your phone was matched" — the modal must be identifier-agnostic.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Vercel signup** — clean OAuth-trio + identifier separator pattern.
- **Linear signup** — path-selector card model (Personal / Team) is directly analogous.
- **Stripe Atlas onboarding** — legal-entity + market picker in Step 3 shows how to gracefully collect corporate data without feeling bureaucratic.
- **Notion signup** — hero-panel value-prop rotation on the right.
- **Auth0's Universal Login** — the "or use your account" divider styling.

Do NOT match:
- Slack signup (workspace-first is wrong for WingCaster — tenant is created AFTER identity for path c).
- Salesforce signup (too enterprise-heavy; overwhelming form).

---

## Backend contract

**Endpoint:** `POST /api/auth/register`

**Request body (all paths):**
```json
{
  "path": "solo" | "join" | "agency",
  "identity": {
    "type": "google" | "apple" | "facebook" | "email" | "username" | "phone",
    "identifier": "sara@example.com" | "sara.almansoori" | "+971512345678",
    "credentials": { "password": "..." } | { "oauth_token": "..." }
  },
  "recovery": {
    "email": "sara.recovery@example.com",   // required if identity.type === "username" and no phone provided
    "phone": "+971512345678"                 // required if identity.type === "username" and no email provided
  },
  "consents": {
    "terms": true,
    "marketing": false
  },
  "path_data": {
    // path=solo: empty {}
    // path=join:
    "agency_slug_or_code": "elite-real-estate",
    // path=agency:
    "agency_name": "Elite Real Estate",
    "legal_entity": "LLC",
    "primary_market": "UAE",
    "authorized_to_accept": true
  },
  "locale": "en" | "ar",
  "referrer": "..."   // optional attribution
}
```

**Response 201:**
```json
{
  "user": { "id": "...", "display_name": "...", "identifier_type": "email", "identifier_masked": "s***@example.com" },
  "tenant": { "id": "...", "name": "personal" | "Elite Real Estate", "role": "owner" | "member" | "personal" },
  "session": { "token": "...", "expires_at": "..." },
  "redirect_to": "/onboarding/welcome" | "/join/pending" | "/agency/onboarding"
}
```

**Response 409 `FREE_TRIAL_ALREADY_CLAIMED`:**
```json
{
  "error": "FREE_TRIAL_ALREADY_CLAIMED",
  "message": "This identity has already claimed a WingCaster account.",
  "help_url": "/support/duplicate-account"
}
```
No dimension leaked (never say which identifier matched — see PR #49 spec).

**Response 400 field validation:**
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "identity.identifier": "invalid_format",
    "path_data.agency_slug_or_code": "not_found"
  }
}
```

**Backend prerequisite: agency free-tier package.** Per matrix SHR-AUT-006 note, `product_packages` currently seeds only `target_audience='agent'` free-tier via migration 304. Path (c) needs a **new agency-target free-tier package seeded via migration extension** (304a or 316+). Without this, path (c) requires post-signup manual PA intervention. FIle as new backend blocker `[BE-BLOCKER-05]` in the kickoff doc.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to refactor:** `web/src/pages/AgentRegisterPage.tsx` → rename to `web/src/pages/RegisterPage.tsx` (removes the "Agent" bias in filename since path (c) is agency-owner).
- **Route:** update `web/src/App.tsx` — replace `/register` handler with `RegisterPage`. Query-param support: `?path=solo|join|agency` pre-selects a card; `?agency=<slug>` pre-fills the join input and pre-selects path=join; `?plan=<tier>` records attribution for downstream Paddle checkout.
- **Component decomposition:**
  - `PathSelector` — the three-card radio group.
  - `OAuthTrio` — the three OAuth buttons.
  - `IdentityForm` — the tab switcher + inputs + password + strength meter + consents + Continue.
  - `PathBFields` — the join-agency Step-3 (slug input + browse link).
  - `PathCFields` — the agency-owner Step-3 (name + legal entity + market + consent-on-behalf).
  - `HeroPanel` — the right-column illustration + value props (desktop) or collapsed top block (mobile).
  - `TrustFooter` — Paddle + encryption + compliance line.
- **Test discipline:**
  - Unit: each of the 6 components renders + state transitions.
  - Integration: full signup flow for each path × identity combo (18 combos — parametrize).
  - PR #49 assertions: dup-identity path shows the modal without leaking dimension.
  - Backend contract match: mock `/api/auth/register` and assert the request body shape per path.
  - Real-Postgres: at least one path (c) flow that verifies the agency tenant + free-tier package row are both created.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **RTL:** verified via `screens.rtl.test.tsx` extension with a signup RTL scenario.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Path-selector cards: unselected `border: 1px solid var(--lc-border)`; selected `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)`.
- OAuth buttons: keep provider brand colors on the button face; wrap in Broadcast `border-radius` and Broadcast `padding` per `--lc-space-*` scale.
- Divider text ("or use your account"): `var(--lc-type-body-sm)` + `--lc-text-muted`; rule `--lc-border`.
- Identifier tabs: inactive `--lc-text-muted`; active `--lc-text-strong` + `border-bottom: 2px solid var(--lc-action-primary)`.
- Password strength segments: `--lc-status-danger` (Weak) → `--lc-status-warning` (Fair) → `--lc-status-success` (Strong) → `--lc-brand-accent` (Excellent). Never rely on color alone — the label text ("Fair", "Strong", etc.) is always present.
- Continue CTA: `--lc-action-primary` fill; hover DARKENS to `--lc-action-primary-hover`. Never lightens.
- Trust footer: `var(--lc-type-caption)` + `--lc-text-muted`.
- Focus rings: two-tone via base CSS — do not override.
- Motion: path-specific reveal `200ms ease-out` height transition; button hovers `120ms`; no bounce, no spring.
- Radii: cards `var(--lc-radius-lg)`; inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster signup screen (SHR-AUT-006) — MENA real-estate B2B SaaS. Three registration paths (solo agent / agent joining agency / agency owner). Six identity paths per path (Google / Apple / Facebook / Email+password / Username+password / Phone+password). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

First pass: render the desktop 1440px layout with path=solo selected, Email identifier tab active, Google/Apple/Facebook OAuth buttons visible, password with strength meter showing "Strong", Terms consent ticked, marketing consent unticked, Continue button enabled. Hero panel on the right with gradient background + illustration placeholder + rotating value prop "Cast listings to every portal.".

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, path=join, path=agency, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate testimonials or agency logos.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now switch to path=join. Show the agency slug/code field appearing below the identity form. Sample data: user typed "elite-real-estate". Continue button enabled.`
2. `Now path=agency. Show the agency name + legal entity + primary market + consent-on-behalf fields. Sample data: "Elite Real Estate" / LLC / UAE / consent ticked.`
3. `Now mobile 375px viewport. Same path=solo state as pass 1. Hero panel collapses to top block.`
4. `Now RTL Arabic layout at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout.`
5. `Now dark mode versions of the desktop LTR and mobile LTR passes.`
6. `Now the FREE_TRIAL_ALREADY_CLAIMED modal state — modal open over the desktop LTR path=solo form.`

Save each output's JSX to `web/src/components/auth/RegisterPage/` (or the mockups folder) + screenshot to `docs/design/mockups/SHR-AUT-006-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (path=solo desktop, path=join, path=agency, mobile, RTL, dark, dup-identity modal).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief + the mockup paths.
- [ ] `[BE-BLOCKER-05]` filed in kickoff §5a — agency free-tier package migration.
