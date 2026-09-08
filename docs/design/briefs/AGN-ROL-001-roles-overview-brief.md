# Screen Brief — AGN-ROL-001 · Roles overview (capability-pack list)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` §3 entry `AGN-ROL-001`. **Family anchor** for AGN-ROL-002 — the delta brief references this document's Broadcast callouts (R1-R14), component palette, and copy conventions rather than redefining them. Wave 7 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 34 + §6 Week 7. Bundled in a single PR with AGN-ROL-002 per the Week-7 slot.

Upstream: `AGN-SET-001` settings hub (Access & permissions group) links here; also linked from `AGN-DSH-002` onboarding checklist step "Set custom roles" and from `AGN-MEM-007` change-role modal "See what each pack enables".
Downstream: user picks a pack card → `AGN-ROL-002` (permissions detail with per-capability toggles).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (referenced by AGN-ROL-002 as "anchor callouts"):**

- **R1 · Screen title** ("Roles & permissions"): `font: var(--lc-type-heading-1)` — IBM Plex Sans 600, 26/32. Color `--lc-text-heading`. Positioned top-left below the settings-hub breadcrumb.
- **R2 · Screen sub** ("Capability packs decide what each teammate can do. Assign packs from the member's profile."): `var(--lc-type-body-lg)` + `--lc-text-secondary`. One line, no wrap on desktop.
- **R3 · Breadcrumb** (`Settings › Access & permissions › Roles`): `var(--lc-type-body-sm)` + `--lc-text-muted`. Each segment except the last links back to its parent screen. Separator `›` in `--lc-text-muted`.
- **R4 · Pack-card grid.** Four cards laid out as a 2×2 grid on desktop (each ~500px × 260px) and a 1-column stack on mobile. Card surface `--lc-surface-raised` + `--lc-elevation-sm`. Radius `--lc-radius-lg` (7px — tight, Broadcast rule). Hover raises to `--lc-elevation-md`; focused `2px solid var(--lc-focus-ring)` two-tone. Never round to 12px+.
- **R5 · Pack-card header row.** Icon well (48×48 tinted `--lc-surface-sunken`) + pack name (`var(--lc-type-heading-3)`) + seeded-pack badge OR custom-pack badge (top-right).
- **R6 · Seeded-pack badge.** Small pill, `var(--lc-type-caption)` + `--lc-text-muted`, background `--lc-surface-sunken`, radius `--lc-radius-pill`. Label: "Built-in — read only". Cannot be reordered next to the pack name.
- **R7 · Custom-pack badge.** Same shape as R6 but ink `--lc-text-brand` (broadcast orange) + border `1px solid var(--lc-action-primary)`. Label: "Custom — editable". Only ONE custom pack exists in v1 (the seeded "Custom" slot); never render two custom badges at once.
- **R8 · Capability chips row.** Below the description, render up to 5 capability chips summarizing what the pack unlocks. Each chip: `var(--lc-type-caption)` + `--lc-text-primary`, background `--lc-surface-sunken`, border `1px solid var(--lc-border)`, radius `--lc-radius-pill`, padding `var(--lc-space-2xs) var(--lc-space-xs)`. If the pack has >5 capabilities, the 5th chip becomes "+N more →" and links to R14 detail. Never render a chip for a denied capability — chips are affirmative only.
- **R9 · Member-count line.** `var(--lc-type-body-sm)` + `--lc-text-secondary`. Uses `<Numeric>` for the count itself. Format: `<Numeric>3</Numeric> members assigned`. When 0: `No members yet — assign this pack from a member's profile.` (helper style `--lc-text-muted`).
- **R10 · Card action row.** Bottom of card, right-aligned. Two buttons for seeded packs (View permissions → R14, Assign to members → R13), three buttons for the Custom pack (View, Edit permissions, Assign). Buttons `<Button variant="outline" size="default">` — 44px min height. Primary action ("View permissions") uses `<Button variant="default">` for the Custom pack, `outline` for others (assumption: seeded packs are reference material, custom is where admins act).
- **R11 · Financial-capability warning banner** — shown INSIDE the Finance pack card, immediately below the description, when the current agency has < 2 owners: `<Alert>` variant compact, `var(--lc-status-warning-bg)` background + `var(--lc-status-warning-fg)` ink + `AlertTriangle` glyph. Copy: "Assigning Finance requires a second owner for two-person approval. Add an owner first ↗" — the link deep-links to AGN-SET-005 ownership transfer / add-owner.
- **R12 · Section overline** for the two subsections ("Built-in packs" / "Custom pack"): `var(--lc-type-overline)` + `--lc-text-muted`. 24px top margin from the previous section.
- **R13 · Assign-to-members action.** Opens a right-side sheet listing all agency members with a checkbox per member. Sheet header shows the pack name; footer has "Assign" primary CTA. Assignment writes to `tenant_memberships.capability_packs` JSONB (per D1 Path B). Sheet uses `<Sheet>` primitive, `--lc-elevation-lg`, 400px wide desktop / full-screen mobile.
- **R14 · Details link / row-click behavior.** Clicking anywhere on a card that ISN'T a button navigates to `/agency/settings/roles/:packId` (AGN-ROL-002). Card is `role="link"` for a11y with `aria-label="View <pack name> permissions"`.
- **R15 · Focus ring** always the base-CSS two-tone (`--lc-focus-ring` + `--lc-focus-ring-contrast`). Do NOT override per card or per button.
- **R16 · Motion.** Card hover elevation change `var(--lc-duration-fast)` (120ms). Sheet slide-in `var(--lc-duration-slow)` (240ms) `var(--lc-easing-out)`. Warning banner appearance instant (no bounce). Reduced-motion → all durations collapse to `--lc-duration-instant`.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-ROL-001 |
| Screen name | Roles overview (capability-pack list) |
| Persona | Agency owner (always) + agency admin with `settings.access.read` capability + agency member with the Read-Only pack (view-only; no Assign button rendered) |
| Device targets | Desktop 1440px (primary), tablet 1024px, mobile 375px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/agency/settings/roles` |
| Current state | MISSING. Capability packs enforced in code (see backend §Backend contract) but no admin surface. Legacy screen `AgencyManagementPage.tsx` shows role names but not capability packs. |
| Workflow role | n/a (governance surface; not a workflow initiator) |
| Backend prerequisites | ⏳ `GET /api/agency/capability-packs` (NEW — see §Backend contract) · ⏳ `GET /api/agency/members?pack=<packId>` (extend existing members list with pack filter) · ⏳ `PATCH /api/agency/members/:userId/capability-packs` (NEW — R13 assignment write) · ✅ `tenant_memberships` (migration 028 exists; adds `capability_packs JSONB` per D1 Path B) |
| Family role | **ANCHOR** — AGN-ROL-002 delta references R1-R16 by ID |
| PR bundle | Ships AGN-ROL-001 + AGN-ROL-002 in one PR per §6 Week 7 |

---

## Purpose

Agency admins see, at a glance, the four capability packs a member can hold — what each unlocks, how many teammates currently hold each, and (for the single Custom pack) where to edit. Prevents the common failure mode of admins assigning a "Finance" pack blindly without understanding what capabilities that grants.

Four packs in v1:

1. **Finance** — billing, invoices, credit adjustments, payout approvals, revenue reports. Two-person rule required for any assignment (per D1 Path B).
2. **Marketer** — listing publishing, portal syndication, social broadcast, campaign metrics. No financial capabilities.
3. **Read-Only** — every read capability across the app; no writes. For auditors, external consultants, junior staff shadowing.
4. **Custom** — a single editable slot where the agency can carve its own capability set. Only one Custom pack exists in v1 — this is a deliberate constraint per D1 Path B (v2 may allow multiple named custom packs).

Success outcome: admin picks a pack, either drills into R14 (permissions detail) or opens the R13 sheet to assign it to members. No pack is created or destroyed on this screen — creation is a v2 concept; the Custom pack is always present and can be emptied but not deleted.

---

## Design goals

1. **Four packs, one glance.** The 2×2 grid means no scroll on desktop 1440px above the fold. Admin sees all packs simultaneously without paging.
2. **Capability chips answer "what does this do".** The chip row is the KEY affordance — an admin scanning "Finance" sees `Bill payments`, `Approve payouts`, `View invoices`, `Adjust credits`, `+3 more →` and understands the pack in 2 seconds. Chip copy is human, not raw permission strings (never `billing.payments.write`).
3. **Custom pack visually distinct without being scary.** Broadcast-orange border + "Custom — editable" badge signal "you can change this" without shouting "danger".
4. **Two-person friction surfaced BEFORE the click.** The Finance card's warning banner (R11) fires when the agency has < 2 owners, blocking a click-through to a dead-end assignment flow.
5. **Assignment is a sheet, not a page.** Sheets keep admins in context — after assigning Finance to Sara, admin stays on the Roles overview to pick the next pack for Ahmed.
6. **RTL Arabic mirrors 1:1.** Custom-pack badge repositions to top-left in RTL. Capability chips flow right-to-left. Numeric member counts stay LTR (Broadcast tabular-nums rule).

---

## Layout

### Desktop / tablet ≥1024px

Full-width single column inside the settings-hub shell (no split; the settings hub already provides left-nav):

- Top: breadcrumb (R3) → screen title (R1) → sub (R2). Right-aligned on the same row as R1: `<HelpButton>` link (opens support article "How capability packs work").
- Section 1 overline (R12): `Built-in packs`.
- 2×3 grid: Finance card, Marketer card, Read-Only card (3 across, but Read-Only + Custom form the second row when viewport is < 1440px). At exactly 1440px the layout is 2×2 with Finance + Marketer on row 1 and Read-Only + Custom on row 2.
- Section 2 overline (R12): `Custom pack`.
- Custom pack card renders here in the 2-across layout; NOT in the built-in section.
- Bottom: `<Alert>` info banner (dismissible, remembered per user via `localStorage` key `agn-rol-001-info-seen`): "v1 supports one custom pack per agency. Multi-custom packs land in v2." Copy `var(--lc-type-body-sm)` + `--lc-text-secondary`.

### Mobile ≤767px

Single column, scroll:

- Breadcrumb collapses to `← Access & permissions` back-link (no full path).
- Screen title + sub stack vertically.
- All 4 cards render full-width, 1-per-row: Finance → Marketer → Read-Only → Custom. Overlines (R12) stay in place — the "Built-in packs" overline sits above Finance/Marketer/Read-Only, then "Custom pack" above the Custom card.
- Card action row (R10) becomes vertical stack; buttons full-width.
- Info banner at bottom.

### Pack-card anatomy (all viewports) — used by R4-R10

Each of the 4 cards contains, top-to-bottom:
- **Header row (R5):** icon well 48×48 + pack name + seeded/custom badge (R6/R7).
- **Description line:** `var(--lc-type-body)` + `--lc-text-primary`. One-line pack summary.
- **Capability chips row (R8):** up to 5 chips, wraps to a second line if needed.
- **Member-count line (R9):** `<Numeric>N</Numeric> members assigned` OR `No members yet — …`.
- **Warning banner (R11):** rendered only inside the Finance card when the two-owner precondition fails.
- **Action row (R10):** right-aligned buttons.

Card icons (48×48 well, 24×24 lucide glyph):
- Finance → `Coins` in a well tinted `--lc-status-warning-bg` with `--lc-status-warning-fg` glyph.
- Marketer → `Megaphone` in a well tinted `--lc-surface-sunken` with `--lc-text-brand` glyph (broadcast orange — reinforces "publishing").
- Read-Only → `Eye` in a well tinted `--lc-surface-sunken` with `--lc-text-muted` glyph.
- Custom → `Wrench` in a well tinted `--lc-surface-sunken` with `--lc-accent-bold-edge` glyph (teal accent — signals "you shaped this").

---

## Explicit copy (English — Arabic mirror pending MENA copywriter pass)

| Slot | Copy |
|---|---|
| Breadcrumb | Settings › Access & permissions › Roles |
| Screen title (R1) | Roles & permissions |
| Screen sub (R2) | Capability packs decide what each teammate can do. Assign packs from the member's profile. |
| Help button | How capability packs work → |
| Section overline (built-in) | Built-in packs |
| Section overline (custom) | Custom pack |
| Finance pack name | Finance |
| Finance description | Billing, invoices, credit adjustments, payout approvals, revenue reports. |
| Finance chips | Bill payments · Approve payouts · View invoices · Adjust credits · +3 more → |
| Marketer pack name | Marketer |
| Marketer description | Listing publishing, portal syndication, social broadcast, campaign metrics. |
| Marketer chips | Publish listings · Send broadcasts · Manage campaigns · Portal syndication · +2 more → |
| Read-Only pack name | Read-Only |
| Read-Only description | View everything, change nothing. For auditors and shadowing staff. |
| Read-Only chips | View listings · View leads · View reports · View billing · +8 more → |
| Custom pack name | Custom |
| Custom description | Your agency's own capability set. Edit any capability on or off. |
| Custom chips (example — depends on state) | Publish listings · View reports · Manage invites · +2 more → |
| Custom chips (empty state) | No capabilities enabled yet — Edit to configure. |
| Seeded-pack badge (R6) | Built-in — read only |
| Custom-pack badge (R7) | Custom — editable |
| Member-count line (R9) | {n} members assigned |
| Member-count line (zero) | No members yet — assign this pack from a member's profile. |
| Action button — View permissions | View permissions → |
| Action button — Edit permissions (Custom only) | Edit permissions |
| Action button — Assign to members | Assign to members |
| Warning banner (R11 — Finance, < 2 owners) | Assigning Finance requires a second owner for two-person approval. Add an owner first ↗ |
| Info banner (v1 constraint) | v1 supports one custom pack per agency. Multi-custom packs land in v2. |
| Sheet header (R13 — Assign to members) | Assign {packName} to members |
| Sheet body — search placeholder | Search by name or email |
| Sheet body — list header | Members ({total}) |
| Sheet body — already-assigned row helper | Already has {packName} |
| Sheet body — conflict row helper (Finance + owner-count) | Second owner required — cannot assign yet |
| Sheet body — save success toast | {packName} assigned to {n} member{s} |
| Sheet CTA | Assign |
| Sheet cancel | Cancel |
| Error toast — read pack list | We couldn't load your packs. Try again? |
| Error toast — write assignment | We couldn't save the assignment. Try again? |
| Empty error state (no packs returned — should never happen) | Something's wrong — no capability packs are configured. Contact support. |
| Loading skeleton alt | Loading capability packs |

**Voice rules** (inherited by AGN-ROL-002):
- Never use raw permission strings in UI copy. Convert `billing.payments.write` → "Bill payments"; `broadcasts.send` → "Send broadcasts".
- Never say "role" and "pack" interchangeably — v1's model is: role is `owner | admin | member | guest` (fixed by migration 028); capability packs modify what a `member` can do. Copy in this brief always uses "pack" for the capability bundle.
- Never render a chip for a DENIED capability. Only affirmative capabilities become chips. The full matrix (grant + deny) lives on AGN-ROL-002.
- Two-person copy: use "second owner" or "two-person approval", not "quorum" or "M-of-N".

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Breadcrumb | Custom `<Breadcrumb>` (already used in `SHR-SET-*` briefs) |
| Screen title | Plain `<h1>` with `var(--lc-type-heading-1)` |
| Help button | `<Button variant="link">` with `HelpCircle` icon |
| Pack-card grid | Plain CSS grid `grid-template-columns: repeat(2, 1fr)` on desktop, `1fr` on mobile |
| Pack card | `<Card>` primitive (Broadcast-migrated per PR #41) |
| Icon well | Plain `<div>` with tinted background |
| Pack icon | `lucide-react` — `Coins`, `Megaphone`, `Eye`, `Wrench` |
| Seeded/custom badge | `<Badge variant="outline">` |
| Capability chips | Custom `<CapabilityChip>` (see §Downstream shared components) |
| Member-count line | Plain `<p>` wrapping `<Numeric>` |
| Warning banner (R11) | `<Alert variant="warning">` (add if missing — variant maps to `--lc-status-warning-*`) |
| Info banner (dismissible) | `<Alert variant="info">` with a close-X button |
| Action-row buttons | `<Button variant="default" \| "outline">` |
| Assign sheet (R13) | `<Sheet>` + `<SheetHeader>` + `<SheetContent>` |
| Sheet search | `<Input>` with `Search` icon inside affix |
| Sheet member list | `<ScrollArea>` + rows of `<Checkbox>` + `<Label>` |
| Numeric display | `<Numeric>` (Broadcast primitive) |
| Toast | `<Sonner>` |
| Loading skeleton | Custom `<CardSkeleton>` (see §Downstream) |

Icons — `lucide-react`: `Coins`, `Megaphone`, `Eye`, `Wrench`, `HelpCircle`, `Search`, `AlertTriangle`, `X`, `ChevronRight`, `Check`.

---

## Sample content (for v0 / mockup)

Render the desktop 1440px layout with:
- **Breadcrumb:** `Settings › Access & permissions › Roles`
- **Screen title + sub:** as per copy table
- **Section 1: Built-in packs** overline visible
- **Finance card:** icon well warning-tinted, chips `Bill payments · Approve payouts · View invoices · Adjust credits · +3 more →`, member-count "2 members assigned", warning banner NOT shown (assumes agency has 2 owners), action row `[View permissions →]` `[Assign to members]` outline
- **Marketer card:** chips `Publish listings · Send broadcasts · Manage campaigns · Portal syndication · +2 more →`, member-count "5 members assigned"
- **Read-Only card:** chips `View listings · View leads · View reports · View billing · +8 more →`, member-count "1 member assigned"
- **Section 2: Custom pack** overline visible
- **Custom card:** custom badge orange, chips `Publish listings · View reports · Manage invites · +2 more →`, member-count "3 members assigned", action row `[View permissions →]` `[Edit permissions]` default `[Assign to members]` outline
- **Info banner** visible at bottom
- **Language:** EN, Light mode

Second sample state (for the second v0 pass):
- Finance card WITH warning banner R11 visible (agency has 1 owner). All other cards unchanged. Copy the R11 warning line verbatim.

Third sample state:
- Assign-to-members sheet OPEN over the Custom pack. Sheet header "Assign Custom to members". Search field empty. 5 rows of members visible; the first row shows the "Already has Custom" helper. Sheet CTA "Assign" disabled until at least one new checkbox is ticked.

---

## Interactions

**On page load:**
- Fetch `GET /api/agency/capability-packs` — returns pack list with counts.
- If 401/403 (caller lacks `settings.access.read`), redirect to `/agency` with toast "You don't have access to Roles & permissions."
- If 500, render error state (no cards; retry button).
- Otherwise render 4 cards in the described order.

**On card click (non-button area):**
- Navigate to `/agency/settings/roles/:packId` (AGN-ROL-002). Card must be reachable by Enter/Space keyboard when focused.

**On "View permissions →":**
- Same as card click — navigate to R14 detail.

**On "Edit permissions" (Custom pack only):**
- Navigate to `/agency/settings/roles/:packId?mode=edit` (AGN-ROL-002 in edit mode).

**On "Assign to members":**
- Open R13 sheet. Fetch `GET /api/agency/members?pack=<packId>` for the pre-checked state (members who already have this pack are shown checked + disabled with the "Already has" helper).
- Also fetch full member list `GET /api/agency/members?limit=500` (agencies are typically < 500; if larger, add search-server-side).
- User ticks/unticks. CTA becomes enabled only when the checkbox set differs from the initial state.
- On "Assign" click: PATCH `/api/agency/members/:userId/capability-packs` PER changed member. Batch via `Promise.allSettled` — show a per-row error indicator if any specific write fails.
- On success (all writes succeeded): sheet closes, toast "Custom assigned to 3 members", cards reload to refresh member counts.
- On partial success: sheet stays open, rows with errors show inline error + retry.

**On assigning the Finance pack when agency has < 2 owners:**
- Sheet renders but every checkbox is DISABLED with helper "Second owner required — cannot assign yet".
- CTA disabled with tooltip "Add a second owner first. → Ownership settings".
- The R11 warning banner on the card is what surfaced this state up-front.

**On help button:**
- Opens a new tab to `https://help.wingcaster.com/agency/capability-packs` (external — do NOT autofill; opens plain link).

