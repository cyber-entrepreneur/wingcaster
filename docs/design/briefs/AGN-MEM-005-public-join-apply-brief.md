# Screen Brief — AGN-MEM-005 · Public join / apply to an agency

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` entry `AGN-MEM-005`. Wave 1 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §6 Week 1 — the WF-02 initiator in the deadlock-resolution cluster (paired with AGN-MEM-002, AGN-MEM-002b, AGT-REC-004). Unblocks SHR-AUT-006 registration path (b) "Agent joining an existing agency."

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts:**
- Screen title ("Apply to join {AgencyName}"): `font: var(--lc-type-heading-1)` — IBM Plex Sans 600 26/32. Agency-name span emphasized with `--lc-text-heading`.
- Agency identity card (logo + name + one-line description + meta strip): `<Card>` primitive with `--lc-surface-raised` + `--lc-elevation-sm`, radius `var(--lc-radius-lg)`. Logo well is a `--lc-radius-md` square, 64×64 mobile / 88×88 desktop.
- Agency meta chips (size, primary market, active listings count, founded year): `<Badge>` with `--lc-surface-sunken` fill + `--lc-text-secondary` ink; each numeric value wrapped in `<Numeric>`.
- Agency-owner note callout (if provided): quoted block with `border-left: 3px solid var(--lc-action-primary)`, `--lc-surface-sunken` background, `var(--lc-type-body-lg)` italic body, and a small attribution line ("— {OwnerName}, Owner") in `var(--lc-type-caption)` + `--lc-text-muted`.
- Section headings ("About the agency" / "Your application"): `var(--lc-type-heading-3)`.
- Field labels: `var(--lc-type-overline)` — always visible, never placeholder-only.
- Text inputs + textarea: `--lc-border-strong`, radius `var(--lc-radius-md)`, focus applies the two-tone Broadcast ring automatically.
- Portfolio URL input: monospace-adjacent, uses `var(--lc-type-body)` (not `--lc-type-data` — it is a URL string, not a numeric).
- "Current listings count" input: numeric field — wrap value display in `<Numeric>`, use `inputMode="numeric"`.
- Consent checkboxes: `<Checkbox>` primitive; link chips (Terms / Privacy / Agency's own policy if present) use `--lc-text-brand` ink.
- Primary CTA "Submit application": `--lc-action-primary` fill, hover DARKENS to `--lc-action-primary-hover`. Full-width on mobile, right-aligned inline with a secondary "Cancel" ghost button on desktop.
- Success confirmation panel: replace the form area with a `--lc-status-published-bg` tint band, `--lc-status-published-fg` ink, and the ● glyph next to "Application sent." Never signal by color alone.
- "Agency not accepting applications" empty state: `--lc-status-closed-bg` tint + ◆ glyph + label; secondary CTA "Browse other agencies →" in `--lc-action-secondary`.
- "Invitation expired" and "Already applied" panels: `--lc-status-archived-bg` + ▢ glyph + label + inline recovery link.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-MEM-005 |
| Screen name | Apply to join agency |
| Persona | Public / anonymous (also renders for signed-in agents — the persona detection swaps the identity handshake block for a compact "Applying as {you}" chip) |
| Device targets | Mobile 375px (primary — agencies commonly share the link over WhatsApp), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory; Arabic mirrors are `[TRANSLATION-PENDING]` |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/agencies/:agencySlug/apply` (public agency profile → apply button) · `/join/:invitationCode` (invitation-code path — pre-fills agency + skips discovery) |
| Query params | `?ref=<attribution>` (bazaar, olx, direct, whatsapp, …) captured to `application.referrer` |
| Current state | MISSING dedicated page. Backend has legacy `POST /api/agencies/apply` (see §Backend contract) — anonymous body-only form. This brief supersedes with the slug-in-URL + invitation-code + signed-in variants. |
| Workflow role | WF-02 (Join agency) Initiator — applicant-side |
| Backend prerequisites | ⚠️ Route rename `/api/agencies/apply` → `/api/agencies/:slug/applications` · ⚠️ Invitation-code lookup + expiry check (new — see `[BE-BLOCKER-06]` in §Backend contract) · ⚠️ `agency.accepting_applications` flag on agency record (new — currently unchecked) · ✅ `agency_applications` table exists · ✅ Duplicate-application 409 exists |

---

## Purpose

A prospective agent lands on this page from ONE of three entry paths:

1. **Public agency profile → "Apply to join this agency" button** (SHR-PUB-003 → this screen). Agency is identified by slug in URL.
2. **SHR-AUT-006 signup path (b)** — after picking "Agent joining an existing agency" and either typing a slug or picking from the "browse agencies" list. Signup routes here with the slug in the URL and the just-created session already active.
3. **Direct invitation link** (`/join/:invitationCode`) shared by the agency owner via WhatsApp / email / SMS. The invitation code encodes both agency identity and an expiry; agency block is pre-rendered without a discovery step.

The screen presents:
- **The agency's identity block** — logo, name, one-line description, size (member count), primary market, active-listings count, founded year — so the applicant knows exactly who they are applying to.
- **An optional note from the agency owner** — free text captured on the agency's public-profile settings (AGN-SET-001) if provided.
- **A short application form** — message to the agency, availability (start date), current listings count, portfolio URL, source-of-referral chip (auto-filled from `?ref` param).
- **Consent + submit** — Terms of Service + Privacy Policy checkbox, plus a "share my profile info with this agency" checkbox that governs how much of the applicant's WingCaster profile the agency owner can see in AGN-MEM-002b.

Success outcome: application row inserted into `agency_applications` with `status='pending'`, applicant redirected to AGT-REC-004 (application outcome — pending state) with the application UUID in the URL. The agency owner receives the row in the AGN-MEM-002 queue. When they act on it (AGN-MEM-002b), the applicant sees the result at AGT-REC-004.

---

## Design goals

