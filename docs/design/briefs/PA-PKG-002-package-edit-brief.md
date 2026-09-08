# Screen Brief — PA-PKG-002 · Package edit (DRAFT version editor)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits Broadcast alignment + PA console shell + PA-PKG-family invariants unchanged from `PA-PKG-001-package-list-brief.md` (anchor). This file covers only what differs for the DRAFT-version editor surface. Read PA-PKG-001 first.

Companion to Cursor prompt `docs/prompts/CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-002 — Package edit (draft version editor)" and matrix `SCREEN_MATRIX_PA.md` §6 (`PA-PKG-004` in the pre-Rev-6 numbering — collapsed into this brief per the Rev-6 four-screen slate in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §11a).

Wave 3.5 (Week 6). Backend prerequisite is the admin write endpoints in Cursor prompt §2.1 + Zod schemas §2.2.

---

## Broadcast alignment

**Inherits `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` + the `PA-PKG-001` §Broadcast-alignment callout block + the PA-PKG-family invariants (1..8) verbatim.** Screen-specific deltas below.

- **Two-column split, 62/38 (form / preview + diff panel).** Form column on `var(--lc-surface-raised)`; right panel on `var(--lc-surface-sunken)` with `border-left: 1px solid var(--lc-border)`.
- **Section headers (Identity, Caps, Price, Trial, Portal group, Feature quotas, Feature toggles, Support level):** `var(--lc-type-heading-3)` (600 18/24 IBM Plex Sans) with a tiny `--lc-text-muted` `var(--lc-type-overline)` step-count above ("Step 3 of 8") — non-navigational; the form is one long scroll, the labels just orient.
- **Sticky footer action bar:** `background: var(--lc-surface-raised)` + `border-top: 1px solid var(--lc-border)` + `--lc-elevation-md` inverted (shadow points up). Contains: left = `Discard changes` (ghost button), center = unsaved-changes indicator, right = `Save draft` (secondary) + `Submit for approval` (primary `--lc-action-primary`).
- **Two-person-approval warning banner (conditional):** appears above the sticky footer when the current form state's diff vs the current ACTIVE version includes a price (monthly OR annual) OR property_cap change. Uses `--lc-status-warning-{bg,fg}` with `AlertTriangle` icon + copy "This change requires two-person approval — you cannot approve your own submission." Explains WF-20 to the PA in the moment they'd trip it.
- **Preview card (right panel top):** live-rendered "how this tier appears on wingcaster.com" mock. Matches the marketing site's actual `<PricingCard>` component shape (Cursor prompt §2.4 note "Uses the same tier shape the public API returns"). Card uses Broadcast tokens — this is a fidelity preview, not a marketing-site embed. Every field re-renders on any form-field change (debounced 100ms).
- **Diff panel (right panel bottom):** side-by-side comparison with the current ACTIVE version. One row per changed field; unchanged fields hidden. Layout: `Field name` (left, `var(--lc-type-caption)` `--lc-text-muted`) | current-value (center, `--lc-text-muted` strikethrough) | new-value (right, `--lc-text-primary` + `--lc-status-warning-bg` highlight tint for price/property_cap fields to hint the two-person trigger). Empty state: "No changes yet — start editing to see the diff.".
- **Feature quotas repeater:** dynamically populated from the feature registry (per Cursor prompt §2.4; each row = one feature). Each row: feature key (left, mono `.lc-data`) + human-readable name (left secondary, `--lc-text-muted`) + `<Input>` accepting a positive integer OR the literal string `unlimited` + a helper chip "unlimited = no cap" with a small `HelpCircle` icon. Save-time conversion: `unlimited` → `-1`; integer → the integer. Server-side validation refuses negative-except-`-1`.
- **Feature toggles group:** each toggle a `<Checkbox>` with the feature label + one-line description in `var(--lc-text-muted)`. Grouped by module (Social / Portal / AI / Comms / Assets) with `var(--lc-type-overline)` section labels.
- **Portal-group Select:** fed from `portal_groups` lookup (per Cursor prompt §2.4). Below the Select, a helper line renders the count of portals in the selected group — `<Numeric>4</Numeric> portals in this group: Property Finder AE, Bayut UAE, Dubizzle UAE, OLX Dubai`. Ties the abstraction back to concrete portal names.
- **Support-level radio group:** four options as `<RadioGroup>` cards: `Email` / `Email + chat` / `Dedicated` / `Dedicated + Slack`. Selected card gets `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)`.
- **Trial-days input:** `<Input type="number">` with helper "Set 0 for no trial." + `sales_led` `<Checkbox>` beside it with helper "When checked, the marketing site shows a Contact-sales CTA instead of a self-serve checkout button."
- **Price inputs:** two side-by-side `<Input type="number">` — monthly (USD minor units, e.g. `2900` for $29.00) with a helper below rendering the dollar equivalent via `<Numeric>` — `= $29.00 / mo`; and annual with the same helper `= $290.00 / yr ($24.17 / mo effective)`. Minor-unit is deliberate to prevent floating-point rounding drift.
- **Focus and motion:** two-tone focus ring on every input; section-scroll uses `scroll-behavior: smooth` when a section-nav link is clicked (see §Layout — Section anchor rail). Live preview + diff updates use `--lc-duration-fast` fade to avoid distracting flicker.
- **Radii + elevation:** form-card `var(--lc-radius-lg)` `--lc-elevation-sm`; preview + diff panel `var(--lc-radius-lg)` (no elevation, uses sunken surface). Every numeric field via `<Numeric>` — prices, caps, trial days, feature quotas, portal counts.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PKG-002 |
| Screen name | Package edit (DRAFT version editor) |
| Persona | PA (Platform Admin — `platform_role === 'platform_admin'`; elevated for the Submit-for-approval action per SHR-MFA-007 when the diff includes price/property_cap changes) |
| Device targets | Desktop 1440px ONLY (as PA-PKG-001) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/packages/:packageId/versions/new` (create fresh) OR `/admin/packages/:packageId/versions/:version/edit` (edit existing DRAFT). Query params: `?return_to=<url>` for back-navigation to PA-PKG-001 or PA-PKG-004. |
| Current state | MISSING — this brief supersedes matrix `PA-PKG-004 PackageVersionEditor.tsx` which existed pre-Rev-6 for the legacy `/admin/fin/packages` route. New file at `web/src/pages/admin/packages/PackageEditPage.tsx`. |
| Workflow role | WF-07 (Package publishing) role = Composition (editor) → Initiator on submit |
| Backend prerequisites | ⏳ `POST /api/admin/packages/:id/versions` (create DRAFT) · `PATCH /api/admin/packages/:id/versions/:version` (update DRAFT) · `POST /:version/submit` (DRAFT → PENDING_APPROVAL) · `GET /api/admin/feature-registry` (dynamic feature list) · `GET /api/admin/portal-groups` (portal-group Select) — all per Cursor prompt §2.1. ⏳ `[BE-VERIFY-12] Feature-registry live fetch — NEW.` Confirm the feature-registry lookup is env-agnostic (registry itself is shared LIVE+TEST) but per-package quota rows are env-scoped. ~0.5 day audit. **File in kickoff §5a.** ✅ SHR-MFA-007 step-up. ✅ If-Match precondition on PATCH + submit. |
| Cluster | Wave 3.5 (Week 6 per §6 + §11a — same PR as PA-PKG-001/003/004) |