**On info-banner dismiss:**
- Writes `localStorage['agn-rol-001-info-seen'] = 'true'`. Banner does not render on subsequent visits for that user.

**On language toggle / mode toggle:**
- Instant swap. No confirmation. Sheet, if open, preserves its state.

**On offline:**
- Card list stays rendered (last-cached). Assign sheet CTA disables with toast "You're offline. Reconnect to save assignments."

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial (data loaded)** | GET packs OK | 4 cards render in the described order. |
| **Loading** | GET packs in flight | Skeleton grid (4 card silhouettes) + skeleton chips. |
| **Error — load** | GET packs 500 | Empty state with `AlertTriangle` + "We couldn't load your packs" + Retry button. |
| **Error — assign** | PATCH failure inside sheet | Row shows inline error + Retry; other row writes continue. |
| **Financial-precondition failed** | Agency has < 2 owners | Finance card shows R11 warning. Finance sheet opens but disables all rows + CTA. |
| **Custom pack empty** | Custom pack has 0 capabilities | Custom card chips row reads "No capabilities enabled yet — Edit to configure." CTA "Edit permissions" is the primary. |
| **Read-Only member persona** | Caller has Read-Only pack | All "Assign to members" and "Edit permissions" buttons hidden. Cards render with only "View permissions →" action. Info banner unchanged. |
| **Sheet open — clean** | Assign clicked | Sheet renders; CTA disabled until state changes. |
| **Sheet open — dirty** | Ticks changed | CTA enabled. Cancel warns if changes pending. |
| **Sheet submitting** | Assign clicked | CTA shows Loader2 + "Saving…"; checkboxes disabled. |
| **Info banner dismissed** | User clicked X | Banner does not render on subsequent visits for this user. |
| **Offline** | Network unreachable | Cards stay; Assign disabled with helper. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Custom badge repositions top-left. Chip flow reverses. Numeric counts stay LTR. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Card surface `--lc-surface-raised` dark value. Warning banner tokens flip polarity. |
| **First-load (agency has 0 members)** | Members count = 0 across all packs | Cards render with "No members yet" line. First-run tip banner at top: "You haven't added teammates yet. Invite your first member ↗" — deep-link to AGN-MEM-003. |

