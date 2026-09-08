# Screen Brief — AGT-APR-004 · Submit bad-comparable report (WF-05 Initiator)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §25 entry `AGT-APR-004`. Week 5 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 49 + §6 Week 5 (WF-05 + WF-06 valuation-review deadlock resolution). Opens the WF-05 (Report bad comparable) chain that lands on `PA-PVA-008` / `PA-PVA-008b` (PA review) and closes at `AGT-REC-002` (agent-side outcome).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **Screen shell** — `<Dialog>` primitive on mobile (full-screen) + `<Sheet side="right">` on desktop (480px wide). Both surfaces `--lc-surface-raised` with `--lc-elevation-lg`. On mobile ≤767px the dialog takes the full viewport with a top nav bar; on desktop 1024px+ the side sheet slides in over the dimmed page below (dim `rgba(0,0,0,0.45)`), keeping the source comparable card visible under the dim so the agent doesn't lose spatial context. The `/reports/comparables/new` direct-entry route renders as a page (not modal) using the same layout in a centered max-width-680px column.
- **Contextual header** — the comparable being reported echoes back at the top of the form as a compact read-only card (`--lc-surface-sunken` + `var(--lc-radius-md)` + 1px `var(--lc-border)`). Address (line 1 heading `var(--lc-type-heading-3)`, line 2 area `var(--lc-type-body-sm)` `var(--lc-text-muted)`), listed price via `<Numeric>`, area (sqft/sqm) via `<Numeric>`, source badge (`<ChannelMark>` matching portal color OR `Layers` glyph for cross-portal aggregations). This is the "what am I reporting" reassurance strip — always present, never hidden.
- **Reason chips (single-select)** — `<RadioGroup>` rendered as a 2-column grid on mobile / 3-column on desktop of `<Card>`-style pills, each with a glyph + label + short helper. Unselected: `var(--lc-border)` 1px + `var(--lc-surface-raised)` background. Selected: `var(--lc-action-primary)` 2px border + `var(--lc-surface-selected)` background + top-right check glyph tinted `var(--lc-action-primary)`. Tap floor 44px each.
- **Reason glyphs** (lucide-react, 20×20):
  - Wrong price → `DollarSign`
  - Wrong area → `Ruler`
  - Already sold / off-market → `TagX` (fallback `XCircle`)
  - Duplicate of another comparable → `Layers`
  - Spam / fake / off-topic → `Ban`
  - Something else → `AlertCircle`
