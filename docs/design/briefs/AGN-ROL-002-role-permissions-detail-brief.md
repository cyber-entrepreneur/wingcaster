# Screen Brief — AGN-ROL-002 · Role permissions detail (capability matrix)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Delta to family anchor `AGN-ROL-001` — inherits Broadcast callouts R1-R16, shared components (`<CapabilityChip>`, `<PackAssignSheet>`, `<PackWarningBanner>`, `useCapabilityPacks()`), and voice rules. Wave 7 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 35 + §6 Week 7. Ships in the same PR as AGN-ROL-001.

Upstream: `AGN-ROL-001` card click OR `View permissions →` OR `Edit permissions` button.
Downstream: on save (Custom pack), route back to `AGN-ROL-001` with success toast. On second-owner-approval trigger (Financial capability grant on any pack — but only Custom is editable), route back with the "pending approval" toast per §Backend contract.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`** and from the anchor callouts R1-R16 in `AGN-ROL-001-roles-overview-brief.md`. Do NOT redefine those callouts here; reference them by ID.

**Screen-specific Broadcast deltas (only what differs from the anchor):**

- **D1 · Screen title** ("{Pack name} permissions"): uses `--lc-type-heading-1` per R1, with the pack name interpolated. On the Custom pack in edit mode, an inline `<Badge>` "Editing" appears immediately to the right of the title in `--lc-status-warning-fg` + `--lc-status-warning-bg`.
- **D2 · Domain-group cards.** Six cards, one per domain (Listings / CRM / Publishing / Analytics / Billing / Settings). Each card uses R4 surface + elevation. Cards stack vertically full-width — this is a matrix screen, not a pack-picker. Radius `--lc-radius-lg`.
- **D3 · Domain-card header row.** Icon (24×24 lucide, see §Component palette) + domain name (`var(--lc-type-heading-3)`) + "N of M enabled" summary in `<Numeric>` on the right (`var(--lc-type-body-sm)` + `--lc-text-muted`).
- **D4 · Capability rows.** Inside each domain card, a table-like list of capabilities. Each row: capability human label (left, `var(--lc-type-body)` + `--lc-text-primary`) + one-line description (below label, `var(--lc-type-body-sm)` + `--lc-text-muted`) + `<Switch>` toggle (right). Row height 56px minimum (44px tap floor + padding).
- **D5 · Financial-capability marking.** Any capability with `is_financial: true` (from backend) renders a small `Coins` glyph inline before the label + a `--lc-status-warning-bg` background wash across the row. Copy suffix in the description: "(requires two-person approval)".
- **D6 · Seeded-pack read-only rendering.** For Finance / Marketer / Read-Only packs, every `<Switch>` renders in the `disabled` state with `aria-disabled="true"`. A muted banner at the top of the first card: "This is a built-in pack — read only. See the Custom pack to edit capabilities."
- **D7 · Custom-pack editable rendering.** Switches are interactive. Above the first domain card, a state banner shows unsaved-changes count when the user has toggled at least one capability: "3 changes pending — Save or Discard." Save button uses `<Button variant="default">`; Discard uses `variant="outline">`.
- **D8 · Two-person warning banner.** Renders at the top of the screen (below the sub, above the first domain card) when the user has toggled ON any Financial capability that was previously OFF. Reuses `<PackWarningBanner>` with reason `financial_capability_pending_two_person`. Copy: "Enabling Financial capabilities requires approval from a second owner. Your changes will apply once approved." Distinct from R11 (that one blocks; this one informs).
- **D9 · Assigned-members section.** At the bottom of the screen (below the last domain card), a compact list of members currently assigned this pack. Reuses R9 typography for the count line + a horizontal 5-member-avatar cluster + a "See all →" link to `AGN-MEM-001?pack=<packId>`. If 0 members: "No members yet — assign from the Roles overview → link back to AGN-ROL-001".
- **D10 · Sticky action bar** (Custom pack edit mode only). Bottom-of-viewport fixed bar, `--lc-surface-raised` + `--lc-elevation-md`, containing (right-aligned): [Discard changes] [Save changes]. On mobile, the bar is full-width bottom nav. Appears with `var(--lc-duration-fast)` slide-up when first change is made; slides down on discard/save.
- **D11 · Audit-note field.** Inside the Save-changes confirm dialog (below), a required `<Textarea>` for the audit reason ("Why are you making this change?"). Persisted as the `audit_reason` payload field. Min 10 chars; max 500. Placeholder: "e.g. Finance capability granted to Layla per CFO approval 2026-09-08."
- **D12 · Motion.** Switch flip `--lc-duration-fast` (120ms). Sticky action bar slide `--lc-duration-fast`. Save confirm dialog `--lc-duration-slow` (240ms). Reduced-motion collapses all to instant.

All other tokens, focus rings, tap floors, and behavior conventions follow AGN-ROL-001 R1-R16 verbatim.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-ROL-002 |
| Screen name | Role permissions detail (capability matrix) |
| Persona | Agency owner (always) + agency admin with `settings.access.edit` capability (custom pack edit) OR `settings.access.read` (view-only for any pack) |
| Device targets | Desktop 1440px (primary), tablet 1024px, mobile 375px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/agency/settings/roles/:packId` — supports `?mode=edit` for the Custom pack + `#capabilities` anchor (from AGN-ROL-001 "+N more" chip click) |
| Current state | MISSING. |
| Workflow role | n/a (governance surface); triggers WF-Governance-Approval when Financial capability is toggled on and the two-person rule fires |
| Backend prerequisites | ⏳ `GET /api/agency/capability-packs/:packId` (NEW — full capability tree, extends the summary from AGN-ROL-001's list endpoint) · ⏳ `PATCH /api/agency/capability-packs/:packId` (NEW — Custom pack only; validates + writes) · ✅ `fin.approval_requests` (reused for two-person flow — verified 2026-09-08 grep in `backend/src/fin/*`) |
| Family role | **DELTA** — inherits R1-R16 from `AGN-ROL-001-roles-overview-brief.md` |
| PR bundle | Ships with AGN-ROL-001 (single PR per §6 Week 7) |

---

## Purpose

Agency admin sees the exhaustive capability tree for one capability pack — grouped by domain (Listings / CRM / Publishing / Analytics / Billing / Settings) — with a toggle per capability. Read-only for seeded packs (Finance / Marketer / Read-Only). Editable for the Custom pack.

Success outcome:
- View mode (any pack): admin scans exactly what the pack grants. Deep-linked from AGN-ROL-001 chip "+N more →".
- Edit mode (Custom pack only): admin toggles capabilities on/off, writes an audit reason, saves. If any Financial capability moved from OFF → ON, the write triggers a two-person approval flow via `fin.approval_requests`.

---

## Design goals

1. **Grouping mirrors the domain vocabulary the admin already knows.** Six domains, in order: Listings, CRM, Publishing, Analytics, Billing, Settings. No hierarchical nesting beyond one level — flat, scannable.
2. **Financial capabilities are visually distinct.** Warning-tinted row + Coins glyph + "(requires two-person approval)" suffix. An admin cannot toggle a Financial capability without seeing it's special.
3. **Edit-mode friction is proportional.** A non-Financial toggle is a one-tap flip + Save + audit reason. A Financial toggle adds the D8 warning banner + routes through the two-person flow after Save.
4. **Read-only for seeded packs is unambiguous.** Every switch disabled, banner at top, no Save button. Copy directs admins to the Custom pack.
5. **Sticky action bar makes save discoverable.** On a long scroll (billing has 15+ capabilities), the Save button never disappears once changes exist.
6. **RTL Arabic mirrors 1:1.** Switches stay on the trailing edge of the row (right in LTR, left in RTL). Numeric counts stay LTR.

---

## Layout

### Desktop / tablet ≥1024px

Full-width single column inside the settings-hub shell:

- Top: breadcrumb (R3 pattern) → screen title (D1) with pack name interpolated → sub `var(--lc-type-body-lg)` describing the pack.
- If custom + edit mode: D7 unsaved-changes banner (only when changes exist).
- If any Financial capability toggled ON from OFF: D8 warning banner.
- If seeded pack: D6 read-only banner.
- Six domain cards (D2) stacked vertically, each collapsed to just the header on first render EXCEPT the first card (Listings) auto-expanded. Cards behave like `<Accordion type="multiple">` — click header to toggle.
- Bottom: D9 assigned-members section.
- Sticky action bar (D10) — only when Custom + edit mode + dirty state.

### Mobile ≤767px

Single column, scroll:

- Breadcrumb collapses to `← Roles` back-link.
- Screen title stacks under back-link.
- All banners (D6/D7/D8) render full-width.
- Domain cards stack full-width; all collapsed by default (mobile default; desktop auto-expands first).
- Capability rows inside a card: label + description stack vertically; switch stays on trailing edge.
- Sticky action bar is a full-width bottom nav bar with Discard + Save stacked or side-by-side depending on button width.
- Save confirm dialog full-screen on mobile (`<Sheet>` on mobile, `<Dialog>` on desktop).

### Domain-card anatomy (all viewports) — D2-D5

Each of the 6 cards contains:
- **Header row (D3):** domain icon + name + "N of M enabled" summary + expand/collapse chevron.
- **Capability rows (D4):** one row per capability. Row anatomy:
  - Left: capability label + description (2 lines).
  - Right: `<Switch>` with `aria-label="{capability label}: {enabled|disabled}"`.
- **Financial rows (D5):** warning-tint wash + `Coins` glyph + suffix.
- **Empty state (should never happen — every domain has ≥ 1 capability):** if a domain returns 0 capabilities, hide the card entirely; do not render an empty card.

Domain icons (24×24 lucide):
- Listings → `Home`
- CRM → `Users`
- Publishing → `Radio` (broadcast semantics)
- Analytics → `BarChart3`
- Billing → `Coins`
- Settings → `Settings2`

---

## Explicit copy (English — Arabic mirror pending MENA copywriter pass)

| Slot | Copy |
|---|---|
| Breadcrumb | Settings › Access & permissions › Roles › {pack name} |
| Mobile back-link | ← Roles |
| Screen title (D1) — view mode | {pack name} permissions |
| Screen title (D1) — edit mode | {pack name} permissions <Badge>Editing</Badge> |
| Screen sub — Finance | Billing, invoices, credit adjustments, payout approvals, revenue reports. |
| Screen sub — Marketer | Listing publishing, portal syndication, social broadcast, campaign metrics. |
| Screen sub — Read-Only | View everything, change nothing. For auditors and shadowing staff. |
| Screen sub — Custom | Your agency's own capability set. Toggle any capability on or off. |
| D6 read-only banner | This is a built-in pack — read only. See the Custom pack to edit capabilities. |
| D6 CTA | Open Custom → |
| D7 unsaved-changes banner | {n} change{s} pending — Save or Discard. |
| D8 two-person warning | Enabling Financial capabilities requires approval from a second owner. Your changes will apply once approved. |
| D8 CTA | Learn about two-person approval → |
| Domain — Listings label | Listings |
| Domain — CRM label | CRM |
| Domain — Publishing label | Publishing |
| Domain — Analytics label | Analytics |
| Domain — Billing label | Billing |
| Domain — Settings label | Settings |
| Domain summary | {n} of {total} enabled |
| Capability row — financial suffix | (requires two-person approval) |
| D9 assigned-members section header | Members with this pack |
| D9 count | {n} member{s} |
| D9 empty | No members yet — assign from the Roles overview ↗ |
| D9 see-all link | See all → |
| Action bar — Save button | Save changes |
| Action bar — Discard button | Discard changes |
| Save confirm dialog title | Save {pack name} changes? |
| Save confirm dialog body (no financial changes) | You're about to save {n} capability change{s} to the {pack name} pack. This will apply immediately to all {m} members assigned this pack. |
| Save confirm dialog body (with financial changes) | You're about to grant {financialCount} Financial capabilit{ies}. This requires approval from a second owner before it takes effect. Non-Financial changes apply immediately. |
| D11 audit-note label | Why are you making this change? |
| D11 audit-note placeholder | e.g. Finance capability granted to Layla per CFO approval 2026-09-08. |
| D11 audit-note helper | Required for the audit log. Minimum 10 characters. |
| Save confirm — Save CTA | Save & apply |
| Save confirm — Save-with-approval CTA | Save & request approval |
| Save confirm — Cancel | Keep editing |
| Discard confirm dialog title | Discard changes? |
| Discard confirm dialog body | Your {n} unsaved change{s} will be lost. |
| Discard confirm — Discard CTA | Discard |
| Discard confirm — Cancel | Keep editing |
| Save success toast (no financial) | {pack name} updated. |
| Save success toast (financial approval pending) | {pack name} saved. Non-Financial changes applied; Financial changes await second-owner approval. |
| Error toast — load pack | We couldn't load this pack. Try again? |
| Error toast — save | We couldn't save your changes. Try again? |
| Read-only pack save attempt (should never happen — defensive) | This pack is read-only and cannot be edited. |

**Voice rules** (inherited from anchor):
- Never render raw permission strings.
- Never say "role" and "pack" interchangeably.
- Financial vs. financial — capitalize "Financial" when referring to the capability class (proper noun in our vocabulary), lowercase in prose about money in general.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Breadcrumb | Custom `<Breadcrumb>` |
| Screen title | Plain `<h1>` |
| Editing badge (D1) | `<Badge variant="warning">` |
| Read-only banner (D6) | `<Alert variant="info">` |
| Unsaved-changes banner (D7) | Custom `<PendingChangesBanner>` — new; can live alongside `<PackWarningBanner>` in the shared roles module |
| Two-person warning (D8) | `<PackWarningBanner reason="financial_capability_pending_two_person">` — reused from anchor R11 shared component |
| Domain card | `<Card>` + `<Accordion>` |
| Domain icon | lucide-react per §Layout |
| Capability row | Plain `<div>` grid with 2-col layout (label+desc | switch) |
| Switch | `<Switch>` (Radix) with `--lc-action-primary` when on, `--lc-border-strong` when off, `--lc-status-warning-fg` when financial+off, `--lc-status-warning-fg` outline when financial+on |
| Financial row wash | Plain `<div>` with `background: var(--lc-status-warning-bg)` |
| Coins glyph | `Coins` from lucide-react |
| Domain summary count | `<Numeric>` |
| Sticky action bar (D10) | Plain fixed-position `<div>` |
| Save button | `<Button variant="default">` |
| Discard button | `<Button variant="outline">` |
| Save confirm dialog | `<Dialog>` on desktop, `<Sheet side="bottom">` on mobile |
| Audit-note textarea (D11) | `<Textarea>` with 500-char counter |
| Assigned-members cluster (D9) | Custom `<MemberAvatarCluster max={5}>` — reused from agency member surfaces |
| Toast | `<Sonner>` |

Icons — `lucide-react`: `Home`, `Users`, `Radio`, `BarChart3`, `Coins`, `Settings2`, `ChevronDown`, `AlertTriangle`, `Info`.

---

## Sample content (for v0 / mockup)

First pass — Custom pack, edit mode, desktop 1440px:
- Breadcrumb: `Settings › Access & permissions › Roles › Custom`
- Title: `Custom permissions [Editing]` (badge visible)
- Sub: Custom description per copy table
- D8 warning banner visible (assume user just toggled ON a Financial capability)
- D7 pending-changes banner: "3 changes pending — Save or Discard."
- **Listings card** — auto-expanded — 5 capabilities visible, 3 toggled ON (Create listing / Edit listing / Delete listing), 2 OFF (Publish listing / Archive listing). Summary "3 of 5 enabled".
- **CRM card** — collapsed — Summary "4 of 6 enabled".
- **Publishing card** — collapsed — Summary "0 of 4 enabled".
- **Analytics card** — collapsed — Summary "2 of 3 enabled".
- **Billing card** — expanded — 3 Financial capabilities visible, 1 toggled ON (Approve payouts) with warning-tint wash + Coins glyph + "(requires two-person approval)" suffix. Summary "1 of 8 enabled" (in warning tint).
- **Settings card** — collapsed — Summary "1 of 5 enabled".
- **D9 assigned members** — "3 members" + 3-avatar cluster + "See all →" link.
- **Sticky action bar (D10)** — bottom of viewport — [Discard changes] [Save changes]

Second pass — Finance pack, view mode (read-only):
- Title: `Finance permissions` (no badge)
- Sub: Finance description
- D6 read-only banner visible with "Open Custom →" CTA
- All 6 cards render; all switches disabled + `aria-disabled="true"`
- No D7, no D8, no D10 sticky bar
- D9 assigned members: "2 members" + 2 avatars

Third pass — Save confirm dialog OPEN (from the first pass state):
- Dialog title: "Save Custom changes?"
- Dialog body: "You're about to grant 1 Financial capability. This requires approval from a second owner before it takes effect. Non-Financial changes apply immediately."
- D11 audit-note textarea with placeholder visible, character counter "0 / 500", required indicator
- Buttons: [Keep editing] [Save & request approval] — primary CTA disabled until textarea has ≥ 10 chars

---

## Interactions

**On page load:**
- Fetch `GET /api/agency/capability-packs/:packId` — returns pack meta + full capability tree.
- If 401/403, redirect to `/agency/settings/roles` with toast.
- If 404 (unknown packId), redirect to `/agency/settings/roles` with toast "Pack not found."
- If `?mode=edit` present but pack is not Custom, drop the query param + render view mode.
- If `#capabilities` hash present, smooth-scroll to the first domain card after mount.

**On accordion header click:**
- Toggle expand/collapse. Persist expanded set to `sessionStorage` (key `agn-rol-002-expanded-<packId>`) so re-visits within a session keep the layout.

**On switch toggle (edit mode, Custom pack only):**
- Optimistic local state update. Increment "N changes pending" in D7 banner.
- If the toggle is ON for a Financial capability that was previously OFF: render D8 warning banner (if not already visible).
- If all changes are reverted (dirty count returns to 0): hide D7 + hide D10 sticky bar.

**On Discard click:**
- If dirty: confirm dialog. On Discard confirm, revert local state to server truth + hide D7 + hide D10.
- If clean: no-op (button should be disabled).

**On Save click:**
- Open save confirm dialog. Dialog body copy varies based on whether any Financial capabilities were toggled ON.
- User types audit reason (required, ≥ 10 chars).
- On Save & apply / Save & request approval:
  - PATCH `/api/agency/capability-packs/:packId` with `{ capabilities: {...}, audit_reason: "..." }`.
  - On 200 (no financial changes): dialog closes, toast "Custom updated.", navigate back to `/agency/settings/roles`.
  - On 202 (financial approval triggered): dialog closes, toast "Custom saved. Non-Financial changes applied; Financial changes await second-owner approval.", navigate back to `/agency/settings/roles`.
  - On 409 (validation conflict, e.g. Read-Only pack impossible edit): dialog stays with inline error.
  - On 500: dialog stays; toast "We couldn't save your changes."

**On seeded-pack switch attempt** (should be blocked by disabled state, but defensive):
- No-op. Log warning to console.

**On D6 "Open Custom →" CTA click:**
- Navigate to `/agency/settings/roles/custom`.

**On D8 "Learn about two-person approval →" click:**
- Opens support article in new tab.

**On D9 "See all →" click:**
- Navigate to `/agency/members?pack=<packId>` — pre-filters the member list by pack.

**On browser back / breadcrumb click while dirty:**
- Intercept navigation with the discard confirm dialog. Cancel returns to the screen; Discard proceeds.

**On language / mode toggle:**
- Preserve local dirty state across the swap. No confirmation.

**On offline:**
- Read-only rendering: cache-served, no impact.
- Edit mode: switches remain interactive; Save button disables with toast "You're offline. Reconnect to save."

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **View — seeded pack** | packId in {finance, marketer, read_only} | Switches disabled; D6 banner; no D7/D8/D10. |
| **View — Custom (no ?mode=edit)** | packId = custom, no query | Switches disabled; header shows "Custom permissions" (no Editing badge); a top-right "Edit permissions" button appears in place of the sticky bar. |
| **Edit — Custom, clean** | ?mode=edit, no changes | Switches enabled; no D7 / no D10; "Editing" badge visible; "Cancel editing" link where Edit button would be. |
| **Edit — Custom, dirty non-financial** | Toggled anything | D7 shows change count; D10 sticky bar visible. |
| **Edit — Custom, dirty financial** | Toggled at least one Financial ON | D8 warning banner visible above D7. |
| **Save confirm — no financial** | Save clicked, no financial changes | Dialog with immediate-apply copy + audit textarea. |
| **Save confirm — with financial** | Save clicked, ≥ 1 financial toggled ON | Dialog with approval-required copy + audit textarea. |
| **Discard confirm** | Discard clicked, dirty state | Confirm dialog with "Your {n} unsaved changes will be lost." |
| **Loading** | GET pack in flight | Skeleton domain cards (6 rows silhouette). |
| **Error — load** | GET pack 404/500 | Empty state + Retry. |
| **Error — save** | PATCH 500 | Dialog stays; toast. |
| **Approval pending** | PATCH 202 | Toast, navigate to AGN-ROL-001. |
| **Offline** | Network unreachable | Save disabled; toast. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Switch trailing edge is left in RTL. Coins glyph stays inside its financial-wash row, no polarity swap needed. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Financial-wash background darkens per `--lc-status-warning-bg` dark value. |
| **Anchor deep-link** | URL has #capabilities hash | Smooth-scroll to first domain card after mount. |
| **Read-only persona** | Caller has Read-Only pack | View-mode only for all packs. Edit button hidden. |

---

## Accessibility

- Every switch has `aria-label="{capability label}: {on|off}"` + `aria-describedby` pointing to the capability's description text.
- Financial capabilities announce as "{label}, financial, requires two-person approval, on/off" via combined aria-label + aria-describedby.
- D7 pending-changes banner is `role="status"` + `aria-live="polite"` — screen readers announce "3 changes pending" without interrupting.
- D8 two-person warning banner is `role="alert"` + `aria-live="assertive"` — first Financial toggle interrupts.
- Sticky action bar (D10) is announced when it appears via `aria-live="polite"` region ("Save and Discard actions available").
- Accordion cards use Radix `<Accordion>` primitive — Enter/Space toggles, Arrow Down/Up navigates between headers.
- Save confirm dialog traps focus; Escape closes with dirty-preservation.
- Audit-note textarea has visible `<Label>` + character counter announced via `aria-describedby`.
- Every tap target ≥ 44×44 CSS pixels.
- Reduced-motion: all durations collapse to instant; sticky bar appears instantly.
- Language + mode announces via `aria-live="polite"`.

---

## Anti-patterns (do NOT do)

- Do NOT render more than 2 levels of hierarchy in the capability tree. Flat within a domain. If a capability has sub-capabilities in v2, flatten them into the domain here.
- Do NOT allow saving without an audit reason. Two-person governance requires an audit trail on every edit.
- Do NOT hide the Save button on scroll — the sticky action bar exists precisely to solve that.
- Do NOT rely on toast-only confirmation for Save. The confirm dialog is required so the user consciously acknowledges what will change (especially Financial capabilities).
- Do NOT auto-save on toggle. Explicit Save + audit reason + confirm dialog is the contract.
- Do NOT let the user toggle Financial capabilities on the Marketer or Read-Only packs (defensive). Seeded packs are all read-only, so this is moot — but if a future v2 introduces editable-marketer, the D5 wash + D8 banner + confirm dialog contract must carry over.
- Do NOT drop the user out of edit mode on browser back without the discard confirm.
- Do NOT show a "Delete pack" button. Custom cannot be deleted; seeded packs are immutable.
- Do NOT collapse the accordion cards below the point where the summary count is unreadable — accordion cards are always tall enough to show the D3 header row.
- Do NOT bypass the two-person flow for Financial toggles even for the agency owner. Two owners means two owners, always.
- Do NOT show raw permission keys anywhere — same rule as anchor.

---

## Backend contract

### Read one pack detail

**Endpoint:** `GET /api/agency/capability-packs/:packId` (NEW — must ship with this brief)

**Response 200:**
```json
{
  "id": "custom",
  "kind": "custom",
  "name": "Custom",
  "description": "Your agency's own capability set. Toggle any capability on or off.",
  "editable": true,
  "member_count": 3,
  "members_preview": [
    { "user_id": "usr_...", "display_name": "Sara Al-Mansoori", "avatar_url": "..." },
    { "user_id": "usr_...", "display_name": "Ahmed Nasser", "avatar_url": "..." },
    { "user_id": "usr_...", "display_name": "Layla Ibrahim", "avatar_url": null }
  ],
  "domains": [
    {
      "key": "listings",
      "label": "Listings",
      "capabilities": [
        { "key": "listings.create", "label": "Create listing", "description": "Create new property listings.", "is_financial": false, "enabled": true },
        { "key": "listings.edit", "label": "Edit listing", "description": "Modify existing listings.", "is_financial": false, "enabled": true },
        { "key": "listings.delete", "label": "Delete listing", "description": "Permanently remove a listing.", "is_financial": false, "enabled": true },
        { "key": "listings.publish", "label": "Publish listing", "description": "Publish a listing to portals + Bazaar.", "is_financial": false, "enabled": false },
        { "key": "listings.archive", "label": "Archive listing", "description": "Move a listing to archive without deleting.", "is_financial": false, "enabled": false }
      ]
    },
    {
      "key": "billing",
      "label": "Billing",
      "capabilities": [
        { "key": "billing.payments.write", "label": "Bill payments", "description": "Initiate bill payments to vendors.", "is_financial": true, "enabled": false },
        { "key": "billing.payouts.approve", "label": "Approve payouts", "description": "Approve outgoing payouts.", "is_financial": true, "enabled": true },
        ... 6 more
      ]
    },
    ... 4 more domains (CRM, Publishing, Analytics, Settings)
  ]
}
```

### Write (Custom pack only)

**Endpoint:** `PATCH /api/agency/capability-packs/:packId` (NEW)

**Request body:**
```json
{
  "capabilities": {
    "listings.publish": true,
    "billing.payouts.approve": true,
    "billing.payments.write": false
  },
  "audit_reason": "Layla needs payout approvals per CFO delegation 2026-09-08."
}
```

`capabilities` is a partial map — only the CHANGED keys are sent. Backend merges into current state.

**Response 200 (no financial changes, or only OFF-transitions):**
```json
{
  "pack": { ... full updated shape ... },
  "audit_entry_id": "aud_...",
  "financial_approval_required": false
}
```
Client toast: "Custom updated." + navigate back.

**Response 202 (Financial ON-transition detected):**
```json
{
  "pack": { ... shape reflecting NON-Financial changes applied; Financial changes shown as pending ... },
  "audit_entry_id": "aud_...",
  "financial_approval_required": true,
  "approval_request_id": "areq_...",
  "requires_approvers": 1,
  "pending_capability_keys": ["billing.payments.write"]
}
```
Client toast: "Custom saved. Non-Financial changes applied; Financial changes await second-owner approval." + navigate back.

**Response 403:** caller lacks `settings.access.edit`. Client shows toast + drops back to view mode.

**Response 409 `SEEDED_PACK_IMMUTABLE`:** attempted to PATCH a seeded pack. Defensive — client should never allow this.

**Response 400 `VALIDATION_FAILED`:** unknown capability key or malformed body. Inline error in dialog.

### Two-person flow (existing)

Uses `fin.approval_requests` (grep-verified today 2026-09-08 in `backend/src/fin/pricing/helpers.js`, `.../ledger/transactions.js`, `.../postpaid/facilities.js`).

The PATCH handler, upon detecting an ON-transition for `is_financial: true` capability, inserts a row into `fin.approval_requests` with:
- `action_kind = 'grant_financial_capability'`
- `payload = { pack_id, capability_keys, agency_id, requested_by }`
- `status = 'PENDING'`

Second owner sees the request in their approval-queue surface (existing FIN admin screen) and confirms. Executor path lands the ON transition atomically.

### Schema (extends AGN-ROL-001 [BE-BLOCKER-29])

The `capability_packs JSONB` column on `tenant_memberships` stores the ASSIGNMENT (which pack ids the member holds). The pack DEFINITIONS (which capabilities are ON per pack) live in a separate agency-scoped table:

```sql
-- New table (numbered per branch state)
CREATE TABLE IF NOT EXISTS agency_capability_pack_overrides (
  agency_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pack_id       TEXT NOT NULL,   -- 'finance' | 'marketer' | 'read_only' | 'custom'
  capabilities  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { "listings.create": true, ... }
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agency_id, pack_id),
  CONSTRAINT overrides_only_for_custom CHECK (pack_id = 'custom')
);
```

In v1, ONLY the Custom pack has a row here — the seeded packs' capability sets are hard-coded in `backend/src/lib/authz/capability-packs.js`. v2 might allow overriding seeded packs (e.g. "our Marketer pack should not have Portal syndication"); the CHECK constraint will lift then.

File as `[BE-BLOCKER-29]` (extension of AGN-ROL-001's blocker). Combined estimate 3-4 days total for AGN-ROL-001 + AGN-ROL-002 backend.

---

## Downstream implementation (Cursor prompt handoff notes)

### File creation

- **New route:** `web/src/pages/agency/settings/RolePermissionsDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `/agency/settings/roles/:packId` guarded by `useCapability('settings.access.read')`.
- **Ships with AGN-ROL-001 in one PR** per §6 Week 7.

### Shared components (reused from anchor)

- `<PackWarningBanner>` — reused for D8 (new `reason="financial_capability_pending_two_person"` variant).
- `<CapabilityChip>` — NOT used on this screen (matrix is switches, not chips).
- `useCapabilityPacks()` — reused for D9 members section (or a new `usePackDetail(packId)` if the list endpoint doesn't include members-preview).

### New components (this screen)

- `<PendingChangesBanner count onSave onDiscard />` — D7.
- `<DomainCapabilityCard domain editable onToggle />` — D2-D5.
- `<CapabilityRow capability editable onToggle />` — D4.
- `<StickyActionBar dirty saving onSave onDiscard />` — D10.
- `<SavePackConfirmDialog packName changes financialCount onConfirm onCancel />` — D11.
- `usePackDetail(packId)` hook — SWR-backed fetch of `GET /api/agency/capability-packs/:packId`.
- `usePackDraft(packId, initialCapabilities)` hook — local state manager for edit-mode toggle set with `dirty`, `changeCount`, `financialChangeCount`, `reset`, `apply` helpers.

### Test discipline

- Unit: DomainCapabilityCard renders 6 domain variants; financial row shows warning wash + Coins glyph.
- Unit: Switch disabled state for seeded packs.
- Unit: PendingChangesBanner count updates as toggles flip.
- Integration: full edit flow — open Custom, toggle 3 non-financial, click Save, type audit reason, confirm, assert PATCH 200 handling.
- Integration: financial flow — toggle 1 Financial ON, assert D8 banner appears, Save confirm dialog shows approval-required copy, assert 202 handling.
- Integration: seeded read-only — GET Finance, assert all switches disabled + no Save button + D6 banner.
- Integration: two-person flow mock — assert 202 response leads to toast + navigate.
- Integration: browser back with dirty state — assert discard confirm intercepts.
- RTL: switch trailing edge on left in RTL.
- Broadcast: `no-raw-hex.test.ts` stays green.
- a11y: axe-core smoke test + keyboard nav test (Tab through switches, Enter opens accordion, Save is reachable).

### Behavior contracts

- `usePackDraft()` never sends the full capability map — only the DELTA of changed keys.
- `SavePackConfirmDialog` MUST NOT expose a "Skip audit reason" affordance. Audit is required.
- Sticky action bar (D10) is `position: fixed; bottom: 0` on desktop and `bottom: env(safe-area-inset-bottom)` on mobile.
- Accordion expand state persists per session via `sessionStorage` keyed on `agn-rol-002-expanded-<packId>`.
- On 202 response, `usePackDetail()` invalidates via SWR mutate + navigate — the AGN-ROL-001 landing must show the pending state indication (v2 adds a "pending approval" chip on the Custom card; v1 relies on toast only).

---

## Anchor callout inheritance (from AGN-ROL-001)

**R1** screen title — inherited (D1 extends with the Editing badge).
**R2** sub — inherited (per-pack copy in the table above).
**R3** breadcrumb — inherited (adds a final `› {pack name}` segment).
**R4** card surface + elevation — inherited (D2 uses R4 tokens).
**R5-R11** — not used on this screen (those are pack-card anatomy from anchor).
**R12** — not used.
**R13** assign sheet — not used on this screen; assignment happens on anchor.
**R14** — not applicable (this IS the detail).
**R15** focus ring — inherited unchanged.
**R16** motion — inherited (D12 adds capability-specific durations).

---

## Handoff instruction to v0

Framing prompt:

```
I'm designing the WingCaster agency Role permissions detail screen
(AGN-ROL-002) — the delta screen to AGN-ROL-001 (already drafted). It
inherits Broadcast callouts R1-R16 from that anchor. Stack: React 18 +
shadcn/ui + Radix + lucide-react + Tailwind + Broadcast (--lc-* tokens;
no raw hex).

First pass: render the desktop 1440px layout for the CUSTOM pack in EDIT
mode with dirty state — breadcrumb "Settings › Access & permissions ›
Roles › Custom", title "Custom permissions" with an orange "Editing"
badge, sub, D8 two-person warning banner ("Enabling Financial
capabilities requires approval…"), D7 pending-changes banner ("3
changes pending — Save or Discard."), then 6 domain cards (Listings
expanded with 5 capabilities of which 3 ON / 2 OFF; CRM/Publishing/
Analytics/Settings collapsed; Billing expanded with 3 capabilities and
1 Financial toggled ON showing the warning wash + Coins glyph +
"(requires two-person approval)" suffix). At bottom, D9 assigned
members section "3 members" with 3-avatar cluster + "See all →" link.
Sticky action bar at viewport bottom with [Discard changes] [Save
changes].

LTR English light mode only for this pass — I'll ask for the seeded
read-only variant, the save-confirm dialog, mobile, RTL, and dark mode
as separate follow-ups.

Follow the copy table exactly. Do NOT invent capabilities — use the
list I gave. Do NOT show raw permission keys.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. `Now the Finance pack view-mode (seeded, read-only). D6 read-only banner at top with "Open Custom →" CTA. All switches disabled. No D7/D8/D10.`
2. `Now the Save confirm dialog OPEN over the first-pass state. Dialog title "Save Custom changes?". Body copy for the with-financial variant. D11 audit-note textarea visible with placeholder. CTA "Save & request approval" disabled until textarea has ≥ 10 chars.`
3. `Now mobile 375px — same Custom edit dirty state. Domain cards collapsed by default. Sticky action bar full-width bottom nav.`
4. `Now RTL Arabic desktop — mirror everything. Switch trailing edge on left. Coins glyph stays inside financial rows.`
5. `Now dark mode versions of desktop and mobile.`

Save to `docs/design/mockups/v0-outputs/AGN-ROL-002/` + screenshots to `docs/design/mockups/AGN-ROL-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 5 iteration states.
- [ ] Screenshots + JSX committed.
- [ ] New components extracted at `web/src/components/agency/roles/`.
- [ ] `[BE-BLOCKER-29]` extended in kickoff §5a to cover pack-detail + patch endpoints + `agency_capability_pack_overrides` table.
- [ ] `usePackDetail()` + `usePackDraft()` hooks implemented.
- [ ] `no-raw-hex.test.ts`, `screens.rtl.test.tsx`, a11y smoke tests pass.
- [ ] Ships in the AGN-ROL-001 PR (single PR per §6 Week 7).