---

## Purpose

Platform Admin composes one DRAFT version of one package — every marketing-visible field, cap, price, trial, portal group, per-feature quota, feature toggle, and support level — with a live preview showing how the tier will appear on wingcaster.com/pricing and a diff panel showing exactly what will change vs the current ACTIVE version. On submit, the version enters PENDING_APPROVAL and the diff-detection engine determines whether one or two approvers are required.

Success outcome: PA arrives with a change intention ("bump Semsar price by $5" / "add unlimited AI-copy quota to Growth" / "enable white-label toggle on Enterprise+"), edits the relevant fields, sees the diff panel confirm exactly and only those changes, sees the preview render the new marketing card, and submits. The version now sits in PA-PKG-003 approval queue awaiting one or two approvers.

---

## Design goals

1. **The form doesn't hide anything.** Every marketing-visible field, every feature quota, every toggle is on the page. No wizard steps. Long scroll is acceptable — PA is a rare-visit admin who needs the full field grid in view.
2. **The diff is unmissable.** The right panel's diff section is the answer to "am I about to change something I didn't intend?" and it renders live on every keystroke.
3. **The preview is honest.** What the PA sees in the preview card is what the marketing site's `<PricingCard>` renders from the public API — not a stylized fake. Fidelity beats prettiness.
4. **Two-person triggers surface AT THE MOMENT they'd fire.** When the PA types a new price or bumps the property cap, the warning banner appears immediately (not on submit-click). PA gets no surprise on submit.
5. **Save draft is safe and cheap.** The Save-draft button never blocks on validation — even a partially-invalid DRAFT can be persisted. Only Submit-for-approval enforces the full validation set. This lets the PA save-and-walk-away.
6. **Concurrent-edit collision handled gracefully.** If a peer opened the same DRAFT and saved first, our PATCH gets 412 and we render a merge-or-discard modal instead of losing the PA's local edits silently.

---

## Layout

Single-column PA console shell (SHR-NAV-001 top bar + PA-NAV-001 env badge + optional TEST warning strip — inherited from PA-PKG-001).

**Header block (sticky under top bar + optional TEST strip):**
- Left: page title "Editing {Package display_name}" (`var(--lc-type-heading-1)`) + subtitle "DRAFT v{N} · Based on ACTIVE v{M} · Last saved {T}" (`var(--lc-type-body-sm)` `--lc-text-muted`).
- Right: `Cancel` (`<Button variant="ghost">` — returns to `return_to` or PA-PKG-001) + `?` keyboard-hints icon-button.

**Section anchor rail (left, sticky, 200px wide):**
- Persistent left column visible on the form side (embedded inside the 62% form column, so the effective form-input area is ~500px). List of section anchors: Identity · Caps · Price · Trial · Portal group · Feature quotas · Feature toggles · Support level.
- Each anchor is a link (`<a href="#section-id">`) with a small `Check` icon prefix when the section has changes vs the current ACTIVE (mirrors the diff panel). Clicking scrolls smoothly to that section.
- Focused-section anchor is highlighted with `--lc-action-primary` left-edge bar.

**Form column (62%, scrollable):**

Section 1 — **Identity**
- `display_name` — `<Input>` with helper "Shown on wingcaster.com/pricing."
- `tagline` — `<Input>` with helper "One-line marketing subhead. Max 120 chars." + character counter via `<Numeric>` — e.g. `78 / 120`.
- `sort_order` — `<Input type="number">` with helper "Lower numbers appear first on the pricing grid."