---

## Accessibility

- Every card is `role="link"` with `aria-label="View Finance permissions"` etc. — clicking anywhere on the card navigates to R14 unless focus is on an inner button.
- Buttons within a card are focus-stopped from the card's link behavior via `event.stopPropagation()` in click handlers.
- Focus order: breadcrumb → help button → Finance card → Finance View button → Finance Assign button → Marketer card → … → Custom card action buttons → info banner dismiss.
- Warning banner (R11) is `role="alert"` so screen readers announce it on render.
- Assign sheet traps focus; Escape closes with a confirm dialog if changes pending.
- Every capability chip is a plain `<span>` (not interactive) with the chip text as its accessible name — the "+N more →" chip is a `<button>` that navigates to R14.
- Skip-link at page top jumps past the breadcrumb to the first pack card.
- Numeric member counts announced with the surrounding sentence via `<Numeric>` semantic wrapping (screen reader reads "3 members assigned", not "3, members assigned").
- Every tap target ≥ 44×44 CSS pixels — buttons + card as a whole.
- Reduced-motion: card hover elevation change instant; sheet slide-in instant.
- Language + mode switches announce via `aria-live="polite"`.

---

## Anti-patterns (do NOT do)

- Do NOT let admins create new packs from this screen. v1 constraint is one Custom slot. Adding "New pack" affordances now would set an expectation we can't hold in v2.
- Do NOT render raw permission strings anywhere. Convert `billing.payments.write` → "Bill payments". If a translation is missing, fall back to a human-readable slug from the backend response — never leak the machine key.
- Do NOT render a chip for a DENIED capability. Chips are affirmative. The full matrix (grants + denies + inherited) lives on AGN-ROL-002.
- Do NOT hide the Finance card entirely when the two-owner precondition fails. Hiding it removes the visibility that motivates the admin to add an owner. Render with R11 warning instead.
- Do NOT allow bulk-assign of the Finance pack via CSV or "assign all". Two-person rule + audit-trail governance require per-member intent.
- Do NOT round cards to 12px+. Broadcast is intentionally tight — `--lc-radius-lg` (7px).
- Do NOT use `--lc-orange-600` primitive alias — semantic `--lc-action-primary` only (Broadcast rule).
- Do NOT lighten hover state — Broadcast rule: hover DARKER (`--lc-elevation-md` shadow, not a fill change).
- Do NOT show the R13 sheet as a full-page modal — sheet keeps admins in context.
- Do NOT auto-select any checkbox in the R13 sheet. Every assignment must be an explicit tick.
- Do NOT render a "Delete pack" button anywhere. Custom cannot be deleted (only emptied); seeded packs cannot be modified.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Notion — Members & permissions** (Settings → People → Teamspace roles) — the row-per-role with capability chips is directly analogous.
- **Linear — Workspace roles** (Settings → Members → Roles) — the split between "built-in" and "custom" section headers with per-role edit affordances.
- **Vercel — Team roles** — the assign-to-members sheet pattern.
- **Auth0 — Roles list** — the compact card + chips summary anti-example of "too many chips at once" (they render 12+; we cap at 5 with a +N more link).

