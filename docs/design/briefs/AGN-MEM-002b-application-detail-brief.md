# Screen Brief — AGN-MEM-002b · Application detail (WF-02 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** This brief references the anchor `AGN-MEM-002-applications-queue-brief.md` for its Broadcast alignment section and only spells out per-screen deltas. Read the anchor first.

Companion to `SCREEN_MATRIX_AGENCY.md` entry `AGN-MEM-002b`. Wave 1 (Week 1) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §6. Ships in the same PR pair as AGN-MEM-002 · AGN-MEM-005 · AGT-REC-004.

---

## Broadcast alignment

**Inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`** AND the full Broadcast callout block in `AGN-MEM-002-applications-queue-brief.md` §Broadcast alignment. Read that section — every token there (page shell, heading tier, status pills, focus rings, motion, radii, elevation) applies here unchanged. Deltas only below.

**Deltas from the anchor:**

- This is a single-record surface, not a table. Content lives in a two-column layout on desktop: left column (~66% width) is the applicant profile + application content; right column (~34%) is the decision panel (docked, sticky under top bar).
- Applicant name treated as page title: `font: var(--lc-type-heading-1)`. Applicant role/city meta line below in `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- Application message body: `var(--lc-type-body-lg)` (16/24 for legibility) rendered in a raised card `var(--lc-surface-raised)` with `var(--lc-elevation-sm)` and `padding: var(--lc-space-xl)`.
- Risk-signals section (only when backend returns signals): each signal is a `<Badge>` with `--lc-status-{warning,danger,info}-{bg,fg,dot}` per severity + glyph + label. Never render an empty risk panel; if 0 signals, hide the section.
- Decision panel background `var(--lc-surface-raised)` + `border: 1px solid var(--lc-border)` + `var(--lc-radius-lg)` + `var(--lc-elevation-sm)`; sticky `top: calc(var(--lc-nav-height) + var(--lc-space-xl))`.
- Approve button: `<Button size="lg" variant="default">` full-width inside the panel — `--lc-action-primary` fill, hover darker.
- Reject button: `<Button size="lg" variant="outline">` full-width below Approve — `--lc-border-strong` outline, `--lc-text-secondary` text.
- Request Info button (Phase 2 stub): visible but disabled with `<Tooltip>` "Coming soon" — placeholder only per matrix note; do not build the flow.
- Queue-position chip: `<Badge>` with `--lc-accent` teal small + `--lc-accent-bold-edge` outline (the only teal usage on this screen; keep it small per BROADCAST rule).
- History accordion (prior applications to this agency): collapsible via `<Accordion>`; each history row `var(--lc-surface-sunken)` with `var(--lc-type-body-sm)`.
- Motion for panel actions: Approve confirmation dialog opens `--lc-duration-slow` `--lc-easing-out`; Reject modal same. Success toast + auto-navigate back to queue at `--lc-duration-base`.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-MEM-002b |
| Screen name | Application detail |
| Persona | Agency admin (Owner OR member with `capability_pack` including `agency-management`) — same as AGN-MEM-002 |
| Device targets | Desktop 1440px (primary), tablet 1024px (decision panel collapses under content instead of side-docked) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/agency/members/applications/:applicationId` |
| Current state | MISSING. Backend approve / reject endpoints exist per matrix note; see §Backend contract for detail-endpoint verification. |
| Workflow role | WF-02 role = Approval detail (agent-joins-agency flow, approver side — single item review) |
| Backend prerequisites | ✅ `POST /:appId/approve` · ✅ `POST /:appId/reject` · ⏳ `GET /:appId` verified against schema · ⏳ risk-signals payload spec (see [BE-VERIFY-06] below) · ⏳ `POST /:appId/request-info` for Phase 2 |
| Cluster | Week 1 (WF-02 deadlock resolution) — ships with AGN-MEM-002 in the same PR pair |

---

## Purpose

An agency admin drills into a single application from the queue (AGN-MEM-002) to review the applicant in full and make an accept / reject decision.

Where the queue is designed for rapid triage, the detail screen is designed for the applications that need a moment of judgment — usually applicants whose message, portfolio, or prior history warrants more context than a row can carry.

Three admin sub-tasks:

1. **Evaluate the applicant.** Full profile block, external portfolio URL (opens in new tab, `rel="noopener noreferrer"`), stated experience + listings count, full application message.
2. **Check for risk signals.** Existing WingCaster identity flagged? Prior rejections from this or other agencies? Free-trial abuse history? — displayed only when the backend surfaces them.
3. **Decide.** Approve (creates membership, notifies via AGT-REC-004) or Reject (with required reason, notifies). Optional Request Info (Phase 2).

Success outcome: decision recorded server-side, admin returned to the queue with a success toast, next-in-queue keyboard shortcut available (`J` navigates to the next Pending application without going back to the list).

---

## Design goals

1. **Reduce the decision to one screen.** Every signal an admin needs to accept or reject is on this page. No modal drill-down for the message body, no separate profile page load.
2. **Decision panel always in reach.** On desktop, docked sticky right column so the two primary buttons are visible regardless of scroll. On tablet, collapses under content but a compact "jump to decision" chip appears in the sticky header.
3. **Honest signals only.** No fabricated "match %", no algorithmic scoring, no AI-summarized "recommendation." The message and portfolio are shown as the applicant wrote them; the admin is trusted to judge.
4. **Risk signals when true, silence when not.** Don't invent a risk panel when the backend has nothing to report. False alarm noise trains admins to dismiss the section.
5. **Keyboard continuity from queue.** `J` moves to next Pending application (server-side sibling lookup), `K` to previous, `Esc` returns to queue at the same filter state.
6. **Reject-with-reason is friction on purpose.** A required, minimum-length reason ensures the applicant gets a real message. No one-click rejection here.

---

## Layout

### Desktop 1440px

Two-column split, 66/34, inside the standard Agency shell (SHR-NAV-001 top bar + SHR-NAV-002 side drawer):

**Sticky sub-header (below the top bar, above content):**
- Left: back-arrow icon button + breadcrumb "Applications / Sara Al Mansouri" (name is `--lc-type-body`, "Applications" is a `--lc-text-brand` link back to `AGN-MEM-002` preserving the last query params).
- Center: queue-position chip — `<Badge>` "Application <Numeric>3</Numeric> of <Numeric>12</Numeric> pending" (accent teal, only teal usage on this screen).
- Right: prev / next application buttons (chevron icons) — keyboard J/K equivalents. Disabled when at edge of queue.

**Left column (66%) — applicant + application content:**

- **Applicant profile block** (top of column):
  - 96px circular avatar (top-left) + name + secondary line (city · years experience · listings count).
  - Contact strip below name: email + phone (both with mask; full only revealed on click, audited server-side).
  - External portfolio URL link (only if provided): `<Numeric>example.com/sara-portfolio</Numeric>` with `ExternalLink` icon; opens in new tab with `rel="noopener noreferrer"`. Hover tooltip: "Opens in a new tab. WingCaster does not verify external portfolios."
  - Applied-at + queue-position line: "Applied <Numeric>2h ago</Numeric> · Queue position <Numeric>3</Numeric> of <Numeric>12</Numeric>".
- **Application message block** (below profile):
  - Card `--lc-surface-raised` + `--lc-elevation-sm`.
  - Section label ("MESSAGE FROM APPLICANT") in `var(--lc-type-overline)` above the card.
  - Message body full — `var(--lc-type-body-lg)`. Preserves line breaks. No character truncation.
- **Risk signals section** (below message — conditional):
  - Section label ("SIGNALS TO REVIEW") in `var(--lc-type-overline)`.
  - Stack of signal cards, one per signal returned by backend. Each card:
    - Left: severity badge (`warning` or `danger` or `info` per signal.severity).
    - Right: signal label + explanation body + optional `learn_more_url` link.
  - Hidden entirely if backend returns `[]`.
- **Prior application history section** (below risk signals — conditional):
  - Section label ("APPLICATION HISTORY") in `var(--lc-type-overline)`.
  - `<Accordion>` — collapsed by default. Trigger row: "This applicant has applied <Numeric>N</Numeric> times before."
  - Expanded: one row per prior application with date, outcome (approved / rejected / expired), reason if rejected, decided-by (agency admin name, respecting privacy in cross-agency history).
  - Hidden entirely if this is the applicant's first application.

**Right column (34%) — decision panel (sticky):**

- Panel card: `--lc-surface-raised` + `--lc-elevation-sm` + `border: 1px solid var(--lc-border)`.
- Sticky at `top: calc(var(--lc-nav-height) + var(--lc-space-xl))` so it never scrolls out of view on typical viewports.
- Panel content, top to bottom:
  1. Section label ("DECISION") in `var(--lc-type-overline)`.
  2. Role picker: `<Select>` "Assign as: Agent" — default Agent; options Agent / Admin (Admin only shown if current user is Owner). Small helper: "Role can be changed later from the member's profile."
  3. **Approve** button — full-width, `<Button size="lg" variant="default">` primary orange. Icon: `Check`. Label: "Approve application".
  4. **Reject** button — full-width, `<Button size="lg" variant="outline">`. Icon: `X`. Label: "Reject application".
  5. **Request info** button — full-width, `<Button size="lg" variant="ghost">`, disabled with tooltip "Coming soon (Phase 2)". Icon: `MessageSquare`. Label: "Request more info".
  6. Divider (`--lc-border` hairline).
  7. Small print: "Approving creates a membership immediately and notifies the applicant. Rejecting sends a message with your reason."

### Tablet 1024px

Same content in a single column: profile → message → risk signals → history → decision panel at bottom. A "Jump to decision" chip appears in the sticky sub-header center on tablet only, scrolling to the panel on click.

### Mobile ≤767px

Agency-desktop-only for v1. Show the shared "Agency console requires a larger screen" info state, same as AGN-MEM-002.

### Approve confirmation dialog

`AlertDialog` with:
- Title: "Approve Sara Al Mansouri's application?"
- Body: "Sara will be added to your agency as an <Numeric>Agent</Numeric> immediately and receive a notification with next steps. This can be reversed by ending the membership later."
- Confirm button: "Approve and add to agency"
- Cancel button: "Cancel"
- Step-up prompt inline if agency requires elevation (see §Interactions).

### Reject modal

`Dialog` with:
- Title: "Reject Sara Al Mansouri's application"
- Reason label: "Reason (shown to applicant)" — required
- Reason textarea: 4 rows min, placeholder "e.g. We're not adding agents in your city right now. Feel free to reapply in a few months."
- Helper: "Required. This message is sent to the applicant. Keep it kind and clear. Minimum 20 characters."
- Confirm button: "Reject application" (disabled until reason ≥20 chars)
- Cancel button: "Cancel"

### Already-decided state (approved / rejected / expired application viewed after the fact)

- Decision panel replaces action buttons with a static block:
  - Status pill (large): matching `<Badge>` with glyph + label + tint.
  - Decided-at + decided-by line: "Approved by Layla Georges on <Numeric>6 Sep 2026</Numeric>".
  - If rejected: reason shown verbatim in a quoted block.
  - If expired: "This application expired on <Numeric>6 Oct 2026</Numeric> after 30 days without a decision. Applicants can reapply."
- No Approve / Reject buttons.
- Optional "Undo decision" ghost button IF the decision is within the 5-second grace window AND undo is supported per [BE-VERIFY-04]; hidden otherwise.

---

## Explicit copy (English)

| Slot | Copy |
|---|---|
| Sub-header breadcrumb link | Applications |
| Queue-position chip | Application {position} of {total} pending |
| Prev / next aria-labels | Previous application · Next application |
| Section label — message | MESSAGE FROM APPLICANT |
| Section label — signals | SIGNALS TO REVIEW |
| Section label — history | APPLICATION HISTORY |
| Section label — decision | DECISION |
| Profile — applied line | Applied {relative_time} · Queue position {position} of {total} |
| Portfolio link tooltip | Opens in a new tab. WingCaster does not verify external portfolios. |
| Contact strip — reveal | Show contact |
| Contact strip — hide | Hide contact |
| History accordion trigger (single prior) | This applicant has applied 1 time before. |
| History accordion trigger (many prior) | This applicant has applied {N} times before. |
| History row template | {status} on {date} · {reason_if_any} |
| Role picker label | Assign as |
| Role picker options | Agent · Admin |
| Role helper | Role can be changed later from the member's profile. |
| Approve button | Approve application |
| Reject button | Reject application |
| Request info button | Request more info |
| Request info tooltip | Coming soon (Phase 2) |
| Panel small print | Approving creates a membership immediately and notifies the applicant. Rejecting sends a message with your reason. |
| Approve dialog title | Approve {name}'s application? |
| Approve dialog body | {name} will be added to your agency as an {role} immediately and receive a notification with next steps. This can be reversed by ending the membership later. |
| Approve dialog confirm | Approve and add to agency |
| Approve dialog cancel | Cancel |
| Reject dialog title | Reject {name}'s application |
| Reject reason label | Reason (shown to applicant) |
| Reject reason placeholder | e.g. We're not adding agents in your city right now. Feel free to reapply in a few months. |
| Reject reason helper | Required. This message is sent to the applicant. Keep it kind and clear. Minimum 20 characters. |
| Reject dialog confirm | Reject application |
| Reject dialog cancel | Cancel |
| Approved success toast | Approved {name}. Membership created. |
| Rejected success toast | Rejected {name}. Applicant notified. |
| Undo toast link | Undo |
| Decided — approved | Approved by {admin_name} on {date} |
| Decided — rejected | Rejected by {admin_name} on {date} |
| Decided — expired | This application expired on {date} after 30 days without a decision. Applicants can reapply. |
| Decided — reason label | Reason given |
| Loading | Loading application… |
| Error | Couldn't load this application. |
| Error retry | Retry |
| Not-found | Application not found. It may have been deleted. |
| Not-found link | ← Back to Applications |

---

## Component palette

| Element | Primitive |
|---|---|
| Sub-header layout | Custom flex; icon buttons `Button variant="ghost" size="icon"` |
| Back / breadcrumb link | `Link` styled `--lc-text-brand` |
| Prev / next buttons | `Button variant="ghost" size="icon"` with `ChevronLeft` / `ChevronRight` |
| Queue-position chip | `Badge` with `--lc-accent` styling |
| Applicant avatar | `Avatar` (96px) |
| Contact reveal | `Button variant="ghost" size="sm"` toggling masked/unmasked text |
| External portfolio link | `<a>` with `ExternalLink` icon; `rel="noopener noreferrer"` mandatory |
| Message card | `Card` with `--lc-elevation-sm` |
| Risk-signal cards | Custom `<div>` styled per severity + `<Badge>` per signal |
| History accordion | `Accordion` + `AccordionItem` + `AccordionTrigger` + `AccordionContent` |
| Decision panel | `Card` (sticky positioning) |
| Role picker | `Select` |
| Approve / Reject / Request-info buttons | `Button` (per variant above) |
| Approve dialog | `AlertDialog` |
| Reject dialog | `Dialog` |
| Reason textarea | `Textarea` |
| Success toast | `Sonner` |
| Loading skeleton | Custom skeleton (profile + message + panel shapes) |
| Not-found state | Custom empty state |
| Icons | `lucide-react` — `ChevronLeft`, `ChevronRight`, `Check`, `X`, `MessageSquare`, `ExternalLink`, `Eye`, `EyeOff`, `AlertTriangle`, `Info`, `AlertOctagon`, `ArrowLeft` |
| Numeric renders | `<Numeric>` primitive |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with sample application `app_abc123` for Sara Al Mansouri (row 1 from AGN-MEM-002 sample data):

**Sub-header:**
- Back arrow + "Applications / Sara Al Mansouri"
- Center chip: "Application 1 of 12 pending"
- Right: prev disabled, next enabled

**Left column:**
- 96px avatar (initials "SM"), name "Sara Al Mansouri" (`--lc-type-heading-1`)
- Secondary line: "Dubai · 5 years experience · 14 listings"
- Contact strip: `s***@example.com · +971 5X XXX XXXX · [Show contact]`
- Portfolio link: `sara-portfolio.example.com ↗`
- Applied-at line: "Applied 2h ago · Queue position 1 of 12"

**Message card:**
- Section label "MESSAGE FROM APPLICANT"
- Body: "Hi,\n\nI've been agent-of-record at Elite for 3 years and I'm looking for a stronger MENA-wide platform. My portfolio focuses on off-plan and secondary residential in Dubai Marina — 14 active listings across four buildings, with documented mandates for all of them.\n\nI'd like to move the portfolio over cleanly. I have my RERA card current through 2027 and can share references from two current colleagues on request.\n\nBest,\nSara"

**Risk signals section — SHOW as populated for the mockup:**
- Signal 1: `warning` severity — "Existing WingCaster identity" — "Sara Al Mansouri already has a WingCaster account created 2 years ago (identity verified). Membership is compatible."
- Signal 2: `info` severity — "Portfolio size exceeds agency's average" — "This applicant's stated 14 listings is 3× your agency's median new-member count of 5."

**Application history section — SHOW as expanded with 1 prior:**
- Trigger: "This applicant has applied 1 time before."
- Expanded row: "Rejected on 12 Mar 2026 · Reason: 'City not currently a focus for us'" (with the agency name masked as "Another agency" for cross-agency privacy)

**Decision panel (right column, sticky):**
- Section label "DECISION"
- Role picker: "Assign as: Agent" (default)
- Role helper: "Role can be changed later from the member's profile."
- Approve button (primary orange, full-width, `Check` icon)
- Reject button (outline, full-width, `X` icon)
- Request info button (ghost, disabled, tooltip visible)
- Divider
- Small print

**Iteration follow-ups to screenshot:**
- Approve confirmation dialog open over the loaded state.
- Reject modal open with reason typed to 45 chars (Confirm enabled).
- Loaded state for a DECIDED (already-rejected) application — no buttons, static "Rejected by Layla Georges on 5 Sep 2026" block + quoted reason.
- Loaded state with `risk_signals: []` and no prior history — the two sections completely hidden.
- Tablet 1024px — single-column stacking with "Jump to decision" chip.
- RTL Arabic + dark-mode passes as separate iterations.

---

## Interactions

**On page load:**
- Fetch `GET /api/agencies/:agencyId/applications/:applicationId`. Show skeleton until success.
- If 404: show not-found empty state with back-to-queue link.
- If 403: full-page permission-denied.
- If status ≠ pending, render already-decided variant.

**On back button / breadcrumb click:**
- Navigate to `AGN-MEM-002` preserving the queue's URL query params from the referrer (fallback default filter if referrer missing).

**On prev / next application (or `J`/`K`):**
- Fetch sibling application id from backend (`GET /api/agencies/:agencyId/applications/:appId/siblings?direction=next`) OR use a pre-fetched next-id passed in the initial payload.
- Navigate to the sibling's detail route. Preserve queue filter state in URL history stack.
- Disable button at end of queue.

**On Show contact click:**
- Reveal masked email + phone (server call `GET /api/agencies/:agencyId/applications/:appId/contact` — server logs the reveal to audit for privacy compliance).
- Button becomes "Hide contact"; on hide, mask again (client-side; audit event already logged).

**On portfolio link click:**
- Opens in new tab with `rel="noopener noreferrer"`. Client-side event fires for analytics ("application_portfolio_link_clicked").
- Show `<Tooltip>` on hover: "Opens in a new tab. WingCaster does not verify external portfolios."

**On Approve button click:**
- Open `AlertDialog` confirmation.
- On confirm: if step-up required per [BE-VERIFY-05] agency policy, prompt SHR-MFA-007 first.
- Fire `POST /api/agencies/:agencyId/applications/:appId/approve` with `{ role: <selected> }`.
- Optimistic UI: decision panel swaps to Decided-approved variant.
- Success toast "Approved {name}. Membership created." + Undo link (5s grace).
- Auto-navigate back to `AGN-MEM-002` queue after 1.5s (with the toast persisting on the queue page). Skipped if user clicks Undo.

**On Reject button click:**
- Open `Dialog` with reason textarea.
- Confirm disabled until reason ≥20 chars (client-side count).
- On confirm: step-up if required, then fire `POST /api/agencies/:agencyId/applications/:appId/reject` with `{ reason }`.
- Success toast "Rejected {name}. Applicant notified." + Undo link.
- Auto-navigate back to queue after 1.5s.

**On Request info button click:**
- Currently disabled — tooltip on hover. If enabled in Phase 2: opens a message composer that fires `POST /api/agencies/:agencyId/applications/:appId/request-info` with `{ message }`.

**On History accordion expand:**
- Fetch `GET /api/agencies/:agencyId/applications/:appId/history` if not preloaded. Show inline spinner on trigger while loading.
- Render rows with cross-agency privacy masking.

**On step-up prompt success:**
- Refire the pending action with elevated session.

**On step-up cancel:**
- Cancel the pending action. Silent — no toast unless the user explicitly retries.

**Keyboard shortcuts:**
- `J` — next application (server-side sibling)
- `K` — previous application
- `A` — open Approve confirmation dialog
- `R` — open Reject modal
- `Esc` — close any open modal / return to queue if no modal open
- `?` — open shortcuts sheet (same primitive as AGN-MEM-002)

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Page mount | Skeleton of profile + message + panel. |
| **Ready — pending, no signals, no history** | Load complete, pending status, empty risk + history | Two sections hidden; layout collapses cleanly. |
| **Ready — pending, with signals and history** | Load complete, backend returned both | Full sample-content layout. |
| **Approve confirm open** | Approve clicked | `AlertDialog` open, focus on Cancel by default (safety-first). |
| **Reject modal open** | Reject clicked | `Dialog` open, focus on reason textarea. Confirm disabled until ≥20 chars. |
| **Step-up required** | 401 `STEP_UP_REQUIRED` | SHR-MFA-007 modal inline; on success refires the action. |
| **Approving in progress** | Confirmation confirmed | Panel buttons disabled + Approve button shows `Loader2` spinner. |
| **Rejecting in progress** | Modal confirmed | Reject button shows spinner. |
| **Approve success** | POST 200 | Panel swaps to Decided-approved. Toast fires. Auto-nav in 1.5s (unless Undo clicked). |
| **Reject success** | POST 200 | Panel swaps to Decided-rejected. Toast + auto-nav. |
| **Undo success** | Undo clicked within 5s grace | Panel reverts to pending. Server-side reversal via `POST /:appId/undo-approve` or `.../undo-reject`. |
| **Approve failure** | POST 4xx/5xx | Destructive toast. Panel reverts to pending. |
| **Already-decided (approved)** | Status = approved on load | Decision panel shows approved block; no buttons. |
| **Already-decided (rejected)** | Status = rejected on load | Panel shows rejected block + reason quoted. |
| **Already-decided (expired)** | Status = expired on load | Panel shows expired block with reapply note. |
| **Not found** | 404 | Full-page not-found empty state + back link. |
| **Permission denied** | 403 | Full-page permission-denied block. |
| **Session expired** | 401 (not step-up) | Redirect to SHR-AUT-001 with return-to param. |
| **Backend error on load** | 5xx | Full-page error with Retry. |
| **Prev / next at edge** | Sibling absent | Button disabled with `aria-disabled="true"`. |
| **RTL** | Locale = ar | Two-column layout mirrors — decision panel docks on left; sub-header prev/next mirror. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap per Broadcast contract. |

---

## Accessibility

- Page has a single `<h1>` — the applicant's name. Sub-header breadcrumb links to queue.
- Decision panel labeled by `aria-labelledby` tied to the "DECISION" section label.
- Approve dialog is `AlertDialog` — has `role="alertdialog"`, focus-trapped, defaults focus to Cancel (safety-first destructive-adjacent pattern).
- Reject dialog is `Dialog` — focus-trapped, defaults focus to reason textarea.
- Reason textarea has `aria-describedby` tied to the character-count helper; helper announces via `aria-live="polite"` when threshold crossed ("Ready to submit").
- Risk-signal cards use severity glyph + label + color; screen reader announces severity via `role="status"` on load.
- Portfolio link explicitly announces "external, opens in new tab" via `aria-label` + visible tooltip.
- Show/Hide contact is announced when toggled.
- Keyboard shortcut hints panel accessible via `?`.
- Focus visible on every interactive element via two-tone ring.
- Every icon-only button has real `aria-label`.
- Prev / next buttons announce the sibling application count ("Next application, 4 of 12 pending").
- Auto-nav-back after 1.5s is announced ("Returning to Applications queue in 1 second") via a subtle live-region — allows AT users to Cancel by focusing an interactive element.

---

## Anti-patterns (do not do these)

- Do NOT show a fabricated "fit score" or algorithmic recommendation. Signals are backend-provided or absent.
- Do NOT default Approve confirmation focus to the Approve button. Default to Cancel — approving is destructive-adjacent (creates a real membership).
- Do NOT allow rejection with a reason shorter than 20 characters. Terse rejections train applicants to feel un-cared-for and generate support tickets.
- Do NOT reveal contact info without server-side audit logging. This is a privacy operation.
- Do NOT open the portfolio link in the same tab. `rel="noopener noreferrer"` + `target="_blank"` mandatory.
- Do NOT strip the applicant's message formatting (line breaks). Render as they wrote it.
- Do NOT show cross-agency history with the OTHER agency's real name. Mask as "Another agency" per privacy contract.
- Do NOT auto-navigate to the next application after decision without a toast + brief pause. The 1.5s window lets the admin see the outcome AND catch a mis-click via Undo.
- Do NOT enable the Request Info button in v1. Ship it as a visible disabled placeholder with tooltip — signals the roadmap without misleading anyone.
- Do NOT render the risk signals section with "No signals" copy when empty. Hide the entire section.
- Do NOT show the decision panel below-the-fold on desktop. Sticky positioning is mandatory; if scroll pushes it out on very small windows, collapse it into a floating "Decide" bottom bar.
- Do NOT use `--lc-action-primary` orange on the risk-signal cards. Orange is reserved for primary CTAs; risk severity uses status tokens.
- Do NOT allow the Approve dialog to close on outside-click WITHOUT confirmation if the role picker has been changed from default. Preserve user intent.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Radar review** — two-column split with sticky decision panel + risk signals + reason-required rejection.
- **GitHub Pull-Request page** — sticky merge panel with prev/next PR navigation.
- **Linear issue detail** — J/K sibling navigation from a list view.
- **Jira request approval** — reason-required rejection with visible history of prior decisions.
- **Superhuman message detail** — keyboard-first sibling navigation.

Do NOT match:
- ATS applicant tracker interfaces that shove 30+ fields into a single form — WingCaster's applicant profile is intentionally lean.
- Notion database record views — too flexible / user-configurable for a decision surface.

---

## Backend contract

**Detail endpoint:** `GET /api/agencies/:agencyId/applications/:applicationId`

**Response 200:**
```json
{
  "application": {
    "id": "app_abc123",
    "status": "pending",
    "applied_at": "2026-09-06T12:04:11Z",
    "expires_at": "2026-10-06T12:04:11Z",
    "message": "Hi,\n\nI've been agent-of-record at Elite for 3 years…",
    "queue_position": 1,
    "queue_total_pending": 12
  },
  "applicant": {
    "id": "usr_xyz789",
    "display_name": "Sara Al Mansouri",
    "avatar_url": "https://…",
    "city": "Dubai",
    "years_experience": 5,
    "listings_count": 14,
    "email_masked": "s***@example.com",
    "phone_masked": "+971 5X XXX XXXX",
    "portfolio_url": "https://sara-portfolio.example.com"
  },
  "risk_signals": [
    {
      "code": "EXISTING_WINGCASTER_IDENTITY",
      "severity": "warning",
      "label": "Existing WingCaster identity",
      "detail": "Sara Al Mansouri already has a WingCaster account created 2 years ago (identity verified). Membership is compatible.",
      "learn_more_url": null
    }
  ],
  "siblings": {
    "prev_application_id": null,
    "next_application_id": "app_def456"
  }
}
```

**History endpoint (lazy-loaded on accordion expand):** `GET /api/agencies/:agencyId/applications/:applicationId/history`

**Response 200:**
```json
{
  "prior_applications": [
    {
      "id": "app_prior001",
      "applied_at": "2026-03-12T…",
      "status": "rejected",
      "decided_at": "2026-03-15T…",
      "reason_masked": "City not currently a focus for us",
      "agency_name_masked": "Another agency"
    }
  ]
}
```

**Contact reveal endpoint:** `GET /api/agencies/:agencyId/applications/:applicationId/contact`

Returns `{ email, phone }` unmasked. Server-side audit event fired.

**Approve endpoint:** `POST /api/agencies/:agencyId/applications/:applicationId/approve` — see anchor brief §Backend contract.

**Reject endpoint:** `POST /api/agencies/:agencyId/applications/:applicationId/reject` — see anchor brief.

**Undo endpoints:** `POST .../undo-approve` and `POST .../undo-reject` — see anchor [BE-VERIFY-04].

**Phase-2 Request-info endpoint (not built for v1):** `POST /api/agencies/:agencyId/applications/:applicationId/request-info` with `{ message }`.

**[BE-VERIFY-06] Risk signals payload spec.** The `risk_signals` array shape above is a proposed contract. Confirm with backend whether the signal codes exist as an enum, whether severities are constrained (`info|warning|danger`), and whether the backend actually produces `EXISTING_WINGCASTER_IDENTITY` today (per PR #49 identity dedup, this should be trivial to derive). If backend has no risk-signal pipeline yet, ship v1 with `risk_signals: []` always and log as a Phase-2 backend task.

**[BE-VERIFY-07] Queue-position + siblings payload.** The `queue_position` + `siblings` fields require backend to compute the sorted-queue context at read time. Confirm this is efficient (indexed on `applied_at desc` per agency). If not, defer prev/next keyboard nav to Phase 2 and hide the queue-position chip.

**[BE-VERIFY-08] Contact reveal audit event.** Confirm backend logs contact reveals to the agency audit log (per AGN-AUD-001 blocker). If audit not wired, reveal endpoint still returns data but log a follow-up.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/agency/ApplicationDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/agency/members/applications/:applicationId" element={<ApplicationDetailPage />} />` behind the same `AgencyRoleGuard` HOC as AGN-MEM-002.
- **Component decomposition:**
  - `ApplicationDetailPage.tsx` — page shell + data fetching + sibling nav.
  - `ApplicationDetailSubHeader.tsx` — breadcrumb + queue-position chip + prev/next.
  - `ApplicantProfileBlock.tsx` — avatar + name + contact strip + portfolio link + applied line.
  - `ApplicationMessageCard.tsx` — the message body card.
  - `RiskSignalsSection.tsx` — conditional signals stack.
  - `ApplicationHistorySection.tsx` — conditional accordion.
  - `DecisionPanel.tsx` — sticky right column with role picker + action buttons + already-decided variant.
  - `ApproveConfirmDialog.tsx` — AlertDialog with copy per §Explicit copy.
  - `RejectDialog.tsx` — Dialog with reason textarea.