- **Free-text explanation** — `<Textarea>` primitive, 4 rows visible, autosize to 12 rows max. Placeholder is neutral and does NOT restate what the agent will type. Character counter bottom-right, `var(--lc-type-caption)` `var(--lc-text-muted)` when under 90% of limit, flips to `var(--lc-status-warning-fg)` at 90-100%, `var(--lc-status-danger-fg)` past limit. Limit 1000 chars.
- **Corrected-source URL field** — `<Input type="url">` with `Link2` glyph left affix. Only rendered when reason ∈ `wrong-price` / `wrong-area` / `already-sold`. Optional helper: "Paste the portal link, PDF, or WhatsApp screenshot URL where you saw the correct data."
- **Evidence uploader** — the shared `<EvidenceUploader>` primitive introduced in this brief and reused by AGT-APR-005 + WF-08 grant-request initiator. Grid of thumbnail tiles, add-tile has `Plus` glyph + "Add evidence" label, tile size 96×96 mobile / 120×120 desktop, tiles have `var(--lc-radius-md)` and 1px `var(--lc-border)`. Accepts: JPG/PNG/HEIC (auto-converted to JPG), PDF (first-page preview thumbnail), CSV (icon tile). Max 3 files on AGT-APR-004, 10MB per file. Upload progress bar overlays the tile in `var(--lc-action-primary)` fill. Delete button (X glyph in a `--lc-surface-inverse` circle) top-right of each tile on hover / long-press.
- **Confidence selector** — `<RadioGroup>` rendered as horizontal segmented control (3 segments): `I saw this myself` / `Colleague told me` / `I have hard evidence`. Selected segment `--lc-action-primary` fill + `--lc-action-primary-text` ink. Unselected `--lc-surface-sunken` + `var(--lc-text-primary)`. Full-width on mobile, max-width 360px on desktop.
- **Submit CTA** — `<Button variant="default" size="lg">` full-width on mobile, right-aligned max-width 240px on desktop sheet footer. Fill `var(--lc-action-primary)`, hover DARKER to `var(--lc-action-primary-hover)`. Never lightens. Secondary "Cancel" `<Button variant="ghost">` inline above (mobile) or left of (desktop) primary. On desktop-sheet layout: footer is `position: sticky; bottom: 0` with `var(--lc-surface-raised)` + top-border `var(--lc-border)` + upward `var(--lc-elevation-sm)`.
- **Success confirmation state** — the same dialog/sheet swaps its body to a `<StatusHero>` (borrowed from the REC-004 anchor) with `state="pending"` and label "Report received — under PA review". Includes SLA line ("Typical review: 3 days") + a `<Button variant="outline">` "View my reports" (routes to `AGT-APR-006` sub-tab `my-comparable-reports`) + a `<Button variant="ghost">` "Close" that returns the agent to where they came from (comparable card / benchmark / listing).
- **Motion** — dialog enter/exit `var(--lc-duration-slow)` (240ms) `var(--lc-easing-out)`. Reason-chip select `var(--lc-duration-fast)` (120ms). Conditional field reveal (URL field on wrong-price reasons) uses `<Collapsible>` height transition `var(--lc-duration-base)` (180ms). Success-state cross-fade `var(--lc-duration-base)`. Respect `prefers-reduced-motion` → skip transitions, instant swap.
- **Focus rings + 44px tap floor** — automatic via base CSS. Do NOT override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-APR-004 |
| Screen name | Submit bad-comparable report |
| Persona | Agent (all tiers — solo / agency / Pro). Report-submission is not tier-gated because bad comparables affect every agent's benchmarks. Rate-limit is `10 open reports per agent-week` (server-enforced; UI shows friendly cap message). |
| Device targets | Mobile 375px (primary — most reports get filed on the fly from a comparable card), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Deep-link entry (modal): `/comparables/:comparableId/report` — opens as `<Dialog>` (mobile) or `<Sheet side="right">` (desktop) over whatever screen the agent was on (comparable detail `AGT-APR-003`, benchmark `AGT-CMP-002`, listing overview `AGT-LST-003`). Direct-entry page: `/reports/comparables/new` — no comparable pre-selected; agent picks from a searchable comparable-picker step first. |
| Current state | MISSING — must ship with WF-05 cluster (Week 5). |
| Workflow role | WF-05 role=Initiator. Feeds `PA-PVA-008` queue. Outcome delivered at `AGT-REC-002`. |
| Backend prerequisites | ✅ `comparables` table (existing, per `backend/src/persistence/migrations/025_market_pricing_extensions.sql`) · ⏳ `bad_comparable_reports` table (new — see §Backend contract) · ⏳ `POST /api/comparables/:comparableId/reports` + `POST /api/reports/comparables` (both hit the same handler) · ⏳ `GET /api/comparables/:id` for the contextual-header hydration · ⏳ Evidence upload endpoint `POST /api/uploads/evidence` returning signed URLs (piggybacks on existing upload infra if present; otherwise new S3-signed-URL service) · ⏳ Rate-limit check `has_open_report_cap_reached(user_id)` · ⏳ Push template `bad_comparable_report.received` (agent's own submission confirmation, deep-links back to `AGT-REC-002` when resolved) |

---

## Purpose

An agent has encountered a comparable listing (a data point WingCaster uses for pricing benchmarks) that appears to be wrong — the price doesn't match reality, the area / bedroom count is stated incorrectly, the property has already sold and shouldn't be in the "actively listed" pool, the same property is listed twice under different portal-IDs, or the whole entry looks fake / spammy. This screen is the agent's one-click affordance from that comparable to say "this data is bad" and hand it to PA for review.

The report is not a punishment on any other agent — comparables are aggregated from portals, WhatsApp shares, sold-price registries, and legacy imports; a "bad comparable" is usually stale data or a mis-scraped field, not a bad actor. UI copy must reflect that (no "flag" verb; use "report").

The WF-05 chain: agent submits here → row lands in `bad_comparable_reports` with `status=pending` → surfaces on `PA-PVA-008` (queue) → PA reviews via `PA-PVA-008b` → outcome one of `accepted` (comparable corrected / removed) / `rejected` (comparable stays as-is with reasoning) / `duplicate` (this report is a dup of another pending report about the same comparable — closed with attribution) / `more_info` (PA needs the agent to add evidence or clarify). Agent sees the outcome at `AGT-REC-002` with the resolver's message.

Success outcome: report is `pending` and the agent has received a confirmation state on this screen with the SLA + link to their submitted-reports list.

---

## Design goals

1. **The comparable being reported is always visible at the top.** The agent should never be able to submit a report without seeing "here is what I'm reporting" reassurance echoed back. If the comparable can't be hydrated (backend error), the form disables its submit until the fetch succeeds — never let an agent guess.
2. **Reason first, evidence second.** The reason chip drives what other fields appear. Wrong-price / wrong-area / already-sold reveal the corrected-URL field. Duplicate reveals a "which comparable is this a duplicate of" picker. Spam / other stay minimal. Field reveal is progressive, not overwhelming.
3. **Evidence is optional but nudged.** The confidence selector defaults to `I saw this myself` — a valid single-witness report. The evidence uploader is present but not required for spam / already-sold (where the "evidence" is the market moving on). It IS strongly nudged for wrong-price / wrong-area via a small helper text: "Screenshots or PDFs make PA's job faster."
4. **The submit is single-tap.** No multi-step wizard. One screen, one submit. If the report needs revision after PA reviews, that happens on `AGT-REC-002` with a "Resubmit with more info" affordance, not here.
5. **Success state doesn't yank context.** After submit, the modal swaps to a confirmation state IN PLACE. Closing the modal returns the agent to the comparable card, benchmark, or listing they were viewing — not to a random landing page.
6. **RTL-first for MENA.** Full mirror. Reason chip grid mirrors column order. Evidence uploader thumbnails flow right-to-left. URL and numeric fields (price, area) stay LTR bidi-embedded in Arabic context.

---

## Layout

### Mobile 375px (primary)

Full-screen `<Dialog>` slides up:

1. **Top nav bar** — sticky, `--lc-surface-raised` + bottom-border `--lc-border`, 48px tall including safe area. Left: `<Button variant="ghost" size="icon">` with `X` glyph (close, aria-label "Cancel report"). Center: title "Report this comparable" (`var(--lc-type-body)` + `var(--lc-text-heading)`). Right: empty (no menu — this is a one-shot form).
2. **Contextual comparable header** — full-width `--lc-surface-sunken` block, `var(--lc-space-md)` padding, `var(--lc-space-md)` gutter from top nav. Inside: `Building2` glyph 20×20 + address line 1 (`var(--lc-type-heading-3)`) + address line 2 muted, then metadata row: listed price `<Numeric>` · area `<Numeric>` · bedrooms · source `<ChannelMark>`. Read-only, no interaction.
3. **Reason section** — `var(--lc-space-lg)` gutter above. Label "Why are you reporting this?" (`var(--lc-type-overline)` `var(--lc-text-muted)`). Below: 2-column grid of 6 reason chips, `var(--lc-space-sm)` gap. Each chip is a full-height card 88px min.
4. **Conditional URL field** — collapses in below reason grid when reason ∈ wrong-price / wrong-area / already-sold. Label "Where did you see the correct info? (optional)" + `<Input type="url">` with `Link2` left affix.
5. **Conditional duplicate-picker** — collapses in when reason = duplicate. Label "Which comparable is this a duplicate of?" + `<Combobox>` populated by `GET /api/comparables?in_same_area_as=:comparableId&limit=20`. Item rows show mini-comparable cards (address + price + source).
6. **Explanation textarea** — always present, below the conditional block. Label "Tell PA what happened" + `<Textarea>` with placeholder "Share what you saw. Kind and specific beats terse." + char counter bottom-right.
7. **Evidence uploader** — always present, below explanation. Label "Evidence (optional, up to 3 files)" + helper "Screenshots or PDFs make PA's job faster." + `<EvidenceUploader>` grid.
8. **Confidence selector** — always present, below evidence. Label "How confident are you?" + `<RadioGroup>` segmented control (3 segments).
9. **Sticky bottom CTA bar** — `position: sticky; bottom: 0`, `--lc-surface-raised` + top-border `--lc-border` + upward `--lc-elevation-sm`, safe-area padding. Contents: `<Button variant="ghost">` "Cancel" (left, text link only) + `<Button variant="default" size="lg">` "Submit report" (right, full-width remainder). On submit, button shows `Loader2` + "Sending…".

### Tablet 768px

Same as mobile but the dialog centers with max-width 560px and doesn't take full width. Sticky footer bar becomes inline dialog footer (buttons right-aligned).

### Desktop 1024px+

`<Sheet side="right">` slides in over the dimmed source screen, 480px wide, full height:

1. **Top of sheet:** same top nav bar pattern (close X + title).
2. **Body scrolls inside sheet** with same sections as mobile in same order.
3. **Sticky footer inside sheet:** Cancel + Submit right-aligned.
4. **Source screen visible under dim** — reinforces "you'll come right back here."

### Direct-entry page `/reports/comparables/new`

Same layout in a centered max-width-680px column on a `--lc-bg-page` background. Adds a comparable-picker step at the top BEFORE the contextual header:

- Label "Which comparable are you reporting?" + `<Combobox>` "Search by address, portal-ID, or agent…" populated by `GET /api/comparables/search?q=<term>&limit=20`.
- Once selected, the picker collapses and the contextual header renders with the chosen comparable's data.
- All subsequent fields disabled until a comparable is selected.

### RTL

Full mirror. Top nav close button flips to right. Contextual header content order mirrors (glyph on right, address on right side of container). Reason chip grid columns mirror (item 1 top-right, item 2 top-left, etc.). Textarea LTR bidi-embedded when the agent types Latin characters but wraps RTL for Arabic text. URL and numeric fields stay LTR. Sticky footer buttons: Cancel on right, Submit on left. Evidence uploader grid flows right-to-left.

---

## Shared component palette introduced by this brief

Two new shared primitives land with this screen and are reused by AGT-APR-005 (next brief) + eventually PA-CRD-005 (WF-08 grant initiator):

### `<EvidenceUploader>`

**Purpose:** file-upload grid affordance used across every agent-facing "here's proof" form.

**Location:** `web/src/components/forms/EvidenceUploader.tsx`

**Props:**
```ts
type EvidenceFile = {
  id: string;                       // client-generated then replaced by server-assigned id
  name: string;
  size_bytes: number;
  content_type: string;
  status: 'uploading' | 'complete' | 'error';
  progress_pct?: number;            // 0-100 while status=uploading
  thumbnail_url?: string;           // server-assigned once complete
  server_url?: string;              // signed URL post-upload
  error_message?: string;
};

type EvidenceUploaderProps = {
  files: EvidenceFile[];
  max_files: number;                // 3 for APR-004, 5 for APR-005
  max_bytes_per_file: number;       // 10_485_760 default (10MB)
  accepted_types: string[];         // ['image/jpeg', 'image/png', 'image/heic', 'application/pdf', 'text/csv']
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  helper_text?: string;
  label?: string;
  disabled?: boolean;
};
```

**Anatomy:** CSS grid, `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))` mobile / `minmax(120px, 1fr)` desktop, gap `var(--lc-space-sm)`. Each tile a square with `var(--lc-radius-md)` + 1px `var(--lc-border)`. Add-tile is dashed border `var(--lc-border-strong)` with center `Plus` glyph + label "Add". File tiles show thumbnail (image) OR file-type glyph (PDF `FileText`, CSV `Table`) + filename truncated 12 chars. Upload progress overlays the tile with a bottom-anchored fill bar in `var(--lc-action-primary)`. Error state: red top-border `var(--lc-status-danger-fg)` + `AlertOctagon` glyph in tile corner + tooltip with error_message.

**A11y:** grid is `<ul role="list">`; each tile `<li>`. Add button `<button type="button">` with `aria-label="Add evidence file"`. File tiles have `aria-label="Evidence file: {name}, {size}"` + delete button `aria-label="Remove {name}"`. Upload progress announced via `aria-live="polite"` region ("Uploading {name}: 40 percent").

**Sanitization:** HEIC auto-converted server-side to JPG on upload. File names sanitized (strip path components + normalize unicode). Content-Type validated server-side (never trust the browser's).

**Downstream reuse:** AGT-APR-005 uses this with `max_files=5`. PA-CRD-005 uses this with `max_files=3` (and `accepted_types` expanded to include XLSX).

### `<ContextEchoCard>`

**Purpose:** the "here is what you're acting on" read-only reassurance card that echoes the subject-of-the-form back to the agent. Not tied to comparables specifically — reused for the listing being submitted for PA moderation (AGT-PUB-005), the price analysis subject (AGT-APR-005), and the grant target (PA-CRD-005).

**Location:** `web/src/components/forms/ContextEchoCard.tsx`

**Props:**
```ts
type ContextEchoCardProps = {
  glyph: LucideIcon;
  title: string;                    // heading — address, listing name, agent name, etc.
  subtitle?: string;                // muted second line
  meta_row?: Array<{                // small metadata pills — up to 4
    key: string;
    label?: string;                 // optional short label
    value: string | number;
    numeric?: boolean;              // renders via <Numeric>
    channel?: string;               // renders via <ChannelMark>
  }>;
  href?: string;                    // if present, tap opens sheet with full detail
};
```

**Anatomy:** full-width `--lc-surface-sunken` block, `var(--lc-radius-md)`, 1px `var(--lc-border)`, padding `var(--lc-space-md)`. Glyph left, title + subtitle stacked next to it. Meta row underneath, `var(--lc-type-body-sm)` `var(--lc-text-muted)`, separated by "·" bullets. If `href` present, whole card is a link with hover state `var(--lc-surface-selected)`.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Top nav title | Report this comparable |
| Close button aria-label | Cancel report |
| Direct-entry page title | Report a bad comparable |
| Comparable picker label | Which comparable are you reporting? |
| Comparable picker placeholder | Search by address, portal-ID, or agent… |
| Reason section label | Why are you reporting this? |
| Reason — wrong-price | **Wrong price** — The listed price doesn't match reality. |
| Reason — wrong-area | **Wrong area** — Size, bedrooms, or bathrooms are wrong. |
| Reason — already-sold | **Already sold** — This property is off the market. |
| Reason — duplicate | **Duplicate** — Same property listed twice. |
| Reason — spam | **Spam or fake** — Not a real listing. |
| Reason — other | **Something else** — Tell PA what you saw. |
| URL field label | Where did you see the correct info? (optional) |
| URL field placeholder | https://portal.com/listing/… |
| URL field helper | Paste the portal link, PDF, or WhatsApp screenshot URL where you saw the correct data. |
| Duplicate picker label | Which comparable is this a duplicate of? |
| Duplicate picker placeholder | Search nearby comparables… |
| Explanation label | Tell PA what happened |
| Explanation placeholder | Share what you saw. Kind and specific beats terse. |
| Explanation counter format | {n} / 1000 |
| Evidence label | Evidence (optional, up to 3 files) |
| Evidence helper | Screenshots or PDFs make PA's job faster. |
| Evidence add-tile | Add evidence |
| Evidence file too large | File too large — 10 MB max. |
| Evidence file wrong type | File type not supported. Try JPG, PNG, PDF, or CSV. |
| Evidence upload failed | Upload failed. Tap to retry. |
| Confidence label | How confident are you? |
| Confidence — self | I saw this myself |
| Confidence — hearsay | Colleague told me |
| Confidence — evidence | I have hard evidence |
| Submit button — idle | Submit report |
| Submit button — in-flight | Sending… |
| Cancel button | Cancel |
| Success — hero label | Report received — under PA review |
| Success — SLA line | Typical review: 3 days |
| Success — body | Thanks. PA will review your report and let you know the outcome on your inbox. |
| Success — primary CTA | View my reports |
| Success — secondary CTA | Close |
| Rate-limit reached — title | You've reached the report cap |
| Rate-limit reached — body | You have 10 open reports under PA review. Once some are resolved, you can submit more. |
| Rate-limit reached — CTA | View my reports |
| Network error toast | Couldn't send report — check your connection and try again. |
| Comparable-not-found error | We couldn't find that comparable. It may have already been removed. |
| Backend duplicate warning | You already have an open report on this comparable. |

---

## Sample content (for v0 / mockup)

Show the mobile 375px layout with:

- **State:** ready to submit, reason = `wrong-price` selected, all fields filled.
- **Contextual header:** address "Apt 2405, Marina Heights Tower 2", subtitle "Dubai Marina · Dubai, UAE", meta row `AED 2,850,000 · 1,120 sqft · 2 BR · Bayut` with the Bayut channel mark.
- **Reason section:** 2-column grid of 6 chips; `Wrong price` selected (orange border + check glyph); other 5 chips in default state.
- **URL field (revealed because reason is wrong-price):** filled with `https://www.bayut.com/property/details-8213334.html`.
- **Explanation textarea:** filled with "This unit closed at AED 2.4M three weeks ago per the DLD sold-price registry. The AED 2.85M asking price seems to be an old listing that wasn't taken down. Attached the DLD screenshot showing the transaction."
- **Character counter:** `232 / 1000`.
- **Evidence uploader:** 1 file tile (thumbnail of a screenshot named `DLD-sold-8213334.png`, 240 KB, complete) + add-tile with `Plus` glyph.
- **Confidence selector:** `I have hard evidence` selected (orange fill, white ink).
- **Sticky bottom bar:** Cancel (left) + `Submit report` (right, enabled, primary orange).

Iteration order for v0 after first pass:

1. Same mobile viewport, freshly opened, no reason selected, all conditional fields hidden, submit disabled.
2. Same mobile viewport, reason = `duplicate` selected — duplicate picker appears instead of URL field, other comparable pre-selected showing "Villa 12, Palm Jumeirah Frond K · AED 12.5M · Property Finder".
3. Same mobile viewport, submit in-flight — button shows `Loader2` + "Sending…", form disabled.
4. Same mobile viewport, success state — `<StatusHero>` "Report received — under PA review" with SLA line + "View my reports" primary + "Close" ghost.
5. Same mobile viewport, rate-limit reached state (opened from a comparable when the agent already has 10 open reports).
6. Desktop 1440px, `<Sheet side="right">` 480px wide, same wrong-price ready-to-submit state, source `AGT-APR-003` comparable-detail visible under dim.
7. Desktop direct-entry page `/reports/comparables/new` — comparable picker at top with a comparable already selected, rest of the form filled.
8. RTL Arabic mirror at mobile 375px, same wrong-price ready-to-submit state, `[TRANSLATION-PENDING]` copy.
9. Dark mode desktop sheet, same state.

Save each output's JSX to `web/src/components/reports/SubmitBadComparableSheet/` + screenshot to `docs/design/mockups/AGT-APR-004-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Modal shell (mobile) | `Dialog` (full-screen variant) |
| Modal shell (desktop) | `Sheet side="right"` |
| Top nav bar | Custom sticky `<header>` inside dialog/sheet |
| Contextual header | `<ContextEchoCard>` (NEW — see §Shared component palette) |
| Reason chip grid | `RadioGroup` + `RadioGroupItem` styled as cards |
| Conditional URL field | `Input type="url"` with `Link2` left affix |
| Duplicate picker | `Command` combobox (shadcn `<Combobox>`) fed by `/api/comparables/search` |
| Explanation textarea | `Textarea` with autosize + `<CharacterCounter>` helper |
| Evidence uploader | `<EvidenceUploader>` (NEW — see §Shared component palette) |
| Confidence selector | `RadioGroup` styled as segmented control (custom class on `RadioGroupItem`) |
| Sticky footer | Custom `<div position: sticky; bottom: 0>` inside dialog body |
| Submit button | `Button variant="default" size="lg"` |
| Cancel button | `Button variant="ghost"` |
| Success state (dialog body swap) | `<StatusHero state="pending" emphasis="default">` (reused anchor from REC-004) |
| Rate-limit warning | `Alert` variant="warning" |
| Toasts (network error) | `Sonner` destructive variant |
| Loading | `Skeleton` shape mirroring contextual header + reason grid (during comparable fetch) |
| Numerics (price, area) | `<Numeric>` |
| Channel marks (source) | `<ChannelMark>` |
| Icons | `lucide-react` — DollarSign, Ruler, XCircle (fallback for TagX), Layers, Ban, AlertCircle, Link2, Plus, X, Loader2, Building2 |

---

## Interactions

**On dialog open (deep-link entry from a comparable):**
- Fetch `GET /api/comparables/:comparableId`. During load, contextual header shows `<Skeleton>` in its shape.
- If 404: contextual header shows the error "We couldn't find that comparable. It may have already been removed." + Close button; form disabled.
- If 200: hydrate contextual header; enable form.
- Simultaneously check `GET /api/users/me/comparable-reports/open-count` — if `>= 10`, replace the form body with the rate-limit-reached state.

**On reason chip select:**
- Chip transitions to selected state instantly (no delay).
- Conditional field reveals via `<Collapsible>` height transition `var(--lc-duration-base)` — URL field for wrong-price / wrong-area / already-sold, duplicate picker for duplicate.
- Switching between reasons that reveal different conditional fields swaps them WITHOUT collapsing/expanding intermediate steps.
- Switching to spam / other collapses any conditional field.

**On URL field input:**
- Client-side URL format validation on blur. Invalid → inline error "This doesn't look like a URL." Continue button stays enabled (URL is optional) but the URL field is visually flagged until fixed or cleared.

**On duplicate picker select:**
- Selected comparable renders as a mini-comparable-card below the picker (address + price + source). Selecting a different one replaces it.

**On explanation textarea input:**
- Autosize as the agent types up to 12 rows. Character counter updates on every keystroke (no debounce needed — cheap).
- Counter flips color at 90% and 100%. Past 100%, submit disables + toast on tap: "Explanation is too long — trim it to 1000 characters."

**On evidence add:**
- Trigger native file picker with `accept` attribute matching `accepted_types`. Multi-select allowed up to `max_files - files.length`.
- On file selected: client-side size + type validation. Invalid files → toast per file with reason.
- Valid files: request signed upload URL via `POST /api/uploads/evidence/sign` → PUT the file to S3 → on success, replace the client-generated file entry with the server response.
- HEIC files: server converts to JPG in a background job; UI shows the tile with a "Converting…" chip until conversion completes, then thumbnail hydrates.

**On evidence remove:**
- Optimistic: remove tile immediately. Fire `DELETE /api/uploads/evidence/:file_id` in background. On failure (rare), toast "Couldn't remove file — refresh and try again" and re-hydrate the tile.

**On confidence select:**
- Instant state flip. No side effects (informational only for PA).

**On Submit click:**
- Client-side validation: reason selected, explanation ≥ 20 chars (soft floor, not enforced by counter but blocks submit with inline helper "Add a bit more detail so PA can act on it."), all in-progress evidence uploads complete.
- If any validation fails: submit disables + fields with issues highlight. No toast (passive disabled).
- On valid: POST `/api/comparables/:comparableId/reports` with body per §Backend contract. Submit button shows `Loader2` + "Sending…". Entire form disabled during POST.
- On success: dialog/sheet body swaps to success state (dialog itself stays open); `bad_comparable_report.received` push template fires; if the source screen showed a "Report this comparable" affordance, it flips to "Under review" indicator on next mount.
- On 409 `DUPLICATE_OPEN_REPORT`: submit re-enables + inline warning "You already have an open report on this comparable. [View it →]" (link goes to `AGT-REC-002` for the existing report).
- On 429 `RATE_LIMIT_EXCEEDED`: body swaps to the rate-limit-reached state.
- On 500 / network: destructive toast + submit re-enables.

**On Close from success state:**
- Dialog dismisses; source screen returns to focus. If the source was a comparable card / detail, that card flips its "Report this comparable" affordance to a muted "Report under review" chip with a link to `AGT-REC-002`.

**On Close from ready-to-submit state:**
- If any field has data, prompt via `<AlertDialog>`: "Discard your report? Your draft will be lost." Confirm dismisses; Cancel keeps the dialog open.
- If no fields have data, dismiss immediately.

**On direct-entry page `/reports/comparables/new` comparable-picker select:**
- Picker collapses; contextual header hydrates. Same downstream flow.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading contextual header** | Dialog opens, comparable fetch in flight | Contextual header shows skeleton in its shape. Reason grid + all subsequent fields disabled. Submit disabled. |
| **Comparable not found** | Fetch returns 404 | Contextual header replaced with error card + Close button. Rest of form hidden. |
| **Ready — no reason** | Dialog loaded, no reason selected | Contextual header + reason grid visible. Explanation / evidence / confidence rendered but inert. Submit disabled. |
| **Ready — reason selected** | Reason chip picked | Conditional field revealed (URL for wrong-*, picker for duplicate). Submit enabled once explanation ≥ 20 chars. |
| **Explanation too short** | Explanation < 20 chars | Submit disabled + inline helper "Add a bit more detail so PA can act on it." |
| **Explanation too long** | Explanation > 1000 chars | Counter flips red; submit disabled. |
| **Evidence uploading** | Any file in `status='uploading'` | Submit shows helper "Waiting for uploads to finish…" + disabled until all files complete or removed. |
| **Evidence upload error** | Any file in `status='error'` | Tile shows error state with retry affordance. Submit enabled (agent can proceed without the failed file if they remove it). |
| **Submitting** | POST in flight | Submit shows `Loader2` + "Sending…"; form disabled. |
| **Success** | POST 201 | Body swaps to success state; dialog stays open. |
| **Duplicate open report** | POST 409 | Submit re-enables + inline warning with link to existing report. |
| **Rate-limit reached** | Open-count ≥ 10 OR POST 429 | Body swaps to rate-limit-reached state with CTA to `AGT-APR-006`. |
| **Network error** | POST failed | Destructive toast + submit re-enables. |
| **Discard confirm** | Close tapped with any field filled | `<AlertDialog>` confirmation. |
| **Direct-entry, no comparable picked** | Direct-entry page loaded | Comparable picker visible; contextual header + all downstream fields hidden until selection. |
| **Offline** | Network unreachable | Top-of-form banner "You're offline — you can draft the report but can't submit until you reconnect." Submit disabled. |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically; contextual header sunken surface + reason grid orange border still legible. |

---

## Accessibility

- Dialog / sheet has `role="dialog" aria-modal="true"` + labeled by the top nav title.
- Contextual header renders as `<section aria-label="Comparable being reported">` with its content readable in tab order (screen reader gets "Comparable being reported: Apt 2405, Marina Heights Tower 2, Dubai Marina Dubai UAE, listed at AED 2.85M, 1120 square feet, 2 bedrooms, source Bayut").
- Reason chips are a `RadioGroup` with keyboard nav (arrow keys move between chips, Enter/Space selects). Each chip has `aria-describedby` pointing to its helper copy.
- URL / textarea / duplicate picker / confidence selector all have visible `<label>` (not just placeholder).
- Evidence uploader: grid is `<ul role="list">`; each tile `<li>` with `aria-label="Evidence file: {name}, {size}, status: {status}"`. Add button `aria-label="Add evidence file"`. Progress announced via `aria-live="polite"` on a dedicated region ("Uploading DLD-sold-8213334.png: 60 percent").
- Sticky footer buttons — Submit's `aria-describedby` points to the current disabled-reason when disabled ("Submit disabled: pick a reason first" / "Submit disabled: explanation is too short" / etc.).
- Character counter is `aria-hidden` on the counter itself; textarea's `aria-describedby` announces "{n} of 1000 characters used" at 90% and 100% thresholds only (avoids screen-reader spam on every keystroke).
- Focus trap inside dialog/sheet. Escape closes (with discard-confirm if filled).
- Focus returns to the element that opened the dialog on close.
- Discard-confirm dialog uses `AlertDialog` — focus trap, Escape cancels, focus returns to Close button on close.
- Success state's `<StatusHero>` becomes the new focused region; announcement "Report received — under PA review" reads once.
- Motion respects `prefers-reduced-motion` → skip dialog slide-in, conditional field reveal, evidence tile progress animation.
- All tap targets ≥ 44×44 CSS pixels including reason chips, evidence tiles, confidence segments.
- No color-only signalling — every state uses glyph + label + surface tint together.

---

## Anti-patterns (do not do these)

- ❌ Do not use the word "flag" anywhere. Use "report." Flagging implies moderation-against-a-person; reporting is about correcting data.
- ❌ Do not require evidence attachments as a hard gate. Confidence selector default `I saw this myself` is a valid single-witness submission.
- ❌ Do not open a separate page for the report — modal/sheet is chosen so the agent doesn't lose spatial context. Only `/reports/comparables/new` is a page, and only because it's a direct-entry path.
- ❌ Do not send the agent to a landing page after submit. Success state renders IN PLACE inside the dialog.
- ❌ Do not fabricate PA's response time. The "Typical review: 3 days" SLA reads from a real backend-configured `platform_settings.wf05_sla_days` field (default 3).
- ❌ Do not leak whether a rejection was "correct" during the report submit. This screen is upstream of PA review; there is no verdict to leak.
- ❌ Do not enable submit while any evidence upload is in progress — the report row would land without its attachments.
- ❌ Do not use `variant="destructive"` red on Submit. Submitting a report is not a destructive act.
- ❌ Do not silently strip fields on backend validation failure. Return field-level errors and re-render inline.
- ❌ Do not auto-close the dialog on success. The agent must tap Close or View-my-reports — the receipt-of-submission moment matters.
- ❌ Do not skip the discard-confirm if the agent has typed. Losing a partially-drafted report is worse than one extra tap.
- ❌ Do not use `dangerouslySetInnerHTML` for the explanation preview in downstream screens. The explanation renders as plain text everywhere (this brief's field is `<Textarea>`, plain text; downstream PA queue + REC-002 render via a `<pre style="white-space: pre-wrap">` in `--lc-font-ui`).

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Airbnb "Report listing" modal** — the reason-chip-first pattern with conditional field reveals is closest to what we want.
- **Google Maps "Report a problem" bottom sheet** — the contextual-echo (the place being reported at the top) is analogous.
- **Zillow "Report data issue"** — the confidence-level pattern (I saw this myself vs I have documentation) is where we take that field from.
- **Linear bug-report form** — the evidence uploader grid + progress bars are a good visual reference for the tile pattern.
- **Notion feedback modal** — the tone of "kind and specific beats terse" comes from Notion's helper copy style.

Do NOT match:

- Uber's "Report a safety issue" flow (too heavy — that's a multi-step wizard for a much higher-consequence action).
- Twitter/X "Report tweet" flow (too moderation-forward; we're correcting data, not moderating a person).
- Reddit's "Report post" (too anonymous / one-directional — our WF-05 has a full recipient feedback loop, the agent will see PA's reasoning at AGT-REC-002).

---

## Backend contract

**Endpoint (modal-entry):** `POST /api/comparables/:comparableId/reports`
**Endpoint (direct-entry):** `POST /api/reports/comparables` (body carries `comparable_id`)

Both routes hit the same handler.

**Request body:**
```json
{
  "comparable_id": "cmp_01H8XZ...",
  "reason": "wrong_price" | "wrong_area" | "already_sold" | "duplicate" | "spam" | "other",
  "corrected_source_url": "https://www.bayut.com/property/details-8213334.html" | null,
  "duplicate_of_comparable_id": "cmp_01H8YA..." | null,
  "explanation": "This unit closed at AED 2.4M three weeks ago per the DLD sold-price registry...",
  "confidence": "self_witnessed" | "hearsay" | "hard_evidence",
  "evidence_file_ids": ["evd_01H8...", "evd_01H8..."],
  "client_context": {
    "source_screen": "AGT-APR-003" | "AGT-CMP-002" | "AGT-LST-003" | "direct_entry",
    "locale": "en" | "ar"
  }
}
```

**Response 201:**
```json
{
  "report": {
    "id": "rpt_01H8ZA...",
    "status": "pending",
    "submitted_at": "2026-09-08T14:22:00Z",
    "expected_sla_days": 3,
    "expires_at": "2026-10-08T14:22:00Z"
  },
  "outcome_url": "/agent/comparable-reports/rpt_01H8ZA..."
}
```

**Response 409 `DUPLICATE_OPEN_REPORT`:**
```json
{
  "error": "DUPLICATE_OPEN_REPORT",
  "message": "You already have an open report on this comparable.",
  "existing_report_id": "rpt_01H8YB...",
  "outcome_url": "/agent/comparable-reports/rpt_01H8YB..."
}
```

**Response 429 `RATE_LIMIT_EXCEEDED`:**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You have 10 open reports under review. Wait for some to resolve before submitting more.",
  "open_count": 10,
  "cap": 10
}
```

**Response 400 field validation:**
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "reason": "required",
    "explanation": "too_short",
    "corrected_source_url": "invalid_url"
  }
}
```

**Migration (new):**
```sql
CREATE TABLE public.bad_comparable_reports (
  id                            TEXT PRIMARY KEY,
  comparable_id                 TEXT NOT NULL REFERENCES public.comparables(id),
  reporter_user_id              TEXT NOT NULL REFERENCES public.users(id),
  reporter_tenant_id            TEXT NOT NULL REFERENCES public.tenants(id),
  reason                        TEXT NOT NULL CHECK (reason IN ('wrong_price','wrong_area','already_sold','duplicate','spam','other')),
  corrected_source_url          TEXT,
  duplicate_of_comparable_id    TEXT REFERENCES public.comparables(id),
  explanation                   TEXT NOT NULL CHECK (length(explanation) BETWEEN 20 AND 1000),
  confidence                    TEXT NOT NULL CHECK (confidence IN ('self_witnessed','hearsay','hard_evidence')),
  evidence_file_ids             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status                        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','duplicate','more_info','withdrawn')),
  resolver_user_id              TEXT REFERENCES public.users(id),
  resolver_message              TEXT,
  decision_code                 TEXT,
  submitted_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at                     TIMESTAMPTZ,
  decided_at                    TIMESTAMPTZ,
  resolved_at                   TIMESTAMPTZ,
  expires_at                    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  source_screen                 TEXT,
  locale                        TEXT NOT NULL DEFAULT 'en',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bcr_reporter_open ON public.bad_comparable_reports (reporter_user_id) WHERE status = 'pending';
CREATE INDEX idx_bcr_comparable_open ON public.bad_comparable_reports (comparable_id) WHERE status = 'pending';
CREATE UNIQUE INDEX uix_bcr_reporter_comparable_open ON public.bad_comparable_reports (reporter_user_id, comparable_id) WHERE status = 'pending';
CREATE INDEX idx_bcr_status_submitted ON public.bad_comparable_reports (status, submitted_at DESC);
```

**Backend prerequisite surfaced (NOT already tracked):**
- `bad_comparable_reports` table + write handler + open-count read + rate-limit guard. File as `[BE-BLOCKER-05a] WF-05 report submission` — Week 5 dependency.
- Evidence upload service (`POST /api/uploads/evidence/sign` + delete). If not already in place from WF-01 WhatsApp attachment handling, needs a new S3-signed-URL adapter. File as `[BE-BLOCKER-05b] shared evidence upload service` — Week 5 dependency (also blocks AGT-APR-005 + PA-CRD-005).
- Push template row `bad_comparable_report.received` (agent's own submission confirmation, single variant, deep-links to `/agent/comparable-reports/:id`). Piggybacks on existing push dispatch; template row is new. Week 5.

---

## Notification hook

**Trigger:** report row inserted with `status='pending'`.

**Piggybacks on existing push infrastructure** — same as REC-004's `agency_application.resolved` template. No new dispatcher.

**Template:** `bad_comparable_report.received`
- Title: "Report received"
- Body: "PA will review your report about {comparableAddressLine1}. Typical review: 3 days."
- Deep-link: `wingcaster://comparable-report/:id` → `/agent/comparable-reports/:id` (renders `AGT-REC-002`)
- Emit at insert (same transaction).

A second template `bad_comparable_report.resolved` fires when PA decides — that's owned by `AGT-REC-002`'s brief, not this one.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/components/reports/SubmitBadComparableSheet.tsx` (the dialog/sheet body) + `web/src/pages/SubmitBadComparablePage.tsx` (direct-entry page wrapping the same body).
- **Route:** add to `web/src/App.tsx`:
  - `<Route path="/comparables/:comparableId/report" element={<SubmitBadComparableRoute mode="modal" />} />` — this route mounts the modal over the previous screen via `useLocation().state.backgroundLocation`.
  - `<Route path="/reports/comparables/new" element={<SubmitBadComparablePage />} />` — the direct-entry page.
- **Shared primitives to create:**
  - `web/src/components/forms/EvidenceUploader.tsx` — see §Shared component palette.
  - `web/src/components/forms/ContextEchoCard.tsx` — see §Shared component palette.
- **Data hook:** `web/src/hooks/useSubmitBadComparableReport.ts` — mutation via React Query.
- **Comparable-fetch hook:** `web/src/hooks/useComparable.ts` (if not already present).
- **Test discipline:**
  - Unit: `EvidenceUploader` renders all file states (uploading / complete / error / add-tile), respects max_files, handles remove, respects accepted_types.
  - Unit: `ContextEchoCard` renders with / without meta_row + href.
  - Integration: full submission flow (open modal from comparable → pick reason → fill fields → upload evidence → submit → see success state → close → source screen reflects "under review").
  - Integration: 409 duplicate flow.
  - Integration: 429 rate-limit flow.
  - Integration: direct-entry page flow (search comparable → pick → fill → submit).
  - Real-Postgres: end-to-end (agent submits → row lands in `bad_comparable_reports` → PA queue at `PA-PVA-008` shows it → decision writes back → agent sees at `AGT-REC-002`).
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Dialog/sheet surface `--lc-surface-raised` + `--lc-elevation-lg`.
- Contextual header `--lc-surface-sunken` + `var(--lc-radius-md)` + 1px `var(--lc-border)`.
- Reason chip selected `var(--lc-action-primary)` 2px border + `var(--lc-surface-selected)` background. Unselected 1px `var(--lc-border)` + `--lc-surface-raised`.
- URL / duplicate picker / textarea inputs `--lc-border-strong` + `--lc-surface-raised`.
- Evidence uploader tiles `var(--lc-radius-md)` + 1px `var(--lc-border)`. Add-tile dashed border `var(--lc-border-strong)`. Upload progress fill `var(--lc-action-primary)`. Error border `var(--lc-status-danger-fg)`.
- Confidence selector selected segment `var(--lc-action-primary)` + `var(--lc-action-primary-text)`. Unselected `--lc-surface-sunken` + `var(--lc-text-primary)`.
- Submit button `var(--lc-action-primary)` fill; hover DARKER to `var(--lc-action-primary-hover)`. Never lightens.
- Cancel button `variant="ghost"` — `var(--lc-text-muted)` label.
- Success state `<StatusHero>` reuses anchor pattern from REC-004 with `state="pending"` (calm sunken hero).
- Numeric fields (price, area, file size, char counter numbers) via `<Numeric>`.
- Source badges via `<ChannelMark>` — 20-28px only, matched `-on` ink pair.
- Focus rings two-tone via base CSS. Do not override.
- Motion: dialog `var(--lc-duration-slow)` `var(--lc-easing-out)`; conditional field reveal `var(--lc-duration-base)`; reason chip select `var(--lc-duration-fast)`. Respect `prefers-reduced-motion`.
- Radii: dialog `var(--lc-radius-lg)`; cards `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`; confidence segmented control `var(--lc-radius-pill)` on the outer track.
- No `variant="destructive"` on any button. Submit is not destruction.
- No 12+px rounding anywhere. Broadcast is intentionally tight.
- No soft/blurred shadows. Elevation is offset per Broadcast reference.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Submit bad-comparable report" screen (AGT-APR-004) — MENA real-estate B2B SaaS. This is the mobile-first modal (desktop side-sheet) where an agent flags a bad comparable data point (wrong price, wrong area, already sold, duplicate, spam) they encountered while reviewing pricing benchmarks. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen introduces TWO shared primitives that will be reused by AGT-APR-005 (agent price report submission) + PA-CRD-005 (grant request initiator): <EvidenceUploader> (file-upload grid) and <ContextEchoCard> (the "here is what you're acting on" read-only reassurance card). Design them as reusable primitives, not one-off compositions.

First pass: render the MOBILE 375px layout as a full-screen Dialog. Top nav "Report this comparable" with X close. Contextual header showing the comparable being reported (address "Apt 2405, Marina Heights Tower 2", "Dubai Marina · Dubai, UAE", metadata row "AED 2,850,000 · 1,120 sqft · 2 BR · Bayut"). Reason section with 6 chip options in a 2-column grid, "Wrong price" selected. Conditional URL field revealed and filled with a Bayut listing link. Explanation textarea filled with a paragraph about a DLD sold-price registry finding. Evidence uploader with one uploaded screenshot tile + add-tile. Confidence segmented control with "I have hard evidence" selected. Sticky bottom bar: Cancel (ghost) + Submit report (primary orange, enabled).

LTR English only for this pass — I'll ask for other reasons, success state, desktop sheet, direct-entry page, RTL Arabic, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Use only Broadcast semantic tokens — no raw hex.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:

1. `Same mobile viewport, freshly opened, no reason selected, conditional fields hidden, all downstream fields inert, Submit disabled.`
2. `Same mobile viewport, reason = duplicate selected. Duplicate picker appears instead of URL field, with another comparable pre-selected ("Villa 12, Palm Jumeirah Frond K · AED 12.5M · Property Finder").`
3. `Same mobile viewport, submit in-flight. Button shows Loader2 + "Sending…", entire form disabled.`
4. `Same mobile viewport, success state. Body swaps to the pending StatusHero "Report received — under PA review" with SLA line "Typical review: 3 days" + "View my reports" primary + "Close" ghost.`
5. `Same mobile viewport, rate-limit reached state. Body swaps to the cap-reached message with "View my reports" CTA.`
6. `Desktop 1440px, Sheet side="right" 480px wide, same wrong-price ready-to-submit state, source screen AGT-APR-003 (comparable detail) visible under 45% black dim.`
7. `Desktop direct-entry page at /reports/comparables/new — comparable picker at top with a comparable already selected, rest of the form filled.`
8. `RTL Arabic mirror at mobile 375px, same wrong-price ready-to-submit state, use [TRANSLATION-PENDING] where copy has no Arabic yet.`
9. `Dark mode desktop sheet, same wrong-price state.`

Save each output's JSX to `web/src/components/reports/SubmitBadComparableSheet/` + screenshot to `docs/design/mockups/AGT-APR-004-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-5 dispatch prompt references this brief + the mockup paths + the two new shared primitives (`<EvidenceUploader>`, `<ContextEchoCard>`).
- [ ] `[BE-BLOCKER-05a]` (bad_comparable_reports table + write handler + rate-limit) filed in kickoff §5a.
- [ ] `[BE-BLOCKER-05b]` (shared evidence upload service) filed in kickoff §5a — flagged as blocker for AGT-APR-005 + PA-CRD-005 as well.
- [ ] Push template `bad_comparable_report.received` filed as a Week-5 backend task.
- [ ] AGT-REC-002 brief (already written) verified as receiving the outcome from this flow.
- [ ] Companion Cursor prompt authored for the shared `<EvidenceUploader>` + `<ContextEchoCard>` primitives (they should land in a prep PR before the AGT-APR-004 PR merges so AGT-APR-005 can reuse them).
