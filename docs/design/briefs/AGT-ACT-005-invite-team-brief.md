# Screen Brief — AGT-ACT-005 · Activation wizard — Invite team (delta)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-ACT-001-activation-welcome-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-ACT-005` (row 58 in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5). Wave-4 Phase-1 add-on per Rev 8.

**Inherits everything from AGT-ACT-001.** Read that anchor first — Broadcast callouts, ACT-vs-ONB coexistence contract, progress-bar persistence, backend `activation_state` contract, anti-patterns, and DoD all apply verbatim. Deltas below.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-005 |
| Screen name | Activation wizard — Invite team |
| Route | `/activate/invite-team` |
| Backend prerequisites | ✅ Tenant + role model (migration 028) · ✅ WF-02 join-agency application flow · Feature flags: `agency_invitations.share_link`, `agency_invitations.invitation_code`, `agency_invitations.bulk_email` (some may already exist; scaffold if missing) |
| Depends on | AGT-ACT-001 + SHR-AUT-006 signup path=c (agency-owner) + WF-02 (application flow) + AGT-CHN-001 (channels — deep-link target) |
| Current state | MISSING — new sub-screen |
| Visibility | **Agency-owner signups ONLY** (`signup_path === "agency"`). Not shown to solo agents or agency-joining agents — AGT-ACT-001 renders the alternative Step 5 variants for those paths. |

---

## Purpose

For agency-owner signups, get the owner's team into the workspace via the fastest applicable channel — share link, invitation code, or bulk-email invitations — then deep-link into channel connections (AGT-CHN-001) so the newly-invited agents can start receiving inbound leads from the moment they join.

---

## What this screen is (and is NOT)

**IS:** a three-tab surface exposing three invitation methods (share link / invitation code / bulk email) + a live list of pending invitations, all backed by the WF-02 application flow.

**IS NOT:** the full agency team management surface. That's AGN-ROL-001/002 (Week 7 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`). This screen is a *focused activation moment* — invite a first cohort and move on. Full team management lives in Settings.

---

## Persona guard (non-negotiable)

**Route guard:** if the authenticated user's `signup_path !== "agency"` OR their current tenant role is not `owner`, redirect to `/activate` with an inline toast: "Team invitations are managed by the agency owner. Ask your agency to add you." (For agency-joining agents.) Solo agents get a different toast: "You're on a solo workspace. Register an agency to invite a team."

The AGT-ACT-001 welcome hub already handles Step 5 variants for non-agency-owner personas — this route is a last-line defense against direct URL entry.

---

## Layout deltas from AGT-ACT-001

Single-column, centered, max-width 720px.

**Zone 1 — Header + breadcrumb:** breadcrumb `Activation wizard → Step 5 · Invite your team`.

**Zone 2 — Persistent progress bar:** same treatment.

**Zone 3 — Task intro:**
- H1: "Invite your team"
- Sub: "Bring your agents into **{agency_name}**. Pick the fastest method for how your team works."
- Agency-name pill: reads from tenant context (`--lc-surface-sunken` chip, `var(--lc-type-caption)`).

**Zone 4 — Three-tab surface (`<Tabs>` from Radix):**

**Tab 1 — Share link** (default active):
- H2: "One link, unlimited agents"
- Sub: "Share this link anywhere — WhatsApp, email, printed onto onboarding paperwork. Every agent who follows it applies to join **{agency_name}**."
- Link display: `<Input readOnly>` with the invite URL (e.g. `https://wingcaster.app/join/elite-real-estate?code=INV-8fA9bC`). Copy button in the input's right affix.
- Regenerate link: "Rotate this link" — small `--lc-text-brand` text link. Rotating invalidates the previous link (with a confirm dialog).
- QR toggle: `<Button variant="ghost">` "Show QR code" — reveals a QR of the invite URL for in-person / printed use.
- Expiry helper: "Link is active until you rotate it or disable it in Settings → Team."

