# Screen Brief — PA-ACR-001 · Account recovery queue (WF-04 approver-side, delta from PA-MOD-001)

**Layer-2 Delta Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the full PA approval-queue family pattern from anchor brief `docs/design/briefs/PA-MOD-001-portal-moderation-queue-brief.md`. Only the CHANGES from that anchor are enumerated here — everything not called out below (page shell, sticky filter strip pattern, table skeleton, keyboard shortcuts, pagination, empty state, error/loading states, accessibility, focus rings, dark mode, RTL treatment) is IDENTICAL to PA-MOD-001. Read PA-MOD-001 first; then apply the deltas in this file.

Wave 2 (Week 3 — WF-04 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 41 + §6 Week 3. Pairs with `PA-ACR-002` (detail) delta brief. WF-04 initiator surface is `SHR-AUT-005` request + `SHR-AUT-005b/c/d` email + TOTP + scheduled deletion (existing / merged).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND the anchor `PA-MOD-001-portal-moderation-queue-brief.md` §Broadcast alignment.** The PA-queue-family invariants (env badge always visible, two-person rule for high-value decisions, keyboard-first J/K/A/R/Enter/X/?/Esc, undo grace for single-row decisions, immutable audit on every action) apply UNCHANGED.

**PA-ACR-001-specific Broadcast deltas:**

- **PII sensitivity — masking by default.** Every applicant identity cell (email, phone, username, IP) renders MASKED using `<PIIMask>` primitive by default. Hover / focus on the masked cell shows an eye-toggle chip that reveals in-place with `--lc-duration-fast` cross-fade. Reveal writes an audit event (`pa_pii_viewed`). Never render raw PII in the table skeleton or in the URL.
- **Dispute-state cell** replaces the anchor's `Validator lint` cell. `<Badge>` variants: `pending_review` `--lc-status-draft-{bg,fg,dot}` + ○, `approved` `--lc-status-published-{bg,fg,dot}` + ●, `rejected` `--lc-status-closed-{bg,fg,dot}` + ◆, `awaiting_info` `--lc-status-warning-{bg,fg,dot}` + ▲, `completed` `--lc-status-published-{bg,fg,dot}` + ✓, `expired` `--lc-status-archived-{bg,fg,dot}` + ▢.
- **Evidence-count cell** replaces the anchor's `Tenure risk` cell. Renders "<Numeric>N</Numeric> files" chip in `var(--lc-type-caption)`. Zero-evidence rows show a warning glyph ⚠ + amber tint `--lc-status-warning`. Tooltip on hover lists the file names + upload timestamps.
- **Account-value tier cell** replaces the anchor's `Portal · Country` cell. `<Badge>` per tier: `standard` `--lc-status-draft-{bg,fg,dot}` + label "Standard"; `elevated` `--lc-status-warning-{bg,fg,dot}` + ▲ + "Elevated"; `high_value` `--lc-status-danger-{bg,fg,dot}` + ◆ + "High-value · 2-person". Tier derived server-side from account role + tenant size + plan; drives the two-person-rule requirement on PA-ACR-002.
- **Preferred-contact-channel micro-chip** below the masked applicant identity: `<ChannelMark>` for `email` / `sms` / `whatsapp` (fallback neutral chip for `phone_call`), 20px only. Never large surface.
- **SLA aging cell semantics.** Same visual as anchor (green >8h / amber 2-8h / red <2h or breached). SLA per WF-04 policy: **24h** for pending-review cases (fixed, not per-portal). Every numeric via `<Numeric>`.
- **Bulk-action bar is HIDDEN in this queue.** WF-04 decisions are single-row-only per PA family-pattern deviation #1 (see §Design goals). Selection checkboxes are absent; the header does NOT show a select-all checkbox. Keyboard shortcut `X` is repurposed to open the case in a new tab.
- **Filter strip deltas:** status tabs = `Pending review` (default) / `Approved` / `Rejected` / `Awaiting info` / `Completed` / `Expired`. Inline selects = `Account tier` (Any / Standard / Elevated / High-value), `Preferred channel` (Any / Email / SMS / WhatsApp / Phone call), `Submitted within` (24h / 7d default / 30d / All time). Search = agent name / masked email prefix / case ID last-4. Portal + Country selects from PA-MOD-001 are OMITTED (not applicable to WF-04).
- **Row actions on hover for Pending rows:** `Open` only. `Approve` / `Reject` / `Request info` are DISABLED as inline row actions per PA family-pattern deviation #1 — every decision requires the detail-screen evidence review (PA-ACR-002). This is the largest single deviation from the anchor.
- **PA queue-family invariant deviations for WF-04 (deliberate):**
  1. **No bulk actions.** PII sensitivity + evidence-per-case review discipline make bulk decisions unsafe. Force single-case review via PA-ACR-002.
  2. **No inline row Approve / Reject.** Same rationale. `Open` is the only row action.
  3. **Undo grace window is EXTENDED to 30 seconds** (vs 5s in anchor) because a wrong approve issues a recovery token that lets the applicant reset the password — much higher blast radius than a portal push. Detail-screen only.
  4. **PII-masking by default** with reveal audit; no other PA queue has this.
  5. All other invariants (env badge, two-person for high-value, keyboard-first, immutable audit, step-up policy) UNCHANGED.

Every other Broadcast token / typography / spacing / motion / focus-ring instruction from PA-MOD-001 §Broadcast alignment applies verbatim.

---

## Meta

| | |
|---|---|
| Screen ID | PA-ACR-001 |
| Screen name | Account recovery queue |
| Persona | PA (Platform Admin — elevated capability pack `account-recovery`; cannot approve cases where the applicant is the PA themselves; server-enforced) |
| Device targets | Desktop 1440px ONLY (same as PA-MOD-001; render "PA console requires a larger screen" info block on <1024px) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/support/account-recovery` (query params: `?status=pending_review\|approved\|rejected\|awaiting_info\|completed\|expired`, `?tier=standard\|elevated\|high_value`, `?channel=email\|sms\|whatsapp\|phone_call`, `?within=24h\|7d\|30d\|all`, `?q=<name-or-masked-prefix-or-caseid>`, `?page=<n>`) |
| Current state | MISSING (UI). Backend `GET /api/admin/account-recovery` VERIFIED EXISTS at `backend/src/server.js:7026`. Response shape needs extension — see §Backend contract. |
| Workflow role | WF-04 role = Approval queue (account recovery) |
| Backend prerequisites | ✅ `GET /api/admin/account-recovery` (list) · ✅ `POST /:caseId/approve` (`backend/src/server.js:7041`) · ✅ `POST /:caseId/reject` (`backend/src/server.js:7087`) · ⏳ `[BE-ACR-01]` list-response extension (masking flags, evidence count, account_value_tier, sla_hours_remaining, is_own) · ⏳ `[BE-ACR-02]` `POST /:caseId/request-info` endpoint · ⏳ `[BE-ACR-03]` evidence-upload schema + storage (see PA-ACR-002 brief) · ⏳ `[BE-ACR-04]` account-value-tier derivation service · ⏳ `[BE-ACR-05]` `X-Wingcaster-Env` scoping audit (WF-04 cases MUST be env-scoped — LIVE recovery ≠ TEST recovery) · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context |
| Cluster | Wave 2 (WF-04 cluster) alongside PA-ACR-002 (detail); pairs with initiator side SHR-AUT-005 / 005b / 005c / 005d (all merged) |

---

## Purpose

Platform Admin reviews the queue of account-recovery requests from users who lost access to the primary identifier on their account (lost email inbox access, phone number transferred to a new device, forgotten username paired with an out-of-service recovery contact). Each row is one applicant asking WingCaster to unlock their account and issue a password-reset token.

The queue exists because WF-04 (Account recovery) is the **support-ops rescue path** when the automated recovery chain (`SHR-AUT-005` → `005b` email challenge → `005c` TOTP challenge → `005d` scheduled deletion) cannot succeed — the user has neither working recovery contact nor working TOTP. The applicant fills the `SHR-AUT-005` request form with reason + preferred contact channel + optional evidence uploads (ID scans, tenancy-record screenshots, agency letterhead confirmation). WingCaster then requires a human review before issuing a recovery token, because the alternative is trusting the applicant's word that they own the account — which invites account-takeover.

The queue serves three PA tasks at three cadences:

1. **Continuous triage** — pending-review cases must clear within the WF-04 24h SLA. Aging + SLA chips make the SLA-at-risk rows scannable.
2. **Weekly hygiene** — approved / rejected / completed / expired views for audit + to spot patterns (a spike in rejected cases from one IP range means an attempted-takeover campaign; a spike in awaiting-info means the SHR-AUT-005 form is under-prompting for evidence).
3. **High-value escalation** — cases tagged `high_value` (agency owners, PAs, tenants above credit-limit threshold) route to a two-person approval on PA-ACR-002. The queue surfaces the tier so PA can decide whether to review now or wait for the second reviewer.

Success outcome: PA opens a case → reviews evidence on PA-ACR-002 → approves (server issues recovery token → applicant receives secure link on their PROVIDED contact channel → applicant lands on `SHR-AUT-005c` completion screen and resets password), rejects with reason (applicant sees rejection message via the same channel), or requests more info (applicant sees a fixable-issues list and can re-upload evidence via `SHR-AUT-005`). Zero pending cases past the 24h SLA. High-value approvals always double-signed.

---

## Design goals

Deltas from PA-MOD-001 §Design goals:

1. **Triage-first density** — SAME as anchor. PA scans dozens of cases in seconds.
2. **PII-safe by default.** Every identifier is masked. Reveal is a deliberate act audited server-side. The queue skeleton itself is safe to screenshot into a bug report.
3. **Evidence-count and account-tier are the two signals** that decide "review now vs escalate vs waitlist for two-person". No auto-decisioning.
4. **Keyboard-native** — SAME as anchor except `X` shortcut is repurposed (open-in-new-tab; row-select is absent because bulk is absent).
5. **No bulk actions** — WF-04 family deviation. Every case decided one-at-a-time on PA-ACR-002.
6. **Env-context is unambiguous** — SAME as anchor. LIVE recovery ≠ TEST recovery; server env-scopes the list.
7. **Two-person-rule visibility.** High-value tier badge is visible in the queue so PA can plan: "This one needs Sara's second approval — I'll open it and start the evidence review; Sara joins for the sign-off." The badge does NOT prevent a first-reviewer from opening the case.

---

## Layout

Deltas from PA-MOD-001 §Layout:

**Sticky header block:**
- Left: page title "Account recovery queue" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> pending review · <Numeric>K</Numeric> at-risk (breach in <Numeric>2h</Numeric>) · <Numeric>H</Numeric> high-value awaiting 2-person · <Numeric>M</Numeric> approved · <Numeric>J</Numeric> rejected this week" (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- Right: `Refresh` (icon), `Export CSV` (masked-only export by default; a second variant `Export CSV (with PII)` requires step-up + writes audit), `?` keyboard-hints. Same shell as anchor.

**Filter strip:**
- Row 1: status tabs `Pending review` (default) / `Approved` / `Rejected` / `Awaiting info` / `Completed` / `Expired` with per-tab counters.
- Row 2: `Account tier` Select, `Preferred channel` Select, `Submitted within` Select, search Input. NO Portal or Country selects.

**Bulk-action bar: OMITTED.** No row-select checkboxes; no bulk bar; no keyboard `Shift+A` shortcut.

**Table columns (desktop, left-to-right in LTR; mirror in RTL):**
1. Submitted — relative time + 24h-SLA chip below (default sort: SLA-at-risk first, then oldest).
2. Applicant identity — 32px avatar (from account profile, if available) + masked display name (`Ali *****`) + masked email (`a**@example.com`) or masked phone (`+971 5* *** **12`) or masked username (`al****23`) secondary line + preferred-channel `<ChannelMark>` micro-chip. Reveal-in-place eye toggle on hover / focus (writes audit).
3. Target account — account role tag (`Agent` / `Agency owner` / `PA` / `Vendor`), agency name (links to PA-TEN-001 in new tab), plan tier chip (from `plan_tier` — Semsar / Broker / Enterprise / Trial).
4. Reason — first ~60 chars of the applicant's reason field with ellipsis if longer. Full reason in `<Tooltip>` on hover. Category chip inferred server-side (`lost_email` / `lost_phone` / `forgotten_username` / `compromised_account` / `other`).
5. Evidence — `<Numeric>N</Numeric> files` chip; zero-evidence rows show ⚠ amber.
6. Account tier — badge (Standard / Elevated / High-value).
7. Dispute state — status badge.
8. Row action — `Open` only on hover.

Row height ~72px. Row click → PA-ACR-002 at `/admin/support/account-recovery/:caseId?return_to=<current-url>`.

**Pagination footer:** SAME as anchor.

### Empty state (Pending review, 0 rows)

- Illustration placeholder (same shell as anchor).
- Title: "No recovery cases awaiting review"
- Body: "When users submit recovery requests via SHR-AUT-005 that the automated challenges couldn't verify, they land here."
- Secondary CTA: "Review recent decisions →" — deep-links to Approved tab (same route, `?status=approved`).

### Empty state (Approved / Rejected / other tabs, 0 rows)

Simpler: title "No {status} cases in this range" + body "Try widening the 'Submitted within' filter."

### Below-min-viewport fallback

SAME as anchor.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror.

| Slot | Copy |
|---|---|
| Page title | Account recovery queue |
| Subtitle template | {N} pending review · {K} at-risk (breach in {T}) · {H} high-value awaiting 2-person · {M} approved · {J} rejected this week |
| TEST-env warning strip | TEST ENVIRONMENT — approvals here issue TEST recovery tokens only. |
| Status tab — pending_review | Pending review |
| Status tab — approved | Approved |
| Status tab — rejected | Rejected |
| Status tab — awaiting_info | Awaiting info |
| Status tab — completed | Completed |
| Status tab — expired | Expired |
| Filter — tier label | Account tier |
| Filter — tier options | Any tier · Standard · Elevated · High-value |
| Filter — channel label | Preferred channel |
| Filter — channel options | Any channel · Email · SMS · WhatsApp · Phone call |
| Filter — within label | Submitted within |
| Filter — within options | Last 24 hours · Last 7 days · Last 30 days · All time |
| Search placeholder | Search name, masked identifier, or case ID… |
| Refresh aria-label | Refresh recovery queue |
| Export CSV (masked) | Export CSV (masked) |
| Export CSV (with PII) | Export CSV (with PII) — requires step-up |
| Keyboard hints button aria-label | Show keyboard shortcuts |
| Shortcut — navigate down | `J` — next case |
| Shortcut — navigate up | `K` — previous case |
| Shortcut — open detail | `Enter` / `O` — open focused case |
| Shortcut — open detail new tab | `X` — open focused case in new tab |
| Shortcut — reveal PII | `V` — reveal PII on focused row (audited) |
| Shortcut — refresh | `.` — refresh queue |
| Shortcut — help | `?` — show shortcuts |
| Shortcut — close | `Esc` — close modal / clear focus |
| Column — submitted | Submitted |
| Column — applicant | Applicant |
| Column — target | Target account |
| Column — reason | Reason |
| Column — evidence | Evidence |
| Column — tier | Account tier |
| Column — state | State |
| Row action — open | Open |
| SLA remaining green | {H}h left |
| SLA remaining amber | {H}h left · at risk |
| SLA remaining red | Breached by {H}h |
| Reveal-PII eye tooltip | Reveal PII (audited) |
| Revealed-PII eye tooltip | Hide PII |
| Evidence chip template (has-files) | {N} files |
| Evidence chip zero | 0 files ⚠ |
| Tier — standard | Standard |
| Tier — elevated | Elevated |
| Tier — high_value | High-value · 2-person |
| Empty pending — title | No recovery cases awaiting review |
| Empty pending — body | When users submit recovery requests via SHR-AUT-005 that the automated challenges couldn't verify, they land here. |
| Empty pending — CTA | Review recent decisions → |
| Empty other-tab — title | No {status} cases in this range |
| Empty other-tab — body | Try widening the 'Submitted within' filter. |
| Loading | Loading recovery cases… |
| Env-switch loading | Switching to {env}. Reloading recovery queue… |
| Error banner | Couldn't load recovery cases. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Rows per page |
| Own-case block | You can't act on this row — you are the applicant. |

---

## Component palette

Inherits the palette table from PA-MOD-001 with the following deltas:

| Element | Primitive |
|---|---|
| Row-select checkbox | **REMOVED** (no bulk) |
| Bulk action bar | **REMOVED** |
| Bulk approve / reject / request-info modals | **REMOVED** |
| Portal chip / Country flag | **REMOVED** (WF-04 has no portal dimension) |
| Validator lint pill row | **REMOVED** |
| Tenure risk badge | **REMOVED** (replaced by `Account tier badge` below) |
| Applicant identity cell | **NEW** — `<PIIMask>` primitive wrapping avatar + masked name + masked identifier + `<ChannelMark>` micro-chip. Reveal-in-place with eye toggle → audit event on reveal. |
| PIIMask primitive | **NEW REUSABLE PA-family primitive** — file: `web/src/components/ui/pii-mask.tsx`. Props: `{ value, kind: "email" \| "phone" \| "username" \| "name" \| "ip", auditContext: { caseId, field } }`. Emits `pa_pii_viewed` audit call on reveal. |
| Evidence-count chip | **NEW** — `<Badge>` with `Paperclip` lucide icon prefix + `<Numeric>` count + tooltip listing filenames. |
| Account tier badge | **NEW** — `<Badge>` (Standard / Elevated / High-value) with glyph + label. |
| Dispute-state badge | Same `<Badge>` primitive, WF-04-specific variant set. |
| Export CSV (masked / with PII) | Split `Button` — default variant masked, dropdown item "with PII" gated by step-up. |

Everything else (page title, env badge, TEST strip, status tabs, filter selects, search input, table shell, avatar, row hover, focus ring, pagination, empty-state block, error banner, toast, tooltip, keyboard hints Sheet, icons) inherits from PA-MOD-001.

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Header:** "Account recovery queue" title, subtitle "12 pending review · 2 at-risk (breach in 3h) · 3 high-value awaiting 2-person · 28 approved · 4 rejected this week".
- **Filter strip:** `Pending review` tab active (counter 12), Approved (28), Rejected (4), Awaiting info (2), Completed (25), Expired (1); Account tier `Any tier`; Preferred channel `Any channel`; Within "Last 7 days"; search empty.
- **Table with 8 sample rows (all Pending review):**
  1. Submitted "18m ago · 23h 42m left" · Avatar "OK" **Omar K******* ** ****** ** ** ******** (masked)** · Masked email `o***@********.ae` + email `<ChannelMark>` · Target **Agent** *Blue Door LB* Broker plan · Reason "Lost phone; SMS OTP no longer reaching me…" cat *lost_phone* · Evidence 2 files · Standard · Pending review
  2. Submitted "1h ago · 22h 58m left" · Avatar "SM" **Sara M*******i** · Masked email `s***@********.com` + email chip · Target **Agency owner** *Elite Real Estate Dubai* Enterprise · Reason "Compromised account; changed email…" cat *compromised_account* · Evidence 5 files · **High-value · 2-person** · Pending review
  3. Submitted "3h ago · 20h 47m left" · Avatar "LG" **Layla G*****s** · Masked phone `+961 7* *** **41` + WhatsApp chip · Target **Agent** *Beirut Homes* Semsar · Reason "Forgot username; secondary contact expired…" cat *forgotten_username* · Evidence 1 file · Standard · Pending review
  4. Submitted "5h ago · 18h 47m left" · Avatar "MR" **Mohammed A******d** · Masked username `mo****23` + SMS chip · Target **Agent** *Riyadh Off-Plan Partners* Broker · Reason "Lost email inbox; company IT deleted mailbox…" cat *lost_email* · Evidence 3 files · Elevated · Pending review
  5. Submitted "8h ago · 15h 47m left" · Avatar "NA" **Noura A***i** · Masked email `n***@********.ae` + email chip · Target **Agent** *Sharjah Coastal Realty* Semsar · Reason "Other — see notes" cat *other* · Evidence 0 files ⚠ · Standard · Pending review
  6. Submitted "12h ago · 11h 47m left" · Avatar "YT" **Youssef T***k** · Masked email `y***@********.eg` + email chip · Target **Agent** *New Cairo Properties* Broker · Reason "Compromised account" cat *compromised_account* · Evidence 4 files · **High-value · 2-person** · Pending review
  7. Submitted "18h ago · 5h 47m left · at risk" (amber) · Avatar "FS" **Fatima S******n** · Masked phone `+968 9* *** **12` + phone-call chip · Target **Agency owner** *Muscat Waterfront* Enterprise · Reason "Lost phone number entirely — transferred…" cat *lost_phone* · Evidence 2 files · **High-value · 2-person** · Pending review
  8. Submitted "22h ago · 1h 47m left · at risk" (red-amber) · Avatar "OZ" **Omar Z***d** · Masked email `o***@********.jo` + email chip · Target **Agent** *Amman Skyline* Semsar · Reason "Lost email inbox" cat *lost_email* · Evidence 1 file · Standard · Pending review
- **Row 2 (Sara) in hover state:** row background `--lc-surface-sunken`, `Open` action button visible on right, PII reveal-eye chip visible next to the masked identifier.
- **Pagination footer:** "1–8 of 12" · prev disabled · next enabled · Rows per page 25.
- **Side variants:**
  - **Awaiting info tab:** 2 sample rows in Awaiting info state.
  - **High-value filter applied:** rows 2, 6, 7 only.
  - **Empty state:** Pending review tab with 0 rows.
  - **Reveal-PII active on row 3:** email fully visible with hide-eye chip in "revealed" state.

Do NOT fabricate applicant risk scores, IP reputation, or "confidence percentages" not returned by the backend contract. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

Deltas from PA-MOD-001 §Interactions:

- **On page load:** fetch `GET /api/admin/account-recovery?status=pending_review&within=7d&page=1&pageSize=25` scoped to current env (`X-Wingcaster-Env` header).
- **On row hover:** row background swaps to `--lc-surface-sunken`; `Open` action button fades in at right; PII reveal-eye chip fades in next to each masked identifier. NO inline Approve / Reject / Request-info buttons.
- **On row click** (anywhere except reveal-eye chip): navigate to PA-ACR-002.
- **On reveal-eye click** (or `V` shortcut on focused row): fire `POST /api/admin/account-recovery/:caseId/reveal-audit` with `{ field: "email" | "phone" | "username" | "ip" }`; on success, swap masked value to plain-text for 30 seconds then re-mask automatically (writes only one audit event per reveal window).
- **On Export CSV (masked)**: fires `GET /api/admin/account-recovery.csv?<same-query>&mask=true`. Instant download.
- **On Export CSV (with PII)**: fires step-up prompt (SHR-MFA-007). On success, fires `GET .../.csv?<same-query>&mask=false&stepup_token=...`. Writes a bulk-reveal audit event containing every case_id + field exported.
- **On keyboard shortcut:** `J` next · `K` prev · `Enter` / `O` open · `X` open in new tab · `V` reveal PII (audited) · `.` refresh · `?` shortcuts · `Esc` close/clear.
- **Bulk actions:** NONE — no bulk-approve, no bulk-reject, no bulk-request-info; no keyboard select shortcut.
- **Env-switch mid-flow:** SAME as anchor (queue refetches in new env, focus resets to row 1).

Everything else (initial loading skeleton, status-tab change, filter change, search debounce, pagination, error → Retry, session expiry → SHR-AUT-001, insufficient permission → 403 block, RTL, dark mode) inherits from PA-MOD-001.

---

## State variants

Deltas from PA-MOD-001 §State variants:

| Variant | Trigger | Behavior |
|---|---|---|
| **Bulk states** | — | ALL REMOVED (no bulk). |
| **PII-revealed (single field)** | Reveal-eye click or `V` shortcut | Value swaps to plain text for 30s; eye chip flips to "hide"; row shows a 30s countdown ring; auto re-mask on expiry OR on row navigation. |
| **PII-revealed (whole row)** | `Shift+V` (rare) | All maskable fields on the focused row revealed for 30s. Extra audit entry. |
| **Own-case in queue** | Server returns `is_own=true` on any row | Row action `Open` disabled + tooltip "You can't act on this row — you are the applicant." Row remains listed for transparency but is non-actionable. |
| **High-value in queue** | `account_value_tier=high_value` | Tier badge amber-danger; row tooltip on tier badge reads "Approval requires two-person on PA-ACR-002." |
| **Awaiting-info tab** | Tab change | Rows show state "Awaiting info" and last-info-requested timestamp; `Open` action available (PA can withdraw the request or upgrade to reject). |
| **Completed tab** | Tab change | Rows show `completed_at` and `completion_ip`; `Open` opens the read-only detail. |
| **Export-with-PII step-up** | Export dropdown item click | SHR-MFA-007 modal opens; on success, download starts and an audit event lists every case_id revealed. |
| **Reveal-audit failure** | `POST /reveal-audit` returns 500 | Reveal blocked; toast "Couldn't record audit — reveal denied." Value stays masked. |
| **TEST-env warning strip** | env=TEST | Persistent full-width warning strip renders under top bar. Copy adjusted to: "TEST ENVIRONMENT — approvals here issue TEST recovery tokens only." |

Everything else (initial loading, ready-pending default, ready-other-tab, empty variants, search-no-results, backend 500, session expired, permission denied, dark mode, RTL, loading-pagination, loading-filter-change) inherits from PA-MOD-001.

---

## Accessibility

Inherits from PA-MOD-001 §Accessibility. **PA-ACR-001 additions:**

- `<PIIMask>` primitive: masked value has `aria-label="Masked {kind} — press V or click reveal to disclose (audited)"`. Reveal state changes announced via `aria-live="polite"` → "Email revealed for 30 seconds."
- Countdown ring on revealed row has `aria-hidden` (visual only); auto-remask event announces "Email re-masked."
- Export-with-PII step-up prompt is dialog + focus trap; explicit `aria-describedby` on the confirm button reading "This export includes personally identifiable information. Every disclosure is audited."

---

## Anti-patterns (do not do these)

Inherits from PA-MOD-001. **PA-ACR-001 additions:**

- Do NOT render raw PII in the table skeleton, in a URL query, or in error toasts.
- Do NOT allow reveal without an audit event succeeding server-side first.
- Do NOT surface a bulk-approve or bulk-reject affordance — WF-04 is single-case-only by policy.
- Do NOT expose the `_dev_recovery_token` field (backend returns it only in non-production env; UI must ignore it in every env and never render).
- Do NOT persist a reveal beyond 30 seconds or across row navigation.
- Do NOT lose the applicant-is-yourself guard (`is_own`) even if the backend returns `null`.

---

## Backend contract

**List endpoint:** `GET /api/admin/account-recovery` — **EXISTS** at `backend/src/server.js:7026`.

Current returned shape (from source): array of `account_recovery_cases` rows augmented with `.agent` = `serializeAgent(agent)`. Fields per row: `id, user_id, email, preferred_channel, contact, reason, status, requested_ip, requested_user_agent, created_at, approved_at, approved_by, rejected_at, rejected_by, review_notes, completed_at, completion_ip, agent`.

**`[BE-ACR-01]` List-response extension** — required for this UI:

```json
{
  "cases": [
    {
      "id": "acr_abc123",
      "created_at": "2026-09-07T12:04:11Z",
      "sla_hours_remaining": 23.7,
      "sla_hours_total": 24.0,
      "status": "pending_review",
      "reason": "Lost phone; SMS OTP no longer reaching me…",
      "reason_category": "lost_phone",
      "preferred_channel": "whatsapp",
      "contact": "+961 7X XXX XX41",
      "requested_ip": "185.104.XXX.XXX",
      "agent": {
        "id": "usr_xyz789",
        "display_name_masked": "Omar K*****",
        "display_name_full": "Omar Khoury",
        "avatar_url": "https://…",
        "email_masked": "o***@********.ae",
        "email_full": "omar.khoury@example.ae",
        "phone_masked": "+971 5X XXX XX12",
        "phone_full": "+971 55 123 4512",
        "username_masked": "om****23",
        "username_full": "omar_kh23",
        "role": "agent",
        "agency": { "id": "agy_bluedoor_lb", "name": "Blue Door LB", "tenant_url": "/admin/tenants/agy_bluedoor_lb" },
        "plan_tier": "broker"
      },
      "evidence": {
        "file_count": 2,
        "files": [
          { "filename": "id_front.jpg", "uploaded_at": "2026-09-07T12:04:20Z", "size_bytes": 218430, "content_type": "image/jpeg" },
          { "filename": "id_back.jpg", "uploaded_at": "2026-09-07T12:04:35Z", "size_bytes": 208112, "content_type": "image/jpeg" }
        ]
      },
      "account_value_tier": "standard",
      "requires_two_person": false,
      "is_own": false,
      "env": "live"
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 12, "has_next": false },
  "counts": {
    "pending_review": 12,
    "pending_at_risk": 2,
    "high_value_awaiting_two_person": 3,
    "approved_this_week": 28,
    "rejected_this_week": 4,
    "awaiting_info_this_week": 2,
    "completed_this_week": 25,
    "expired_this_week": 1
  }
}
```

**Single actions:**
- `POST /api/admin/account-recovery/:caseId/approve` — **EXISTS** at `backend/src/server.js:7041`. Body `{ notes }`. Issues recovery token (30-minute TTL).
- `POST /api/admin/account-recovery/:caseId/reject` — **EXISTS** at `backend/src/server.js:7087`. Body `{ notes }`.
- **NEW `[BE-ACR-02]` `POST /api/admin/account-recovery/:caseId/request-info`** — required for the Awaiting-info flow. Body `{ reason_code, notes, requested_evidence: ["id_front", "id_back", "tenancy_record", ...] }`. Transitions `status → awaiting_info`; sends notification to applicant on their preferred channel with the list of requested evidence.
- **NEW `[BE-ACR-06]` `POST /api/admin/account-recovery/:caseId/reveal-audit`** — records the reveal event server-side before the UI unmasks. Body `{ field: "email"|"phone"|"username"|"ip"|"row" }`. Returns 200 on success; 429 if reveal-rate-limit exceeded.
- **NEW `[BE-ACR-07]` `POST /api/admin/account-recovery/:caseId/undo-approve`** — required for the 30-second undo grace. Only succeeds if the issued recovery token has not yet been consumed.

**CSV export:** **NEW `[BE-ACR-08]`** — `GET /api/admin/account-recovery.csv?<same-query>&mask=true|false`. Masked variant is unauthenticated-safe; unmasked variant requires step-up header + writes bulk audit.

**Query params (list):**
- `status` — as above (default `pending_review`)
- `tier` — `standard` | `elevated` | `high_value` (default all)
- `channel` — `email` | `sms` | `whatsapp` | `phone_call` (default all)
- `within` — `24h` | `7d` (default) | `30d` | `all`
- `q` — search string (≥2 chars; server-side substring match on full display_name + full email prefix + case_id last 4 + masked variants; server never returns rows that only matched full-PII when `mask=true` and the caller lacks the reveal capability)
- `page`, `pageSize`, `sort` — SAME semantics as anchor

**Prerequisites tracked / to file (kickoff §5a):**

- **`[BE-ACR-01]` List-response extension** — extend `GET /api/admin/account-recovery` to return the shape above (add masking flags, evidence, tier, is_own, env, pagination, counts). Currently returns a flat array truncated at 300 rows with no masking. ~2 days backend.
- **`[BE-ACR-02]` `POST /:caseId/request-info` endpoint** — NEW. ~1 day backend + notification wiring.
- **`[BE-ACR-03]` Evidence upload schema + storage** — see PA-ACR-002 brief. Required by SHR-AUT-005 uploader too. ~3 days backend.
- **`[BE-ACR-04]` `account_value_tier` derivation service** — NEW. Rule: `high_value` when applicant is `agency_owner` of a tenant on Enterprise plan OR has PA role OR agency credit-outstanding above threshold; `elevated` when `agency_owner` on Broker plan OR PA-designate; `standard` otherwise. ~1 day backend.
- **`[BE-ACR-05]` Env-scoping audit** — verify `X-Wingcaster-Env` scoping on the list + all case-level POST endpoints. ~0.5 day audit.
- **`[BE-ACR-06]` `POST /:caseId/reveal-audit` endpoint** — NEW. Writes to immutable audit (PA-AUD-001). Rate limit 20 reveals per PA per hour. ~1 day.
- **`[BE-ACR-07]` `POST /:caseId/undo-approve` endpoint** — NEW. Refuses if the issued token has been consumed (checked against `used_recovery_tokens`). ~1 day.
- **`[BE-ACR-08]` CSV export (masked + PII variants)** — NEW. ~1 day.

Total new backend surface for the PA-ACR-001+002 pair: ~10-12 days.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/support/AccountRecoveryQueuePage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/support/account-recovery" element={<AccountRecoveryQueuePage />} />` behind the `PAConsoleGuard` HOC (capability pack `account-recovery`).
- **Top-nav entry:** update PA top nav to add "Support → Account recovery" with a badge counter tied to `pending_review` count (poll every 60s).
- **Component reuse (from PA-MOD-001 anchor):**
  - `PAQueueFilterStrip` — reused with WF-04-specific `filterSchema` prop.
  - `PAQueueTable` — reused with `showSelectionColumn={false}` (new prop needed on the anchor's component).
  - `PAQueueKeyboardShortcutsPanel` — reused; pass WF-04-specific `shortcuts` map (no `X`/`Shift+A` for select; `X` repurposed to open-in-new-tab, `V` added for reveal).
  - `PAQueueBulkBar`, `PAQueueBulkApproveDialog`, `PAQueueBulkReasonDialog` — NOT used.
- **New components:**
  - `AccountRecoveryQueuePage.tsx` — page shell + data fetching + URL state + env context.
  - `AccountRecoveryRow.tsx` — one row (masked applicant, target, reason, evidence, tier, state, open).
  - `AccountRecoveryEmptyState.tsx` — WF-04-specific empty state.
  - `<PIIMask>` primitive at `web/src/components/ui/pii-mask.tsx` — **REUSABLE across future PA support surfaces (PA-USR-001/002, PA-SUP-*, PA-KYC-*)**.
- **Data layer:**
  - Hook: `useAccountRecoveryQuery({ status, tier, channel, within, q, page, pageSize, sort, env })` — wraps `fetch`; env-scoped.
  - Hook: `useRevealPII({ caseId, field })` — writes audit before unmask; auto-remask timer.
  - No bulk-mutation hooks needed.
- **Test discipline:**
  - Unit: `<PIIMask>` mask/reveal/audit-failure/timer/reduced-motion.
  - Integration: page load × filter × tab-swap × row-click × reveal-audit-happy-path × reveal-audit-rate-limit-block × env-switch mid-flow × 403-permission-denied × own-case block.
  - RTL: masked identifiers stay LTR via bidi isolation even in Arabic locale.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: at least one path that transitions a case through pending_review → approved on PA-ACR-002 (covered by pair brief).
  - Accessibility: axe-core scan of loaded + reveal-active + step-up-open states.
- **Perf:** unvirtualized fine at pageSize 100. Skeleton within 100ms.
- **Copy/i18n:** all strings in `web/src/locales/en/paAccountRecovery.json` + `ar/paAccountRecovery.json`. `[TRANSLATION-PENDING]` in AR.

---

## Broadcast alignment callouts (short)

**Refer to PA-MOD-001 §Broadcast alignment callouts as the anchor.** All page-shell, header, filter, table, pagination, empty-state, loading-skeleton, focus-ring, radii, elevation, motion, and no-raw-hex rules apply UNCHANGED.

PA-ACR-001-specific overlays:
- `<PIIMask>` primitive: mask style uses `var(--lc-text-muted)` + `letter-spacing: 0.05em` for the mask characters; revealed state uses `var(--lc-text-primary)` + a 30s countdown ring using `--lc-accent-bold-edge` at 2px pulsing at `--lc-duration-slow` (respect `prefers-reduced-motion`).
- Reveal-eye chip: `<Button size="icon" variant="ghost">` with `Eye` / `EyeOff` lucide icons, 24×24 (visual), 44×44 tap-target; icon color `var(--lc-text-muted)` → `var(--lc-text-brand)` on hover.
- Account-tier badge (high-value variant): uses the `--lc-status-danger-{bg,fg,dot}` token set + ◆ glyph + label "High-value · 2-person". Reserve the danger tint for this tier only; do NOT reuse for other severities.
- Bulk-bar tokens: not applicable.
- Export dropdown: use `<DropdownMenu>` with a lock icon `Lock` (lucide) prefixing the "with PII" item to signal step-up.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) account-recovery queue screen (PA-ACR-001) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin reviews account-recovery requests from users who lost access to their primary identifier (email inbox, phone number, or username) and could not complete automated recovery challenges (WF-04 approver-side inbox). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

This is a DELTA brief inheriting from PA-MOD-001 (portal moderation queue) — same page shell, same env badge, same filter strip pattern, same table skeleton, same keyboard nav (with WF-04-specific deltas). The critical differences: PII masked by default with audited reveal, no bulk actions, no inline row approve/reject (Open only), evidence-count and account-tier as the two decision signals.

First pass: render the desktop 1440px layout with the LIVE env badge in the top bar (green), Pending review tab active (counter 12), 8 sample rows all Pending review (mix of standard/elevated/high-value tiers, mix of preferred channels across MENA countries), row 2 in hover state showing PII reveal-eye chip + Open button. Pagination footer "1–8 of 12".

LTR English only for this pass — I'll ask for reveal-active state, high-value filter, awaiting-info tab, TEST env, empty state, RTL Arabic, dark mode as follow-ups.

Follow the copy table exactly. Do NOT invent risk scores or confidence percentages. Every visible signal is a defined backend payload attribute.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Reveal-PII active on row 3 — email fully visible with hide-eye chip + 30s countdown ring around the row.`
2. `High-value filter applied — only high-value rows shown (rows 2, 6, 7 from sample). Highlight the "2-person" callout in each tier badge.`
3. `Awaiting-info tab active with 2 sample rows showing "Requested 2h ago" secondary line.`
4. `TEST env — badge amber TEST + full-width warning strip under top bar with WF-04-specific copy ("TEST ENVIRONMENT — approvals here issue TEST recovery tokens only.").`
5. `Empty state — Pending review tab with 0 rows. Illustration placeholder + title + body + secondary CTA "Review recent decisions".`
6. `Export dropdown open — showing "Export CSV (masked)" default and "Export CSV (with PII) — requires step-up" gated item with Lock icon prefix.`
7. `Keyboard shortcut drawer open — J/K/Enter/O/X/V/./?/Esc listed.`
8. `RTL Arabic at desktop 1440px with [TRANSLATION-PENDING] where copy has no Arabic; MIRROR the layout; masked identifiers stay LTR via bidi isolation.`
9. `Dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-ACR-001/` + screenshot to `docs/design/mockups/PA-ACR-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states (ready-pending LIVE, reveal-active, high-value-filter, awaiting-info tab, TEST env, empty, export-dropdown, keyboard drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-ACR-001/`.
- [ ] Cursor Wave-2 Week-3 dispatch prompt references this brief + the mockup paths + the paired PA-ACR-002 brief.
- [ ] `[BE-ACR-01..08]` filed in kickoff §5a.
- [ ] `PAQueueTable` extended to support `showSelectionColumn={false}` prop before this queue's implementation lands.
- [ ] `<PIIMask>` primitive shipped as a reusable UI component (documented for reuse in future PA-USR-*, PA-SUP-*, PA-KYC-* surfaces).
- [ ] Delta brief `PA-ACR-002-account-recovery-detail-brief.md` referenced from Wave-2 Week-3 dispatch prompt.