Do NOT match:
- Salesforce role hierarchy (too enterprise; hierarchical roles are NOT part of v1 model).
- AWS IAM (JSON-policy detail belongs on AGN-ROL-002, not here).

---

## Backend contract

### Read pack list on load

**Endpoint:** `GET /api/agency/capability-packs` (NEW — must ship with this brief)

**Response 200:**
```json
{
  "agency_id": "agn_...",
  "packs": [
    {
      "id": "finance",
      "kind": "seeded",
      "name": "Finance",
      "description": "Billing, invoices, credit adjustments, payout approvals, revenue reports.",
      "capability_summary": [
        { "key": "billing.payments.write", "label": "Bill payments" },
        { "key": "billing.payouts.approve", "label": "Approve payouts" },
        { "key": "billing.invoices.read", "label": "View invoices" },
        { "key": "billing.credits.adjust", "label": "Adjust credits" }
      ],
      "capability_total": 7,
      "member_count": 2,
      "requires_two_person": true,
      "editable": false
    },
    {
      "id": "marketer",
      "kind": "seeded",
      "name": "Marketer",
      "description": "Listing publishing, portal syndication, social broadcast, campaign metrics.",
      "capability_summary": [ ... ],
      "capability_total": 6,
      "member_count": 5,
      "requires_two_person": false,
      "editable": false
    },
    {
      "id": "read_only",
      "kind": "seeded",
      "name": "Read-Only",
      "description": "View everything, change nothing. For auditors and shadowing staff.",
      "capability_summary": [ ... ],
      "capability_total": 12,
      "member_count": 1,
      "requires_two_person": false,
      "editable": false
    },
    {
      "id": "custom",
      "kind": "custom",
      "name": "Custom",
      "description": "Your agency's own capability set. Edit any capability on or off.",
      "capability_summary": [ ... ],
      "capability_total": 5,
      "member_count": 3,
      "requires_two_person": false,
      "editable": true
    }
  ],
  "agency_meta": {
    "owner_count": 2,
    "member_count_total": 11
  }
}
```