**Tab 2 — Invitation code**:
- H2: "A short code for phone or in-person"
- Sub: "Share this code verbally or over a call. Agents enter it during signup."
- Code display: 6-8 character mono-typed code, `var(--lc-type-display)` letter-spaced, `--lc-text-heading`.
- Copy button + rotate link (same treatment as Tab 1).
- Expiry helper: "Code is active until you rotate it or disable it in Settings → Team."

**Tab 3 — Bulk email**:
- H2: "Send email invitations"
- Sub: "Paste up to 50 email addresses. Each gets a personalized invitation to join **{agency_name}**."
- Textarea: `<Textarea>` with placeholder `sara@example.com, ali@example.com, layla@example.com` — accepts commas, newlines, or spaces as separators.
- Optional custom message field: `<Textarea>` shorter, `--lc-text-muted` label "Add a personal note (optional)". Max 280 chars — counter uses `<Numeric>`.
- Send button: `<Button variant="default">` "Send invitations" — POSTs to bulk invitation endpoint. Shows count parsed from textarea live ("Send **N** invitations →" where N is `<Numeric>`).
- On success: toast "**N** invitations sent." Textarea clears. Pending invitations table (Zone 5) refreshes.

**Zone 5 — Pending invitations table:**
- Renders below the tab surface.
- H3: "Pending invitations" + `<Numeric>` count in a `<Badge>`.
- Table columns: `Email` · `Sent` (relative timestamp) · `Status` (pill: Pending / Accepted / Expired / Declined) · Actions (Resend · Revoke).
- Empty state: "No pending invitations yet."
- Uses `<Numeric>` for the count badge and any timestamp cell numerics.

**Zone 6 — Footer:**
- Primary CTA "Mark step complete → Connect channels" — enabled once ≥1 invitation has been sent OR the user acknowledges "I'll invite my team later." **On click, navigates to `/activate/first-listing` OR to `/channels` (AGT-CHN-001) per §Interactions** to deep-link into channel connections so newly-invited agents receive leads immediately when they accept.
- Secondary "I'll do this later" (ghost).
- Tertiary link "It's just me for now" — POSTs defer with `reason: solo_operation_for_now`.

---

## Explicit copy deltas