- **Data layer:**
  - Hook: `useApplicationDetailQuery(applicationId)` — wraps `fetch` + shares cache with the queue list where possible.
  - Optimistic update on approve/reject with 5-second undo timer.
  - Sibling prefetch via `siblings.next_application_id` in the initial payload to make J/K feel instant.
- **Reuse from anchor:**
  - `KeyboardShortcutsPanel` component from AGN-MEM-002 — reused via shared path.
  - Toast + Undo grace-period utilities — shared.
  - `AgencyRoleGuard` HOC — shared.
- **Test discipline:**
  - Unit tests per sub-component.
  - Integration: full load + approve (with step-up mock) + reject (with reason required) + undo path + sibling navigation + already-decided variants (approved / rejected / expired).
  - RTL scenario.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: at least one approve flow that creates a membership row and one reject that persists the reason.
  - Accessibility: axe-core scan on loaded, dialog-open, and already-decided states.

---

## Broadcast alignment callouts

Deltas from the anchor brief; anchor's callouts apply unchanged unless overridden below.

- Two-column split — `grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: var(--lc-space-2xl)`. Decision panel docks in the right cell, `position: sticky`, `top: calc(var(--lc-nav-height) + var(--lc-space-xl))`.
- Applicant name treated as page title: `var(--lc-type-heading-1)`. Never `--lc-type-display` (this is not a hero surface).
- Message body inside the card: `var(--lc-type-body-lg)` for legibility of long paragraphs. Preserve `\n` line breaks (`white-space: pre-line`).
- Section labels above each block ("MESSAGE FROM APPLICANT", "SIGNALS TO REVIEW", "APPLICATION HISTORY", "DECISION"): `var(--lc-type-overline)` `var(--lc-text-muted)`.
- Queue-position chip: `<Badge>` with `--lc-accent` background + `--lc-accent-bold-edge` outline + `--lc-accent-bold-text` ink. This is the ONLY teal usage on this screen.
- Risk-signal card severity: `warning` uses `--lc-status-warning-{bg,fg,dot}` + `AlertTriangle` glyph; `danger` uses `--lc-status-danger-*` + `AlertOctagon` glyph; `info` uses `--lc-status-info-*` + `Info` glyph. All with visible label.
- Decision panel: `background: var(--lc-surface-raised)`, `border: 1px solid var(--lc-border)`, `border-radius: var(--lc-radius-lg)`, `box-shadow: var(--lc-elevation-sm)`.
- Approve button: `<Button size="lg" variant="default">` — `--lc-action-primary` fill, hover `--lc-action-primary-hover` (darker). Full-width inside panel.
- Reject button: `<Button size="lg" variant="outline">` — border `--lc-border-strong`, text `--lc-text-secondary`. Full-width. Below Approve.
- Request-info button: `<Button size="lg" variant="ghost" disabled>` — muted; hover shows tooltip.
- Already-decided state: replace buttons with a `<Badge>` (large variant, `--lc-type-heading-3`) + decided-by line + optional reason quoted-block (`--lc-surface-sunken`, `border-left: 3px solid var(--lc-border-strong)`, `padding: var(--lc-space-md)`, `font-style: italic` optional).
- Motion: dialogs open `--lc-duration-slow` `--lc-easing-out`; panel decision-swap animates at `--lc-duration-base` `--lc-easing-in-out`. Auto-nav-back at `--lc-duration-slow` fade.
- Focus rings + two-tone from base CSS — do not override.
- All numerics — queue position, listings count, years experience, character count on reason textarea, dates — via `<Numeric>`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat AFTER the AGN-MEM-002 anchor has been designed (v0 will have the applicant sample content in memory). Framing prompt:

```
I'm designing the WingCaster agency Application detail screen (AGN-MEM-002b) — MENA real-estate B2B SaaS admin surface. Desktop 1440px only for v1. This is the drill-in from the Applications queue (AGN-MEM-002 anchor already designed) — one application shown for full evaluation with an accept/reject decision panel. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px two-column layout for Sara Al Mansouri's application (queue position 1 of 12). Left column: applicant profile block (96px avatar, name as H1, city + experience + listings line, masked contact strip with Show contact link, external portfolio link, applied-at line) + message card (long body) + risk signals section (2 signals: one warning "Existing WingCaster identity", one info "Portfolio size exceeds average") + application history accordion expanded (1 prior rejected at another agency, name masked). Right column: sticky decision panel with role picker "Assign as: Agent", Approve button (primary orange full-width), Reject button (outline full-width), Request info button (ghost disabled with tooltip), divider, small print. Sub-header shows back arrow + breadcrumb + "Application 1 of 12 pending" chip (teal small) + prev/next arrows.

LTR English only for this pass — I'll ask for the modals, already-decided variants, empty risk/history states, tablet layout, RTL Arabic, and dark mode as separate follow-ups.

Follow the copy table exactly. Do NOT fabricate reputation scores, match %, or ratings. Do NOT show the other agency's real name in history — always masked as "Another agency".

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the Approve confirmation dialog open over the loaded state. Default focus on Cancel button (safety-first).`
2. `Now the Reject modal open — reason textarea with 45 chars typed. Confirm button enabled.`
3. `Now the already-decided (Rejected) variant — decision panel shows large Rejected badge, "Rejected by Layla Georges on 5 Sep 2026", quoted reason block. No action buttons.`
4. `Now the "no signals, no history" state — same applicant + message, but the risk signals and history sections completely hidden. Layout collapses cleanly.`
5. `Now the tablet 1024px layout — single-column with decision panel at the bottom + "Jump to decision" chip in the sub-header.`
6. `Now the RTL Arabic layout at desktop 1440px. Mirror the whole layout — decision panel docks on the LEFT, sub-header prev/next mirror, portfolio link chevron mirrors.`
7. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGN-MEM-002b/` + screenshot to `docs/design/mockups/AGN-MEM-002b-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states (loaded desktop, approve-confirm, reject-modal, already-decided-rejected, empty-signals-and-history, tablet, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGN-MEM-002b/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief alongside the anchor AGN-MEM-002 brief.
- [ ] `[BE-VERIFY-06]` risk signals payload spec filed in kickoff §5a.
- [ ] `[BE-VERIFY-07]` queue-position + siblings payload verified.
- [ ] `[BE-VERIFY-08]` contact reveal audit event verified.
- [ ] Reject reason min-length (20 chars) implemented in both single and bulk reject dialogs (consistency with the anchor).
- [ ] Request-info button ships as a visible disabled placeholder — do NOT hide from v1 UI.