**Response 403:** caller lacks `settings.access.read`. Client redirects to `/agency` with toast.

### Write assignment (R13 sheet)

**Endpoint:** `PATCH /api/agency/members/:userId/capability-packs` (NEW)

**Request body:**
```json
{
  "packs": ["marketer", "custom"],
  "audit_reason": null
}
```

Semantics: replaces the member's current `tenant_memberships.capability_packs` JSONB with the given list. Passing `["finance"]` on a `Finance` assignment triggers the two-person flow — response 202 with an approval request id instead of 200.

**Response 200 (immediate write, non-Finance):** the updated membership row.

**Response 202 (Finance — two-person triggered):**
```json
{
  "approval_request_id": "areq_...",
  "requires_approvers": 1,
  "message": "Awaiting second owner approval to grant Finance."
}
```
Client toast: "Finance assignment sent for second-owner approval." Sheet closes.

**Response 409 (Finance + only 1 owner):** `{ "error": "SECOND_OWNER_REQUIRED", "help_url": "/agency/settings/ownership" }`. Client shows the toast + disables the write.

**Response 400 (invalid pack id):** `{ "error": "UNKNOWN_PACK", "unknown_ids": [...] }`.

### Existing schema (migration 028)

Reuses `tenant_memberships.role` (unchanged: `owner | admin | member | guest`). Adds a new JSONB column via a follow-up migration:

```sql
-- New migration (numbered per actual state at branch time)
ALTER TABLE tenant_memberships
  ADD COLUMN capability_packs JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seeded pack definitions live in code (backend/src/lib/authz/capability-packs.js — NEW).
-- Only the assignment is per-tenant; pack DEFINITIONS are agency-agnostic in v1.
```

File as `[BE-BLOCKER-29] agency capability-pack schema + endpoints` in the kickoff doc §5a. Estimated 2-3 days:
- 0.5 day — migration for `capability_packs` JSONB on `tenant_memberships` + backfill (default `[]` for everyone).
- 0.5 day — seeded pack definitions module + capability registry.
- 1 day — `GET /api/agency/capability-packs` + `PATCH /api/agency/members/:userId/capability-packs` + two-person integration via existing `fin.approval_requests` infra.
- 0.5 day — capability-check middleware update (existing `role`-based checks become `role + packs`-based).

**Grep-verified today (2026-09-08):**
- `grep -rn "capability_pack\|member_capabilities" backend/src` — zero hits. This is a genuinely new subsystem.
- `role IN ('owner', 'admin', 'member', 'guest')` — the four canonical roles from migration 028 line 72.
- `fin.approval_requests` exists (used by fin/pricing/helpers.js, fin/ledger/transactions.js, fin/postpaid/facilities.js) — the two-person infra to reuse.