| Slot | Copy |
|---|---|
| Breadcrumb | Activation wizard → Step 5 · Invite your team |
| H1 | Invite your team |
| Sub | Bring your agents into **{agency_name}**. Pick the fastest method for how your team works. |
| Tab 1 label | Share link |
| Tab 1 H2 | One link, unlimited agents |
| Tab 1 sub | Share this link anywhere — WhatsApp, email, printed onto onboarding paperwork. Every agent who follows it applies to join **{agency_name}**. |
| Tab 1 copy button | Copy link |
| Tab 1 rotate link | Rotate this link |
| Tab 1 rotate dialog title | Rotate the share link? |
| Tab 1 rotate dialog body | The previous link stops working. Agents mid-application can still complete. |
| Tab 1 QR toggle | Show QR code |
| Tab 1 expiry helper | Link is active until you rotate it or disable it in Settings → Team. |
| Tab 2 label | Invitation code |
| Tab 2 H2 | A short code for phone or in-person |
| Tab 2 sub | Share this code verbally or over a call. Agents enter it during signup. |
| Tab 2 copy button | Copy code |
| Tab 2 rotate link | Rotate code |
| Tab 2 expiry helper | Code is active until you rotate it or disable it in Settings → Team. |
| Tab 3 label | Bulk email |
| Tab 3 H2 | Send email invitations |
| Tab 3 sub | Paste up to **50** email addresses. Each gets a personalized invitation to join **{agency_name}**. |
| Tab 3 textarea placeholder | sara@example.com, ali@example.com, layla@example.com |
| Tab 3 message label | Add a personal note (optional) |
| Tab 3 message counter | **{n}** / **280** |
| Tab 3 send button | Send **{n}** invitations → |
| Tab 3 send success | **{n}** invitations sent. |
| Tab 3 send partial success | **{sent}** sent, **{failed}** couldn't be delivered. See details below. |
| Zone 5 heading | Pending invitations (**{n}**) |
| Zone 5 empty | No pending invitations yet. |
| Zone 5 resend | Resend |
| Zone 5 revoke | Revoke |
| Zone 5 revoke dialog title | Revoke this invitation? |
| Zone 5 revoke dialog body | **{email}** won't be able to join with this invitation. You can invite them again later. |
| Footer primary (enabled) | Mark step complete → Connect channels |
| Footer primary (before send) | Send an invitation first, or defer |
| Footer secondary | I'll do this later |
| Footer tertiary | It's just me for now |
| Auto-complete banner | You already sent invitations on **{date}**. Nothing to do here. |
| Route guard toast (agency-joining) | Team invitations are managed by the agency owner. Ask your agency to add you. |
| Route guard toast (solo) | You're on a solo workspace. Register an agency to invite a team. |

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Fresh — no invitations yet** | `activation_state.steps[invite_team].state === "not_started"` + no pending invitations | Tab 1 active, share link visible, pending-invitations table empty. Footer primary disabled with helper "Send an invitation first, or defer." |
| **After first invitation sent** | ≥1 pending invitation | Pending table populates. Footer primary CTA enables. |
| **Already complete on load** | `activation_state.steps[invite_team].state === "complete"` | Auto-complete banner + pending invitations table (still relevant) + "Return to activation wizard →" primary CTA. |
| **Bulk email — partial failure** | `POST /api/agency/invitations/bulk` returns `{sent: N, failed: M}` | Toast shows partial success copy; failed entries listed with reason (invalid_email, duplicate, rate_limited). |
| **Route guard fail** | `signup_path !== "agency"` OR role !== `owner` | Redirect to `/activate` with appropriate toast. |
| **Rate limit hit** | Bulk-email endpoint returns 429 | Destructive toast: "You've sent a lot of invitations quickly — please wait a few minutes." |
| **Deferred** | User clicked defer or tertiary | Return to `/activate`. Card in Skipped variant on the welcome hub. |
| **Locked features** | Some invite methods gated by capability pack (e.g. bulk email might require a paid tier) | Locked tab shows a `<Lock>` icon in the tab trigger + a body-level upgrade prompt when clicked. Do NOT hide the tab — visibility of what's available is important. |

---

## Interactions (deltas)

**On mount:**
- Parallel: `GET /api/agent/activation_state` + `GET /api/agency/invitations` (pending list) + `GET /api/agency/invitations/share-link` (current share link + code).
- Route guard runs before render.