Section 2 — **Caps**
- `agent_cap` — `<Input type="number">` with an `Unlimited` `<Switch>` beside it. When Switch is ON, Input is disabled + shows "Unlimited". When Switch is OFF, Input is required + must be a positive integer. Saved as `null` when Switch is ON, otherwise the integer.
- `property_cap` — same pattern as `agent_cap`. **Any change here triggers the two-person-approval warning banner.**

Section 3 — **Price**
- `price_monthly_minor` — `<Input type="number">` (label "Monthly price (USD, minor units — cents)") + helper below rendering `= $29.00 / mo` in `<Numeric>`. Empty allowed for sales-led packages.
- `price_annual_minor` — same pattern + helper `= $290.00 / yr ($24.17 / mo effective)`.
- **Any change to either price triggers the two-person-approval warning banner.**

Section 4 — **Trial**
- `trial_days` — `<Input type="number">` with helper "Set 0 for no trial. Common values: 0, 7, 14, 30."
- `sales_led` — `<Checkbox>` with helper "When checked, the marketing site renders a Contact-sales CTA instead of a self-serve checkout button. Use for Enterprise-tier packages."

Section 5 — **Portal group**
- `portal_group_id` — `<Select>` fed from `portal_groups` lookup. Below the Select, a helper line rendering the count + names of portals in the selected group via `<Numeric>` + a short comma-joined list. If no group selected: warning helper "This package will render on wingcaster.com/pricing with no portal-quota row — most tiers should have one."

Section 6 — **Feature quotas** (dynamic from feature registry)
- One row per feature in the registry. Layout: feature key (mono, `.lc-data`) + feature display name (`--lc-text-muted`) + module tag pill + `<Input>` accepting positive integer OR literal string `unlimited` + a small `HelpCircle` tooltip explaining unit ("credits per property per month" / "properties total" / etc.).
- Header row: `<Numeric>{N}</Numeric> features from registry · Missing a feature? Add one first in Feature registry admin →` (deep-link to matrix `PA-PKG-007` for later — Phase-2 note stub for now).
- Repeater is virtualized only if registry >30 features (unlikely in v1).

Section 7 — **Feature toggles** (dynamic from feature registry, `is_flag=true` rows)
- Grouped by module (Social / Portal / AI / Comms / Assets / Governance). Each `<Checkbox>` with label + one-line description.

Section 8 — **Support level**
- `<RadioGroup>` with 4 cards — Email / Email + chat / Dedicated / Dedicated + Slack. Selected card highlighted per PA-PKG-001 §Broadcast callouts.

**Sticky footer action bar:**
- Left: `Discard changes` (ghost button — only visible when there are unsaved edits; opens confirm AlertDialog).
- Center: unsaved-changes indicator ("Unsaved changes" chip with amber `--lc-status-warning-dot` when dirty; "All saved" chip with green `--lc-status-published-dot` when clean).
- Center-right (conditional): two-person-approval warning banner (see §Broadcast alignment) when the diff includes price/property_cap changes.
- Right: `Save draft` (`<Button variant="outline">`) + `Submit for approval` (`<Button variant="default">` `--lc-action-primary`).

**Right panel (38%, scrollable independently):**

Top card — **Preview** (`var(--lc-type-heading-3)` header + card body). Renders a Broadcast-token-faithful mock of the marketing-site `<PricingCard>` for this tier: display_name, tagline, price monthly + annual toggle, property cap, agent cap, feature quotas summary (first 5 features, "+N more" if longer), toggles rendered as bullet features with a `Check` icon, support level, trial-days label, sales-led CTA if applicable. Every field re-renders on any form-field change (debounced 100ms).

Bottom card — **Diff vs ACTIVE v{M}** (`var(--lc-type-heading-3)` header + card body). Renders each changed field on its own row: label | current value (strikethrough, muted) | new value (highlighted). Price + property_cap rows carry the amber `--lc-status-warning-bg` tint to hint the two-person trigger. Empty state (no changes yet): "No changes yet — start editing to see the diff." in `--lc-text-muted`.

### Empty state — brand-new package (v1 DRAFT)

Diff panel shows "New package — no prior version to compare against. All fields are new." Preview shows the form-state-in-progress card.

### Below-min-viewport fallback (<1024px)