### Custom-pack editing lives on AGN-ROL-002

This screen does not write capability changes to a pack — only assignments of packs to members. Capability toggles are AGN-ROL-002's responsibility.

---

## Downstream implementation (Cursor prompt handoff notes)

### File creation

- **New route:** `web/src/pages/agency/settings/RolesOverviewPage.tsx` (this brief).
- **Route registration:** `web/src/App.tsx` — add `/agency/settings/roles` guarded by `useCapability('settings.access.read')` hook.
- **Sibling route** (shipped by AGN-ROL-002 in the same PR): `/agency/settings/roles/:packId`.

### Shared components (extracted for family reuse — MUST live in `web/src/components/agency/roles/`)

The following components are used by AGN-ROL-001 + AGN-ROL-002 and must be extracted up-front, not inlined:

1. **`<PackCard pack={packDto} onAssign onView onEdit />`** — the 2×2 grid card. Renders R4-R11 anatomy.
2. **`<CapabilityChip label kind="grant" />`** — single chip. `kind="grant"` for R8 usage; AGN-ROL-002 reuses with `kind="deny"` variant.
3. **`<PackAssignSheet packId open onOpenChange />`** — the R13 assign sheet. Handles GET members + PATCH per row + partial-error state.
4. **`<PackWarningBanner reason="second_owner_required" onAction />`** — R11 warning banner. Reused on AGN-ROL-002 for edit-mode preconditions.
5. **`<CardSkeleton variant="pack" />`** — loading skeleton for pack cards.
6. **`useCapabilityPacks()` hook** — SWR-backed hook exposing `{ packs, agencyMeta, isLoading, isError, mutate }`.
7. **`useAgencyCapability(capabilityKey)` hook** — client-side gate that reads the caller's own packs + role. Server-side gating is authoritative; this hook is for hiding UI affordances only.

### Test discipline

- Unit: PackCard renders 4 variants (Finance / Marketer / Read-Only / Custom), badge polarity correct, member count uses `<Numeric>`.
- Unit: CapabilityChip renders grant + deny variants; `+N more →` chip is a button, not a span.
- Integration: full flow test for Assign — open sheet, tick 2 rows, submit, verify 2 PATCH calls, toast, card counts update.
- Integration: two-person flow — with `requires_two_person: true` on Finance, assert 202 response is handled + no immediate count update.
- Integration: read-only persona — assert View button visible, Assign + Edit buttons absent.
- RTL: `screens.rtl.test.tsx` extension — custom badge repositions, chip flow reverses.
- Broadcast: `no-raw-hex.test.ts` stays green.
- a11y: axe-core smoke test on default state + sheet-open state + keyboard nav test (Tab through cards, Enter opens R14).

### Behavior contracts