**On tab switch:**
- No data reload — all three tabs share the same underlying invitation state.
- Preserve textarea content in Tab 3 across tab switches (don't clear if user flips to Tab 1 and back).

**On "Rotate link" or "Rotate code":**
- Open confirmation dialog.
- On confirm, POST rotation endpoint; new link/code renders; success toast.

**On "Send N invitations" (Tab 3):**
- Client-side validation: parse the textarea for valid email format, dedupe, cap at 50. Show inline count before send.
- POST `/api/agency/invitations/bulk` with `{emails: [...], custom_message: "..."}`.
- On success, refresh pending invitations table + clear textarea.

**On "Mark step complete → Connect channels" (footer primary):**
- POST `activation_state/complete` with `step_id: "invite_team"`, `completed_via: dashboard_action`, `metadata: {invitations_sent: N, methods_used: [...]}`.
- Navigate to `/channels` (AGT-CHN-001) with query `?source=activation` for attribution — NOT back to `/activate`. Rationale: inviting a team without connecting channels means the newly-joined agents have nowhere for leads to arrive; deep-linking to AGT-CHN-001 closes the loop.
- The 5/5 confetti celebration (from AGT-ACT-001) fires on the welcome hub the next time the user visits it, not on this transition.

**On "I'll do this later" or tertiary "It's just me for now":**
- POST defer.
- Return to `/activate` (welcome hub) — do NOT deep-link to AGT-CHN-001 in the defer path.

**On resend / revoke row action:**
- Resend: POST to resend endpoint with the invitation ID.
- Revoke: open confirmation dialog, then POST revoke, then refresh table.

---

## Anti-patterns (deltas)

- ❌ Do not show this screen to solo agents or agency-joining agents. Route guard is mandatory.
- ❌ Do not silently drop invalid emails in bulk paste. Surface them inline with a clear reason.
- ❌ Do not skip the deep-link to AGT-CHN-001 on step-complete. Team invited + no channels = leads have nowhere to go. Chain the two.
- ❌ Do not let this screen replace AGN-ROL-001/002. This is activation, not team management. Full role/permission editing lives in Settings.
- ❌ Do not hide capability-locked invite methods. Show them locked so agency owners understand what an upgrade unlocks.
- ❌ Do not let the share link or invitation code appear in URL query strings when navigating (privacy — codes are for direct sharing, not for browser history).
- ❌ Do not send invitations without WingCaster branding attribution on the destination signup screen (SHR-AUT-006 already handles this via the `?agency=<slug>` query param).

---

## Downstream implementation notes (deltas)

- **New file:** `web/src/pages/ActivationInviteTeamPage.tsx` — route `/activate/invite-team`.
- **New shared primitives** (extract for reuse with AGN-DSH-002 agency onboarding checklist + AGN-ROL-* Settings surfaces):
  - `ShareLinkPanel` — reused across activation + Settings.
  - `InvitationCodePanel` — same.
  - `BulkInvitePanel` — same.
  - `PendingInvitationsTable` — same.
- **Route guard hook:** `useRequireAgencyOwner()` — throws to `/activate` with a toast if the current session isn't an agency-owner. Reused by other agency-owner-only routes.
- **Data hooks:**
  - `useAgencyInvitations()` — TanStack Query wrapping `GET /api/agency/invitations`.
  - `useShareLink()` — wraps the share-link + rotate endpoints.
  - `useInvitationCode()` — wraps the code + rotate endpoints.
  - `useBulkInvite()` — mutation for bulk email send.
- **Backend contract confirmations:**
  - `GET /api/agency/invitations` returns `[{id, email, sent_at, status, method}, ...]`.
  - `GET /api/agency/invitations/share-link` returns `{url, code, expires_at}`.
  - `POST /api/agency/invitations/bulk` accepts `{emails, custom_message}` and returns `{sent: N, failed: [{email, reason}]}`.
  - `POST /api/agency/invitations/rotate-share-link` and `POST /api/agency/invitations/rotate-code` — both simple no-body POSTs.
  - `POST /api/agency/invitations/{id}/resend` and `POST /api/agency/invitations/{id}/revoke`.
- **Test discipline:**
  - Integration: solo-agent hits `/activate/invite-team` → redirected to `/activate` with correct toast.
  - Integration: agency-owner sees all 3 tabs; bulk-send 3 valid + 1 invalid email → table shows 3 pending, inline error for the 1.
  - Integration: rotate link → old link no longer works; new link works.
  - Integration: step-complete → navigates to `/channels?source=activation`, NOT `/activate`.
  - a11y: tabs keyboard-navigable, textarea labeled, rotate confirm dialogs focus-trapped.
- All Broadcast + a11y + RTL + dark-mode requirements from AGT-ACT-001 apply verbatim.

---

## Definition of done (deltas)

- [ ] Route guard verified — solo + agency-joining users correctly bounced.
- [ ] v0 iteration states: fresh agency-owner state (Tab 1 active), after-first-send with pending table populated, bulk-email tab with 5 emails pasted, rotate-link confirmation dialog, already-complete-on-load, capability-locked tab variant, mobile, RTL, dark.
- [ ] Cross-brief regression: step completion correctly deep-links to AGT-CHN-001 with the `?source=activation` attribution query param.
- [ ] Shared primitives extracted and re-used by (or ready for re-use by) the Week-7 AGN-ROL-* Settings surfaces.