1. **Applicant confidence in one glance.** The agency identity block is the first thing rendered — logo, name, size, market, active listings count — so the applicant is never left wondering "is this the right agency." No hero panel, no marketing rotation; this is a decision surface, not a landing page.
2. **Zero-friction on invitation-code path.** Invitation-code URL skips agency discovery entirely: agency block pre-rendered above the fold, form pre-focused on the message field. A first-time applicant reaching this via WhatsApp should be able to submit in under 60 seconds on a mobile keyboard.
3. **Honest about what happens next.** No fake urgency ("apply now, only 3 spots!"), no vague "we'll be in touch." Explicit copy: "Applications typically get a response within 2 business days. You'll be notified by email + in-app when the agency reviews your application." Anti-dark-pattern.
4. **Applicant does NOT need to sign up to preview.** The form renders and validates for anonymous visitors, but submission requires an identity — either an existing session, or an inline "quick account" collapsible that captures email + password (a compact SHR-AUT-006 subset). Prevents anonymous spam applications while not gating discovery.
5. **RTL Arabic first-class.** Whole layout mirrors; agency logo well and identity block remain readable; identifier inputs (email, phone, URL) stay LTR even in Arabic context.
6. **Failure states are actionable, not dead-ends.** "Agency not accepting applications" → "Browse other agencies →". "Invitation expired" → "Request a new invitation from the agency →" (mailto or contact chip). "Already applied" → "See your application status →" (deep-link to AGT-REC-004).

---

## Layout

### Desktop / tablet ≥768px

Single-column centered layout, `max-width: 720px`, generous top spacing (`--lc-space-4xl`). Not a two-column split — this is not a marketing page; the agency identity block IS the visual anchor.

**Top bar (persistent):**
- Left: WingCaster wordmark → links to `/`.
- Right: language selector (SHR-NAV-006 embedded) + persona-aware chip:
  - If anonymous: "Already have an account? **Sign in**" text link.
  - If signed in: `<Avatar>` + "Applying as {DisplayName}" + tiny "Not you? Sign out" link.

**Section 1 — Agency identity card (top of scroll):**
- Layout: horizontal flex on desktop (logo left, content right), stacked on tablet.
- Logo well: 88×88 square, `--lc-surface-sunken` fallback background, `--lc-radius-md`. Fallback: agency-name monogram in `var(--lc-type-heading-1)` if logo missing.
- Content column:
  - Agency name (`var(--lc-type-heading-1)`).
  - One-line description (`var(--lc-type-body-lg)` + `--lc-text-secondary`) — truncates at 140 chars with tooltip on hover for the full string.
  - Meta strip (chips, wraps to a second row on tablet): "Team of {N} agents" · "{PrimaryMarket}" · "{ActiveListings} active listings" · "Since {FoundedYear}". Each numeric value wrapped in `<Numeric>`.
- Right-edge secondary action: `<Button variant="ghost" size="sm">` "View agency profile →" — opens SHR-PUB-003 in a new tab. Not present on mobile (moves to a text link under the meta strip).

**Section 2 — Owner note (conditional, only if agency populated it):**
- Rendered directly under the identity card with `--lc-space-lg` gap.
- Left border 3px `--lc-action-primary`, `--lc-surface-sunken` background, `var(--lc-radius-md)` on the right three corners.
- Body: `var(--lc-type-body-lg)` italic, 3-line clamp with "Read more" toggle if longer.
- Attribution line: `var(--lc-type-caption)` + `--lc-text-muted` — "— {OwnerFirstName} {OwnerLastInitial}., Owner".

**Section 3 — Application form:**
- Section heading "Your application" (`var(--lc-type-heading-3)`) with `--lc-space-2xl` top spacing.
- Anonymous-only inline collapsible: "Sign in or continue as guest" — expands to show a 3-field compact form (email + password + name) matching the SHR-AUT-006 identity handshake but scoped to signup-in-place. Signed-in users skip this entirely and see a `--lc-surface-sunken` chip "Applying as {DisplayName} · {MaskedEmail}".
- Fields (all `<Label>` above `<Input>` / `<Textarea>`):
  1. **Message to the agency** (`<Textarea>`, 4 rows, `maxLength=500` with character counter). Placeholder guidance under label: "Tell them why you'd like to join — what you specialize in, where you sell most, and what you're looking for in an agency."
  2. **Current listings count** (`<Input type="number" inputMode="numeric" min=0 max=500>`). Small helper: "Approximate is fine."
  3. **Portfolio URL** (`<Input type="url">`, optional). Placeholder: "https://…" — e.g. link to Instagram, personal site, or Bazaar profile.
  4. **When can you start?** (`<RadioGroup>` inline, 4 options): "Immediately" · "Within 2 weeks" · "Within a month" · "Just exploring".
  5. **Where did you hear about {AgencyName}?** (`<Select>`, optional, auto-filled from `?ref` param when present, options: "WingCaster Bazaar" · "OLX" · "Property Finder" · "Instagram" · "Referral from a friend" · "Direct link" · "Other"). Auto-filled values are read-only chips with a small "Change" text link.
