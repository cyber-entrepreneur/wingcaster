# Screen Brief — PA-ACR-002 · Account recovery detail (WF-04 approver-side detail, delta from PA-MOD-001)

**Layer-2 Delta Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the PA approval-family patterns from anchor `docs/design/briefs/PA-MOD-001-portal-moderation-queue-brief.md` (page shell, env badge, focus rings, undo grace pattern, step-up prompt, own-record guard, immutable-audit invariant) AND the WF-04 deltas established in the queue brief `docs/design/briefs/PA-ACR-001-account-recovery-queue-brief.md` (PII masking / audited reveal, `account_value_tier`, evidence-count, single-case discipline, no bulk). Only the CHANGES from those two files are enumerated here — every unspecified concern (focus ring, dark mode, RTL treatment, error banner, session expiry, insufficient permission, keyboard shortcuts pattern) is IDENTICAL to the anchor.

Wave 2 (Week 3 — WF-04 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 42 + §6 Week 3. Pairs with `PA-ACR-001` (queue). Downstream: on Approve, applicant sees `SHR-AUT-005c` completion screen; on Reject, applicant sees rejection notification; on Request info, applicant sees a fixable-issues list and can re-submit via `SHR-AUT-005`.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`, `PA-MOD-001-portal-moderation-queue-brief.md` §Broadcast alignment, AND `PA-ACR-001-account-recovery-queue-brief.md` §Broadcast alignment.** The PA-approval-family invariants (env badge always visible, two-person rule for high-value, keyboard-first, immutable audit, step-up policy) apply UNCHANGED.

**PA-ACR-002-specific Broadcast deltas:**

- **Detail-screen layout is a 3-column split (72 : desktop, no mobile fallback).** Left column (60% width) = case data (identity + target + reason + evidence + timeline). Right column (40% width) = decision panel (sticky under top bar). No middle column.
- **PII-reveal is per-field with the same `<PIIMask>` primitive from PA-ACR-001** — click the eye chip on any masked field (email, phone, username, IP, user-agent, evidence-filename) to reveal for 30s. Reveal writes an audit event.
- **Evidence gallery** uses a `<ScrollArea>` horizontal strip of 96×96 thumbnails at `var(--lc-radius-md)` with the file extension chip overlaid at bottom-left. Click a thumbnail → opens `<Dialog>` at `var(--lc-elevation-lg)` with the full-size viewer (image preview for JPG/PNG/PDF-page-1; download link for other types). File viewer never leaves the PA console (no in-browser tab open; all previews served through the app's authenticated image proxy).
- **Contact-attempt timeline** below the identity block uses the same `<Timeline>` primitive as PA-AUD-001 audit trail — vertical stack of `--lc-surface-sunken` cards with a leading dot in `--lc-accent-bold-edge` (or `--lc-status-danger` for failed contact). Each entry shows timestamp (mono, tabular) + channel `<ChannelMark>` + status glyph + message.
- **Decision panel (right column)** is a sticky `<Card>` at `var(--lc-elevation-sm)` on `var(--lc-surface-raised)` with `var(--lc-radius-lg)` and `padding: var(--lc-space-xl)`. It contains: current state badge, two-person progress indicator (if high_value), decision buttons (`Approve` primary orange, `Request info` outline, `Reject` destructive-outline), and — after decision — the outcome summary + Undo link (30s grace).
- **Two-person progress indicator** (only shown when `requires_two_person=true`): horizontal 2-step `<Progress>`-like bar with dots. Step 1 = "First reviewer" (labeled with the first-reviewer's initials once they cast their vote); Step 2 = "Second reviewer" (labeled with second-reviewer's initials once cast, or "Awaiting second reviewer" muted while pending). Colors: completed step `--lc-status-published-{bg,fg}` + ● glyph; pending step `--lc-status-draft-{bg,fg}` + ○ glyph. Non-clickable — informational only.
- **Approve confirmation dialog** uses `<AlertDialog>` at `var(--lc-elevation-lg)`. Body copy explicitly names the effect ("This will issue a recovery link on {channel} to {masked-contact}. The link is valid for 30 minutes and can be used once."). Confirm button label: "Issue recovery link". For high-value cases where the current PA is the second reviewer, body copy prefixes with "You are the second reviewer for this high-value case." and Confirm label becomes "Sign off & issue recovery link".
- **Reject dialog** uses `<Dialog>` — Select for reason vocab + Textarea for notes (required, ≥10 chars). Reason vocab: `Insufficient evidence` / `Identity mismatch` / `Suspected takeover attempt` / `Duplicate case` / `Applicant is not the account owner` / `Other`. Body copy: "The applicant will be notified on {channel} that their request was declined. Your notes are shared verbatim."
- **Request-info dialog** uses `<Dialog>` — Select for reason vocab + multi-check for `requested_evidence` (`ID front` / `ID back` / `Selfie holding ID` / `Tenancy record` / `Agency letterhead` / `Utility bill` / `Other — describe in notes`) + Textarea for notes (optional). Body copy: "The applicant will be notified on {channel} with the evidence they need to add. The case moves to Awaiting info until they respond."
- **Undo pulse-border** on the decision panel (not on a table row) after any decision: `--lc-accent-bold-edge` at 2px, pulsing at `--lc-duration-slow` for 30s; countdown text below the outcome summary.
- **PA queue-family invariant deviations for WF-04 detail (deliberate, inherited from PA-ACR-001 §Broadcast alignment):** no bulk, no inline row action (not applicable on a detail screen anyway), 30s undo grace, PII-masking by default, two-person for high-value.

Every other Broadcast token / typography / spacing / motion / focus-ring instruction from PA-MOD-001 §Broadcast alignment applies verbatim.

---

## Meta

| | |
|---|---|
| Screen ID | PA-ACR-002 |
| Screen name | Account recovery detail |
| Persona | PA (elevated capability pack `account-recovery`; two-person second-reviewer for `high_value` cases requires distinct PA identity from first reviewer — server-enforced) |
| Device targets | Desktop 1440px ONLY |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/support/account-recovery/:caseId` (query params: `?return_to=<queue-url>` preserved from PA-ACR-001) |
| Current state | MISSING (UI). Backend `POST /:caseId/approve` VERIFIED at `backend/src/server.js:7041` + `POST /:caseId/reject` VERIFIED at `backend/src/server.js:7087`. Missing: single-case GET, request-info POST, evidence upload/storage, reveal-audit POST, undo-approve POST, two-person coordination. |
| Workflow role | WF-04 role = Approval detail (account recovery) |
| Backend prerequisites | ✅ `POST /:caseId/approve` · ✅ `POST /:caseId/reject` · ⏳ `[BE-ACR-09]` `GET /:caseId` single-case endpoint (fetch full case + evidence + contact-attempt log + two-person state) · ⏳ `[BE-ACR-02]` `POST /:caseId/request-info` (shared with queue brief) · ⏳ `[BE-ACR-03]` evidence upload endpoint + storage (shared with SHR-AUT-005 uploader) · ⏳ `[BE-ACR-06]` `POST /:caseId/reveal-audit` (shared with queue brief) · ⏳ `[BE-ACR-07]` `POST /:caseId/undo-approve` (shared with queue brief) · ⏳ `[BE-ACR-10]` two-person cast-vote endpoint (`POST /:caseId/cast-vote`) + server-side second-reviewer enforcement · ⏳ `[BE-ACR-11]` authenticated image proxy for evidence file previews · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context |
| Cluster | Wave 2 (WF-04 cluster) — pairs with PA-ACR-001 (queue). Initiator side merged (SHR-AUT-005/005b/005c/005d). |

---

## Purpose

Platform Admin opens ONE account-recovery case, reviews the applicant's identity evidence in depth, and casts a decision (Approve / Reject / Request info). For high-value cases, both the first-reviewer AND a second-reviewer must Approve independently before the recovery token is issued — the two-person rule is enforced server-side and reflected in the decision-panel progress indicator.

This is the WF-04 evaluation surface. The queue (PA-ACR-001) is triage; this screen is the actual decision. PA sees:

1. **Applicant identity block** — masked by default; per-field reveal (audited); includes what the applicant PROVIDED at request time (email, preferred contact channel, contact value they can currently receive on) plus what the account ON FILE holds (registered email, registered phone, registered username, agency, plan, role, tenure days). PA compares.
2. **Reason + reason-category** — verbatim applicant text plus the server-classified category (`lost_email` / `lost_phone` / `forgotten_username` / `compromised_account` / `other`).
3. **Evidence gallery** — every file the applicant uploaded via SHR-AUT-005 or in response to a prior Request-info. Thumbnails; click to preview at full size in a modal viewer served through an authenticated proxy.
4. **Contact-attempt timeline** — every automated attempt WingCaster made before the case landed for human review: SHR-AUT-005b email challenge (sent / bounced / opened / expired), SHR-AUT-005c TOTP challenge (offered / attempted / failed), plus any prior PA-ACR-002 request-info sends and applicant re-submissions.
5. **Decision panel** — right-column sticky card with current state, two-person progress (if applicable), three decision buttons, and post-decision outcome + Undo grace.

Success outcome: PA reaches a decision within the 24h WF-04 SLA. Approve on a `standard` or `elevated` case issues the recovery token immediately (30-min TTL, one-time-use, delivered on the applicant's stated preferred channel). Approve on a `high_value` case records the first vote and moves the case to "Awaiting second reviewer" — the second PA opens the same screen, sees the two-person progress showing the first vote cast, casts their own vote, and the token issues only after both votes align on Approve. Reject notifies the applicant with the PA's reason. Request info notifies the applicant with the specific evidence needed and moves the case to Awaiting info until they respond.

---

## Design goals

Deltas from PA-MOD-001 §Design goals + PA-ACR-001 §Design goals:

1. **Evidence review is the primary act.** The largest visual real estate is the evidence gallery + reason. Everything else is scaffolding for that review.
2. **PII-safe by default.** Every applicant identifier is masked; reveal is deliberate and audited. Applies to both PROVIDED and ON-FILE identifiers.
3. **Two-person progress is visible from the moment the page opens.** High-value cases surface the current progress state before any decision buttons are clickable. First-reviewer sees "Awaiting second reviewer" after they cast; second-reviewer sees "You are the second reviewer" prefix on the confirmation dialog.
4. **Approve wording names the blast radius.** Every confirmation dialog explicitly says what will happen ("Issue recovery link to {masked-contact} valid for 30 minutes"). No abstract "Are you sure?" placeholders.
5. **Undo grace is 30 seconds** (vs 5s in anchor) because the issued recovery token creates a password-reset window on a real account. Undo only succeeds if the token has NOT yet been consumed.
6. **Contact-attempt timeline explains WHY human review is needed.** Every case here is one where automated recovery failed. PA reads the timeline first to understand why; that context often decides the case.
7. **Same-PA-cannot-double-sign guard.** Server rejects a second-vote request from the same PA identity as the first vote. UI hides the decision buttons for the first reviewer once they have cast, replaces them with "You've cast your vote. Awaiting second reviewer."

---

## Layout

### Desktop 1440px (primary and only target for v1)

Single-column stack inside the PA console shell (SHR-NAV-001 top bar with PA-NAV-001 env badge; no side drawer):

**PA-NAV-001 persistent warning strip (conditional — env=TEST):** SAME as anchor.

**Back-nav row (sticky under top bar + optional TEST strip):**
- Left: `< Back to recovery queue` link → `?return_to` value from URL, fallback `/admin/support/account-recovery`. `<Button variant="ghost">` with `ChevronLeft` icon.
- Right: case ID chip (last-6 of `caseId`, mono, tabular) + copy-to-clipboard icon; `?` keyboard-hints toggle.

**Header block:**
- Left: page title "Recovery case · <Numeric>#4C2E</Numeric>" (`var(--lc-type-heading-1)`) + subtitle "<state badge> · Submitted <T> · SLA <H>h left" (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- Right: quick-context chip stack — `Account tier` badge (Standard / Elevated / High-value) + `Preferred channel` `<ChannelMark>`.

**Two-column split (60/40) below header:**

**Left column (60% width) — case data stack:**

1. **Applicant identity card** (`<Card>` on `--lc-surface-raised`, `--lc-elevation-sm`, `--lc-radius-lg`, `padding: var(--lc-space-xl)`):
   - Section title "Applicant identity" (`var(--lc-type-heading-3)`).
   - Two-column grid inside — left "Provided at request" / right "On file for this account":
     - Provided: preferred channel, contact value they can receive on now, request IP + user agent (masked; reveal-eye on hover). Every string masked; reveal-audited.
     - On file: registered email, registered phone, registered username, agency (linked to PA-TEN-001 new tab), plan tier, role, tenure days (`<Numeric>`), last-successful-login timestamp (mono, tabular; tooltip with full ISO on hover).
   - Below the grid: a `Mismatch summary` line if server flagged any field mismatch — e.g. "Provided email does not match account email (differs at local-part)." — in `var(--lc-status-warning-{bg,fg})` chip with ▲ glyph. If no mismatch: `Match summary` chip in `var(--lc-status-published-{bg,fg})` + ● + "All provided fields match account fields."

2. **Reason card** (`<Card>` same shell):
   - Section title "Applicant's reason" (`var(--lc-type-heading-3)`) + category chip on the right (`lost_email` / `lost_phone` / etc.).
   - Full verbatim reason text in `var(--lc-type-body-lg)`. Preserve line breaks. Max height ~200px with scroll-inside if longer.

3. **Evidence gallery card** (`<Card>` same shell):
   - Section title "Evidence · <Numeric>N</Numeric> files" (`var(--lc-type-heading-3)`).
   - Horizontal `<ScrollArea>` of 96×96 thumbnails, each with a file-extension chip overlay at bottom-left (`.jpg` / `.pdf` / `.png` / `.heic`). Click → opens preview modal.
   - Below the strip: file list in a `<Table>` — filename (masked-suffix if long) / size / uploaded-at (mono, tabular) / download link. Filenames revealed on hover-audit.
   - Empty state (0 files): centered stack "No evidence uploaded" + secondary CTA `Request info` (opens Request-info dialog with `ID front` + `ID back` pre-checked).

4. **Contact-attempt timeline card** (`<Card>` same shell):
   - Section title "Automated challenge history" (`var(--lc-type-heading-3)`).
   - Vertical `<Timeline>` — one entry per automated attempt (SHR-AUT-005b email, SHR-AUT-005c TOTP) plus any prior Request-info sends + applicant re-submissions on THIS case. Each entry: timestamp (mono, tabular) + `<ChannelMark>` + status glyph + short message (e.g. "Email challenge sent to o***@********.ae · not opened by expiry", "TOTP challenge offered · applicant did not attempt", "Info requested (ID front, tenancy record) · applicant re-uploaded 3 files 2h later").
   - Empty state: single entry "This case skipped automated challenges — applicant selected 'lost all recovery contacts'."

**Right column (40% width) — decision panel (sticky under back-nav row):**

- **Decision card** (`<Card>` on `--lc-surface-raised`, `--lc-elevation-sm`, `--lc-radius-lg`, `padding: var(--lc-space-xl)`; sticky `top: calc(64px + optional-warning-strip)`):
  - Current state badge (large — same variants as PA-ACR-001).
  - Two-person progress indicator (only when `requires_two_person=true`) — 2-step bar labeled "First reviewer" / "Second reviewer" with initials or "Awaiting…" text.
  - Reviewer-mode explanation strip (conditional):
    - If first-reviewer AND has not yet voted: "Your vote will be recorded and the case will move to Awaiting second reviewer."
    - If first-reviewer AND has voted: "You've cast your vote (<action>). Awaiting second reviewer." Decision buttons hidden; only `Withdraw my vote` link visible (opens confirmation).
    - If second-reviewer AND first vote was Approve: "First reviewer approved this case. Your matching vote issues the recovery link immediately."
    - If second-reviewer AND first vote was Reject: "First reviewer rejected this case. Your matching vote closes the case."
    - If second-reviewer AND first vote was Request info: no second-reviewer role — the case is Awaiting info; strip reads "First reviewer requested more info; the applicant is being contacted."
  - Decision buttons (stack vertically inside the card, full-width, `var(--lc-space-sm)` gap):
    - `Approve` (or `Sign off & Approve` for second reviewer) — `Button variant="default"` (`--lc-action-primary`).
    - `Request info` — `Button variant="outline"`.
    - `Reject` — `Button variant="destructive-outline"` (outline in `--lc-status-danger-fg`).
  - Own-case block: if `is_own=true`, buttons disabled + tooltip "You can't decide your own recovery case."
  - After decision + within undo grace: buttons swap to `Outcome summary` block — "{action} · recovery link sent to {masked-contact} · valid for 30 min" + `Undo (30s)` link with countdown ring around the card border.
  - After decision + grace expired: `Outcome summary` block persists (no Undo link).
  - Below the card: audit-note "This decision was recorded to the immutable audit log. See PA-AUD-001 → case #4C2E."

### Loading state

Skeleton: two-column split with shimmer blocks for identity card, reason card, evidence strip (5 96×96 shimmers), timeline (4 shimmer entries), and decision panel (state badge + progress bar + 3 buttons).

### Already-decided state (`status` in [approved, rejected, awaiting_info, completed, expired])

- Decision panel shows the past outcome + timestamp + deciding PA + reason/notes verbatim.
- No decision buttons visible.
- If `status=awaiting_info`: an inline `Cancel request` link on the decision panel — opens a confirm dialog to withdraw the info request and re-open the case as pending_review.
- If `status=completed`: also show the completion timestamp + completion IP.

### Permission-denied state

Full-page block: "You need `account-recovery` access to view this case." + link back to PA home. Same shell as anchor.

### Below-min-viewport fallback

SAME as anchor.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]`.

| Slot | Copy |
|---|---|
| Back-nav | ← Back to recovery queue |
| Page title template | Recovery case · #{last6} |
| Subtitle template | {stateBadge} · Submitted {relTime} · SLA {H}h left |
| Applicant identity — section title | Applicant identity |
| Provided-at-request — sub-heading | Provided at request |
| On-file — sub-heading | On file for this account |
| Field — preferred channel | Preferred channel |
| Field — contact value | Contact value (can receive on now) |
| Field — request IP | Request IP |
| Field — request user agent | Request device / browser |
| Field — registered email | Registered email |
| Field — registered phone | Registered phone |
| Field — registered username | Registered username |
| Field — agency | Agency |
| Field — plan tier | Plan tier |
| Field — role | Role |
| Field — tenure days | Tenure |
| Field — last successful login | Last successful login |
| Match summary chip | ● All provided fields match account fields. |
| Mismatch summary chip | ▲ {N} provided fields do not match account fields. Hover for details. |
| Reveal chip aria-label | Reveal {fieldName} (audited) |
| Reason — section title | Applicant's reason |
| Reason category chips | Lost email · Lost phone · Forgotten username · Compromised account · Other |
| Evidence — section title template | Evidence · {N} files |
| Evidence — empty title | No evidence uploaded |
| Evidence — empty body | The applicant did not attach any files. Request specific evidence before deciding. |
| Evidence — empty CTA | Request info → |
| Evidence — file list column names | Filename · Size · Uploaded · Actions |
| Evidence — download link | Download |
| Evidence — preview close | Close |
| Timeline — section title | Automated challenge history |
| Timeline — empty | This case skipped automated challenges — applicant selected 'lost all recovery contacts'. |
| Decision panel — current state label | Current state |
| Two-person — step 1 label | First reviewer |
| Two-person — step 2 label | Second reviewer |
| Two-person — awaiting text | Awaiting second reviewer |
| Reviewer strip — first pending | Your vote will be recorded and the case will move to Awaiting second reviewer. |
| Reviewer strip — first cast | You've cast your vote ({action}). Awaiting second reviewer. |
| Reviewer strip — second approve-path | First reviewer approved this case. Your matching vote issues the recovery link immediately. |
| Reviewer strip — second reject-path | First reviewer rejected this case. Your matching vote closes the case. |
| Reviewer strip — awaiting-info | First reviewer requested more info; the applicant is being contacted. |
| Decision — approve (standard/elevated) | Approve · Issue recovery link |
| Decision — approve (second reviewer, high-value) | Sign off & issue recovery link |
| Decision — request info | Request more info |
| Decision — reject | Reject |
| Decision — withdraw first vote | Withdraw my vote |
| Own-case tooltip | You can't decide your own recovery case. |
| Audit-note | This decision was recorded to the immutable audit log. See PA-AUD-001 → case #{last6}. |
| Approve dialog — title (standard) | Approve this recovery request? |
| Approve dialog — title (second reviewer high-value) | Sign off on this high-value recovery? |
| Approve dialog — body template | This will issue a recovery link on {channel} to {maskedContact}. The link is valid for 30 minutes and can be used once. |
| Approve dialog — high-value prefix | You are the second reviewer for this high-value case. |
| Approve dialog — notes label | Notes (recorded to audit, not shown to applicant) |
| Approve dialog — confirm (standard) | Issue recovery link |
| Approve dialog — confirm (second reviewer) | Sign off & issue recovery link |
| Approve dialog — cancel | Cancel |
| Reject dialog — title | Reject this recovery request |
| Reject dialog — body | The applicant will be notified on {channel} that their request was declined. Your notes are shared verbatim. |
| Reject dialog — reason vocab | Insufficient evidence · Identity mismatch · Suspected takeover attempt · Duplicate case · Applicant is not the account owner · Other |
| Reject dialog — reason label | Reason (shown to applicant) |
| Reject dialog — notes label | Notes for the applicant |
| Reject dialog — notes helper | Required, ≥10 characters. Kind and clear beats terse. |
| Reject dialog — confirm | Reject request |
| Reject dialog — cancel | Cancel |
| Request-info dialog — title | Request more info from applicant |
| Request-info dialog — body | The applicant will be notified on {channel} with the evidence they need to add. The case moves to Awaiting info until they respond. |
| Request-info dialog — reason vocab | Missing government ID · Selfie required · Tenancy record required · Agency letterhead required · Provided contact unreachable · Other |
| Request-info dialog — requested-evidence label | Evidence to request |
| Request-info dialog — evidence options | ID front · ID back · Selfie holding ID · Tenancy record · Agency letterhead · Utility bill · Other — describe in notes |
| Request-info dialog — notes label | Notes for the applicant (optional) |
| Request-info dialog — confirm | Send request |
| Request-info dialog — cancel | Cancel |
| Undo link | Undo (30s) |
| Undo success toast | Reverted. Recovery link revoked. |
| Undo blocked toast (token used) | Can't undo — recovery link has already been used. |
| Approved toast | Approved. Recovery link sent to {maskedContact} on {channel}. |
| Rejected toast | Rejected. Applicant notified on {channel}. |
| Request-info toast | Info requested. Applicant notified on {channel}. |
| First-vote cast toast | Your vote recorded. Awaiting second reviewer. |
| Second-vote issues toast | Second vote matches. Recovery link sent to {maskedContact}. |
| Second-vote mismatch toast | Votes do not match — case escalated to PA-APR-005 for resolution. |
| Withdraw-vote confirm — title | Withdraw your vote? |
| Withdraw-vote confirm — body | The case returns to Pending review with no first vote recorded. |
| Withdraw-vote confirm — confirm | Withdraw vote |
| Cancel-info-request confirm — title | Cancel the info request? |
| Cancel-info-request confirm — body | The case returns to Pending review and the applicant is notified the request was withdrawn. |
| Cancel-info-request confirm — confirm | Cancel request |
| Permission-denied — title | You don't have access to this case. |
| Permission-denied — body | This screen requires the `account-recovery` capability pack. Contact a Platform Admin owner to request access. |
| Loading | Loading case… |
| Error | Couldn't load this case. Try again. |
| Retry | Retry |

---

## Component palette

Inherits the palette table from PA-MOD-001 + PA-ACR-001 with the following deltas:

| Element | Primitive |
|---|---|
| Back-nav link | `<Button variant="ghost">` + `ChevronLeft` |
| Case ID chip | Custom `<Badge>` with mono + tabular + `Copy` icon on hover |
| Applicant identity card | `<Card>` shell wrapping a two-column `<dl>` grid |
| Provided / On-file fields | `<dl>` with `<dt>` label + `<dd>` value; every value wrapped in `<PIIMask>` (reusable from PA-ACR-001) |
| Match / Mismatch summary chip | `<Badge>` variant per state |
| Reason card | `<Card>` shell with scrolling body |
| Evidence gallery | `<ScrollArea>` horizontal + 96×96 thumbnails |
| Evidence thumbnail | Custom `<button>` with `<img>` via authenticated proxy + `<Badge>` overlay for extension |
| Evidence preview modal | `<Dialog>` at `--lc-elevation-lg`; image via authenticated proxy |
| Evidence file list | `<Table>` |
| Contact-attempt timeline | `<Timeline>` primitive (reused from PA-AUD-001; if not yet built, ship a shared primitive at `web/src/components/ui/timeline.tsx`) |
| Decision panel card | `<Card>` sticky |
| State badge (large) | `<Badge>` at `var(--lc-type-body-lg)` size variant |
| Two-person progress | Custom `<div>` bar with 2 dots + labels; NOT a standard `<Progress>` primitive |
| Decision buttons | `<Button variant="default" \| "outline" \| "destructive-outline">` |
| Approve dialog | `<AlertDialog>` |
| Reject / Request-info dialog | `<Dialog>` with `<Select>` + `<Textarea>` (+ multi-`<Checkbox>` for evidence in Request-info) |
| Withdraw / Cancel confirm | `<AlertDialog>` |
| Undo grace toast | `Sonner` toast + Undo link |
| Undo pulse-border on card | `--lc-accent-bold-edge` 2px pulsing at `--lc-duration-slow`; respect reduced-motion |
| Toasts | `Sonner` |
| Icons | `lucide-react` — `ChevronLeft`, `Copy`, `Eye`, `EyeOff`, `Download`, `FileText`, `Image`, `AlertTriangle`, `Check`, `X`, `MessageCircle`, `HelpCircle`, `Undo2`, `Users` (two-person indicator) |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout for **a high-value case, first-reviewer mode, no decision yet** with:

- **Env:** LIVE.
- **Back-nav:** "← Back to recovery queue" left; case ID chip "#B7F3A2" + copy icon right.
- **Header:** "Recovery case · #B7F3A2" title, subtitle "**Pending review** · Submitted 1h ago · SLA 22h 58m left". Right chips: "**High-value · 2-person**" + WhatsApp `<ChannelMark>`.
- **Applicant identity card:**
  - Provided at request: Preferred channel `WhatsApp`; Contact value `+961 7X XXX XX41` (masked, reveal-eye); Request IP `185.104.XXX.XXX` (masked); Request device `iPhone · Safari 17` (masked user-agent).
  - On file for this account: Registered email `s***@********.com`; Registered phone `+961 7X XXX XX41`; Registered username `sa****ri`; Agency **Elite Real Estate Dubai** (link); Plan **Enterprise**; Role **Agency owner**; Tenure **1,240 days**; Last successful login `2026-08-14 09:12 GMT` (mono).
  - Mismatch summary chip: "▲ 1 provided field does not match account fields. Hover for details." (mismatch: provided contact phone country differs from registered phone country — LB vs UAE.)
- **Reason card:** category chip "Compromised account". Body: "I received an email from 'account-security@wingcaster.help' asking me to re-verify — I logged in and I think that stole my password. Then my email inbox stopped receiving anything from your platform. I've attached my Emirates ID (front + back), a selfie holding it, my Elite Real Estate Dubai employment letter, and a screenshot of the phishing email."
- **Evidence gallery:** 5 thumbnails — id_front.jpg, id_back.jpg, selfie_holding_id.jpg, elite_dubai_letter.pdf, phishing_screenshot.png. File list below with size + timestamps.
- **Contact-attempt timeline:** 4 entries — "Email challenge sent to s***@********.com · not opened by expiry (1h ago)"; "SMS OTP challenge sent to +961 7X XXX XX41 · not entered by expiry (55m ago)"; "TOTP challenge offered · applicant does not have TOTP configured (52m ago)"; "Case escalated to PA review (50m ago)".
- **Decision panel (right sticky column):**
  - State badge "**Pending review**" (draft variant, large).
  - Two-person progress: Step 1 "First reviewer" pending; Step 2 "Second reviewer" pending.
  - Reviewer strip: "Your vote will be recorded and the case will move to Awaiting second reviewer."
  - Buttons (full-width, stacked): `Approve · Issue recovery link` (primary orange), `Request more info` (outline), `Reject` (destructive-outline).
  - Below buttons: audit note "This decision was recorded to the immutable audit log. See PA-AUD-001 → case #B7F3A2."

**Side variants to screenshot as separate v0 iterations:**

- **Reveal-active** on the Registered email field — value fully visible with hide-eye chip + 30s countdown.
- **Approve dialog open (high-value second-reviewer variant)** — Sign off & issue recovery link, notes textarea empty, body copy prefixed with "You are the second reviewer for this high-value case.".
- **Reject dialog open** — reason "Suspected takeover attempt" selected, notes typed ("The provided contact country does not match your registered phone country and we could not verify the phishing screenshot as authentic. Please regain access to your registered email and try again."), Confirm enabled.
- **Request-info dialog open** — `ID front` + `ID back` + `Selfie holding ID` checked, reason "Missing government ID" selected, notes empty.
- **After Approve — undo grace state** — decision panel replaced with "Approved · Recovery link sent to +961 7X XXX XX41 on WhatsApp · valid for 30 min" + `Undo (30s)` link with countdown; card border pulses accent.
- **First vote cast (first-reviewer mode)** — buttons hidden; strip reads "You've cast your vote (Approve). Awaiting second reviewer." + `Withdraw my vote` link.
- **Second-reviewer mode with first vote = Approve** — strip reads "First reviewer approved this case. Your matching vote issues the recovery link immediately." Confirm button label "Sign off & issue recovery link".
- **Already-decided (completed)** — decision panel replaced with "Completed · Approved by SM on 2026-09-05 11:04 · Applicant reset password on 2026-09-05 11:22 from 185.104.XXX.XXX (masked IP)".
- **RTL Arabic** at 1440px.
- **Dark mode** of the primary pass.

Do NOT fabricate confidence scores, applicant-risk percentages, or IP-reputation ratings not returned by the backend contract.

---

## Interactions

Deltas from PA-MOD-001 §Interactions:

- **On page load:** fetch `GET /api/admin/account-recovery/:caseId` scoped to current env. In parallel, fetch `GET /api/admin/account-recovery/:caseId/timeline` (contact-attempt log) if not embedded in the single-case response. Skeleton until both resolve.
- **On reveal-eye click on any masked field** (or `V` shortcut on focused field): fire `POST /api/admin/account-recovery/:caseId/reveal-audit` with `{ field }`; on 200, unmask for 30s; on 429, block + toast "Reveal rate limit reached — try again in an hour." On 500, block + toast "Couldn't record audit — reveal denied."
- **On evidence thumbnail click:** open `<Dialog>` with the file preview served via `GET /api/admin/account-recovery/:caseId/evidence/:filename` (authenticated image proxy — never a public URL). Preview supports JPG/PNG/PDF-page-1 inline; other types show a download-only card.
- **On evidence Download link:** fires the same authenticated endpoint with `Content-Disposition: attachment`.
- **On Approve click (standard/elevated):**
  - If `is_own=true`: buttons already disabled — no-op.
  - Else if step-up policy requires (elevated tier OR high-risk pattern): SHR-MFA-007 prompt.
  - Else: open Approve `<AlertDialog>` with body naming the channel + masked contact.
  - On Confirm: fire `POST /:caseId/approve` with `{ notes }`. Server issues recovery token.
  - Optimistic: decision panel swaps to Outcome + 30s undo pulse.
  - Toast "Approved. Recovery link sent to {masked} on {channel}." with `Undo` link (30s grace).
- **On Approve click (high-value, first reviewer):**
  - Step-up ALWAYS required.
  - Open Approve dialog; body prefixes "You are casting the FIRST vote on a high-value case."
  - On Confirm: fire `POST /:caseId/cast-vote` with `{ vote: "approve", notes }`. Server records first vote, case status stays `pending_review` server-side but a `first_vote` field populates.
  - UI updates: decision panel replaces buttons with "You've cast your vote (Approve). Awaiting second reviewer." + `Withdraw my vote` link. Two-person progress updates.
  - Toast "Your vote recorded. Awaiting second reviewer."
- **On Approve click (high-value, second reviewer with first vote = Approve):**
  - Step-up ALWAYS required.
  - Open Approve dialog; body prefixes "You are the second reviewer for this high-value case."; Confirm label "Sign off & issue recovery link".
  - On Confirm: fire `POST /:caseId/cast-vote` with `{ vote: "approve", notes }`. Server matches votes → issues recovery token → case transitions to `approved`.
  - Optimistic: decision panel swaps to Outcome + 30s undo pulse.
  - Toast "Second vote matches. Recovery link sent to {masked}."
- **On Reject click:** open Reject `<Dialog>`. Reason Select required + notes Textarea (≥10 chars) required. Confirm fires `POST /:caseId/reject` with `{ reason_code, notes }`. Optimistic + toast + 30s Undo grace (Undo only if no follow-up notification has been sent — server enforces).
- **On Request info click:** open Request-info `<Dialog>`. Reason Select required + Evidence multi-check (≥1) required + notes optional. Confirm fires `POST /:caseId/request-info` with `{ reason_code, requested_evidence: [...], notes }`. Case status transitions to `awaiting_info`. No Undo grace (info request notification sends immediately).
- **On Withdraw my vote (first-reviewer mode):** open confirm dialog. On confirm, fire `POST /:caseId/withdraw-vote`. First-vote cleared; decision panel returns to buttons-visible state.
- **On Cancel request (awaiting-info state):** open confirm dialog. On confirm, fire `POST /:caseId/cancel-info-request`. Status returns to `pending_review`.
- **On Undo (approve grace):** fire `POST /:caseId/undo-approve`. On 200: status reverts + issued token revoked + toast "Reverted. Recovery link revoked." On 409 (token already used): toast "Can't undo — recovery link has already been used."
- **On second vote MISMATCH (votes disagree):** server returns 409 with `escalation_case_id`. UI shows destructive toast "Votes do not match — case escalated to PA-APR-005 for resolution." Decision panel becomes read-only.
- **Env-switch mid-flow:** if any dialog open, confirm-cancel prompt; on env switch, redirect back to PA-ACR-001 in new env (this case may not exist in the new env).
- **Keyboard shortcuts:** `V` reveal focused field · `A` open approve dialog · `R` open reject dialog · `I` open request-info dialog · `U` undo (during grace) · `Esc` close dialog · `?` shortcuts sheet · `Backspace` back to queue.

Everything else (initial loading skeleton, backend 500, session expiry, 403 permission-denied, RTL, dark mode, reduced-motion) inherits from PA-MOD-001 + PA-ACR-001.

---

## State variants

Deltas from PA-MOD-001 + PA-ACR-001 §State variants:

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Two-column skeleton (identity + reason + evidence strip + timeline + decision panel). |
| **Ready — pending, standard/elevated** | Load complete, `status=pending_review`, `requires_two_person=false` | Decision panel shows 3 buttons; no two-person progress. |
| **Ready — pending, high-value first reviewer** | `requires_two_person=true`, `first_vote=null` | Two-person progress visible (both pending); reviewer strip "Your vote…"; 3 buttons. |
| **Ready — pending, high-value first reviewer post-vote** | `requires_two_person=true`, `first_vote.reviewer_id=current` | Progress step 1 complete with current PA initials; buttons hidden; `Withdraw my vote` link. |
| **Ready — pending, high-value second reviewer (approve path)** | `first_vote.reviewer_id≠current`, `first_vote.vote="approve"` | Progress step 1 complete with first-reviewer initials; strip "First reviewer approved…"; 3 buttons (Approve label = "Sign off & issue recovery link"). |
| **Ready — pending, high-value second reviewer (reject path)** | `first_vote.vote="reject"` | Similar to above but strip and confirm reflect reject-path. |
| **Ready — awaiting-info** | `status=awaiting_info` | Decision panel shows past info-request reason + evidence checklist + `Cancel request` link; no decision buttons. |
| **Ready — approved / rejected / completed / expired** | Terminal states | Decision panel read-only outcome summary. |
| **Reveal-active (single field)** | Reveal-eye or `V` | Field unmasked for 30s + eye chip flips to "hide" + countdown ring on the field. |
| **Approve dialog open** | Approve click | Dialog with dynamic body/confirm label per reviewer mode. |
| **Reject dialog open** | Reject click | Dialog with reason vocab + notes required. |
| **Request-info dialog open** | Request-info click | Dialog with reason + evidence multi-check + optional notes. |
| **Step-up in flight** | 401 STEP_UP_REQUIRED | SHR-MFA-007 inline modal; retries pending action on success. |
| **Approve in progress** | POST fired | Buttons disabled + spinner in confirm button. |
| **Approve success + undo grace (single reviewer or second reviewer)** | POST 200 | Outcome summary + Undo link + card border pulse for 30s. |
| **Approve success + first vote cast (high-value first reviewer)** | POST 200 `cast-vote` | Progress step 1 fills; buttons hidden; `Withdraw` link; toast. |
| **Vote-mismatch escalation** | POST 409 with `escalation_case_id` | Read-only panel + destructive toast + link to PA-APR-005. |
| **Undo success** | POST 200 `undo-approve` | Panel reverts to pending; buttons re-enabled; toast "Reverted." |
| **Undo blocked (token used)** | POST 409 | Toast "Can't undo — recovery link has already been used." Panel stays in Approved outcome. |
| **Own-case block** | `is_own=true` | All decision buttons disabled + tooltip. |
| **Same-PA-cannot-double-sign** | Attempted second vote by same PA | Buttons hidden with block message "You cast the first vote. A different PA must cast the second." |
| **Evidence preview open** | Thumbnail click | Modal with authenticated image; Esc closes. |
| **Cancel-request confirm** | `Cancel request` on awaiting-info | Confirm dialog; on confirm, POST returns case to pending_review. |
| **Withdraw-vote confirm** | `Withdraw my vote` in first-vote-cast state | Confirm dialog; on confirm, POST clears first vote. |
| **TEST-env warning strip** | env=TEST | Persistent full-width strip with WF-04 copy. |
| **Env-switch mid-flow** | PA-NAV-001 env change | Dialog cancel prompt if any dialog open; redirect to PA-ACR-001 in new env. |
| **Backend error 500** | GET / POST fails | Destructive banner + Retry. |
| **Session expired** | 401 (non step-up) | Redirect to SHR-AUT-001 with return-to. |
| **Insufficient permission** | 403 | Full-page block. |
| **Not-found** | 404 | Full-page block "Case not found — it may have been deleted or you don't have access to this env." |

---

## Accessibility

Inherits from PA-MOD-001 + PA-ACR-001 §Accessibility. **PA-ACR-002 additions:**

- Page has a single `<h1>` "Recovery case · #{last6}". Provided-at-request and On-file-for-this-account are `<h2>` inside the identity card labeled `<section aria-labelledby>`.
- Two-column split uses `role="region"` on each column with `aria-labelledby` pointing at its section title.
- Two-person progress bar uses `role="progressbar"` with `aria-valuenow` (0 / 1 / 2 votes cast), `aria-valuemin=0`, `aria-valuemax=2`, `aria-label="Two-person approval progress"`. Screen-reader-only text describes each step's status.
- Decision panel is a `<section aria-labelledby>` sticky region; sticky offset accounts for the two-tone focus ring on the decision buttons (add `scroll-margin-top` so focused buttons are never hidden under the header).
- Approve / Reject / Request-info dialogs trap focus + Esc closes + click-outside dismisses with confirmation if notes were typed.
- Evidence thumbnails are `<button>` (not `<img>`) with `aria-label="Preview {filename}"`; the preview modal has `<h2>` = filename + `aria-describedby` on file metadata.
- Undo link within a toast is keyboard-focusable and reachable via `Tab` from the toast landmark.
- All state transitions announced via `aria-live="polite"` (own-block, first-vote-cast, second-vote-mismatch, awaiting-info transition, undo).
- Evidence preview modal image has `alt="Applicant-uploaded evidence: {filename}"`.

---

## Anti-patterns (do not do these)

Inherits from PA-MOD-001 + PA-ACR-001. **PA-ACR-002 additions:**

- Do NOT open evidence files in a new browser tab from a public URL — always through the authenticated proxy inside a modal.
- Do NOT allow Approve without the confirmation dialog naming the exact channel + masked contact + TTL.
- Do NOT allow Undo after the recovery token has been used — server enforces; UI must handle the 409 gracefully.
- Do NOT show decision buttons to a PA who has already cast their vote on a high-value case.
- Do NOT allow the same PA identity to cast both votes — server enforces; UI must not appear to allow it either.
- Do NOT collapse the two-person progress indicator into an icon-only chip; it must always show both step labels and current state.
- Do NOT persist a reveal beyond 30 seconds; auto-remask.
- Do NOT include raw PII in URL query strings, error messages, toast copy, or the audit note (mask + append caseId only).
- Do NOT surface an inline Approve on high-value cases without step-up; step-up is ALWAYS required for high-value.
- Do NOT ship a mobile viewport as anything other than the "PA console requires a desktop screen" info block for v1.
- Do NOT hide the audit-note under the fold — it must be visible below the decision buttons in every state.

---

## Reference designs

Draw structural cues from:
- **Stripe Radar Reviews** — dense single-item review with left-column evidence + right-column decision panel.
- **GitHub PR review page** — sticky right-column decision panel with primary + secondary + destructive actions.
- **Linear issue detail** — timeline with per-entry glyph + channel + timestamp.
- **Notion admin case detail** — masked-by-default identity fields with per-field reveal.
- **PA-MOD-002 (WingCaster peer, when built)** — same shell family.

Do NOT match:
- Salesforce case detail (too enterprise-noisy, low signal-to-decoration).
- Zendesk ticket (chat-thread-shaped, wrong for one-shot approval).

---

## Backend contract

**Single-case GET — NEW `[BE-ACR-09]`:** `GET /api/admin/account-recovery/:caseId`

Response 200:
```json
{
  "id": "acr_b7f3a2",
  "created_at": "2026-09-07T11:04:11Z",
  "sla_hours_remaining": 22.97,
  "sla_hours_total": 24.0,
  "status": "pending_review",
  "reason": "I received an email from 'account-security@wingcaster.help' asking me to re-verify…",
  "reason_category": "compromised_account",
  "provided": {
    "preferred_channel": "whatsapp",
    "contact_masked": "+961 7X XXX XX41",
    "contact_full": "+961 71 456 7841",
    "request_ip_masked": "185.104.XXX.XXX",
    "request_ip_full": "185.104.212.44",
    "request_user_agent_masked": "iPhone · Safari 17",
    "request_user_agent_full": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)…"
  },
  "on_file": {
    "email_masked": "s***@********.com",
    "email_full": "sara.mansouri@elitedubai.com",
    "phone_masked": "+961 7X XXX XX41",
    "phone_full": "+961 71 456 7841",
    "username_masked": "sa****ri",
    "username_full": "sara_mansouri",
    "agency": { "id": "agy_dubai_elite", "name": "Elite Real Estate Dubai", "tenant_url": "/admin/tenants/agy_dubai_elite" },
    "plan_tier": "enterprise",
    "role": "agency_owner",
    "tenure_days": 1240,
    "last_successful_login_at": "2026-08-14T09:12:00Z"
  },
  "mismatches": [
    { "field": "phone", "detail": "Provided contact phone country (LB) differs from registered phone country (AE)." }
  ],
  "evidence": {
    "file_count": 5,
    "files": [
      { "id": "ev_1", "filename": "id_front.jpg", "uploaded_at": "2026-09-07T11:04:22Z", "size_bytes": 218430, "content_type": "image/jpeg" },
      { "id": "ev_2", "filename": "id_back.jpg", "uploaded_at": "2026-09-07T11:04:35Z", "size_bytes": 208112, "content_type": "image/jpeg" },
      { "id": "ev_3", "filename": "selfie_holding_id.jpg", "uploaded_at": "2026-09-07T11:04:52Z", "size_bytes": 302145, "content_type": "image/jpeg" },
      { "id": "ev_4", "filename": "elite_dubai_letter.pdf", "uploaded_at": "2026-09-07T11:05:10Z", "size_bytes": 128330, "content_type": "application/pdf" },
      { "id": "ev_5", "filename": "phishing_screenshot.png", "uploaded_at": "2026-09-07T11:05:24Z", "size_bytes": 98420, "content_type": "image/png" }
    ]
  },
  "timeline": [
    { "at": "2026-09-07T11:04:15Z", "channel": "email", "status": "failed", "message": "Email challenge sent to s***@********.com · not opened by expiry." },
    { "at": "2026-09-07T11:05:00Z", "channel": "sms", "status": "failed", "message": "SMS OTP challenge sent to +961 7X XXX XX41 · not entered by expiry." },
    { "at": "2026-09-07T11:07:12Z", "channel": "system", "status": "info", "message": "TOTP challenge offered · applicant does not have TOTP configured." },
    { "at": "2026-09-07T11:10:00Z", "channel": "system", "status": "info", "message": "Case escalated to PA review." }
  ],
  "account_value_tier": "high_value",
  "requires_two_person": true,
  "first_vote": null,
  "current_reviewer": {
    "id": "pa_current_id",
    "is_first_reviewer_candidate": true,
    "is_second_reviewer_candidate": false
  },
  "decision": null,
  "escalation_case_id": null,
  "is_own": false,
  "env": "live"
}
```

**Approve — EXISTS** at `backend/src/server.js:7041`. Body `{ notes }`. For high-value cases, this endpoint MUST be replaced by (or delegate to) `POST /:caseId/cast-vote` in `[BE-ACR-10]`. Current implementation issues a token immediately regardless of tier — this is a **known gap** that MUST be closed before UI ships (see `[BE-ACR-10]`).

**Reject — EXISTS** at `backend/src/server.js:7087`. Body `{ notes }`. For high-value cases, same cast-vote delegation applies.

**`[BE-ACR-02]` Request-info — NEW** (shared with queue brief): `POST /:caseId/request-info` with `{ reason_code, notes, requested_evidence: [...] }`. Transitions to `awaiting_info`; sends notification.

**`[BE-ACR-06]` Reveal-audit — NEW** (shared): `POST /:caseId/reveal-audit` with `{ field }`. Rate limit 20 reveals per PA per hour.

**`[BE-ACR-07]` Undo-approve — NEW** (shared): `POST /:caseId/undo-approve`. Rejects with 409 if the recovery token has been consumed.

**`[BE-ACR-10]` Two-person cast-vote — NEW:** `POST /:caseId/cast-vote` with `{ vote: "approve" | "reject", notes }`. Server logic:
- If `requires_two_person=false`: immediate execution — approve issues token, reject notifies applicant.
- If `requires_two_person=true` and `first_vote=null`: record first vote (do NOT execute).
- If `requires_two_person=true` and `first_vote.reviewer_id=current`: 409 SAME_REVIEWER.
- If `requires_two_person=true`, `first_vote≠null`, `first_vote.reviewer_id≠current`:
  - If `first_vote.vote=current_vote`: execute (approve → issue token; reject → notify).
  - If votes disagree: create escalation case in `fin.approval_requests` (WF-07/08 pattern reused) + return 409 with `escalation_case_id`.
- Also add `POST /:caseId/withdraw-vote` (first reviewer can withdraw their vote before second vote is cast).

**`[BE-ACR-03]` Evidence upload + storage — NEW** (shared with SHR-AUT-005 uploader):
- Upload endpoint: `POST /api/auth/recovery/:caseId/evidence` (public, throttled) — applicant-side. Body multipart form-data.
- Serve endpoint: `GET /api/admin/account-recovery/:caseId/evidence/:evidenceId` — PA-side authenticated proxy. Serves the file inline (`Content-Disposition: inline` for image/pdf, `attachment` for others). NEVER a public URL.
- Storage: S3 or equivalent with private ACL + presigned URLs generated per PA request (server-side; PA never sees the presigned URL).

**`[BE-ACR-11]` Authenticated image proxy — NEW:** dedicated route serving evidence files, verified against session + case ownership + reveal-rate-limit.

**Cancel-info-request — NEW as sub-item of `[BE-ACR-02]`:** `POST /:caseId/cancel-info-request`. Returns status to `pending_review`.

**Prerequisites tracked / to file (kickoff §5a):**

- **`[BE-ACR-09]` Single-case GET endpoint** — ~2 days backend (needs to compose case + agent + evidence + timeline).
- **`[BE-ACR-10]` Two-person cast-vote endpoint + escalation wiring** — ~4 days backend (needs to touch `fin.approval_requests`, integrate with existing WF-07/08 pattern, add withdraw-vote).
- **`[BE-ACR-11]` Authenticated image proxy** — ~2 days backend.
- **`[BE-ACR-02]` + `[BE-ACR-03]` + `[BE-ACR-06]` + `[BE-ACR-07]`** — shared with PA-ACR-001 brief.
- **`[BE-ACR-12]` `POST /:caseId/withdraw-vote`** — NEW sub-item of `[BE-ACR-10]`.
- **`[BE-ACR-13]` `POST /:caseId/cancel-info-request`** — NEW sub-item of `[BE-ACR-02]`.

Combined new backend surface for the WF-04 PA cluster (queue + detail): ~15-18 days backend + tests.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/support/AccountRecoveryDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — `<Route path="/admin/support/account-recovery/:caseId" element={<AccountRecoveryDetailPage />} />` behind `PAConsoleGuard` (capability `account-recovery`).
- **Component reuse:**
  - `<PIIMask>` — reused from PA-ACR-001.
  - `<ChannelMark>` — reused from Broadcast primitives.
  - `<Numeric>` — reused.
  - `PAQueueKeyboardShortcutsPanel` — reused; pass PA-ACR-002-specific `shortcuts` map (V/A/R/I/U/Esc/?/Backspace).
- **New components:**
  - `AccountRecoveryDetailPage.tsx` — page shell + data fetching + URL state.
  - `AccountRecoveryIdentityCard.tsx` — Provided vs On-file grid.
  - `AccountRecoveryReasonCard.tsx` — reason + category.
  - `AccountRecoveryEvidenceGallery.tsx` — thumbnails + file list + preview modal.
  - `AccountRecoveryTimeline.tsx` — contact-attempt log wrapping the shared `<Timeline>`.
  - `AccountRecoveryDecisionPanel.tsx` — sticky right-column card + two-person progress + buttons + outcome.
  - `TwoPersonProgress.tsx` — **REUSABLE across WF-07/08/17/18/19/20/21/23/24/25/27/28 second-approval surfaces.** File: `web/src/components/ui/two-person-progress.tsx`.
  - `<Timeline>` primitive (if not already built for PA-AUD-001) at `web/src/components/ui/timeline.tsx` — **REUSABLE**.
  - `EvidencePreviewDialog.tsx` — modal image viewer served through authenticated proxy.
- **Data layer:**
  - Hook: `useAccountRecoveryCase(caseId)` — env-scoped GET; refetches after any mutation.
  - Hook: `useEvidencePreview(caseId, evidenceId)` — builds proxied URL for the modal viewer.
  - Hook: `useCastVote(caseId)` — wraps `POST /cast-vote` with step-up + optimistic + undo grace.
  - Hook: `useRequestInfo(caseId)`, `useCancelInfoRequest(caseId)`, `useWithdrawVote(caseId)`, `useRevealAudit(caseId, field)`.
- **Test discipline:**
  - Unit: each sub-component; TwoPersonProgress state machine (0/1/2 votes × approve/reject × same-PA blocked).
  - Integration: full page load × reveal-audit × evidence preview × approve happy path (standard, elevated, high-value first-vote, high-value second-vote-matches, high-value second-vote-mismatches → escalation) × reject × request-info × undo-within-grace × undo-blocked-token-used × cancel-info-request × withdraw-vote × own-case block × session expiry × 403 × env-switch mid-flow.
  - RTL: `screens.rtl.test.tsx` extension with the detail in Arabic locale; two-column split mirrors.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: at least one path that transitions high-value case through first-vote → matching second-vote → token issued → applicant completes SHR-AUT-005c reset (integration with existing recovery-token machinery).
  - Accessibility: axe-core scan of loaded + reveal-active + approve-dialog-open + first-vote-cast + second-reviewer states.
- **Perf:**
  - Evidence images loaded lazily (only the visible thumbnail slice fetches from the proxy).
  - Modal image loads at full resolution only when opened.
  - Skeleton within 100ms.
- **Copy/i18n:** all strings in `web/src/locales/en/paAccountRecovery.json` + `ar/paAccountRecovery.json` (shared file with PA-ACR-001).

---

## Broadcast alignment callouts (short)

**Refer to PA-MOD-001 §Broadcast alignment callouts + PA-ACR-001 §Broadcast alignment callouts as anchors.** All page-shell, header, focus-ring, radii, elevation, motion, no-raw-hex, PII-masking, and reveal-audit rules apply UNCHANGED.

PA-ACR-002-specific overlays:
- Two-column split gap `var(--lc-space-2xl)`; card padding `var(--lc-space-xl)`; card gap `var(--lc-space-lg)`.
- Decision panel sticky offset accounts for top-bar + TEST warning strip + back-nav row + header row.
- Two-person progress bar step colors: completed `--lc-status-published-{bg,fg,dot}` + ● glyph; pending `--lc-status-draft-{bg,fg,dot}` + ○ glyph.
- Decision buttons stacked vertically full-width inside the decision card at `var(--lc-space-sm)` gap; primary Approve orange; Request-info outline; Reject destructive-outline (outline color `--lc-status-danger-fg`, hover fill `--lc-status-danger-bg`).
- Undo pulse-border on the decision panel: `--lc-accent-bold-edge` 2px, pulsing at `--lc-duration-slow` for 30s; respect `prefers-reduced-motion`.
- Evidence thumbnails: `var(--lc-radius-md)` corners; hover `--lc-elevation-sm`; focus ring via base CSS.
- Evidence preview modal: `--lc-elevation-lg`; backdrop `--lc-z-modal`; image container max-width 90vw × max-height 80vh with object-fit contain.
- Timeline dot color: `--lc-accent-bold-edge` for success/info entries; `--lc-status-danger-fg` for failed entries; `--lc-status-warning-fg` for pending entries.
- Section titles inside cards: `var(--lc-type-heading-3)`; section sub-headings (Provided / On-file): `var(--lc-type-overline)` `var(--lc-text-muted)`.
- Every numeric — case-ID last-6, sla_hours_remaining, tenure days, sizes, timestamps, evidence count, page-size — via `<Numeric>` or `.lc-data`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) account-recovery detail screen (PA-ACR-002) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the WF-04 evaluation surface where a PA reviews ONE account-recovery request and casts a decision (Approve / Reject / Request info). High-value cases (agency owners on Enterprise, PA accounts) require two-person approval. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

This is a DELTA brief inheriting from PA-MOD-001 (portal moderation queue anchor) AND PA-ACR-001 (WF-04 queue delta). Critical shared patterns: PII masked by default with audited reveal; 30-second undo grace on Approve; step-up required for all high-value decisions; server enforces that the same PA cannot cast both first and second vote; evidence files served through an authenticated proxy (never a public URL).

First pass: render a high-value case in first-reviewer mode, no decision yet. LIVE env green badge. Back-nav ← Back to recovery queue. Case ID chip #B7F3A2. Header "Recovery case · #B7F3A2 · Pending review · Submitted 1h ago · SLA 22h 58m left" with High-value·2-person tier badge + WhatsApp channel chip on the right. Two-column 60/40 split: LEFT column = applicant identity card (masked Provided-at-request vs On-file grid with 1 mismatch chip), reason card (compromised_account), evidence gallery (5 thumbnails), contact-attempt timeline (4 entries). RIGHT column = sticky decision panel with two-person progress (both steps pending), reviewer strip "Your vote will be recorded…", 3 stacked full-width buttons (Approve primary orange / Request info outline / Reject destructive-outline), audit-note below.

LTR English only for this pass — I'll ask for reveal-active, approve-dialog, reject-dialog, request-info-dialog, undo-grace, first-vote-cast, second-reviewer, already-decided, RTL, dark mode as follow-ups.

Follow the copy table exactly. Do NOT invent applicant risk scores or confidence percentages. Every visible signal is a defined backend payload attribute.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Reveal-active on the Registered email field — value fully visible with hide-eye chip + 30s countdown ring on the field.`
2. `Approve dialog open (high-value second-reviewer variant) — "Sign off & issue recovery link", body prefixed with "You are the second reviewer for this high-value case.", notes textarea empty, confirm enabled.`
3. `Reject dialog open — reason "Suspected takeover attempt" selected, notes typed (≥10 chars), Confirm enabled.`
4. `Request-info dialog open — ID front + ID back + Selfie holding ID checked, reason "Missing government ID" selected.`
5. `After Approve — undo grace state — decision panel replaced with "Approved · Recovery link sent to +961 7X XXX XX41 on WhatsApp · valid for 30 min" + Undo (30s) link + card border pulse.`
6. `First vote cast (first-reviewer mode) — buttons hidden; strip reads "You've cast your vote (Approve). Awaiting second reviewer." + Withdraw my vote link. Two-person progress step 1 filled with initials.`
7. `Second-reviewer mode with first vote = Approve — strip reads "First reviewer approved this case. Your matching vote issues the recovery link immediately." Progress step 1 filled with the OTHER PA's initials. Confirm button label "Sign off & issue recovery link".`
8. `Already-decided (completed) — decision panel replaced with "Completed · Approved by SM on 2026-09-05 11:04 · Applicant reset password on 2026-09-05 11:22 from 185.104.XXX.XXX (masked IP)".`
9. `Evidence preview modal open — full-size id_front.jpg with filename header + size + Download button + Close.`
10. `TEST env — badge amber + full-width warning strip.`
11. `RTL Arabic at desktop 1440px with [TRANSLATION-PENDING]; MIRROR the two-column split; masked identifiers stay LTR via bidi isolation.`
12. `Dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-ACR-002/` + screenshot to `docs/design/mockups/PA-ACR-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 12 iteration states (ready-first-reviewer LIVE, reveal-active, approve-dialog, reject-dialog, request-info-dialog, undo-grace, first-vote-cast, second-reviewer, already-decided, evidence-preview, TEST env, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-ACR-002/`.
- [ ] Cursor Wave-2 Week-3 dispatch prompt references this brief + the mockup paths + the paired PA-ACR-001 brief.
- [ ] `[BE-ACR-09..13]` filed in kickoff §5a (queue-brief `[BE-ACR-01..08]` already tracked from PA-ACR-001).
- [ ] `<TwoPersonProgress>` primitive shipped as reusable at `web/src/components/ui/two-person-progress.tsx` — documented for reuse in future WF-07/08/17/18/19/20/21/23/24/25/27/28 second-approval surfaces.
- [ ] `<Timeline>` primitive shipped at `web/src/components/ui/timeline.tsx` if PA-AUD-001 has not already delivered it — coordinated with PA-AUD-001 owner.
- [ ] Backend note filed: the existing `POST /:caseId/approve` at `backend/src/server.js:7041` MUST be refactored to delegate through `[BE-ACR-10]` cast-vote before this UI ships, otherwise high-value cases would bypass two-person server-side.
- [ ] Broadcast `no-raw-hex.test.ts` and RTL screens tests updated to include PA-ACR-002.