Same "PA console requires a desktop screen" info block as PA-PKG-001.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title template | Editing {Package display_name} |
| Subtitle template | DRAFT v{N} · Based on ACTIVE v{M} · Last saved {T} |
| Subtitle — brand new | DRAFT v1 · Brand new package · Not saved yet |
| Cancel button | Cancel |
| Section anchor — identity | Identity |
| Section anchor — caps | Caps |
| Section anchor — price | Price |
| Section anchor — trial | Trial |
| Section anchor — portal-group | Portal group |
| Section anchor — feature-quotas | Feature quotas |
| Section anchor — feature-toggles | Feature toggles |
| Section anchor — support-level | Support level |
| Identity — display-name label | Display name |
| Identity — display-name helper | Shown on wingcaster.com/pricing. |
| Identity — tagline label | Tagline |
| Identity — tagline helper | One-line marketing subhead. Max 120 chars. |
| Identity — sort-order label | Sort order |
| Identity — sort-order helper | Lower numbers appear first on the pricing grid. |
| Caps — agent-cap label | Agents per package |
| Caps — agent-cap unlimited-switch | Unlimited |
| Caps — property-cap label | Properties per package |
| Caps — property-cap warning-hint | Changing this triggers two-person approval. |
| Price — monthly label | Monthly price (USD, cents) |
| Price — monthly helper | = ${dollars} / mo |
| Price — annual label | Annual price (USD, cents) |
| Price — annual helper | = ${dollars} / yr (${effective} / mo effective) |
| Price — warning-hint | Changing price triggers two-person approval. |
| Trial — days label | Trial days |
| Trial — days helper | Set 0 for no trial. Common values: 0, 7, 14, 30. |
| Trial — sales-led label | Sales-led package |
| Trial — sales-led helper | When checked, the marketing site renders a Contact-sales CTA instead of a self-serve checkout button. |
| Portal group — label | Portal group |
| Portal group — helper | {N} portals in this group: {list} |
| Portal group — none-warning | This package will render on wingcaster.com/pricing with no portal-quota row — most tiers should have one. |
| Feature quotas — heading | Feature quotas |
| Feature quotas — subheading | {N} features from registry · Missing a feature? Add one first in Feature registry admin → |
| Feature quotas — input helper | Type a positive integer, or "unlimited" for no cap. |
| Feature toggles — heading | Feature toggles |
| Support level — heading | Support level |
| Support level — option-email | Email |
| Support level — option-email-chat | Email + chat |
| Support level — option-dedicated | Dedicated |
| Support level — option-dedicated-slack | Dedicated + Slack |
| Sticky footer — unsaved chip | Unsaved changes |
| Sticky footer — saved chip | All saved |
| Sticky footer — save-draft | Save draft |
| Sticky footer — submit-for-approval | Submit for approval |
| Sticky footer — discard-changes | Discard changes |
| Two-person warning banner title | This change requires two-person approval |
| Two-person warning banner body | Price and property-cap changes require a second Platform Admin to approve. You cannot approve your own submission. |
| Preview card heading | Preview — how this appears on wingcaster.com |
| Diff card heading — brand new | New package — no prior version to compare against. All fields are new. |
| Diff card heading — vs active | Diff vs ACTIVE v{M} |
| Diff card empty | No changes yet — start editing to see the diff. |
| Diff row template | {field} · {current} → {new} |
| Discard-changes confirm title | Discard your changes? |
| Discard-changes confirm body | Your local edits since the last save will be lost. |
| Discard-changes confirm ok | Discard |
| Discard-changes confirm cancel | Keep editing |
| Concurrent-edit modal title | Someone else edited this draft |
| Concurrent-edit modal body | This draft was updated by {peer_display_name} at {T}. Reload to pick up their changes (you'll lose your local edits) or download your local edits as JSON to reapply after reload. |
| Concurrent-edit modal reload | Reload draft |
| Concurrent-edit modal download-local | Download my edits |
| Submit — validation-failed toast | Fix the highlighted fields before submitting. |
| Submit — success-single toast | Submitted v{N} for approval. |
| Submit — success-two-person toast | Submitted v{N} for two-person approval. A second admin will review the price / property-cap change. |
| Submit — step-up prompt template | Confirm your identity to submit this two-person-required change. |
| Save-draft success toast | Draft saved. |
| Save-draft error toast | Couldn't save draft. Try again. |
| Field validation — required | Required. |
| Field validation — positive-integer | Must be a positive integer. |
| Field validation — quota-format | Must be a positive integer or the word "unlimited". |
| Field validation — tagline-length | Max 120 characters. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page title | plain `<h1>` with `--lc-type-heading-1` |
| Section header | plain `<h2>` with `--lc-type-heading-3` |
| Section anchor rail | plain `<nav>` with sticky positioning |
| Form fields | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup` + `RadioGroupItem` |
| Field label | `Label` (visible, never placeholder-only) |
| Field helper text | plain `<p>` with `--lc-type-caption` `--lc-text-muted` |
| Feature quotas repeater | plain repeated row layout with `Input` per row + `Tooltip` on `HelpCircle` |
| Sticky footer | Custom `<div>` styled with Broadcast tokens; `position: sticky; bottom: 0` |
| Unsaved chip / All-saved chip | `<Badge variant="outline">` with dot glyph |
| Save-draft button | `Button variant="outline"` |
| Submit-for-approval button | `Button variant="default"` |
| Discard-changes button | `Button variant="ghost"` |
| Two-person warning banner | Custom `<div>` with `AlertTriangle` icon, `--lc-status-warning-bg` background |
| Preview card | Custom `<div>` mirroring `<PricingCard>` shape from marketing site |
| Diff card | Custom `<div>` with per-row `<dl>` structure |
| Diff row | `<div>` with three columns (field · current · new) |
| Discard-changes confirm | `AlertDialog` |
| Concurrent-edit modal | `Dialog` |
| Step-up prompt | Embedded `SHR-MFA-007` modal |
| Toast (success + error) | `Sonner` toast |
| Keyboard hints panel | `Sheet` — inherited from PA-MOD-001 REUSABLE component |
| Icons | `lucide-react` — `Check`, `HelpCircle`, `AlertTriangle`, `RotateCcw`, `Save`, `Send`, `ChevronDown`, `X` |
| Numeric renders | `<Numeric>` primitive |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE.
- **Header:** "Editing Small Team" title, subtitle "DRAFT v7 · Based on ACTIVE v6 · Last saved 2m ago". Cancel + `?` on the right.
- **Section anchor rail (left):** all 8 sections listed; Identity + Caps + Price have `Check` prefix (they have changes vs ACTIVE); currently focused = Price.
- **Form column, scrolled to Price section:**
  - Identity: display_name "Small Team", tagline "Two to five agents sharing a listing pool and inbox — now with expanded portal quotas", sort_order 300 (unchanged).
  - Caps: agent_cap 5 (unchanged, Unlimited switch off), property_cap 150 (WAS 100 — change highlighted by two-person banner).
  - Price: monthly 11900 (`= $119.00 / mo`, WAS 9900 → $99.00), annual 119000 (`= $1,190.00 / yr ($99.17 / mo effective)`, WAS 99000).
  - Sticky footer visible: `Unsaved changes` chip amber + `Save draft` (outline) + `Submit for approval` (primary orange).
  - Two-person warning banner visible above the sticky footer: "This change requires two-person approval — Price and property-cap changes require a second Platform Admin. You cannot approve your own submission."
- **Right panel:**
  - **Preview card:** renders the Small Team card with the NEW price/cap — $119/mo, 150 properties, 5 agents, etc.
  - **Diff card:** heading "Diff vs ACTIVE v6"; rows: `Price monthly · $99.00 → $119.00` (amber tint) · `Price annual · $990.00 → $1,190.00` (amber tint) · `Property cap · 100 → 150` (amber tint) · `Tagline · "Two to five agents sharing a listing pool and inbox" → "Two to five agents sharing a listing pool and inbox — now with expanded portal quotas"`.

Do NOT fabricate feature-registry entries — every feature quota row must correspond to a real feature key that would come back from `GET /api/admin/feature-registry` in the current DB. Placeholder examples: `credits.property_month`, `credits.ai_copy`, `portal.publish_bayut_ae`, `comms.whatsapp_intake`, `assets.hero_image_upload`. Do NOT invent MRR / subscriber-impact numbers here — that projection is Phase-2.

---

## Interactions

**On page load (existing DRAFT):**
- Fetch `GET /api/admin/packages/:id/versions/:version` — the DRAFT payload including every field + the current ACTIVE version's field snapshot for diff.
- Fetch `GET /api/admin/feature-registry` (cache 5min) + `GET /api/admin/portal-groups` (cache 5min).
- Show 3-section skeleton while loading.
- On success: prefill every field; render preview + empty diff. Cursor lands on the display_name field.

**On page load (create fresh — route `/versions/new`):**
- Server-side: `POST /api/admin/packages/:id/versions` creates the DRAFT (copied from current ACTIVE if one exists). Client is redirected to the edit URL with the new version number.
- Otherwise the same load pattern as existing DRAFT.

**On field edit:**
- Update local state.
- Debounce 100ms + re-render preview + diff panels.
- Mark form as dirty; sticky footer chip flips to "Unsaved changes" amber.
- If the edited field is `price_monthly_minor`, `price_annual_minor`, or `property_cap`: check whether the new value differs from the ACTIVE-version snapshot; if so, render the two-person warning banner (dismiss automatically if PA reverts the value).

**On `Save draft`:**
- Client fires `PATCH /api/admin/packages/:id/versions/:version` with `{ ...formState }` + `If-Match: <version.updated_at>`.
- Success 200: update local `updated_at` + `last_saved_at`; sticky footer chip flips to "All saved" green; toast "Draft saved."
- Fail 412 (concurrent edit): show the Concurrent-edit modal (see §State variants).
- Fail 400 (validation): highlight the failing fields inline; toast "Couldn't save — check highlighted fields." (Note: Save-draft normally accepts partial-invalid payload — a 400 here means a schema-level constraint like non-null on a required column.)
- Fail 500: toast "Couldn't save draft. Try again."

**On `Submit for approval`:**
- Client-side full validation: every required field, every quota row a positive integer or "unlimited", every price a positive integer if not sales-led, portal group chosen, support level chosen. Missing → toast "Fix the highlighted fields before submitting." + inline errors.
- If diff includes price OR property_cap: step-up prompt via SHR-MFA-007. On success, proceed. On cancel, silent-cancel.
- Fire `POST /api/admin/packages/:id/versions/:version/submit` with `{ reason: "" }` (reason field kept simple — the diff itself is the record).
- Success 200: toast "Submitted v{N} for approval." (or "…for two-person approval." variant); redirect to `/admin/packages/approvals/:versionId` (PA-PKG-003 detail) so the PA sees the pending queue entry immediately.
- Fail 412: concurrent-edit modal.
- Fail 400: inline errors + toast.
- Fail 500: toast "Couldn't submit. Try again."

**On `Discard changes`:**
- Only visible when dirty. Opens AlertDialog "Discard your changes? Your local edits since the last save will be lost."
- Confirm: refetch DRAFT from server, blow away local state, reset chip to "All saved".
- Cancel: close dialog, keep state.

**On `Cancel` (header):**
- If dirty: same discard-changes AlertDialog. Confirm → navigate to `return_to` or PA-PKG-001. If clean: navigate directly.

**On section-anchor click:**
- `scroll-behavior: smooth` scrolls the form column to the section. Anchor gets `--lc-action-primary` left-edge bar until scroll finishes.

**On feature-quota input change:**
- Accept typed integer (positive) OR the literal string `unlimited` (case-insensitive; auto-lowercase on blur).
- On blur, canonicalize: `unlimited` stays as `unlimited` in the input; on save, converted to `-1` in the payload.
- Invalid (negative integer, non-numeric non-"unlimited"): inline error under the row + Save-draft still permitted (partial-invalid allowed) but Submit blocked.

**On unlimited-switch toggle (agent_cap / property_cap):**
- ON: disable Input, show "Unlimited" placeholder, set state value to `null`.
- OFF: enable Input, focus it, clear the placeholder.

**On keyboard shortcut:**
- `Cmd+S` / `Ctrl+S` — Save draft (intercept default browser save).
- `Cmd+Enter` / `Ctrl+Enter` — Submit for approval.
- `Esc` — Cancel (with discard confirm if dirty).
- `?` — open shortcuts sheet.

**On PA-NAV-001 env-change:**
- If dirty: confirm-discard prompt (env switch would lose local edits and switch to a different env's package catalog). Confirm → refetch in new env (but note: this DRAFT belongs to the old env; the new env may not have this package — redirect to PA-PKG-001 in new env). Cancel → stay.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Skeleton form. Right panel dimmed. |
| **Ready — existing DRAFT** | Load complete | Every field prefilled from the DRAFT payload. Sticky footer chip "All saved". |
| **Ready — brand-new v1 DRAFT** | Fresh from new-package modal | Every field empty (with the seed fields — display_name, sort_order derived from tier — prefilled from the POST response). Diff panel shows "New package" empty state. |
| **Editing — dirty** | Any field change | Sticky footer chip "Unsaved changes" amber. Discard-changes button visible. |
| **Two-person banner active** | Price or property_cap differs from ACTIVE | Warning banner above sticky footer. Persists until value reverts or is committed via Submit. |
| **Save in progress** | Save-draft click | Save button shows Loader2 + "Saving…". Form disabled. |
| **Save success** | 200 | Chip flips to "All saved". Toast. |
| **Save fail — concurrent edit** | 412 | Concurrent-edit modal — Reload draft OR Download my edits (JSON). |
| **Save fail — validation** | 400 | Inline field errors + toast. Chip stays "Unsaved changes". |
| **Save fail — server** | 500 | Toast. State unchanged. |
| **Submit — validation blocked** | Missing required + click | Toast + inline errors. No POST fired. |
| **Submit — step-up required** | Diff includes price/property_cap | SHR-MFA-007 modal fires; on success re-fires the submit. |
| **Submit in progress** | POST in flight | Submit button shows Loader2 + "Submitting…". Form disabled. |
| **Submit — success (single-person)** | 200, no price/property_cap change | Toast "Submitted v{N} for approval." + navigate to PA-PKG-003 detail. |
| **Submit — success (two-person)** | 200, price/property_cap change | Toast "Submitted v{N} for two-person approval. A second admin will review." + navigate to PA-PKG-003 detail. |
| **Submit — concurrent edit** | 412 | Concurrent-edit modal. |
| **Submit — server fail** | 500 | Toast. Stay on page. |
| **Discard confirm open** | Discard-changes click OR Cancel with dirty | AlertDialog. |
| **Concurrent-edit modal open** | 412 on any write | Modal traps focus; two options (Reload OR Download). |
| **Session expired** | 401 (not step-up) | Redirect to `SHR-AUT-001` login with return-to param. |
| **Insufficient permission** | 403 | Full-page block: "You need package-admin access to edit this draft." Link to PA home. |
| **Env-switch mid-flow** | PA-NAV-001 env change | If dirty: confirm-discard. Confirm → navigate to PA-PKG-001 in new env (this DRAFT is env-specific). |
| **TEST-env warning strip** | env=TEST | Persistent full-width warning strip renders under top bar. Preview card shows a "TEST preview" watermark chip. |
| **Below-min-viewport** | <1024px | Full-page info block. |
| **RTL** | Locale = ar | Whole layout mirrors; section anchor rail moves to the right; price/cap numerals stay LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. |

---

## Accessibility

- Every form control has a visible `<Label>` via `htmlFor`.
- Section headers use `<h2>`; anchor rail links point to `#section-<id>`.
- Sticky footer is `role="region"` + `aria-label="Draft actions"`.
- Two-person warning banner is `role="status"` + `aria-live="polite"` — announced when it appears.
- Preview + diff panels are `role="region"` with `aria-label="Preview" / "Diff vs ACTIVE"`.
- Diff rows use `<dl>` semantics.
- Save shortcut (Cmd/Ctrl+S) announces "Draft saved" via a hidden aria-live region.
- Concurrent-edit modal traps focus + Esc; Reload / Download options are keyboard-reachable.
- Feature-quota `<Input>` fields have `aria-describedby` linking to per-row helper + error text.
- Focus rings via base CSS two-tone.
- Section-anchor scroll respects `prefers-reduced-motion` (jumps instead of smooth-scrolls).
- Every icon-only button (`?`) has `aria-label`.

---

## Anti-patterns (do not do these)

- Do NOT render numeric fields (price, cap, quotas, days) in the UI font. Every number goes through `<Numeric>` — including inside the preview card mock.
- Do NOT hide the diff panel behind a toggle. It stays visible and updates live.
- Do NOT surface the two-person-approval banner only on Submit-click. The banner appears the moment the diff qualifies.
- Do NOT allow Save-draft to open a modal or block on validation for non-critical fields. Save-draft is deliberately liberal.
- Do NOT allow Submit-for-approval to bypass step-up when the diff includes price/property_cap.
- Do NOT lose the PA's local edits silently on 412. The concurrent-edit modal always offers Download-my-edits before Reload.
- Do NOT auto-navigate to PA-PKG-001 on Save-draft success. PA stays in the editor.
- Do NOT show subscriber-impact projections here. That analytics view is Phase-2 (matrix `PA-PKG-002 view subscribers → PA-SUB-001 filtered` — deep-link only).
- Do NOT allow price entry in dollars (whole units). Minor-unit / cents input prevents floating-point drift; the dollar helper is a computed hint.
- Do NOT let the section-anchor rail become a wizard — no step-locking, no linear flow. It's a scroll shortcut, not a gate.
- Do NOT let the preview card diverge from the marketing site's actual `<PricingCard>` shape. Fidelity is the point.

---

## Reference designs

- **Stripe Products → Add product / Price edit** — the field grid + live-preview pattern.
- **Paddle Product edit** — sections with anchor rail + sticky footer save.
- **Linear settings → Workflow edit** — diff-vs-current comparison in a right panel.
- **Notion database property edit** — dynamic feature-quota repeater pattern.
- **GitHub repository settings** — sticky bottom-save + two-person warning discipline (protected-branch edits).

Do NOT match:
- Salesforce field editor (over-configurable, overwhelming).
- Any Kanban / stage-picker pattern (this is a flat form, not a workflow).

---

## Backend contract

**Read endpoint:** `GET /api/admin/packages/:packageId/versions/:version`

Response 200:
```json
{
  "package": { "id": "pkg_small_team", "code": "small-team", "tier": "small_team", "currency": "USD", "billing_cadence": "monthly_and_annual" },
  "version": {
    "version": 7,
    "status": "DRAFT",
    "updated_at": "2026-09-08T12:34:56Z",
    "display_name": "Small Team",
    "tagline": "Two to five agents sharing a listing pool and inbox — now with expanded portal quotas",
    "sort_order": 300,
    "agent_cap": 5,
    "property_cap": 150,
    "price_monthly_minor": 11900,
    "price_annual_minor": 119000,
    "trial_days": 14,
    "sales_led": false,
    "portal_group_id": "pgrp_mena_starter",
    "feature_quotas": { "credits.property_month": 100, "credits.ai_copy": 500, "portal.publish_bayut_ae": -1 },
    "feature_toggles": { "governance.audit_export": true, "assets.watermark": false },
    "support_level": "email_and_chat"
  },
  "active_snapshot": {
    "version": 6,
    "display_name": "Small Team",
    "tagline": "Two to five agents sharing a listing pool and inbox",
    "agent_cap": 5,
    "property_cap": 100,
    "price_monthly_minor": 9900,
    "price_annual_minor": 99000,
    "trial_days": 14,
    "sales_led": false,
    "portal_group_id": "pgrp_mena_starter",
    "feature_quotas": { "credits.property_month": 50, "credits.ai_copy": 500, "portal.publish_bayut_ae": -1 },
    "feature_toggles": { "governance.audit_export": true, "assets.watermark": false },
    "support_level": "email_and_chat"
  },
  "env": "live"
}
```

**Write endpoints:** per Cursor prompt §2.1 —
- `POST /api/admin/packages/:packageId/versions` (create DRAFT, body per §Backend contract).
- `PATCH /api/admin/packages/:packageId/versions/:version` (update DRAFT, `If-Match: <updated_at>`).
- `POST /:version/submit` (DRAFT → PENDING_APPROVAL).

Response 412 `PRECONDITION_FAILED`:
```json
{
  "error": "CONCURRENT_EDIT",
  "message": "This draft was updated by another admin.",
  "current_version": { "updated_at": "...", "peer_display_name": "...", "peer_edited_at": "..." }
}
```

Response 400 `VALIDATION_FAILED` (submit only, strict):
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "price_monthly_minor": "required_if_not_sales_led",
    "feature_quotas.credits.property_month": "must_be_positive_integer_or_-1"
  }
}
```

**Prerequisites tracked:**

- Every write endpoint per Cursor prompt §2.1 — covered.
- **`[BE-VERIFY-12] Feature-registry live fetch — NEW.** Confirm `GET /api/admin/feature-registry` exists and is env-agnostic. ~0.5 day. **File in kickoff §5a.**