- Consent block (below fields, `--lc-space-xl` top spacing):
  1. **Required** — `<Checkbox>` "I agree to WingCaster's [Terms of Service] and [Privacy Policy]." (Signed-in users still see this if they haven't previously accepted the current terms revision.)
  2. **Required** — `<Checkbox>` "I consent to sharing my WingCaster profile (name, contact, existing listings) with {AgencyName} for the purpose of this application." Helper below: "The agency sees only what they need to review your application. They can't act on your account."
- CTA row (right-aligned on desktop, full-width stacked on mobile):
  - Secondary: `<Button variant="ghost">` "Cancel" → `history.back()` if referrer present, else `/`.
  - Primary: `<Button variant="default" size="lg">` "Submit application →". Disabled until form valid + both consents ticked.

**Bottom — trust / expectation footer:**
- `var(--lc-type-caption)` + `--lc-text-muted`:
  - "Applications typically get a response within 2 business days."
  - "You'll be notified by email and in the WingCaster app."
  - "{AgencyName} may contact you directly to schedule a call."

### Mobile ≤767px

Same single-column, but:
- Sticky top bar collapses to wordmark + language selector only; persona chip moves under the H1 as a small `--lc-surface-sunken` band.
- Agency identity card stacks: 64×64 logo top-left, name+description below, meta strip full-width chips wrapping onto 2-3 rows.
- Owner-note callout keeps full width.
- Form fields are full-width, `--lc-space-md` vertical rhythm.
- CTAs stack: primary "Submit application" full-width first (thumb-reachable), secondary "Cancel" full-width ghost below.
- Trust footer wraps to 3 lines.

### Invitation-code variant (`/join/:invitationCode`)

Identical to slug variant, with these differences above the fold:
- No agency-discovery friction — agency block is server-rendered before the form.
- A small `<Badge>` above the agency name: "Invited by {OwnerFirstName}" using the `--lc-accent` teal signal with `--lc-accent-bold-edge` boundary.
- Expiry note in `var(--lc-type-caption)` + `--lc-text-muted` under the meta strip: "This invitation expires on {ExpiryDate}."
- "Where did you hear about {AgencyName}?" field is pre-filled to "Direct invitation" and hidden (submitted invisibly).

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title (browser tab) | Apply to join {AgencyName} · WingCaster |
| H1 (persona chip context) | Apply to join **{AgencyName}** |
| Persona chip — anonymous | Already have an account? **Sign in** |
| Persona chip — signed in | Applying as **{DisplayName}** · Not you? [Sign out] |
| Agency card — meta chip: team | Team of {N} agents |
| Agency card — meta chip: market | {PrimaryMarket} |
| Agency card — meta chip: listings | {N} active listings |
| Agency card — meta chip: founded | Since {FoundedYear} |
| Agency card — secondary action | View agency profile → |
| Owner-note attribution | — {OwnerFirstName} {OwnerLastInitial}., Owner |
| Owner-note truncation toggle | Read more / Read less |
| Section heading | Your application |
| Anonymous collapsible header | Sign in or continue as guest |
| Guest-account name label | Your name |
| Guest-account email label | Your email |
| Guest-account password label | Choose a password |
| Field label — message | Message to the agency |
| Field helper — message | Tell them why you'd like to join — what you specialize in, where you sell most, and what you're looking for in an agency. |
| Field placeholder — message | I've been selling residential in Dubai Marina for 3 years… |
| Field counter | {N} / 500 |
| Field label — current listings | How many active listings do you have today? |
| Field helper — current listings | Approximate is fine. |
| Field label — portfolio URL | Portfolio or profile link (optional) |
| Field placeholder — portfolio | https://instagram.com/your.handle |
| Field label — availability | When can you start? |
| Field option — immediately | Immediately |
| Field option — 2 weeks | Within 2 weeks |
| Field option — month | Within a month |
| Field option — exploring | Just exploring |
| Field label — referral source | Where did you hear about {AgencyName}? |
| Field placeholder — referral | Select a source (optional) |
| Referral options | WingCaster Bazaar · OLX · Property Finder · Instagram · Referral from a friend · Direct link · Other |
| Consent — Terms | I agree to WingCaster's [Terms of Service] and [Privacy Policy]. |
| Consent — profile share | I consent to sharing my WingCaster profile (name, contact, existing listings) with {AgencyName} for the purpose of this application. |
| Consent — profile share helper | The agency sees only what they need to review your application. They can't act on your account. |
| Primary CTA | Submit application → |
| Primary CTA — submitting | Sending your application… |
| Secondary CTA | Cancel |
| Trust footer line 1 | Applications typically get a response within 2 business days. |
| Trust footer line 2 | You'll be notified by email and in the WingCaster app. |
| Trust footer line 3 | {AgencyName} may contact you directly to schedule a call. |
| Success panel heading | Application sent to {AgencyName} |
| Success panel body | {OwnerFirstName} and the team will review your application. You'll hear back within 2 business days. |
| Success panel primary CTA | Track your application → |
| Success panel secondary | Browse other agencies |
| Empty state — not accepting heading | {AgencyName} isn't accepting new applications right now |
| Empty state — not accepting body | The agency has paused new applications. You can still explore other agencies on WingCaster. |
| Empty state — not accepting CTA | Browse other agencies → |
| Empty state — invitation expired heading | This invitation has expired |
| Empty state — invitation expired body | Invitation links from {AgencyName} expire after {N} days. Ask the agency owner to send you a new link, or apply directly. |
| Empty state — invitation expired CTA (primary) | Apply directly to {AgencyName} → |
| Empty state — invitation expired CTA (secondary) | Contact the agency |
| Empty state — already applied heading | You've already applied to {AgencyName} |
| Empty state — already applied body | Your application is currently **{Status}**. You'll be notified when there's an update. |
| Empty state — already applied CTA | See your application status → |
| Error toast — server | Something went wrong sending your application. Please try again. |
| Error toast — offline | You're offline. Reconnect to send your application. |
| Error toast — session lost (post-guest-signup) | Your session expired mid-signup. Please try again. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Agency identity card | `<Card>` with slotted `<CardHeader>` + `<CardContent>` |
| Agency logo well | `<Avatar>` with `AvatarImage` + `AvatarFallback` (monogram) |
| Meta chips | `<Badge variant="secondary">` |
| Owner-note callout | Custom `<blockquote>` styled with left-border + `--lc-surface-sunken` |
| Section heading | Plain `<h2>` with `--lc-type-heading-3` |
| Anonymous collapsible | `<Collapsible>` from Radix, chevron on the right, `ChevronDown` / `ChevronUp` from lucide-react |
| Guest-account fields | `<Input>` + `<Label>` per field |
| Message textarea | `<Textarea>` with `maxLength={500}` and character-counter span below-right |
| Numeric input | `<Input type="number" inputMode="numeric">` |
| URL input | `<Input type="url">` |
| Availability radio | `<RadioGroup>` + `<RadioGroupItem>` — horizontal on desktop, vertical stack on mobile |
| Referral select | `<Select>` (Radix), auto-fill chip variant uses `<Badge>` + "Change" ghost link |
| Consent checkboxes | `<Checkbox>` + `<Label>` |
| Primary CTA | `<Button variant="default" size="lg">` |
| Loading state | `<Button disabled>` + `Loader2` icon spinning |
| Secondary CTA | `<Button variant="ghost">` |
| Success panel | `<Card>` with `--lc-status-published-bg` background + `CircleCheck` icon + `<Numeric>` for application UUID last-6 chars |
| Empty-state panels | Custom `<div>` composition per §Broadcast alignment |
| Persona chip | `<Badge>` (anon) OR `<Avatar>` + label (signed in) |
| Language selector | Embedded `SHR-NAV-006` component |
| Error toast | `Sonner` toast (destructive variant) — bottom-center |
| Icons | `Building2` (logo fallback context) · `MapPin` (market) · `Users` (team size) · `List` (active listings) · `Calendar` (founded) · `ChevronDown/Up` (collapsible) · `CircleCheck` (success) · `CircleX` (already-applied error tone) · `Clock` (expired) · `ExternalLink` (view profile) |

---

## Sample content (for v0 / mockup)

For the first v0 pass render the desktop slug-URL variant with an authenticated agent, using this concrete data:

- **URL:** `/agencies/elite-real-estate/apply?ref=bazaar`
- **Persona chip:** signed-in — Avatar with initials "SA", "Applying as **Sara Almansoori** · Not you? Sign out"
- **Agency identity card:**
  - Logo: placeholder image slot 88×88, `Building2` icon fallback shown
  - Name: **Elite Real Estate**
  - Description: "MENA's specialist brokerage for premium residential + off-plan. Dubai · Riyadh · Cairo."
  - Meta chips: "Team of **24** agents" · "**UAE**" · "**312** active listings" · "Since **2011**"
  - Secondary action: "View agency profile →" (top-right, ghost)
- **Owner note (populated):**
  > "We're looking for closers who care about long-term client relationships. If you've sold in Dubai Marina, JBR, or Downtown, we'd love to hear from you."
  > — Rashid A., Owner
- **Form (filled sample):**
  - Message: "I've been selling residential in Dubai Marina for 3 years and want to move to a brokerage with a stronger off-plan pipeline. Currently at 8 listings, closing 2-3/month." (233 / 500)
  - Current listings: `8`
  - Portfolio URL: `https://instagram.com/sara.dxb.realestate`
  - When can you start: "Within 2 weeks" (selected)
  - Referral source: "WingCaster Bazaar" (auto-filled from `?ref=bazaar`, shown as chip with "Change" link)
- **Consent:** both boxes ticked
- **Primary CTA:** enabled, hover state
- **Trust footer:** all three lines visible

---

## Interactions

**On page load (slug variant):**
- Server fetches `GET /api/agencies/:slug/public` for identity card + owner note. If 404 → redirect to `/agencies` browse index with a toast "That agency link isn't valid."
- If agency exists but `accepting_applications=false` → render the "not accepting" empty state (skip form).
- If a signed-in user already has a pending application to this agency → render the "already applied" empty state.

**On page load (invitation-code variant):**
- Server fetches `GET /api/invitations/:code`. If expired → "invitation expired" empty state. If revoked → "invitation expired" body swap to "This invitation has been revoked by the agency owner."
- If valid → pre-render agency block + hide referral source field + pin "Invited by {OwnerFirstName}" badge above H1.

**On anonymous-collapsible toggle:**
- `<Collapsible>` 200ms height transition (`--lc-easing-out`).
- Expanded state auto-focuses the "Your name" input.
- Guest fields validate on blur (email format, password strength ≥ Fair per SHR-AUT-006 rule).

**On message-textarea input:**
- Character counter updates on every keystroke.
- When 480-500 chars: counter switches to `--lc-text-brand` ink.
- Above 500: input is truncated by the `maxLength` attribute (no destructive over-type).

**On availability radio select:**
- Selection is instant; no submit until CTA.

**On referral-source select:**
- If auto-filled from `?ref` param: rendered as read-only chip; "Change" text link swaps in the `<Select>` inline.
- If unset: standard dropdown.

**On consent-checkbox tick:**
- Continue enables only when both required consents ticked AND all required form fields valid.

**On Submit click:**
- Client-side validation runs first. Invalid fields get `aria-invalid=true` + inline error under the input.
- If anonymous with the guest-account collapsible open: POST to `/api/auth/register` (SHR-AUT-006 contract, `path=solo`) first; on success, chain into the application POST using the returned session.
- POST `/api/agencies/:slug/applications` with body per §Backend contract.
- Button state: `Loader2` spinner + "Sending your application…" — form disabled.
- On 201 success: form area fades out (`--lc-duration-base`), success panel fades in with `CircleCheck` icon and the application UUID last-6 chars (`<Numeric>`) shown small under the heading.
- On 409 already-applied: swap to "already applied" empty state with the existing application's status.
- On 409 agency-not-accepting (race — flag flipped between load and submit): swap to "not accepting" empty state.
- On 400 validation: inline field errors, form re-enables.
- On 401 (session lost after guest signup): destructive toast, re-open the guest-signup collapsible.
- On 500 / network: destructive toast, form re-enables.

**On success-panel "Track your application →":**
- Redirect to `/applications/:applicationId` (AGT-REC-004 in pending state).

**On success-panel "Browse other agencies":**
- Redirect to `/agencies` (SHR-PUB-003 index).

**On "not accepting" / "invitation expired" / "already applied" CTAs:**
- "Browse other agencies →" → `/agencies`.
- "Apply directly to {AgencyName} →" (expired invitation only) → same route with slug in URL, invitation-code path stripped.
- "Contact the agency" → mailto link if `agency.public_email` set; otherwise opens a small dialog with the agency's public phone/WhatsApp chip.
- "See your application status →" → `/applications/:applicationId`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading — page** | Server fetch in flight | Skeleton for agency card + form-shape skeleton for the form area. No layout shift when data arrives. |
| **Initial (anonymous)** | Page load, no session | Persona chip shows "Sign in". Anonymous collapsible present but collapsed by default. Form fields render but disabled until collapsible expands OR user clicks Sign in. Submit disabled. |
| **Initial (signed-in)** | Page load, valid session | Persona chip shows "Applying as {name}". Anonymous collapsible not rendered. Form fields enabled. Submit disabled until valid + consents ticked. |
| **Invitation pre-fill** | `/join/:code` valid | Agency card server-rendered. "Invited by" badge visible. Referral field hidden. Form pre-focused on message textarea. |
| **Form invalid** | Any required field fails validation | Continue disabled. No destructive toast until user clicks — passive disabled state. |
| **Consents not ticked** | Either required checkbox unticked | Continue disabled. Small helper next to each unticked checkbox: "Required." |
| **Submitting** | POST in flight | Submit shows `Loader2` + "Sending your application…". Whole form disabled. Cancel remains enabled (aborts the request via AbortController + re-enables the form). |
| **Success** | 201 response | Form area cross-fades to success panel (`--lc-status-published-bg`, ● glyph, "Application sent to {AgencyName}"). Shows application UUID last-6 chars in `<Numeric>`. Redirect countdown NOT used — user clicks "Track your application →" themselves. |
| **Duplicate application (already applied)** | 409 on submit OR detected on page load | Full-page empty state with ▢ glyph on `--lc-status-archived-bg`. Body shows the existing application's status inline ("pending" / "under review" / "on hold"). Primary CTA "See your application status →". |
| **Agency not accepting applications** | `accepting_applications=false` on load OR 409 race on submit | Full-page empty state with ◆ glyph on `--lc-status-closed-bg`. Body explains agency has paused new applications. Primary CTA "Browse other agencies →". |
| **Invitation expired** | Invitation-code route, code expired or revoked | Full-page empty state with ▢ glyph on `--lc-status-archived-bg`. Body explains expiry + how to get a new invitation. Primary CTA "Apply directly to {AgencyName} →" (routes to slug variant), secondary "Contact the agency". |
| **Agency not found (slug 404)** | Slug does not resolve | Redirect to `/agencies` with toast "That agency link isn't valid." (Do not render this screen with a null agency.) |
| **Validation error (server)** | 400 with field errors | Inline errors per field returned. Continue re-enables. Never surface `agency_id` or internal field names — map to human-facing labels. |
| **Server error** | 500 | Destructive `Sonner` toast: "Something went wrong sending your application. Please try again." Continue re-enables. |
| **Offline** | `navigator.onLine === false` OR fetch fails with network error | Top-of-form banner: "You're offline. Reconnect to send your application." Submit disabled. |
| **Session lost mid-signup** | 401 after guest-signup chain | Destructive toast + re-open the guest collapsible with fields preserved. |
| **RTL** | Locale = ar | Whole layout mirrors. Identifier inputs (email, phone, URL) stay LTR. Agency logo well and meta chips mirror position; icons within chips flip (MapPin, Users, List, Calendar). |
| **Dark mode** | `prefers-color-scheme: dark` | All tokens swap; owner-note callout background darkens; success panel keeps the ● glyph contrast; empty-state status tints swap per Broadcast dark values. |
| **Signed-in — has other tenant** | User is signed in AND owns / is member of another agency | Small info banner above the form: "You're currently a member of {OtherAgencyName}. Applying here does not remove you from that agency." Never blocks — WingCaster supports multi-tenant identity. |

---

## Accessibility

- Every form control has a visible `<label>` (not just placeholder text). Labels use `htmlFor`.
- Agency identity card is a landmark (`role="region"` + `aria-label="Agency you are applying to"`).
- Owner-note callout uses `<blockquote>` + `<cite>` for the attribution — semantic, screen-reader-friendly.
- Tab order flows: language selector → sign-in / sign-out link → view profile → collapsible toggle (if present) → guest fields (if expanded) → message → current listings → portfolio URL → availability radios → referral select → Terms consent → profile-share consent → Cancel → Submit.
- Focus rings visible on every interactive element (two-tone Broadcast focus ring; do not override).
- Character counter announces via `aria-live="polite"` on 25-char thresholds (not per-keystroke — over-noisy).
- Radio-group availability is a single tab stop; arrow keys navigate between options; Space/Enter selects.
- Error messages tied to inputs via `aria-describedby`.
- Empty-state panels announce their heading first (`role="status"` for success; `role="alert"` for error tones like "not accepting" / "invitation expired") so screen-reader users hear the outcome before the CTAs.
- Skip-to-content link at top of page (jumps past top bar into the agency identity card).
- Every tap target ≥ 44×44 CSS pixels — including the "Change" text link on the auto-filled referral chip.
- No color-only status differentiation — every status panel pairs tint + glyph + label per Broadcast rule.
- Owner-note "Read more" toggle managed via `aria-expanded`.

---

## Anti-patterns (do not do these)

- ❌ Do not present a hero-panel + marketing-rotation right column. This is a decision surface, not a landing page. Agency identity IS the visual anchor.
- ❌ Do not fabricate agency size / listings / market data if the agency row is incomplete. Missing fields render as "—" or the chip is omitted entirely; never invent a plausible number.
- ❌ Do not show fake urgency ("Only 3 spots left!" / "Apply in the next 24 hours!"). Agencies don't have "spots" in the WingCaster model.
- ❌ Do not require the applicant to have applied to zero other agencies. Applicants may apply to multiple agencies in parallel; treat each application independently.
- ❌ Do not silently sign the user up on submit without an explicit anonymous collapsible. Consent to account creation is separate from consent to apply.
- ❌ Do not send the agency's private contact details (owner email, owner phone) to the applicant on this screen. Only the agency's public profile info + optional public_email/public_whatsapp shown via the "Contact the agency" CTA on failure states.
- ❌ Do not leak whether the "already applied" 409 is per-email vs per-user_id vs per-phone. The error message is identifier-agnostic: "You've already applied to {AgencyName}."
- ❌ Do not auto-redirect on success. Show the confirmation panel and let the user click through. Auto-redirect on a form submission is a dark-pattern remnant.
- ❌ Do not gate the form behind sign-in. Anonymous applicants must be able to fill the form and read the trust footer before deciding to submit (and thus sign up).
- ❌ Do not use `<input type="tel">` for the current listings count. It is a number. Use `type="number" inputMode="numeric"`.
- ❌ Do not size the agency logo well as a circle. Broadcast uses tight radii (`var(--lc-radius-md)` — 5px). Round avatars belong to person entities, not brand marks.
- ❌ Do not include agency-owner-choice fields ("preferred contact method", "salary expectations") on this initiator. Those belong on AGN-MEM-002b during agency-side review.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **AngelList / Wellfound apply-to-startup page** — the single-column identity-card-above-form pattern is directly analogous.
- **Y Combinator batch application** — clean "message to the founders" textarea with character counter + trust footer explaining response timelines.
- **Vercel "join team" invitation link** — the pre-filled identity block + minimal friction on the invitation-code path.
- **Stripe Connect onboarding page** — the way a third-party brand is rendered at the top of a WingCaster-branded form (chrome hierarchy right).
- **LinkedIn "Easy Apply"** — persona chip pattern for signed-in users, plus the guest-account collapsible inline.

Do NOT match:
- Indeed job apply flow (too many required fields, feels bureaucratic).
- Greenhouse ATS candidate portal (marketing hero on top is wrong for this decision surface).
- Any dark-pattern SaaS trial signup (fake urgency, hidden fields, forced marketing consent).

---

## Backend contract

**Primary endpoint (public agency profile / SHR-AUT-006 path b entry):**
`POST /api/agencies/:slug/applications`

**Request body:**
```json
{
  "message": "I've been selling residential in Dubai Marina…",
  "current_listings_count": 8,
  "portfolio_url": "https://instagram.com/sara.dxb.realestate",
  "availability": "within_2_weeks",
  "referral_source": "bazaar",
  "consents": {
    "terms": true,
    "profile_share": true
  },
  "guest_signup": null,
  "locale": "en"
}
```

If the applicant is anonymous and used the guest-collapsible, `guest_signup` carries the SHR-AUT-006 `identity` sub-object (`{type, identifier, credentials, recovery}`) and the server must:
1. First call the register handler (identical semantics to `POST /api/auth/register` with `path=solo`).
2. Then create the application under the newly-created session.
3. Return the combined session + application in the response.

**Invitation-code endpoint:**
`POST /api/invitations/:code/accept`

**Request body:** identical to the slug endpoint. Server resolves the agency + auto-fills `referral_source="direct_invitation"` + records `invitation_code` on the application row.

**Response 201:**
```json
{
  "application": {
    "id": "uuid",
    "agency_id": "uuid",
    "agency_name": "Elite Real Estate",
    "status": "pending",
    "created_at": "2026-09-07T10:23:11Z",
    "expected_response_by": "2026-09-09T10:23:11Z"
  },
  "session": {
    "token": "...",
    "expires_at": "..."
  },
  "redirect_to": "/applications/:id"
}
```

**Response 409 `ALREADY_APPLIED`:**
```json
{
  "error": "ALREADY_APPLIED",
  "existing_application_id": "uuid",
  "existing_status": "pending",
  "message": "You've already applied to this agency."
}
```

**Response 409 `AGENCY_NOT_ACCEPTING`:**
```json
{
  "error": "AGENCY_NOT_ACCEPTING",
  "message": "This agency isn't accepting new applications right now."
}
```

**Response 410 `INVITATION_EXPIRED`** (invitation-code endpoint only):
```json
{
  "error": "INVITATION_EXPIRED",
  "expired_at": "2026-09-01T00:00:00Z",
  "fallback_slug": "elite-real-estate",
  "message": "This invitation has expired."
}
```

**Response 400 `VALIDATION_FAILED`:**
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "message": "required",
    "portfolio_url": "invalid_format",
    "guest_signup.identifier": "invalid_email"
  }
}
```

### Backend prerequisites (must land before this brief's PR)

**Existing today** (`backend/src/server.js` L7152):
- Route: `POST /api/agencies/apply` with body `{agency_id, agent_email, agent_name, agent_phone, message}`.
- Table: `agency_applications` with `{id, agency_id, agent_email, agent_name, agent_phone, message, status='pending', created_at}`.
- Duplicate check: 409 if pending row exists for the same agency + agent_email.

**Required changes (new backend blockers to file in kickoff §5a):**

- **`[BE-BLOCKER-06]` — Application route + schema uplift.** Rename `POST /api/agencies/apply` → `POST /api/agencies/:slug/applications`; add slug → agency resolution; add columns `applicant_user_id` (nullable — for guest applicants that didn't sign up), `current_listings_count`, `portfolio_url`, `availability` enum, `referral_source`, `profile_share_consent`, `invitation_code` (nullable), `expected_response_by`; retire `agent_email` / `agent_name` / `agent_phone` columns as first-class (derive from `applicant_user_id` join instead — keep as denormalized cache columns for legacy queries during the migration window). Est. 1 day (route + schema + backfill + test).
- **`[BE-BLOCKER-07]` — Agency invitation code table + endpoints.** New table `agency_invitations {id, agency_id, code, created_by_user_id, created_at, expires_at, revoked_at, max_uses, use_count}`. New routes: `GET /api/invitations/:code` (resolve + expiry check) and `POST /api/invitations/:code/accept`. Wired to AGN-MEM-003 (invite member) so the same table serves email-invite and shareable-link flows. Est. 2 days.
- **`[BE-BLOCKER-08]` — `agencies.accepting_applications` boolean column + admin toggle.** New nullable boolean on `agencies` (default true). Exposed on `GET /api/agencies/:slug/public` + on `AGN-SET-001` for owner control. Est. 0.5 day.

Without these, this screen can only render a degraded variant against the legacy `POST /api/agencies/apply` route (anonymous submissions only, no invitation-code path, no accepting-flag gate). Ship the UI degraded IF the Week-1 backend slot can't accommodate all three — but the invitation-code path and the "not accepting" empty state MUST NOT be shown as working when backend is stubbed. Flag those states as `PENDING BACKEND` in the mockup review.

---

## Downstream implementation (Cursor prompt handoff notes)

- **New file to create:** `web/src/pages/AgencyApplyPage.tsx` (route `/agencies/:agencySlug/apply`) + `web/src/pages/AgencyInvitationAcceptPage.tsx` (route `/join/:invitationCode`). Both compose a shared `<AgencyApplicationForm>` component.
- **Route wiring:** update `web/src/App.tsx` — add both routes. Support query params: `?ref=<attribution>` on both, `?intent=agency` when arriving from SHR-AUT-006 path (b) (used only for downstream analytics — no visible UI difference).
- **Component decomposition:**
  - `<AgencyIdentityCard>` — logo, name, description, meta chips, view-profile action. Also used on SHR-PUB-003 and AGN-DSH-001 attention cards (extract to `web/src/components/agency/`).
  - `<OwnerNoteCallout>` — blockquote with attribution + read-more toggle.
  - `<GuestSignupCollapsible>` — a compact 3-field subset of SHR-AUT-006's `<IdentityForm>`; internally delegates to the same identity handshake helper.
  - `<AgencyApplicationForm>` — the message + numeric + URL + availability + referral + consents + Submit surface.
  - `<PersonaChip>` — the top-bar chip that swaps between "Sign in" (anon) and "Applying as {name}" (signed in). Reusable across other public-facing screens.
  - `<ApplicationSuccessPanel>` — cross-fade destination for 201 responses.
  - `<AgencyEmptyState>` — the three empty-state panels (`variant="not-accepting" | "invitation-expired" | "already-applied"`).
- **API client extension:** `web/src/api/client.ts` — add:
  - `getAgencyPublic(slug: string)` → `GET /api/agencies/:slug/public`.
  - `resolveInvitation(code: string)` → `GET /api/invitations/:code`.
  - `applyToAgency(slug, body)` → `POST /api/agencies/:slug/applications` (replaces legacy `applyToAgency(agencyId, data)` — schedule the legacy signature for removal in the same PR after grepping call sites; today only used by one legacy component).
  - `acceptInvitation(code, body)` → `POST /api/invitations/:code/accept`.
- **Test discipline:**
  - Unit: each of `<AgencyIdentityCard>`, `<GuestSignupCollapsible>`, `<AgencyApplicationForm>`, `<PersonaChip>`, `<ApplicationSuccessPanel>`, `<AgencyEmptyState>` renders + state transitions.
  - Integration: full flow for {anon + guest signup} × {slug URL, invitation URL} × {success, 409 already-applied, 409 not-accepting, 410 expired, 400 validation, 500}.
  - RTL: at least one Arabic mirror flow via `screens.rtl.test.tsx`.
  - Real-Postgres: verifies that a signed-in submission inserts a row with `applicant_user_id` populated + `guest_signup=null`; a guest submission inserts a `users` row then an `agency_applications` row atomically in the same transaction.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green. All colors via `--lc-*` semantics.
- **Redirect targets:** confirm AGT-REC-004 route exists (`/applications/:applicationId`); if not, this PR must ship an AGT-REC-004 stub — but per Week-1 kickoff plan AGT-REC-004 lands in the same PR pair so this is coordinated.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Page background: `var(--lc-bg-page)`. Agency identity card + owner-note callout + form area sit on `var(--lc-surface-raised)` inside a max-width container.
- Agency identity card: `var(--lc-radius-lg)` corners; `--lc-elevation-sm`; header padding `var(--lc-space-xl)` on desktop, `var(--lc-space-lg)` on mobile.
- Agency logo well: `var(--lc-radius-md)` — NEVER circular; monogram fallback uses `var(--lc-type-heading-1)` + `--lc-text-heading`.
- Owner-note callout: `border-left: 3px solid var(--lc-action-primary)`; background `var(--lc-surface-sunken)`; radius `var(--lc-radius-md)` on the right corners only (left corners follow the border); body `var(--lc-type-body-lg)` italic + `--lc-text-primary`; attribution `var(--lc-type-caption)` + `--lc-text-muted`.
- Section heading "Your application": `var(--lc-type-heading-3)` + `--lc-text-heading`.
- Form field labels: `var(--lc-type-overline)` + `--lc-text-secondary`.
- Message textarea: `var(--lc-radius-md)`; border `--lc-border-strong`; focus applies two-tone ring automatically (do not override).
- Character counter: `var(--lc-type-caption)` + `--lc-text-muted`; switches to `--lc-text-brand` at 480+ chars.
- Numeric input for current-listings-count: rendered value uses `<Numeric>` wrapper — activates `--lc-font-mono` + `tabular-nums`.
- Availability `<RadioGroup>`: selected item gets `background: var(--lc-surface-selected)` + `border: 2px solid var(--lc-action-primary)`; unselected `border: 1px solid var(--lc-border)`.
- Referral auto-fill chip: `<Badge>` with `--lc-surface-sunken` fill + `--lc-text-secondary` ink + `--lc-radius-pill`; "Change" text link uses `--lc-text-brand`.
- Consent checkboxes: `<Checkbox>` primitive; link chips (Terms / Privacy) use `--lc-text-brand` ink.
- Primary CTA: `--lc-action-primary` fill; hover DARKENS to `--lc-action-primary-hover`. Never lightens. Radius `var(--lc-radius-md)`; height auto (`--lc-tap-target-min` floor).
- Secondary CTA: `<Button variant="ghost">` — text `--lc-text-secondary`, hover `--lc-surface-sunken` background.
- Success panel: `var(--lc-status-published-bg)` fill + `var(--lc-status-published-fg)` ink + ● glyph. Application UUID last-6 chars wrapped in `<Numeric>` and rendered `var(--lc-type-data-sm)`.
- "Not accepting" empty state: `var(--lc-status-closed-bg)` + ◆ glyph + label. Secondary CTA `--lc-action-secondary`.
- "Invitation expired" / "Already applied" empty states: `var(--lc-status-archived-bg)` + ▢ glyph + label.
- Persona chip (signed-in variant): `<Avatar>` uses `var(--lc-radius-pill)`; "Applying as" label `var(--lc-type-body-sm)` + `--lc-text-secondary`; display name `var(--lc-type-body-sm)` + `--lc-text-heading` + `font-weight: 600`.
- "Invited by {Owner}" badge (invitation variant): `<Badge>` with `--lc-accent` fill + `--lc-accent-bold-text` ink + `--lc-accent-bold-edge` outline (accent needs boundary per Broadcast rule).
- Trust footer: `var(--lc-type-caption)` + `--lc-text-muted`.
- Focus rings: two-tone via base CSS — do not override.
- Motion: form-area → success-panel cross-fade `var(--lc-duration-base)` ease-out; anonymous collapsible open `var(--lc-duration-slow)`; button hovers `var(--lc-duration-fast)`; NO bounce, NO spring, NO signal-lamp motif (that's reserved for the "listing went live" moment on the home page).
- Radii: identity card `var(--lc-radius-lg)`; inputs + textarea `var(--lc-radius-md)`; owner-note callout `var(--lc-radius-md)` right corners only; badges `var(--lc-radius-pill)`; buttons `var(--lc-radius-md)`.
- RTL: mirror layout, but keep email + phone + URL inputs LTR via `dir="ltr"` on the input itself even when the page is `dir="rtl"`. Icon chips (MapPin, Users, List, Calendar) flip position within the meta strip; the icons themselves do not mirror (they are direction-neutral).

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster public "apply to join an agency" screen (AGN-MEM-005) — MENA real-estate B2B SaaS. This is the WF-02 initiator: a prospective agent lands here from a public agency profile, from the signup wizard when they picked "join an agency", or from a shareable invitation link. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind. Design tokens are Broadcast (`--lc-*` semantic tokens only, never raw hex).

First pass: render the DESKTOP 1440px layout for the slug-URL variant with an authenticated agent. Show the agency identity card at top (logo well 88x88, "Elite Real Estate", description, meta chips "Team of 24 agents · UAE · 312 active listings · Since 2011", "View agency profile →" ghost link top-right). Below it, the owner-note callout with a left orange border, italic body "We're looking for closers…", attribution "— Rashid A., Owner". Then the "Your application" form with the sample data from the brief filled in (message at 233/500 chars, current listings 8, portfolio URL, "Within 2 weeks" radio selected, referral chip "WingCaster Bazaar" auto-filled with a "Change" link). Both consent checkboxes ticked. Cancel (ghost) + "Submit application →" (primary orange, hover state) right-aligned. Trust footer 3 lines below. Persona chip top-right: Avatar "SA" + "Applying as Sara Almansoori · Not you? Sign out".

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, the invitation-code variant, the anonymous+guest-signup variant, the success panel, and the three empty states (not-accepting / invitation-expired / already-applied) as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate agency data — use the sample values verbatim.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now switch to the invitation-code variant (/join/:code). Add the "Invited by Rashid" teal badge above the H1. Hide the referral source field. Add the small "This invitation expires on {date}" line under the meta strip.`
2. `Now the anonymous variant with the guest-signup collapsible EXPANDED. Show three inline fields (name / email / password) inside the collapsible; message textarea below is disabled with a helper "Sign in to submit your application."`
3. `Now mobile 375px viewport. Same signed-in slug variant as pass 1. Agency identity card stacks (64x64 logo). CTAs stack full-width (primary first, cancel below).`
4. `Now the SUCCESS panel state. Form area cross-faded out, success panel with ● glyph, "Application sent to Elite Real Estate", body copy, application UUID last-6 shown small below heading, "Track your application →" primary CTA, "Browse other agencies" secondary.`
5. `Now the three empty states (render each as its own frame): (a) "not accepting" with ◆ glyph on --lc-status-closed-bg, (b) "invitation expired" with ▢ glyph on --lc-status-archived-bg, (c) "already applied" with ▢ glyph on --lc-status-archived-bg — show a pending status inline.`
6. `Now RTL Arabic layout at desktop 1440px for the signed-in slug variant. Mirror the whole layout. Keep [TRANSLATION-PENDING] where copy has no Arabic yet. Keep email/URL inputs LTR.`
7. `Now dark mode versions of the desktop LTR pass 1 and mobile LTR pass 3.`

Save each output's JSX to `web/src/components/agency/AgencyApplyPage/` (or the mockups folder) + screenshot to `docs/design/mockups/AGN-MEM-005-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7+ iteration states (signed-in slug, invitation variant, anonymous + guest signup, mobile, success, three empty states, RTL, dark mode).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-1 dispatch prompt references this brief + AGN-MEM-002 + AGN-MEM-002b + AGT-REC-004 briefs together (single PR pair per kickoff §6 Week 1).
- [ ] `[BE-BLOCKER-06]`, `[BE-BLOCKER-07]`, `[BE-BLOCKER-08]` filed in kickoff §5a — application route uplift, invitation-code table, `accepting_applications` flag.
- [ ] Confirmed with kickoff whether Week-1 slot accommodates all three BE blockers or whether this UI ships in a degraded variant with `PENDING BACKEND` badges on the invitation-code + not-accepting states.