- `useCapabilityPacks()` MUST tolerate 404 on first fetch — return empty pack array with an inline "capability system not initialized" empty state. This is a defensive posture; production should always seed the four packs.
- The R13 sheet's assign flow MUST batch PATCH calls with `Promise.allSettled` — a single failed row must not abort the successful ones.
- Warning banner (R11) rendering is driven by `agency_meta.owner_count < 2`, computed client-side from the pack list response. Backend is the source of truth; client is presentation.
- The "+N more →" chip navigates to `/agency/settings/roles/:packId#capabilities` — the anchor hash tells AGN-ROL-002 to scroll to the capability matrix.

---

## Broadcast alignment callouts summary

Every callout below is Broadcast-token-specific and non-negotiable. **AGN-ROL-002 references these by ID (R1-R16).**

- R1 screen title — `--lc-type-heading-1` + `--lc-text-heading`.
- R2 sub — `--lc-type-body-lg` + `--lc-text-secondary`.
- R3 breadcrumb — `--lc-type-body-sm` + `--lc-text-muted`.
- R4 pack-card grid — `--lc-surface-raised` + `--lc-elevation-sm`, radius `--lc-radius-lg`.
- R5 header row — 48×48 well + pack name + badge.
- R6 seeded badge — `--lc-surface-sunken` + `--lc-text-muted`.
- R7 custom badge — `--lc-action-primary` border + `--lc-text-brand` ink.
- R8 capability chips — `--lc-surface-sunken` + `--lc-text-primary`, pill radius.
- R9 member-count — `<Numeric>` + `--lc-text-secondary`.
- R10 action row — outline + default `<Button>` variants, 44px.
- R11 warning banner — `--lc-status-warning-*` tokens.
- R12 section overlines — `--lc-type-overline` + `--lc-text-muted`.
- R13 assign sheet — `<Sheet>` + `--lc-elevation-lg`.
- R14 card-click navigation — `role="link"` + `aria-label`.
- R15 focus ring — base-CSS two-tone, NEVER overridden.
- R16 motion — 120ms hover / 240ms sheet / instant reduced-motion.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster agency Roles overview screen (AGN-ROL-001) —
MENA real-estate B2B SaaS. It's the anchor of a 2-screen family
(AGN-ROL-001 + AGN-ROL-002); the delta references this one's Broadcast
callouts. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind +
Broadcast theme (--lc-* tokens; no raw hex).

First pass: render the desktop 1440px layout with breadcrumb
"Settings › Access & permissions › Roles", screen title "Roles &
permissions", the "Built-in packs" section with 3 pack cards (Finance
with 2 members / Marketer with 5 members / Read-Only with 1 member —
each showing 4 capability chips + a "+N more →" chip), then the
"Custom pack" section with 1 Custom card (3 members, orange custom
badge, "Edit permissions" as the primary action). Info banner at the
bottom about v1 supporting one custom pack. Finance card DOES NOT show
the warning banner (assume 2 owners exist).

LTR English light mode only for this pass — I'll ask for the warning
banner state, RTL Arabic, mobile 375px, dark mode, and the assign sheet
as separate follow-ups.

Follow the copy table exactly. Do NOT show raw permission strings — use
the human labels in the chip copy. Do NOT invent a "Create new pack"
button — v1 is one custom slot only.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now render the state where the agency has 1 owner. Finance card must show the R11 warning banner "Assigning Finance requires a second owner…" inside the card.`
2. `Now the assign-to-members sheet OPEN over the Custom pack. Sheet header "Assign Custom to members". 5 member rows visible; first row shows "Already has Custom" and is disabled + checked. Assign CTA disabled until state changes.`
3. `Now mobile 375px — cards stack full-width, action buttons stack vertically, breadcrumb collapses to a back-link.`
4. `Now RTL Arabic desktop — mirror everything. Custom badge moves to top-left. Chip flow reverses. Numeric member counts stay LTR.`
5. `Now dark mode versions of desktop LTR + mobile LTR.`
6. `Now the Read-Only persona view — no Assign or Edit buttons; only View permissions →.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGN-ROL-001/` and screenshots to `docs/design/mockups/AGN-ROL-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (desktop-LTR-light default, R11 warning, assign sheet, mobile, RTL, dark, read-only persona).
- [ ] Screenshots committed under `docs/design/mockups/AGN-ROL-001-*.png`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGN-ROL-001/`.
- [ ] Shared components extracted at `web/src/components/agency/roles/` per §Downstream.
- [ ] `[BE-BLOCKER-29]` filed in kickoff §5a — capability-pack schema + `GET /packs` + `PATCH /members/:userId/capability-packs`.
- [ ] `useCapabilityPacks()` + `useAgencyCapability()` hooks implemented + used by AGN-ROL-002 in the same PR.
- [ ] `no-raw-hex.test.ts`, `screens.rtl.test.tsx`, and a11y smoke tests pass.
- [ ] AGN-ROL-002 brief cross-references this brief's R1-R16 callouts without redefining them.
