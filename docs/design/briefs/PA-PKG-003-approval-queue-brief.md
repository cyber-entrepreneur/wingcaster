# Screen Brief — PA-PKG-003 · Package approval queue + detail (WF-07 second-approver)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits Broadcast alignment + PA console shell + PA-PKG-family invariants unchanged from `PA-PKG-001-package-list-brief.md` (anchor) AND inherits the reusable PA-queue-family Broadcast callout block + invariant set from `PA-MOD-001-portal-moderation-queue-brief.md` (queue anchor). This file covers only what differs for the package-version approval queue + single-version detail surface. Read PA-PKG-001 first, then PA-MOD-001, then this file.

Interfaces with the generic approvals queue and generic approval-detail screens in the PA matrix:
- `PA-APR-001` (generic approvals queue) — package rows appear there too but link back to THIS screen's detail view for package-specific diff rendering. This screen is the WF-07 specialization.
- `PA-APR-002` (generic approval detail) — package versions render the same shape here for consistency; this brief details the package-specific diff panel that replaces the generic key-value diff.
- `PA-APR-003` (action confirmation modal) — reused here for the Approve confirm step, unchanged.

Companion to Cursor prompt `docs/prompts/CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-003 — Approval queue + detail" and matrix `SCREEN_MATRIX_PA.md` §6 (`PA-PKG-005` in the pre-Rev-6 numbering — collapsed into this brief per the Rev-6 four-screen slate).

Wave 3.5 (Week 6). Backend prerequisite is the admin approval endpoints in Cursor prompt §2.1 (`POST /:version/approve` + `POST /:version/reject`) — hooks into the existing WF-20 approval infrastructure from PR #44 (`fin.approval_requests` table). On approve, marketing-site revalidation fires per §2.6.

---

## Broadcast alignment

**Inherits `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` + `PA-PKG-001` §Broadcast-alignment callouts + `PA-MOD-001` §Broadcast-alignment callouts (PA-queue-family) + the PA-PKG-family invariants (1..8) + the PA-queue-family invariants (1..7) verbatim.** Where the two invariant sets overlap (env badge, two-person rule, audit, step-up, keyboard-first, undo grace), take the STRICTER interpretation. Screen-specific deltas below.

- **Two-view surface.** Route `/admin/packages/approvals` renders the queue (list of PENDING_APPROVAL versions across all packages in the env). Route `/admin/packages/approvals/:versionId` renders one version's detail. Both use the same PA console shell + env badge + TEST warning strip.
- **Queue table columns** (specialized from PA-MOD-001):
  1. Row-select checkbox — bulk actions are NOT supported here in v1 (see §Design goals point 2). Column is present but disabled with a tooltip explaining. **File as `[UX-DECISION-01] Bulk approval on package versions — deferred to Phase 2.**
  2. Submitted — relative time (`2h ago`) + full timestamp on tooltip; column is default sort desc.
  3. Package — display_name (primary) + tagline (secondary muted).
  4. Version — `v{N} (from v{M})` in mono `<Numeric>` — makes the "we're upgrading from v6 to v7" scan obvious.
  5. Submitter — 32px avatar + display name + role chip ("PA · Elite Support"). Links to a tenant/user detail view on the avatar click.
  6. Change summary — a compact one-line diff summary: `Price · 5 features · Property cap` — chips per changed field-group (Price / Cap / Features / Toggles / Portal group / Support level / Identity). Chips use `--lc-surface-sunken` fill + `--lc-text-primary` text; the Price + Cap chips carry an amber `--lc-status-warning-dot` prefix to hint the two-person requirement.
  7. Two-person indicator — a small badge: two-person required `<Badge>` `--lc-status-warning-{bg,fg,dot}` + ▲ + "Two-person"; single-person `<Badge>` `--lc-status-draft-{bg,fg,dot}` + ○ + "Single". Absence of the two-person badge means the submitter can self-approve after cooling-off.
  8. Status — always `Pending` on this queue tab (approved/rejected go to PA-PKG-004 history); pill `--lc-status-warning-{bg,fg,dot}` + ▲ + "Pending".
  9. Row actions (on hover) — `Open` (opens detail view) is the only inline action. Approve + Reject decisions require the detail view — the queue does NOT support inline decisions in v1 because a package-version approval WITHOUT reading the diff is a footgun.