---

## Downstream implementation (Cursor prompt handoff notes)

Direct alignment with `CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-002" section.

- **File to create:** `web/src/pages/admin/packages/PackageEditPage.tsx`.
- **Route registration:** two routes — `/admin/packages/:packageId/versions/new` (redirects server-side to the created DRAFT URL) + `/admin/packages/:packageId/versions/:version/edit`. Behind `PAConsoleGuard`.
- **Component decomposition:**
  - `PackageEditPage.tsx` — page shell + data fetching + form state + sticky footer.
  - `PackageEditSectionAnchorRail.tsx` — left sticky nav.
  - `PackageIdentitySection.tsx`, `PackageCapsSection.tsx`, `PackagePriceSection.tsx`, `PackageTrialSection.tsx`, `PackagePortalGroupSection.tsx`, `PackageFeatureQuotasSection.tsx`, `PackageFeatureTogglesSection.tsx`, `PackageSupportLevelSection.tsx` — one per Section.
  - `PackageEditPreviewCard.tsx` — right-panel preview (mirrors marketing-site `<PricingCard>`).
  - `PackageEditDiffCard.tsx` — right-panel diff.
  - `PackageEditStickyFooter.tsx` — sticky action bar + two-person warning.
  - `ConcurrentEditModal.tsx` — 412 recovery.
- **Data layer:**
  - Hook: `usePackageDraftQuery({ packageId, version, env })`.
  - Hook: `useFeatureRegistryQuery()` (5min cache).
  - Hook: `usePortalGroupsQuery()` (5min cache).
  - Mutations: `useSaveDraft`, `useSubmitForApproval` — both enforce If-Match.
- **Test discipline:**
  - Unit: each section renders + validates + saves partial state.
  - Integration: full edit → save → submit happy path; two-person banner appears on price change; concurrent-edit modal fires on 412 with download-my-edits option; step-up fires on submit when diff qualifies.
  - RTL: form-mirror scenario in `screens.rtl.test.tsx`.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: at least one path that creates a DRAFT, patches it, submits it, verifies status transition + audit row.
  - Accessibility: axe-core scan of loaded + dirty + concurrent-edit-modal states.
- **Perf:**
  - Debounce preview + diff render 100ms.
  - Feature-quota repeater virtualized only if registry > 30 rows.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Form column `var(--lc-surface-raised)`; right panel `var(--lc-surface-sunken)` with `border-left: 1px solid var(--lc-border)`.
- Section headers `var(--lc-type-heading-3)`; helper text `var(--lc-type-caption)` `--lc-text-muted`.
- Field labels always visible (Broadcast rule — no placeholder-only labels).
- Every numeric — price minor+dollar helper, caps, trial days, feature quotas, portal count, character counter, page-size, pagination — via `<Numeric>` (mono + tabular-nums).
- Sticky footer `background: var(--lc-surface-raised)` + `border-top: 1px solid var(--lc-border)` + inverted `--lc-elevation-md`.
- Save-draft button `<Button variant="outline">`; Submit-for-approval `<Button variant="default">` `--lc-action-primary` fill; hover DARKER.
- Two-person warning banner `--lc-status-warning-{bg,fg}` + `AlertTriangle` glyph + tint + label — never color-alone.
- Diff card row: price + property_cap rows carry `--lc-status-warning-bg` tint on the new-value cell to hint the two-person trigger.
- Preview card must use ONLY Broadcast tokens — no marketing-site hex leakage.
- Section-anchor rail focused-item indicator: `--lc-action-primary` left-edge bar 3px wide.
- Radii: form-card + preview + diff cards `var(--lc-radius-lg)`; inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`.
- Focus rings: two-tone via base CSS.
- Motion: preview + diff re-render `--lc-duration-fast` fade; section-anchor scroll respects `prefers-reduced-motion`.
- Never use `--lc-action-primary` as a section-header background — reserved for primary CTA + anchor-rail active indicator + DRAFT badge accent.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) package DRAFT-version editor screen (PA-PKG-002) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin composes one DRAFT version of one package with a live preview + diff panel on the right and submits it for one- or two-person approval. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout for editing DRAFT v7 of the Small Team package. Env: LIVE. Header "Editing Small Team", subtitle "DRAFT v7 · Based on ACTIVE v6 · Last saved 2m ago". Left section-anchor rail with 8 anchors (Identity, Caps, Price, Trial, Portal group, Feature quotas, Feature toggles, Support level); Identity + Caps + Price have Check-prefix indicators showing they've changed. Form column scrolled to the Price section showing monthly = 11900 (= $119.00 / mo, WAS $99.00) and annual = 119000 (= $1,190.00 / yr ($99.17 / mo effective), WAS $990.00). Sticky footer with "Unsaved changes" amber chip + Save draft (outline) + Submit for approval (primary orange). Above the sticky footer: amber Two-person warning banner "This change requires two-person approval". Right panel: Preview card rendering the Small Team card with $119/mo, 150 properties, 5 agents, tagline updated; Diff card below listing 4 changed rows (Price monthly, Price annual, Property cap, Tagline) with price/cap rows amber-highlighted.

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, TEST env, concurrent-edit modal, discard-confirm dialog, empty-diff state (brand new v1), and validation-error state as separate follow-ups.

Follow the copy table in the brief exactly. Do NOT fabricate feature-registry entries or subscriber-impact projections. Preview card must use only Broadcast tokens.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now scroll the form column up to the Feature quotas section. Show 8 dynamic rows from a plausible feature registry (credits.property_month, credits.ai_copy, portal.publish_bayut_ae, portal.publish_property_finder_ae, comms.whatsapp_intake, assets.hero_image_upload, ai.copywriter_generation, governance.audit_export). Row 1 changed (100 was 50) — highlighted with a small changed dot in the diff panel.`
2. `Now the concurrent-edit modal open on top of pass 1. Show the two options: Reload draft (primary) and Download my edits (secondary).`
3. `Now the Discard-changes AlertDialog open on top of pass 1.`
4. `Now the same layout in TEST env — badge shows amber TEST + full-width warning strip under top bar. Preview card shows a "TEST preview" watermark chip.`
5. `Now a brand-new v1 DRAFT for a new package "Growth+ MENA" — every field empty except display_name + sort_order (seeded from the modal). Diff card shows "New package — no prior version to compare against." Preview card shows the form-state-in-progress mock. Sticky footer chip "Unsaved changes".`
6. `Now RTL Arabic at desktop 1440px. MIRROR the whole layout including the section anchor rail (now on the right).`
7. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PKG-002/` + screenshot to `docs/design/mockups/PA-PKG-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states (edit-existing-draft, feature-quotas-section, concurrent-edit-modal, discard-confirm, TEST env, brand-new v1, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PKG-002/`.
- [ ] Cursor Wave-3.5 dispatch prompt references this brief.
- [ ] `[BE-VERIFY-12]` feature-registry live fetch audit filed in kickoff §5a.
- [ ] Preview card component `PackageEditPreviewCard.tsx` shares its type-signature with the marketing-site `<PricingCard>` — enforced by a shared TypeScript type in `packages/shared-types/pricing-tier.ts` (or the equivalent workspace-shared types package).