- **Detail view layout — 62/38 split, same as PA-PKG-002 editor:**
  - Left column (62%): read-only rendering of every field in the pending version, organized in the same 8 sections as PA-PKG-002 (Identity / Caps / Price / Trial / Portal group / Feature quotas / Feature toggles / Support level). Each field renders its CURRENT (ACTIVE) value on top + NEW (pending) value below, with unchanged fields collapsed by default under a "Show unchanged fields (N)" expand link. Changed fields expanded; price + property_cap fields carry `--lc-status-warning-bg` tint per PA-PKG-002 diff panel styling.
  - Right column (38%):
    - **Metadata card**: submitter name + avatar + submitted-at (full timestamp) + version transition line (`v6 → v7`) + two-person indicator badge + change-summary chips (repeat of the queue's summary chips).
    - **Approvers list card**: shows who has approved so far. Header "Approvers (needs {N})" where N is 1 or 2. Rows: avatar + display name + timestamp + `<Badge>` "Approved". If the current PA is the submitter AND two-person is required, a `--lc-text-muted` italic line reads "You submitted this — a second admin must approve." with the Approve button disabled and a tooltip.
    - **Actions card**: `Approve` primary button (disabled with tooltip if self-submit-blocked OR if `--lc-status-danger` if some invariant fails), `Reject` secondary (opens Reason modal), a smaller `Recall` ghost link visible ONLY to the submitter (reused pattern from matrix `PA-APR-006`).
- **Approvers list rendering:** if two-person and 0 approved: "0 of 2". If two-person and 1 approved (someone else): "1 of 2 · You can approve next." with Approve button enabled + step-up. If single-person and submitter+cooling-off elapsed: "0 of 1 · Cooling-off complete. You can approve your own submission." with Approve enabled + step-up.
- **Approve confirmation modal (PA-APR-003 pattern):** AlertDialog "Approve v{N} of {Package display_name}?" body "Approving deactivates v{M} (currently ACTIVE) and this new version becomes ACTIVE immediately. The marketing site will refresh within ~5 seconds." Confirm button `Approve and publish` (primary). Below the copy, a small note: "Audit entry will be written under your identity."
- **Reject modal:** `Dialog` "Reject v{N} of {Package display_name}" body: `<Select>` reason vocabulary (`Price too high` / `Cap too aggressive` / `Feature quota mismatch` / `Marketing copy needs work` / `Duplicate with prior version` / `Timing wrong` / `Other`) + `<Textarea>` notes (required, ≥5 chars — "Explain to the submitter what needs changing"). Confirm `Reject and return to draft` (destructive-secondary — uses `--lc-status-danger-fg` text on `--lc-surface-raised` bg with a `--lc-status-danger-bg` outline on hover, per PA-MOD-001 reject pattern) fires the reject action.
- **On-approve marketing revalidation feedback:** Sonner toast "Approved v{N} · Marketing site refreshing…" on POST 200. A follow-up toast "Marketing site refreshed" fires if the revalidation confirmation ping returns within 10s; otherwise WARN toast "Marketing site refresh may be delayed — check wingcaster.com/pricing in a few minutes" (non-blocking, DB write already succeeded).
- **Undo grace on Reject only** (PA-queue-family invariant #6): 5-second Undo link in the Reject toast. Approve is IRREVOCABLE once the marketing revalidation has fired — no Undo affordance for Approve (would leave the marketing site in a transient wrong state). Copy this reasoning into the Approve confirmation modal as a small footer note: "Approval is final. Reversing later requires submitting a new DRAFT version."
- **Radii / motion / focus:** inherited unchanged from PA-MOD-001 + PA-PKG-002. Detail view uses `--lc-duration-slow` slide-in from the right when navigating from the queue; `--lc-duration-fast` fade otherwise.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PKG-003 (queue + detail — two routes, one brief) |
| Screen name | Package approval queue (list) · Package approval detail (single version) |
| Persona | PA (Platform Admin — `platform_role === 'platform_admin'`; elevated for the Approve/Reject actions via SHR-MFA-007 step-up when two-person required or when the diff includes price/property_cap changes) |
| Device targets | Desktop 1440px ONLY |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Queue: `/admin/packages/approvals` (query `?package=<id>&submitter=<user>&type=two_person\|single&within=24h\|7d\|30d\|all&sort=submitted_at:asc\|desc&page=<n>`) · Detail: `/admin/packages/approvals/:versionId` (query `?return_to=<url>`) |
| Current state | MISSING — this brief supersedes matrix `PA-PKG-005 PackageApproval.tsx` which existed pre-Rev-6 for the legacy `/admin/fin/packages` route. New files: `web/src/pages/admin/packages/PackageApprovalQueuePage.tsx` + `web/src/pages/admin/packages/PackageApprovalDetailPage.tsx`. |
| Workflow role | WF-07 (Package publishing) role = Approval queue + Approval detail (second approver) |
| Backend prerequisites | ⏳ `GET /api/admin/packages/approvals` (queue list — new endpoint, wraps the WF-20 approval_requests scoped to package-version approvals). ⏳ `POST /api/admin/packages/:id/versions/:version/approve` + `POST /:version/reject` — per Cursor prompt §2.1. ⏳ `POST /:version/recall` — enables the submitter's Recall link (matrix `PA-APR-006` pattern; new endpoint, ~1 day backend). ⏳ `triggerMarketingRevalidate` wired to actually fire on approve — per Cursor prompt §2.6 (`MARKETING_REVALIDATE_URL` + `MARKETING_REVALIDATE_SECRET` env vars). ✅ `fin.approval_requests` WF-20 infrastructure from PR #44. ✅ SHR-MFA-007 step-up. ⏳ `[BE-VERIFY-13] Own-submission detection on package versions — NEW.` Backend must return `is_own_submission: true` on the queue + detail payload so UI can hide Approve. ~0.5 day. **File in kickoff §5a.** ⏳ `[BE-DESIGN-05] Recall endpoint — NEW.` `POST /api/admin/packages/:id/versions/:version/recall` — DRAFT-safe cancellation from PENDING_APPROVAL back to DRAFT (submitter-only, single-person). ~1 day backend. **File in kickoff §5a.** |
| Cluster | Wave 3.5 (Week 6 per §6 + §11a — same PR as PA-PKG-001/002/004) |

---

## Purpose

Second PA reviews a peer-submitted package version and takes an approve / reject / (submitter-only) recall decision.

**Queue view** answers: "Which package versions need my attention as an approver right now?" Sorted by submitted-at desc (oldest first for triage), filtered to my-attention view by default (excludes my own submissions when two-person required — server hint via `is_own_submission`).

**Detail view** answers: "Am I comfortable making this go live on wingcaster.com/pricing?" Every changed field is visible; every unchanged field is one click away; the two-person-approval threshold + approvers-so-far list is loud; the Approve button is disabled when it shouldn't be legal.

Success outcome: PA either (a) approves — the version becomes ACTIVE, the previous ACTIVE is deactivated, marketing site revalidates within ~5s; (b) rejects with a specific reason + notes — the version returns to DRAFT and the submitter sees the rejection in their audit + notification stream; or (c) if PA is the submitter and single-person, recalls their own submission back to DRAFT.

---

## Design goals

1. **The queue is a decision-triage list, not an archive.** Only PENDING_APPROVAL versions render here. Approved / rejected versions live in PA-PKG-004 (version history) — separation-of-concerns keeps this list short and actionable.
2. **No inline approve/reject on the queue.** A package-version approval WITHOUT reading the diff would let a PA rubber-stamp price/cap changes. In v1, decisions require opening the detail view. Bulk actions are similarly deferred. Document as `[UX-DECISION-01]` in the workstream log.
3. **The detail view surfaces the diff as the primary content.** Left column IS the diff — every field shows current-vs-new; unchanged collapsed. The right column is metadata + actions. No re-litigation of the marketing preview — that lives in PA-PKG-002 (submitter's screen). Approvers here read the diff and decide.
4. **Approve is irrevocable; Reject has a 5-second Undo.** Because Approve triggers marketing revalidation (external side-effect), reversing is not free. Copy this into the confirm modal.
5. **Two-person is loud + enforced client-side + enforced server-side.** UI hides Approve for submitters when two-person required; server refuses too. Belt + suspenders.
6. **On-approve marketing revalidation feedback is honest.** If the revalidation confirm ping doesn't return, the toast tells the PA "may be delayed" — never silently succeeds.

---

## Layout

### Queue view — `/admin/packages/approvals`

Single-column PA console shell (SHR-NAV-001 top bar + PA-NAV-001 env badge + optional TEST warning strip).

**Header block (sticky):**
- Left: page title "Package approvals" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> pending · <Numeric>K</Numeric> two-person required · <Numeric>M</Numeric> awaiting your review" (`var(--lc-type-body-sm)` `--lc-text-muted`). "Awaiting your review" = total pending minus own submissions.
- Right: `Refresh` icon button + `?` keyboard-hints icon button.

**Filter strip (sticky):**
- Row 1: view tabs — `Awaiting my review` (default, excludes own submissions) / `All pending` (includes own — but Approve remains hidden per two-person rule).
- Row 2: filter selects — `Package` (Select, fed from `GET /api/admin/packages` — all packages), `Submitter` (Select — populated from unique submitters in the current queue), `Approval type` (Select — Any / Two-person / Single-person), `Submitted within` (Select — 24h / 7d default / 30d / All).

**Table** — columns per §Broadcast alignment above. Empty state per §State variants below.

**Pagination footer:** `var(--lc-type-body-sm)`, `var(--lc-text-muted)`, page numerals in `<Numeric>`. Default page size 25.

### Detail view — `/admin/packages/approvals/:versionId`

Single-column PA console shell + a back-link to `return_to` or `/admin/packages/approvals`.

**Header block:**
- Left: page title "Approve v{N} of {Package display_name}" (`var(--lc-type-heading-1)`) + subtitle "Submitted by {submitter} · {relative_time}" (`var(--lc-type-body-sm)` `--lc-text-muted`).
- Right: `Back to queue` link + `?` icon button.

**Two-column split, 62/38 (diff panel / metadata + actions):**

**Left column (62%) — Read-only diff panel:**

- Heading "Changes in v{N} vs ACTIVE v{M}" (`var(--lc-type-heading-2)`).
- 8 collapsible sections (Identity / Caps / Price / Trial / Portal group / Feature quotas / Feature toggles / Support level).
- Sections with 0 changes: collapsed by default, header shows "Identity · No changes" in `--lc-text-muted`.
- Sections with ≥1 change: expanded by default, header shows "Price · <Numeric>2</Numeric> changes" and each changed field rendered as: label (top, `var(--lc-type-caption)` `--lc-text-muted`) | current value (strikethrough) | arrow `→` | new value (highlighted with `--lc-status-warning-bg` for price/cap fields).
- Feature quotas + Feature toggles: only changed features rendered; unchanged ones summarized as "N unchanged features" with a "Show all" expand link.
- Top-of-panel toggle: `Show unchanged fields (<Numeric>N</Numeric>)` — global expand for review completeness.

**Right column (38%):**

**Metadata card:**
- Submitter avatar (48px) + display name + role chip.
- Submitted-at full timestamp (`Sept 8, 2026 · 14:23 UTC`) via `<Numeric>` for the numerals.
- Version transition line: `v6 → v7` in mono `<Numeric>`.
- Two-person indicator badge (large): "Two-person required" or "Single-person".
- Change-summary chip row: `Price` · `Property cap` · `5 features` (mirrors the queue's chip row).
- If the submitter attached a reason on submit (Cursor prompt §2.1 submit body `{ reason }`): render it here as a `<blockquote>` with `--lc-text-primary` on `--lc-surface-sunken`.

**Approvers list card:**
- Heading "Approvers (needs <Numeric>N</Numeric>)".
- If 0 approvers yet: single row "No approvers yet" in `--lc-text-muted`.
- Otherwise: one row per approver — avatar + display name + timestamp + "Approved" badge.
- Bottom line (context-dependent):
  - Single-person + submitter=self + cooling-off elapsed: "Cooling-off complete. You can approve your own submission."
  - Single-person + submitter=self + cooling-off not elapsed: "Cooling-off ends in <Numeric>Xm</Numeric>. Then you can approve."
  - Two-person + submitter=self: "You submitted this — a second admin must approve."
  - Two-person + you approved but need another: "You've approved · <Numeric>1</Numeric> of <Numeric>2</Numeric>."

**Actions card:**
- Primary: `Approve and publish` (`<Button variant="default">`) — `--lc-action-primary` fill. Disabled with tooltip when action is not legal (submitter self-approve blocked; cooling-off pending; already approved by you in two-person mode).
- Secondary: `Reject and return to draft` (`<Button variant="outline">`) — outline color `--lc-status-danger-fg`.
- If you are the submitter: `Recall this submission` (`<Button variant="ghost">`) — quiet link-style. Opens confirm AlertDialog "Recall v{N} back to DRAFT? Your submission will be removed from the approval queue and you can continue editing." Confirm fires the recall endpoint.
- Below the buttons: a small `--lc-text-muted` footer note: "Approval is final. Reversing later requires submitting a new DRAFT version. Marketing site refreshes within ~5 seconds of approval."

### Empty state (queue, 0 pending)

Centered stack in the table area:
- Illustration placeholder — "Illustration — inbox zero".
- Title (`var(--lc-type-heading-3)`): "No package approvals pending."
- Body (`var(--lc-type-body)` `--lc-text-muted`): "When a peer submits a package version, it lands here for your review. Meanwhile, review the package catalog or the version history."
- Secondary CTAs: `Back to packages →` (link to PA-PKG-001) + `Version history →` (link to PA-PKG-004 for the last-updated package).

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Queue — page title | Package approvals |
| Queue — subtitle template | {N} pending · {K} two-person required · {M} awaiting your review |
| Queue — view tab own-excluded | Awaiting my review |
| Queue — view tab all | All pending |
| Queue — filter package label | Package |
| Queue — filter submitter label | Submitter |
| Queue — filter type label | Approval type |
| Queue — filter type options | Any · Two-person · Single-person |
| Queue — filter within label | Submitted within |
| Queue — filter within options | Last 24 hours · Last 7 days · Last 30 days · All time |
| Queue — column submitted | Submitted |
| Queue — column package | Package |
| Queue — column version | Version |
| Queue — column submitter | Submitter |
| Queue — column change-summary | Change summary |
| Queue — column approval-type | Approval type |
| Queue — column status | Status |
| Queue — row action open | Open |
| Queue — bulk-checkbox disabled tooltip | Bulk approval on package versions is not supported. Open each one to review the diff before deciding. |
| Queue — change-summary chip identity | Identity |
| Queue — change-summary chip caps | Caps |
| Queue — change-summary chip price | Price |
| Queue — change-summary chip trial | Trial |
| Queue — change-summary chip portal-group | Portal group |
| Queue — change-summary chip features-quotas | {N} feature quotas |
| Queue — change-summary chip features-toggles | {N} toggles |
| Queue — change-summary chip support-level | Support level |
| Queue — badge two-person | Two-person |
| Queue — badge single | Single |
| Queue — status pill pending | Pending |
| Empty queue — title | No package approvals pending. |
| Empty queue — body | When a peer submits a package version, it lands here for your review. Meanwhile, review the package catalog or the version history. |
| Empty queue — CTA packages | Back to packages → |
| Empty queue — CTA history | Version history → |
| Detail — page title | Approve v{N} of {Package display_name} |
| Detail — subtitle | Submitted by {submitter} · {relative_time} |
| Detail — back-to-queue link | ← Back to queue |
| Detail — diff heading | Changes in v{N} vs ACTIVE v{M} |
| Detail — section no changes | {Section} · No changes |
| Detail — section N changes | {Section} · {N} changes |
| Detail — show unchanged | Show unchanged fields ({N}) |
| Detail — hide unchanged | Hide unchanged fields |
| Detail — features unchanged summary | {N} unchanged features |
| Detail — features show all | Show all features |
| Detail — metadata card version transition | v{M} → v{N} |
| Detail — metadata card two-person label | Two-person approval required |
| Detail — metadata card single-person label | Single-person approval |
| Detail — metadata card submit-reason label | Submitter's reason |
| Detail — approvers heading | Approvers (needs {N}) |
| Detail — approvers empty | No approvers yet |
| Detail — approvers status you-can-self | Cooling-off complete. You can approve your own submission. |
| Detail — approvers status cooling | Cooling-off ends in {T}. Then you can approve. |
| Detail — approvers status two-person-self | You submitted this — a second admin must approve. |
| Detail — approvers status you-approved | You've approved · {N} of {M}. |
| Detail — action approve | Approve and publish |
| Detail — action reject | Reject and return to draft |
| Detail — action recall | Recall this submission |
| Detail — footer note | Approval is final. Reversing later requires submitting a new DRAFT version. Marketing site refreshes within ~5 seconds of approval. |
| Detail — approve tooltip self-block | You can't approve your own submission — a second admin must approve two-person changes. |
| Detail — approve tooltip cooling | Cooling-off period active — you can approve your own submission in {T}. |
| Detail — approve tooltip already-approved | You've already approved this. Waiting for another admin. |
| Approve confirm modal — title | Approve v{N} of {Package display_name}? |
| Approve confirm modal — body | Approving deactivates v{M} (currently ACTIVE) and this new version becomes ACTIVE immediately. The marketing site will refresh within ~5 seconds. Audit entry will be written under your identity. |
| Approve confirm modal — confirm | Approve and publish |
| Approve confirm modal — cancel | Cancel |
| Approve confirm modal — final note | Approval is final — reversal requires a new DRAFT. |
| Reject modal — title | Reject v{N} of {Package display_name} |
| Reject modal — reason label | Reason (shown to submitter) |
| Reject modal — reason vocab | Price too high · Cap too aggressive · Feature quota mismatch · Marketing copy needs work · Duplicate with prior version · Timing wrong · Other |
| Reject modal — notes label | Notes for the submitter |
| Reject modal — notes placeholder | Explain what needs changing before resubmission. |
| Reject modal — notes helper | Required. Kind and clear beats terse — the submitter will use this to fix their draft. |
| Reject modal — confirm | Reject and return to draft |
| Reject modal — cancel | Cancel |
| Recall confirm — title | Recall v{N} back to DRAFT? |
| Recall confirm — body | Your submission will be removed from the approval queue and returned to DRAFT status. You can continue editing. |
| Recall confirm — confirm | Recall to draft |
| Recall confirm — cancel | Keep submitted |
| Approve success toast | Approved v{N} · Marketing site refreshing… |
| Approve marketing-confirm toast | Marketing site refreshed. |
| Approve marketing-delayed toast | Approved. Marketing site refresh may be delayed — check wingcaster.com/pricing in a few minutes. |
| Reject success toast | Rejected v{N} · Submitter notified. |
| Recall success toast | Recalled v{N} back to DRAFT. |
| Undo toast link | Undo |
| Step-up prompt template | Confirm your identity to approve this {type} change. |
| Session expired | Please sign in again to continue. |
| Error banner | Couldn't load approvals. Try again. |
| Retry button | Retry |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Queue table | `Table` + `TableHeader` + `TableRow` + `TableCell` |
| Queue row-select checkbox (disabled) | `Checkbox disabled` + `Tooltip` |
| Queue filter Selects | `Select` + `SelectItem` |
| Queue tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Detail read-only diff sections | `Accordion` + `AccordionItem` (collapsible per section) |
| Detail metadata card | `Card` or plain `<div>` styled with Broadcast tokens |
| Detail approvers list | plain `<ul>` with per-row `Avatar` + `Badge` |
| Detail actions card | plain `<div>` with `Button` variants |
| Approve confirm | `AlertDialog` |
| Reject modal | `Dialog` with `Select` + `Textarea` |
| Recall confirm | `AlertDialog` |
| Step-up prompt | Embedded `SHR-MFA-007` modal |
| Toast | `Sonner` toast |
| Change-summary chip | `<Badge variant="outline">` |
| Two-person indicator badge | `<Badge>` variant per state |
| Icons | `lucide-react` — `Check`, `X`, `RotateCcw`, `AlertTriangle`, `ChevronRight`, `ChevronDown`, `ArrowRight`, `RefreshCw`, `HelpCircle`, `MessageCircle` |
| Numeric renders | `<Numeric>` primitive |

---

## Sample content (for v0 / mockup)

**Pass 1 — Queue view:** desktop 1440px, LIVE env.

- Header: "Package approvals" title, subtitle "3 pending · 2 two-person required · 2 awaiting your review". Refresh + `?` on the right.
- Filter strip: `Awaiting my review` tab active; Package `Any package`; Submitter `Any`; Approval type `Any`; Within "Last 7 days".
- Table with 3 rows (all Pending):
  1. Submitted "2h ago" · Package **Small Team** / *Two to five agents sharing a listing pool and inbox* · Version `v7 (from v6)` · Submitter avatar "FS" **Fatima Al-Sayed** / PA · Elite Support · Change summary chips: `Price` (amber dot) · `Property cap` (amber dot) · `Identity` · Two-person indicator: **Two-person** badge · Status: **Pending**
  2. Submitted "4h ago" · Package **Growth+** / *Growth tier plus premium portal quotas and dedicated onboarding* · Version `v2 (from v1)` · Submitter avatar "SM" **Sara Al Mansouri** / PA · Central Support · Change summary chips: `4 feature quotas` · `3 toggles` · Two-person indicator: **Single** badge · Status: **Pending**
  3. Submitted "1d ago" · Package **Enterprise** / *Custom-scoped for national brokerages* · Version `v4 (from v3)` · Submitter avatar "OA" **Omar Al-Khouri** / PA · Enterprise Success · Change summary chips: `Support level` · `Feature toggles: 2 toggles` · Two-person indicator: **Single** badge · Status: **Pending**
- Row 1 (Small Team) in hover state: row action `Open` visible on the right.
- Pagination: "1–3 of 3".

**Pass 2 — Detail view for Small Team v7:** desktop 1440px, LIVE env.

- Header: "Approve v7 of Small Team", subtitle "Submitted by Fatima Al-Sayed · 2h ago". `← Back to queue` link on the right.
- Left column (62%):
  - Heading "Changes in v7 vs ACTIVE v6".
  - Global toggle: "Show unchanged fields (5)".
  - Section Identity (expanded, "1 change"): row `Tagline · "Two to five agents sharing a listing pool and inbox" → "Two to five agents sharing a listing pool and inbox — now with expanded portal quotas"`.
  - Section Caps (expanded, "1 change"): row `Property cap · 100 → 150` (amber-tinted new-value cell).
  - Section Price (expanded, "2 changes"): row `Monthly · $99.00 → $119.00` (amber) + row `Annual · $990.00 → $1,190.00` (amber).
  - Sections Trial / Portal group / Feature quotas / Feature toggles / Support level collapsed with "No changes" suffix in muted color.
- Right column (38%):
  - Metadata card: 48px avatar "FS" + "Fatima Al-Sayed" + role chip "PA · Elite Support" + "Sept 8, 2026 · 14:23 UTC" + version transition "v6 → v7" (mono) + Two-person indicator: large "Two-person approval required" badge + change-summary chips `Price` `Property cap` `Identity`. Submitter reason blockquote: "Bumping to reflect the expanded Bayut UAE portal allocation from the MENA Q4 partnership."
  - Approvers list card: heading "Approvers (needs 2)" + single row "No approvers yet".
  - Actions card: `Approve and publish` primary button (enabled — current PA is NOT the submitter), `Reject and return to draft` outline button (destructive-tinted). Footer note "Approval is final. Reversing later requires submitting a new DRAFT version. Marketing site refreshes within ~5 seconds of approval."

**Pass 3 — Detail view for own submission (self-approve-blocked):** same layout as pass 2 but the current PA IS Fatima. Actions card shows: Approve button DISABLED with tooltip "You can't approve your own submission — a second admin must approve two-person changes." `Reject and return to draft` also greyed (you can't reject your own). `Recall this submission` ghost link visible below — enabled.

Do NOT fabricate approver counts or timings beyond what the backend payload returns. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

**On queue page load:**
- Fetch `GET /api/admin/packages/approvals?view=awaiting_my_review&within=7d&page=1&pageSize=25` scoped to current env.
- In parallel, fetch `GET /api/admin/packages` (5min cache) for the Package filter Select.
- Show 6-row skeleton while loading.

**On queue row click (or `Open` action):**
- Navigate to `/admin/packages/approvals/:versionId` with `?return_to=<current-url>`.

**On detail page load:**
- Fetch `GET /api/admin/packages/:packageId/versions/:version` PLUS `GET /api/admin/packages/approvals/:versionId/state` for approvers-so-far + two-person threshold + own-submission flag + cooling-off remaining.
- Show 3-section skeleton on left + card skeletons on right.

**On section header click (detail view):**
- Toggle Accordion open/close.
- Unchanged-section headers still clickable (opens to reveal the unchanged fields in that section, useful for review completeness).

**On "Show unchanged fields (N)" toggle:**
- Global expand — opens every collapsed section.

**On `Approve and publish`:**
- If disabled: no-op + tooltip already shown.
- Otherwise: step-up via SHR-MFA-007 (always required for approve — it's the higher-stakes decision).
- On step-up success: open Approve confirm AlertDialog.
- On confirm: fire `POST /api/admin/packages/:packageId/versions/:version/approve` with `{}`.
- On success: toast "Approved v{N} · Marketing site refreshing…"; wait for marketing revalidation confirm ping (server-side push via SSE or 10s polling); on confirm within 10s → follow-up toast "Marketing site refreshed"; on 10s timeout → WARN toast "Approved. Marketing site refresh may be delayed — check wingcaster.com/pricing in a few minutes."
- Navigate to PA-PKG-004 version history for this package (the newly-approved version now sits atop the timeline as ACTIVE).
- On fail 400 / 409 (invariant violation — e.g. another admin approved between page-load and click, race): toast + refetch state (which will now show the version as approved by the other admin).
- On fail 500: toast + stay on page.

**On `Reject and return to draft`:**
- Open Reject Dialog. Reason Select required + Notes Textarea required (≥5 chars). Confirm disabled until both.
- On confirm: step-up (required by PA-queue-family invariant #4 when rejecting under high-risk conditions; for this queue, step-up is always required on reject to keep parity with approve).
- Fire `POST /:version/reject` with `{ reason_code, notes }`.
- On success: toast "Rejected v{N} · Submitter notified." + 5s Undo link. On Undo click within 5s: fire `POST /:version/undo-reject` (needs `[BE-VERIFY-14]` — file). Otherwise navigate back to queue.

**On `Recall this submission` (submitter only):**
- Open Recall confirm AlertDialog.
- On confirm: fire `POST /:version/recall`. On success: toast "Recalled v{N} back to DRAFT." + navigate to PA-PKG-002 editor for this DRAFT.

**On PA-NAV-001 env-change:**
- If a modal is open: confirm-close prompt. Otherwise refetch in new env; if the current detail versionId doesn't exist in the new env, redirect to `/admin/packages/approvals` in new env.

**On keyboard shortcut:**
- Queue: `J` next row · `K` prev · `Enter` open detail · `.` refresh · `?` shortcuts · `Esc` clear focus.
- Detail: `A` approve (if enabled) · `R` reject · `.` refresh state · `?` shortcuts · `Esc` back to queue.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Queue loading** | Page mount | Skeleton table. |
| **Queue ready — awaiting my review** | Load complete, ≥1 non-own pending | Table renders. Row 1 focused. |
| **Queue ready — all pending includes own** | Tab switch | Own rows still visible but `Open` on them lands on the detail view with Approve disabled. |
| **Queue empty** | 0 pending | Empty-state block. |
| **Queue error** | Load fails | Error banner + Retry. |
| **Detail loading** | Page mount | Skeleton diff sections + skeleton cards. |
| **Detail ready — third party, two-person, 0 approvers** | Load complete | Approve enabled, Reject enabled, Recall hidden. |
| **Detail ready — third party, two-person, 1 approver (you)** | You've already approved | Approve disabled with tooltip "You've already approved this. Waiting for another admin." Reject disabled. |
| **Detail ready — self, two-person** | is_own_submission=true | Approve disabled with self-block tooltip. Reject disabled. Recall enabled. |
| **Detail ready — self, single, cooling not elapsed** | is_own + cooling active | Approve disabled with cooling tooltip. Recall enabled. Countdown auto-updates. |
| **Detail ready — self, single, cooling elapsed** | is_own + cooling done | Approve enabled + step-up. Recall enabled. |
| **Detail ready — already decided (rare race)** | Server returns already-approved | Full-page notice "This version has already been decided" + link to PA-PKG-004 for the audit. |
| **Approve step-up prompt** | Approve click | SHR-MFA-007 modal opens; on success fires confirm modal. |
| **Approve confirm modal open** | Post-step-up | AlertDialog. |
| **Approve in progress** | POST in flight | Approve button shows Loader2 + "Approving…"; entire page disabled. |
| **Approve success + revalidation pending** | POST 200 | Toast "Marketing site refreshing…"; poll for confirm ping. |
| **Approve success + revalidation confirmed** | Ping returns within 10s | Follow-up toast "Marketing site refreshed"; navigate to PA-PKG-004. |
| **Approve success + revalidation timeout** | 10s no ping | WARN toast "May be delayed"; navigate to PA-PKG-004 anyway (DB write succeeded). |
| **Approve fail — race** | 409 | Toast + refetch state. |
| **Reject modal open** | Reject click | Dialog with Select + Textarea. |
| **Reject in progress** | POST in flight | Modal Loader2. |
| **Reject success + undo grace** | POST 200 | Toast with Undo link; row pulses `--lc-accent-bold-edge` for 5s in the queue view. |
| **Reject undo triggered** | Undo click within 5s | Fire undo endpoint; row reverts to Pending. |
| **Reject undo expired** | 5s passes | Toast dismisses; navigate back to queue. |
| **Recall modal open** | Recall click (self only) | AlertDialog. |
| **Recall success** | POST 200 | Toast + navigate to PA-PKG-002 editor. |
| **Step-up required 401** | Any decision without step-up | SHR-MFA-007 fires; retry on success. |
| **Session expired** | 401 (not step-up) | Redirect to `SHR-AUT-001` login. |
| **Insufficient permission** | 403 | Full-page block. |
| **Env-switch mid-flow** | PA-NAV-001 env change | Confirm-close prompt if any modal open; otherwise refetch. |
| **TEST-env warning strip** | env=TEST | Persistent full-width strip. Approve confirm modal shows an extra TEST note "Approving in TEST does not affect wingcaster.com/pricing (LIVE)." |
| **Below-min-viewport** | <1024px | Full-page info block. |
| **RTL** | Locale = ar | Whole layout mirrors; two-column detail-view split reverses; approvers list moves to left column, diff to right. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. |

---

## Accessibility

- Queue table `role="grid"` + row `tabindex="0"`.
- Bulk-checkbox `disabled` state has `aria-disabled="true"` and a Tooltip readable by SR.
- Detail Accordion sections have `aria-expanded` state + heading buttons.
- Approve / Reject / Recall buttons have `aria-disabled` when disabled + `aria-describedby` linking to tooltip text.
- Approvers list is `<ul>` with `<li>` per approver.
- Modals trap focus + Esc closes + click-outside dismisses (with cancel confirmation if fields typed).
- Toasts `role="status"` + `aria-live="polite"`; destructive `assertive`.
- Step-up modal handled by SHR-MFA-007 primitive.
- Skip-to-content link at top of both routes.
- Focus rings two-tone via base CSS.
- Every icon-only button (`?`, refresh, back-arrow) has `aria-label`.
- Marketing-revalidation-delayed toast is `role="status"` + `aria-live="polite"` — announces the delay without being intrusive.

---

## Anti-patterns (do not do these)

- Do NOT allow inline approve/reject on the queue in v1. `[UX-DECISION-01]` — approvals require diff review.
- Do NOT allow bulk approve/reject in v1. Same reason.
- Do NOT show Approve enabled when the submitter=self and the version is two-person-required. Server enforces; UI also hides.
- Do NOT offer Undo on Approve. Marketing revalidation is external side-effect.
- Do NOT collapse the diff panel to a summary. Approvers must see every changed field.
- Do NOT show unchanged fields by default. Expand-on-demand keeps the review scannable.
- Do NOT silently succeed on marketing-revalidation timeout. Honest WARN toast.
- Do NOT show the marketing preview on this screen. That's the submitter's view (PA-PKG-002); approvers read the diff, not the mock.
- Do NOT paint the two-person badge as color-only. Tint + glyph + label.
- Do NOT allow Recall from a non-submitter. Server enforces; UI hides the link.
- Do NOT co-mingle LIVE and TEST data.
- Do NOT surface a "reason to approve" prompt on approve — the reason is the diff itself. Reject requires a reason; Approve does not.
- Do NOT let the Approve confirm modal be dismissable by clicking outside (only via Cancel button + Esc) — too easy to fat-finger.

---

## Reference designs

- **Stripe Radar / Reviews queue** — approve/reject with diff-review discipline. Direct pattern predecessor.
- **GitHub PR review** — file-diff-as-primary + approve/request-changes/comment right panel. The diff-as-content model.
- **Linear approval / two-approver flows** — approvers-list card + step-up on approve.
- **Notion admin → Approve billing changes** — two-person visualization + "you submitted this" self-block.
- **PA-MOD-001 (WingCaster)** — the PA queue shell + env + TEST strip + filter strip pattern is inherited unchanged.
- **PA-APR-002 / PA-APR-003 (WingCaster generic)** — the approval-detail action pattern + confirm-modal pattern are inherited and specialized here.

Do NOT match:
- Salesforce Approval Process (over-configurable multi-step wizard model).
- Trello / Kanban (wrong tool for terminal-state approval).

---

## Backend contract

**Queue endpoint:** `GET /api/admin/packages/approvals`

Query: `view=awaiting_my_review|all_pending`, `package=<id>`, `submitter=<user_id>`, `type=two_person|single`, `within=24h|7d|30d|all`, `sort=submitted_at:desc|asc`, `page`, `pageSize`.

Response 200:
```json
{
  "approvals": [
    {
      "version_id": "pkgv_smallteam_v7",
      "package": { "id": "pkg_small_team", "display_name": "Small Team", "tagline": "…" },
      "version": 7,
      "prior_active_version": 6,
      "submitted_at": "2026-09-08T12:23:00Z",
      "submitter": {
        "id": "usr_fatima",
        "display_name": "Fatima Al-Sayed",
        "avatar_url": "…",
        "role": "PA · Elite Support"
      },
      "submit_reason": "Bumping to reflect the expanded Bayut UAE portal allocation from the MENA Q4 partnership.",
      "approval_type": "two_person",
      "change_summary": {
        "identity": true,
        "caps": true,
        "price": true,
        "trial": false,
        "portal_group": false,
        "feature_quotas_count": 0,
        "feature_toggles_count": 0,
        "support_level": false
      },
      "approvers_so_far": [],
      "is_own_submission": false,
      "cooling_off_ends_at": null,
      "env": "live"
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 3 },
  "counts": {
    "pending_total": 3,
    "pending_two_person": 2,
    "pending_awaiting_my_review": 2
  }
}
```

**Detail state endpoint:** `GET /api/admin/packages/approvals/:versionId/state`

Response 200:
```json
{
  "version_id": "pkgv_smallteam_v7",
  "approval_type": "two_person",
  "approvers_needed": 2,
  "approvers_so_far": [
    { "user_id": "usr_omar", "display_name": "Omar Al-Khouri", "avatar_url": "…", "approved_at": "2026-09-08T13:00:00Z" }
  ],
  "is_own_submission": false,
  "you_have_approved": false,
  "cooling_off_ends_at": null,
  "can_approve_now": true,
  "can_reject_now": true,
  "can_recall_now": false,
  "already_decided": false,
  "env": "live"
}
```

**Action endpoints:** per Cursor prompt §2.1 —
- `POST /api/admin/packages/:packageId/versions/:version/approve`
- `POST /:version/reject` with body `{ reason_code, notes }`
- `POST /:version/undo-reject` (grace window — `[BE-VERIFY-14]`)
- `POST /:version/recall` (submitter-only — `[BE-DESIGN-05]`)

Response 401 `STEP_UP_REQUIRED` — client triggers SHR-MFA-007, retries.

Response 409 `ALREADY_DECIDED` — refetch state.

**Marketing revalidation:** internal server-side after approve — client observes only via toast follow-up (no client-side call to marketing site).

**Prerequisites tracked / to file:**

- **`[BE-VERIFY-13] Own-submission detection on package versions — NEW.** Backend must return `is_own_submission: true` on the queue + detail state payload. ~0.5 day. **File in kickoff §5a.**
- **`[BE-DESIGN-05] Recall endpoint — NEW.** `POST /api/admin/packages/:id/versions/:version/recall` — submitter-only cancellation from PENDING_APPROVAL back to DRAFT. ~1 day backend. **File in kickoff §5a.**
- **`[BE-VERIFY-14] Undo-reject endpoint — NEW.** `POST /:version/undo-reject` for the 5-second grace window. ~0.5 day. **File in kickoff §5a.**
- **`[BE-VERIFY-15] Marketing revalidation confirm ping — NEW.** Server-side after `triggerMarketingRevalidate` returns 200, expose a follow-up signal (SSE or short-poll endpoint) so client can toast the confirmation. ~1 day. If not implemented in v1, client falls back to a fixed 5s optimistic toast without the "delayed" WARN variant. **File in kickoff §5a.**

---

## Downstream implementation (Cursor prompt handoff notes)

Direct alignment with `CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-003" section.

- **Files to create:** `web/src/pages/admin/packages/PackageApprovalQueuePage.tsx` + `web/src/pages/admin/packages/PackageApprovalDetailPage.tsx`.
- **Route registration:** `/admin/packages/approvals` + `/admin/packages/approvals/:versionId` behind `PAConsoleGuard`.
- **Top-nav badge:** the PA top nav's "Billing → Packages" entry from PA-PKG-001 shares its badge counter with the pending-approval count from this queue.
- **Component decomposition:**
  - `PackageApprovalQueuePage.tsx` — page shell + queue data + filter/sort/pagination.
  - `PackageApprovalDetailPage.tsx` — detail shell + diff panel + right-column cards.
  - `PackageApprovalDiffSection.tsx` — per-section collapsible diff (one for Identity, Caps, Price, Trial, Portal group, Feature quotas, Feature toggles, Support level).
  - `PackageApprovalMetadataCard.tsx` — submitter + timestamps + version transition + two-person badge + change-summary chips.
  - `PackageApprovalApproversCard.tsx` — approvers list.
  - `PackageApprovalActionsCard.tsx` — Approve / Reject / Recall buttons + tooltips.
  - `PackageApproveConfirmDialog.tsx` — AlertDialog reused pattern from PA-APR-003.
  - `PackageRejectDialog.tsx` — Reason + Notes Dialog.
  - `PackageRecallConfirmDialog.tsx` — AlertDialog.
  - Reused: `PAKeyboardShortcutsPanel` from PA-MOD-001, `PAQueueFilterStrip` shell from PA-MOD-001 (adapted for this queue's filters).
- **Data layer:**
  - Hook: `usePackageApprovalsQuery({ view, package, submitter, type, within, page, pageSize, env })`.
  - Hook: `usePackageApprovalDetail(versionId)` — returns diff payload + state payload joined.
  - Hook: `usePackageApprovalState(versionId)` — refetches state on window focus.
  - Mutations: `useApprove`, `useReject`, `useUndoReject`, `useRecall` — all step-up-aware.
- **Marketing revalidation observability:**
  - If `[BE-VERIFY-15]` implemented: subscribe to SSE on `/api/admin/packages/revalidation-events` scoped to the approval id.
  - Fallback: fixed 5s optimistic toast without WARN.
- **Test discipline:**
  - Unit: queue table renders + filter changes + detail sections expand/collapse.
  - Integration: full flow — queue → open detail → approve happy path (two-person) → step-up → confirm modal → success toast + navigate to PA-PKG-004; reject flow with reason + notes + undo-within-grace; recall flow for self-submitter; self-block Approve state.
  - RTL: `screens.rtl.test.tsx`.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: full lifecycle — create DRAFT → submit → approve → deactivate previous → verify approve endpoint fires the marketing-revalidation mock.
  - Accessibility: axe-core scan of queue + detail + all modal states.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Queue shell inherits PA-MOD-001 unchanged.
- Detail view left column `var(--lc-surface-raised)`; right column cards `var(--lc-surface-raised)` on a `var(--lc-surface-sunken)` page background.
- Change-summary chips `<Badge variant="outline">`; Price + Cap chips prefixed with a `--lc-status-warning-dot`.
- Two-person indicator: `<Badge>` with `--lc-status-warning-{bg,fg,dot}` + ▲ + "Two-person" OR `--lc-status-draft-{bg,fg,dot}` + ○ + "Single".
- Diff panel new-value cells for price + property_cap: `--lc-status-warning-bg` tint highlighting.
- Approvers-list "Approved" badge: `<Badge>` `--lc-status-published-{bg,fg,dot}` + ● + "Approved".
- Approve primary button `--lc-action-primary` fill; disabled state uses `--lc-action-primary-disabled` (lighter — this is the ONLY place lighter-than-default is legal per Broadcast rules, and only because Broadcast's disabled state uses opacity + `pointer-events: none` on primary buttons per the existing `<Button>` primitive).
- Reject secondary button `<Button variant="outline">` with `--lc-status-danger-fg` text + outline; hover fills `--lc-status-danger-bg`.
- Recall ghost link `<Button variant="ghost">` with `--lc-text-secondary` text.
- Approve confirm modal `--lc-elevation-lg`; footer note `var(--lc-type-caption)` `--lc-text-muted`.
- Reject modal reason Select + Notes Textarea per PA-MOD-001 modal styling.
- Undo pulse-border on rejected queue row: `--lc-accent-bold-edge` at 2px, pulsing at `--lc-duration-slow` for 5s.
- Motion: detail-view slide-in from queue `--lc-duration-slow` `--lc-easing-out`; modal open `--lc-duration-base`; toast enter `--lc-duration-fast`; NO signal-lamp motif.
- Radii: cards `var(--lc-radius-lg)`; buttons + inputs `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`; modals `var(--lc-radius-lg)`.
- Focus rings: two-tone via base CSS.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) package-approval queue + detail screens (PA-PKG-003) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin reviews a peer-submitted package version (with the marketing-visible diff surfaced as the primary content) and takes an approve/reject decision. Two-person approval required for price + property-cap changes. Marketing site (wingcaster.com/pricing) revalidates within ~5s of approval. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass (queue view): render the desktop 1440px layout at /admin/packages/approvals with LIVE env badge in the top bar (green), Awaiting-my-review tab active, 3 sample rows all Pending (Small Team v7 two-person / Growth+ v2 single / Enterprise v4 single). Row 1 in hover state showing inline `Open` button. Header subtitle "3 pending · 2 two-person required · 2 awaiting your review".

LTR English only for this pass — I'll ask for the detail view next.

Follow the copy table in the brief exactly.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now the detail view at /admin/packages/approvals/pkgv_smallteam_v7. Left column shows the 8 sections with Identity + Caps + Price expanded (3 changed rows total across those sections — property cap 100→150, monthly $99→$119, annual $990→$1190, tagline updated) and Trial/Portal group/Feature quotas/Feature toggles/Support level collapsed with "No changes" suffix. Right column: Metadata card with Fatima's avatar + role + two-person badge + change-summary chips + submitter reason blockquote; Approvers card "Approvers (needs 2) · No approvers yet"; Actions card with Approve enabled + Reject enabled + footer note.`
2. `Now the same detail view but the current PA is Fatima herself (self-submitter, two-person blocked). Approve disabled with tooltip "You can't approve your own submission — a second admin must approve two-person changes." Reject disabled. Recall ghost link enabled below.`
3. `Now the Approve confirm AlertDialog open on top of pass 1. Copy matches the brief exactly.`
4. `Now the Reject Dialog open with Reason Select (Price too high highlighted) + Notes Textarea empty. Confirm disabled.`
5. `Now the empty queue state — 0 pending. Show illustration placeholder + copy + two CTAs.`
6. `Now the same queue in TEST env — amber TEST badge + warning strip under top bar.`
7. `Now RTL Arabic at desktop 1440px for the detail view. MIRROR the whole layout — diff panel moves to right, cards to left.`
8. `Now dark mode versions of pass 1 (queue) and pass 2 (detail).`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PKG-003/` + screenshot to `docs/design/mockups/PA-PKG-003-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states (queue-ready, detail-third-party, detail-self-blocked, approve-confirm, reject-dialog, empty-queue, TEST env, RTL detail, dark queue+detail).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PKG-003/`.
- [ ] Cursor Wave-3.5 dispatch prompt references this brief.
- [ ] `[BE-VERIFY-13]` own-submission detection filed in kickoff §5a.
- [ ] `[BE-DESIGN-05]` recall endpoint filed in kickoff §5a.
- [ ] `[BE-VERIFY-14]` undo-reject endpoint filed in kickoff §5a.
- [ ] `[BE-VERIFY-15]` marketing revalidation confirm ping filed in kickoff §5a (non-blocking; graceful degradation documented).
- [ ] `[UX-DECISION-01]` bulk approval on package versions deferred to Phase 2 — filed in workstream log.
