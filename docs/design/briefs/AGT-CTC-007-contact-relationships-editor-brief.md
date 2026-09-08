# Screen Brief — AGT-CTC-007 · Contact relationships editor

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §8 entry `AGT-CTC-007` (CORRECTED — added 2026-09-04) and `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 26 + §6 Week 8+. This is the CRM foundation surface — without formal representation/mandate tracking under the multi-tenant contact model (migration 028), WingCaster's CRM cannot function per audit #2. Unblocks legitimate exclusive-buyer-rep gating, agency mandate reporting, and downstream lead routing (`lead_assignments.relationship_id`).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts:**
- Screen title ("Relationships"): `font: var(--lc-type-heading-1)` — 600 26/32 IBM Plex Sans. Subhead: `var(--lc-type-body-lg)` muted.
- Contact-context header (contact avatar + name + primary channel): pinned atop the surface — `background: var(--lc-surface-sunken)`, `border-bottom: 1px solid var(--lc-border)`.
- Relationship cards: `background: var(--lc-surface-raised)`, `border: 1px solid var(--lc-border)`, `border-radius: var(--lc-radius-lg)` (7px), `padding: var(--lc-space-lg)` (20px), `box-shadow: var(--lc-elevation-sm)`. Vertical stack, gap `var(--lc-space-md)` (16px).
- Relationship-type chip (representation / mandate / affinity): `<Badge>` primitive with GLYPH + LABEL. Representation → `Handshake` glyph + `--lc-status-active` tint. Mandate → `FileSignature` glyph + `--lc-accent-bold` on `--lc-accent-bold-edge` boundary. Affinity → `Heart` glyph + `--lc-status-draft` tint.
- Party-type badge (buyer / seller / landlord / tenant): `<Badge>` primitive; small, `var(--lc-type-caption)`, `--lc-surface-sunken` bg + `--lc-text-primary` ink.
- Exclusivity ribbon (exclusive): `--lc-action-primary` fill, `--lc-action-primary-text` ink, `Lock` glyph, positioned top-right of card. Non-exclusive shows no ribbon (avoid noise).
- Status pill (pending / confirmed / active / suspended / ended / expired): use `--lc-status-{status}-bg`/`-fg`/`-dot` tokens per Broadcast rule — tint + dot + label ALWAYS.
- Scope block (subject properties + area + price): rendered inside card body as a nested `<Card variant="sunken">` with `--lc-surface-sunken` bg. Numerics via `<Numeric>` for prices, areas, dates.
- Consent-record chip: `<Badge>` with `Paperclip` icon + evidence filename OR "verbal — in person" tag when no attachment. Missing consent triggers `--lc-status-danger` chip "No consent on file — required".
- Primary CTA ("Add relationship"): `<Button variant="default">` `--lc-action-primary` fill; hover DARKENS to `--lc-action-primary-hover`. Full-width on mobile, right-aligned on desktop.
- Per-card action menu: `<DropdownMenu>` with `MoreVertical` trigger. Menu items: Edit, Extend end date, Suspend, End.
- Conflict warning banner (overlapping exclusive claim): `<Alert variant="destructive">` — `--lc-status-danger-bg`, `AlertTriangle` glyph, `--lc-status-danger-fg` ink.
- Add-relationship flow uses `<Dialog>` on desktop / `<Sheet side="bottom">` on mobile. Multi-step: stepper indicator across top.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-CTC-007 |
| Screen name | Contact relationships editor |
| Persona | Agent (self-manage own relationships) · Agency admin (see all tenant relationships, edit any) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/contacts/:contactId/relationships` (deep-link from AGT-CTC-002 contact detail via `Relationships` tab) |
| Current state | MISSING — schema exists (`contact_relationships` table, migration 028 lines 451–472). No API routes, no UI. |
| Workflow role | Feeder for lead routing (`lead_assignments.relationship_id` FK); consumer of AGT-CTC-002 contact context. |
| Backend prerequisites | ✅ `contact_relationships` table (migration 028) · ✅ `uq_active_exclusive_buyer_rep` unique index (contested-exclusivity guardrail) · ⏳ CRUD routes on `/api/contacts/:contactId/relationships` (new — `[BE-BLOCKER-08]`) · ⏳ Consent-confirmation HMAC token endpoint (new — piggybacks SHR-AUT-005d token pattern) · ⏳ Cross-tenant relationship visibility gating per `contacts.cross_tenant_visibility` |

---

## Purpose

An agent formalizes and manages the representation / mandate / affinity relationships they hold with a specific contact. Every relationship carries:

- **Relationship type** — `representation` (traditional agency relationship: agent works on the contact's behalf), `mandate` (formal listing/search mandate with fiduciary duty, e.g. exclusive listing mandate), `affinity` (informal preferred-agent relationship, no legal weight).
- **Party type on the OTHER side** — `buyer` / `seller` / `landlord` / `tenant`. This is what the CONTACT is; the agent is always the counterparty.
- **Exclusivity** — `exclusive` (only this agent can represent this contact for this party_type within this tenant; DB unique index guards active exclusive buyer reps across tenants) or `non_exclusive`.
- **Scope** — JSONB payload capturing subject property IDs (for mandate — specific listings), geo areas (Dubai Marina, Riyadh CBD, …), property types (residential apt / villa / commercial / land), price range.
- **Start / end dates** — mandate windows, extension anchors.
- **Consent record** — evidence attachment (signed MoU PDF, WhatsApp screenshot, recorded audio), consent text summary, date, method (`verbal_in_person`, `whatsapp_reply`, `email_reply`, `signed_document`).
- **Status** — `pending` (awaiting contact confirmation) → `confirmed` (contact confirmed via link) → `active` (start_date reached) → `suspended` (paused, retained) → `ended` (terminated) → `expired` (end_date reached).

The screen renders **My relationships (this tenant)** — full editable — and **Other tenants' relationships (visible-only, redacted)** — gated by the contact's cross-tenant visibility settings.

CRM cannot function without this surface: lead-routing assignments join through `lead_assignments.relationship_id`; exclusive-mandate enforcement depends on active relationship rows; commission attribution at close-won references the relationship in force at deal creation.

Success outcome: agent creates, edits, extends, suspends, or ends any relationship they hold; consent evidence is captured; contested-exclusivity conflicts are surfaced humanely; downstream lead routing has clean data to work from.

---

## Design goals

1. **Consent is a first-class citizen — never optional.** No relationship can transition past `pending` without a consent record attached. Blank consent = red danger chip + Continue disabled. This is a compliance surface, not a CRM shortcut.
2. **Multi-tenant reality visible without leaking PII.** Other tenants' relationships appear as pale redacted cards ("A different agency also represents this contact for buyer opportunities — Dubai · residential apt · exclusive since 2026-06") — enough to prevent naive exclusive-claim collisions, never enough to expose the other agent's name or personal contact data.
3. **Contested-exclusivity is a modal, not a silent DB error.** If the agent tries to create an active exclusive buyer/seller rep while another tenant holds one, the DB unique constraint fires — UI must catch and explain: "Another agency currently holds an active exclusive buyer representation for this contact. You can either wait for it to end, propose a non-exclusive relationship, or contact the contact to request they end the other exclusive first."
4. **Add-relationship flow is a stepper, not a mega-form.** Four-step sheet on mobile / dialog on desktop: (1) Type, (2) Party type, (3) Scope, (4) Consent. Each step is a single decision + Continue, never overloaded.
5. **Extend / Suspend / End are non-destructive and reversible where possible.** End is soft (row retained with `status='ended'`, audit trail preserved). Suspend can be resumed. Extend just moves `ends_at`. No hard deletes from this screen.
6. **Multi-tenant contact model is respected.** The same contact may hold a relationship with different agents in different agencies; the screen shows only the CURRENT tenant's own relationships as editable + summarised cross-tenant awareness. Never edit another tenant's relationship — ever.

---

## Layout

### Desktop / tablet ≥768px

Single-column, max-width `760px`, centered within the AGT-CTC-002 content area (this screen lives inside the contact-detail tab shell):

**Contact context header (sticky at top of the tab body):**
- Left: `<Avatar>` (48×48) + contact display name (`var(--lc-type-heading-2)`) + primary identifier (`--lc-text-muted` — phone masked or email).
- Right: `<ChannelMark>` for primary channel + "View contact →" link back to AGT-CTC-002 primary tab.
- Below the row: 2-line summary — "12 conversations · Last seen 3d ago · Buyer profile: apt · Dubai Marina · AED 1.2M–2.4M".

**Section 1 — My relationships (this tenant)**
- H2: "My relationships" — `var(--lc-type-heading-2)` + count badge `(3)`.
- Right of H2: `<Button variant="default">` "+ Add relationship" — `--lc-action-primary`.
- Below header: `<Card>` stack, one per relationship row from `contact_relationships` where `tenant_id = current AND agent_user_id = current OR (viewer role includes agency_admin)`.

**Relationship card anatomy (per card):**
```
┌────────────────────────────────────────────────────────────────────┐
│ [Handshake] Representation · Buyer          [Lock] Exclusive       │  ← top row: type badge + party badge + exclusivity ribbon
│                                                                    │
│ ● Active   Since 2026-08-14   Until 2027-02-14   (5 months left)   │  ← status + date range + countdown
│                                                                    │
│ ┌─Scope───────────────────────────────────────────────────────┐    │
│ │ Areas:      Dubai Marina · JBR · Bluewaters                 │    │
│ │ Type:       Residential apartment · 1–3 bed                 │    │
│ │ Price:      AED 1,200,000 – 2,400,000                       │    │
│ │ Subjects:   No specific property — open search              │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ [📎] Consent: signed_mou_2026_08_14.pdf · Signed in person 14 Aug  │
│                                                                    │
│                                     [Edit] [Extend] [Suspend] [⋮] │  ← inline actions + overflow menu (End)
└────────────────────────────────────────────────────────────────────┘
```

- Card gets `border-left: 4px solid var(--lc-status-{status}-dot)` per status (active=green, pending=amber, suspended=slate, ended=neutral, expired=neutral, confirmed=teal).
- Pending cards show extra footer: "Waiting on contact to confirm via link · Resend confirmation · Cancel request".
- Ended / Expired cards collapse by default with a "Show ended (2)" reveal toggle at bottom of section.

**Section 2 — Other tenants' relationships (redacted, visible-only)**
- H2: "Other agencies representing this contact" — `var(--lc-type-heading-2)` `--lc-text-muted`.
- Helper: `var(--lc-type-body-sm)` `--lc-text-muted` — "You can see that other relationships exist so you don't create conflicting exclusive claims. Names and evidence are redacted per this contact's privacy settings."
- Below: pale `<Card>` stack — `background: var(--lc-surface-sunken)`, `opacity: 0.85`, cards NOT interactive (no menu, no edit, cursor default).

**Redacted card anatomy:**
```
┌────────────────────────────────────────────────────────────────────┐
│ [Handshake] Representation · Seller          [Lock] Exclusive      │
│ ● Active · Since 2026-06 · Ends 2027-06                            │
│ Scope: Dubai · residential apartment · price range redacted        │
│ Agent + agency: hidden per contact privacy                         │
└────────────────────────────────────────────────────────────────────┘
```

- If the contact has disabled cross-tenant visibility entirely, the whole Section 2 is replaced with a single muted line: "This contact has disabled cross-agency awareness. Exclusive-claim collisions will only surface at save time."

**Empty state (no relationships in either section):**
- Illustration placeholder + copy: "You haven't formalized any relationship with this contact yet."
- Sub: "Add a representation, mandate, or affinity to make lead routing, exclusive-claim protection, and mandate reporting work."
- `<Button variant="default">` "+ Add first relationship".

### Mobile ≤767px

Single column, full-width scroll:

- Sticky header at top (contact context, condensed — 40px avatar + name + one-line summary).
- Section headers larger; cards stack full-width edge-to-edge with `padding: var(--lc-space-md)` and internal spacing `var(--lc-space-sm)`.
- Card footer actions become a single `<Button variant="ghost">` "Actions ▾" that opens a bottom-sheet action list (Edit / Extend / Suspend / End) — inline buttons don't fit at 375px.
- "+ Add relationship" is a floating FAB (bottom-right, 56×56, `--lc-action-primary` fill, `Plus` icon) rather than an inline button.
- Add-relationship flow opens as full-height `<Sheet side="bottom">` with drag-handle at top.

### Add-relationship flow (stepper — Dialog desktop / Sheet mobile)

**Stepper indicator** across top: `Type · Party · Scope · Consent`. Current step accented `--lc-action-primary`; completed steps get a check.

**Step 1 — Relationship type (radio cards):**
- **Representation** — "I represent this contact in an ongoing agent capacity for buying/selling/leasing." (default choice; most common).
- **Mandate** — "A formal, time-bounded, signed mandate for a specific listing or search brief. Higher fiduciary duty."
- **Affinity** — "Informal preferred-agent relationship. No legal weight; used for lead-routing preference only."

Each choice is a `RadioGroup` card with icon + title + description. `Continue →` at bottom (disabled until choice made).

**Step 2 — Party type (the contact's side of the deal):**
- Four radio cards: Buyer · Seller · Landlord · Tenant. Icons: `ShoppingCart`, `Store`, `Building`, `Home`.
- If contact already has an active relationship of same party_type in this tenant, banner appears: "You already have an active {representation} for {buyer} on this contact. Are you creating a second one? (Non-exclusive relationships can stack; exclusive cannot.)"

**Step 3 — Scope + Exclusivity + Dates:**
- Exclusivity toggle: `<RadioGroup>` — Non-exclusive (default) · Exclusive.
  - If Exclusive selected AND cross-tenant awareness shows another tenant holds active exclusive for same party_type: warning banner immediately fires (see Contested-exclusivity modal below).
- Areas: `<MultiSelect>` picker seeded from tenant's area taxonomy.
- Property type: `<MultiSelect>` — apt / villa / townhouse / commercial / land / mixed.
- Price range: two `<Numeric>` inputs (Min / Max) — currency inferred from tenant primary market.
- Subject properties (mandate only): `<PropertyPicker>` — search + multi-select from tenant's listings. For Representation and Affinity, this field is hidden.
- Start date: `<DatePicker>` — default today.
- End date: `<DatePicker>` — default 6 months from start (representation), 3 months (mandate), 12 months (affinity); user editable.

**Step 4 — Consent record:**
- Consent method: `<RadioGroup>` — Verbal (in person) · WhatsApp reply · Email reply · Signed document.
- Consent text summary: `<Textarea>` — "Summarize the contact's consent in one sentence" (min 20 chars).
- Evidence attachment: `<FileUpload>` — mandatory unless method = `verbal_in_person`. Accept PDF, PNG, JPG, audio (mp3/m4a), video (mp4). Max 10 MB.
- Consent date: `<DatePicker>` — default today.
- If method requires contact confirmation (all except `verbal_in_person`): checkbox "Send confirmation link to contact via {WhatsApp / email}" defaulted ON. Explains: "The contact will receive a link. Until they confirm, the relationship stays pending."
- Save: `<Button variant="default">` "Save relationship" — `--lc-action-primary`.

On save: POST to backend; on success dialog closes and card appears in the list with `status='pending'` (unless verbal — in which case `status='confirmed'` immediately). Toast: "Relationship created. Awaiting confirmation from {contact name}." OR "Relationship confirmed and active."

### Contested-exclusivity modal

Triggered when Step-3 exclusivity=`exclusive` AND backend responds 409 `EXCLUSIVE_CONFLICT`.

- Dialog title: "Another agency holds this exclusive"
- Body: "{Contact name} already has an active exclusive {representation | mandate} for {buyer | seller | landlord | tenant} with a different agency. Only one exclusive of this type can be active across all agencies at once."
- Three options as buttons:
  - `[Save as non-exclusive]` — creates the row with `exclusivity='non_exclusive'`.
  - `[Save as pending]` — creates with `exclusivity='exclusive'` + `status='pending'` (won't collide until confirmed; useful when the existing exclusive is about to end).
  - `[Cancel]` — closes modal, keeps user in Step 3.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Screen title | Relationships |
| Subhead | Formalize how you represent this contact so leads route correctly and exclusive claims are protected. |
| Section 1 heading | My relationships |
| Section 1 count | ({n}) |
| Section 2 heading | Other agencies representing this contact |
| Section 2 helper | You can see that other relationships exist so you don't create conflicting exclusive claims. Names and evidence are redacted per this contact's privacy settings. |
| Section 2 all-hidden | This contact has disabled cross-agency awareness. Exclusive-claim collisions will only surface at save time. |
| Empty state title | You haven't formalized any relationship with this contact yet. |
| Empty state sub | Add a representation, mandate, or affinity to make lead routing, exclusive-claim protection, and mandate reporting work. |
| Empty state CTA | + Add first relationship |
| Add CTA (populated) | + Add relationship |
| FAB label (mobile screen reader) | Add relationship |
| Card: type badge — representation | Representation |
| Card: type badge — mandate | Mandate |
| Card: type badge — affinity | Affinity |
| Card: party badge | Buyer · Seller · Landlord · Tenant |
| Card: exclusivity ribbon | Exclusive |
| Card: status labels | Pending · Confirmed · Active · Suspended · Ended · Expired |
| Card: pending footer | Waiting on contact to confirm via link. |
| Card: pending action | Resend confirmation |
| Card: pending secondary | Cancel request |
| Card: date row (active) | Since {start} · Until {end} · ({countdown}) |
| Card: date row (pending) | Requested {createdAt} · Would run {start} → {end} |
| Card: scope label | Scope |
| Card: scope areas | Areas |
| Card: scope type | Type |
| Card: scope price | Price |
| Card: scope subjects | Subjects |
| Card: scope no-subject | No specific property — open search |
| Card: consent label | Consent |
| Card: consent verbal | Verbal — in person |
| Card: no consent | No consent on file — required |
| Card: actions | Edit · Extend · Suspend · End |
| Card: ended reveal | Show ended ({n}) |
| Card: ended collapse | Hide ended |
| Redacted card: agent-hidden | Agent + agency: hidden per contact privacy |
| Redacted card: scope-partial | Price range redacted |
| Add-relationship — stepper | Type · Party · Scope · Consent |
| Step 1 title | What kind of relationship? |
| Step 1 helper | You can change this later, but the type sets the fiduciary bar. |
| Step 1 — representation body | I represent this contact in an ongoing agent capacity for buying/selling/leasing. |
| Step 1 — mandate body | A formal, time-bounded, signed mandate for a specific listing or search brief. Higher fiduciary duty. |
| Step 1 — affinity body | Informal preferred-agent relationship. No legal weight; used for lead-routing preference only. |
| Step 2 title | Which side is the contact on? |
| Step 2 duplicate-warning | You already have an active {type} for {partyType} on this contact. Non-exclusive relationships can stack; exclusive cannot. |
| Step 3 title | Scope + dates |
| Step 3 exclusivity-non | Non-exclusive — other agents can also represent this contact for this side. |
| Step 3 exclusivity-exc | Exclusive — no other agent can represent this contact for this side while this is active. |
| Step 3 areas label | Areas |
| Step 3 type label | Property type |
| Step 3 price-min label | Min price |
| Step 3 price-max label | Max price |
| Step 3 subjects label | Subject properties (mandate only) |
| Step 3 start label | Starts |
| Step 3 end label | Ends |
| Step 3 exclusive-collision-inline | Another agency currently holds this exclusive. Save will fail unless you switch to non-exclusive or pending. |
| Step 4 title | Consent record |
| Step 4 helper | A consent record is required. Without it, this relationship cannot activate. |
| Step 4 method label | How did the contact consent? |
| Step 4 method — verbal | Verbal — in person |
| Step 4 method — whatsapp | WhatsApp reply |
| Step 4 method — email | Email reply |
| Step 4 method — signed | Signed document |
| Step 4 summary label | Consent summary |
| Step 4 summary placeholder | e.g. "Sara agreed to exclusive buyer representation for Dubai Marina apartments during our meeting on 14 Aug 2026." |
| Step 4 evidence label | Evidence attachment |
| Step 4 evidence hint | PDF, image, audio, or video. Up to 10 MB. Required unless verbal in person. |
| Step 4 date label | Consent date |
| Step 4 confirmation-checkbox | Send confirmation link to {contact name} via {channel} |
| Step 4 confirmation-hint | The contact will receive a link. Until they confirm, the relationship stays pending. |
| Step Save CTA | Save relationship |
| Step Back / Next | Back · Continue → |
| Toast: created verbal | Relationship confirmed and active. |
| Toast: created pending | Relationship created. Awaiting confirmation from {contact name}. |
| Toast: extended | End date updated. |
| Toast: suspended | Relationship suspended. Resume any time. |
| Toast: ended | Relationship ended. Audit trail preserved. |
| Toast: consent-resent | Confirmation link resent. |
| Modal: contested-exclusivity title | Another agency holds this exclusive |
| Modal: contested-exclusivity body | {Contact name} already has an active exclusive {relationshipType} for {partyType} with a different agency. Only one exclusive of this type can be active across all agencies at once. |
| Modal: option 1 | Save as non-exclusive |
| Modal: option 2 | Save as pending |
| Modal: option 3 (cancel) | Cancel |
| End-confirmation dialog title | End this relationship? |
| End-confirmation dialog body | Ending is permanent for reporting, but the record stays for audit. Future leads will not route through it. |
| End-confirmation reason | Reason (optional) |
| End-confirmation CTA | End relationship |
| Suspend-confirmation title | Suspend this relationship? |
| Suspend-confirmation body | Suspend pauses lead routing without ending. You can resume at any time. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Contact context header | `Card variant="sunken"` + `Avatar` + typography |
| Section headings | `<h2>` with `Numeric` count badge |
| Relationship card | `Card` |
| Type badge | `Badge` + `Handshake` / `FileSignature` / `Heart` |
| Party badge | `Badge` |
| Exclusivity ribbon | `Badge variant="primary"` with `Lock` icon |
| Status pill | `Badge` + `--lc-status-{status}` tokens + dot |
| Scope nested block | `Card variant="sunken"` |
| Consent chip | `Badge` + `Paperclip` |
| Card actions | `Button variant="ghost"` inline (desktop) OR bottom-sheet action list (mobile) |
| Overflow menu | `DropdownMenu` + `MoreVertical` |
| Add relationship trigger | `Button variant="default"` (desktop) OR floating FAB (mobile) |
| Add flow (desktop) | `Dialog` |
| Add flow (mobile) | `Sheet side="bottom"` full-height |
| Stepper indicator | custom `<Stepper>` — 4 pills with connector line |
| Step 1 / 2 choices | `RadioGroup` styled as cards |
| Step 3 exclusivity | `RadioGroup` |
| Step 3 areas / type | `MultiSelect` (Combobox with `checked` state) |
| Step 3 price inputs | `Input type="number"` wrapped by `<Numeric>` primitive |
| Step 3 subject picker | Custom `PropertyPicker` — Combobox seeded from tenant listings |
| Step 3 dates | `DatePicker` (shadcn calendar) |
| Step 4 method | `RadioGroup` |
| Step 4 summary | `Textarea` |
| Step 4 evidence | Custom `FileUpload` — dropzone + button |
| Step 4 confirmation opt-in | `Checkbox` + label |
| Contested-exclusivity modal | `Dialog` (destructive) |
| End / Suspend confirm | `AlertDialog` |
| Cross-tenant redacted card | `Card variant="sunken"` non-interactive |
| Empty state | Custom `<EmptyState>` — illustration + copy + CTA |
| Toast | `Sonner` |
| Countdown chip | `<Numeric>` (mono + tabular-nums) |
| Icons | `lucide-react` — `Handshake`, `FileSignature`, `Heart`, `Lock`, `Paperclip`, `Plus`, `MoreVertical`, `ShoppingCart`, `Store`, `Building`, `Home`, `AlertTriangle` |

---

## Sample content (for v0 / mockup)

Show the desktop layout for contact **Sara Al-Mansoori** with:

**Contact context header:**
- Avatar with initials `SA`
- Name: "Sara Al-Mansoori"
- Primary channel: WhatsApp mark + `+971 5X XXX 4820`
- Summary: "12 conversations · Last seen 3d ago · Buyer profile: apt · Dubai Marina · AED 1.2M–2.4M"

**Section 1 — My relationships (3):**

**Card 1 — Active exclusive buyer rep:**
- Type: Representation · Party: Buyer · Exclusivity: Exclusive
- Status: Active (green dot) · Since 2026-08-14 · Until 2027-02-14 · (5 months left)
- Scope: Dubai Marina · JBR · Bluewaters; residential apt 1–3 bed; AED 1,200,000–2,400,000; No specific property
- Consent: `signed_mou_2026_08_14.pdf` · Signed in person 14 Aug 2026

**Card 2 — Pending mandate:**
- Type: Mandate · Party: Seller · Exclusivity: Exclusive
- Status: Pending (amber dot) · Requested 2026-09-05 · Would run 2026-09-08 → 2026-12-08
- Scope: subject property `Marina Gate Tower 1 · Unit 3204`
- Consent: WhatsApp reply — awaiting confirmation link click
- Pending footer: "Waiting on contact to confirm via link · Resend confirmation · Cancel request"

**Card 3 — Non-exclusive affinity:**
- Type: Affinity · Party: Buyer · Exclusivity: (no ribbon)
- Status: Active (teal dot) · Since 2025-11-02 · Until 2026-11-02 · (2 months left)
- Scope: Downtown Dubai · Palm Jumeirah; residential villa; open price
- Consent: Verbal — in person (no attachment)

**Section 2 — Other agencies (1 redacted):**
- Redacted card: Representation · Buyer · Exclusive · Active · Since 2026-06 · Ends 2027-06 · Dubai · residential apartment · price range redacted · Agent + agency: hidden

**Sticky FAB / add button** in top-right of Section 1 header.

---

## Interactions

**On tab load:**
- Fetch `GET /api/contacts/:contactId/relationships?scope=mine` — returns Section 1 cards.
- Fetch `GET /api/contacts/:contactId/relationships?scope=other-redacted` — returns Section 2 redacted rows (or 403 with `CROSS_TENANT_VISIBILITY_DISABLED` message).
- Skeleton renders both sections during load.

**On "+ Add relationship":**
- Desktop: opens Dialog. Mobile: opens bottom Sheet full-height.
- Stepper starts at Step 1. Back button disabled on Step 1. Continue disabled until Step 1 choice made.

**On step transitions:**
- Continue → advances to next step (200ms slide-in animation, respects `prefers-reduced-motion`).
- Back → returns to previous step (data preserved).
- Escape / X → confirms discard if any field dirty ("Discard this new relationship? Nothing has been saved.").

**On Step 3 exclusivity toggle to Exclusive:**
- Client-side check against known Section 2 redacted rows for same party_type → if collision detected, inline warning banner ("Another agency currently holds this exclusive…") appears above the exclusivity radio group. User can proceed; the collision only becomes hard at save.

**On Step 4 file upload:**
- Dropzone accepts drag+drop and click-to-browse. Progress bar for uploads >1MB. On success, filename + size chip renders. Remove button (×) beside chip.

**On Save relationship click:**
- Validates: type + party + at least one area OR at least one subject property + start_date + end_date > start_date + consent method + consent summary ≥ 20 chars + evidence (unless verbal).
- POST to `/api/contacts/:contactId/relationships` per §Backend contract.
- On success: dialog closes. Toast appears. New card renders at top of Section 1 with status.
- On 409 `EXCLUSIVE_CONFLICT`: opens Contested-exclusivity modal (see §Layout).
- On other 400 validation: inline field errors + stay on the failing step.
- On 500: destructive toast "Something went wrong. Please try again." — form state preserved.

**On card Edit click:**
- Opens the same Dialog / Sheet, pre-filled with existing values. Stepper still 4 steps but all steps navigable freely (not gated). Save updates existing row via `PATCH /api/contacts/:contactId/relationships/:relationshipId`.

**On card Extend click:**
- Opens compact Dialog: single `DatePicker` "New end date" + Save. Only `ends_at` updated. Toast on success.

**On card Suspend click:**
- Opens `AlertDialog` confirmation. On confirm, PATCH `status='suspended'`. Toast.

**On card End click (from overflow menu):**
- Opens `AlertDialog` with reason textarea (optional). On confirm, PATCH `status='ended'` + `data.end_reason`. Toast.

**On pending card Resend confirmation:**
- POST `/api/contacts/:contactId/relationships/:relationshipId/resend-consent-link` — regenerates HMAC-signed token and re-sends via original channel. Toast: "Confirmation link resent."

**On pending card Cancel request:**
- `AlertDialog` — "Cancel this pending relationship? The confirmation link becomes invalid immediately." On confirm, DELETE relationship row (rare hard-delete, allowed only for status=`pending`).

**On section-2 redacted card:**
- Not interactive. Hover shows tooltip: "This information comes from another agency's records. You cannot edit it. It appears so you don't accidentally create a conflicting exclusive claim."

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Tab first render | Skeleton with header shape + 3 card skeletons in Section 1. |
| **Empty (mine)** | Section 1 zero rows | Empty state card with illustration + CTA "+ Add first relationship". Section 2 still renders if applicable. |
| **Empty (both)** | Section 1 + 2 both zero | Just the Section 1 empty state; Section 2 hidden entirely. |
| **Populated (mine only)** | Section 1 has rows, Section 2 zero | Section 1 cards render; Section 2 renders header + "None from other agencies visible." muted line. |
| **Cross-tenant visibility disabled** | Contact's setting off | Section 2 replaced with single muted line. |
| **Ended cards collapsed** | Any card status = ended / expired | Reveal toggle at bottom of Section 1 "Show ended (n)". Ended cards render below active on toggle. |
| **Pending awaiting confirmation** | Card status = pending | Amber left-edge stripe + pending footer with Resend / Cancel actions. |
| **Contested exclusivity — client-anticipated** | Step 3 exclusive toggle when redacted collision known | Inline yellow warning above exclusivity radio. Continue still allowed. |
| **Contested exclusivity — server rejection** | POST returns 409 | Contested-exclusivity modal opens over the Dialog with 3 options. |
| **Save-in-progress** | POST / PATCH in flight | Save button shows Loader2 + "Saving…". Form disabled. |
| **Consent required (danger)** | Card has empty `consent_record` (legacy or bug) | Red danger chip on card + card border-left `--lc-status-danger`. Card can only be edited to add consent — no Extend/Suspend/End until fixed. |
| **Adding relationship — Step 1** | Dialog open, step 1 | Type radio group visible. Continue disabled until choice. |
| **Adding relationship — Step 2** | Step 2 | Party radio group. Duplicate-warning banner if applicable. |
| **Adding relationship — Step 3** | Step 3 | Scope + exclusivity + dates. Multi-selects, price inputs, subject picker (mandate only). |
| **Adding relationship — Step 4** | Step 4 | Consent record fields. Save enabled when valid. |
| **Extend dialog** | Extend clicked | Compact date picker + Save. |
| **Suspend confirm** | Suspend clicked | AlertDialog. |
| **End confirm** | End clicked | AlertDialog + optional reason. |
| **Cancel pending confirm** | Cancel request clicked on pending card | AlertDialog — hard delete warning. |
| **RTL** | Locale = ar | Whole layout mirrors. Icons flip where directional (`Handshake` — visually symmetric; keep). Numeric inputs stay LTR. Date pickers RTL-aware. |
| **Dark mode** | `prefers-color-scheme: dark` | All tokens swap. Status colors readable on `--lc-surface-raised` dark surface. |
| **Offline** | Network unreachable | Top-of-screen banner "You're offline. Changes will save when reconnected." Add / Save disabled. |
| **Not authorized** | Viewer role lacks permission (rare — agents from other tenants who somehow deep-link in) | 403 page — "You don't have permission to view or edit this contact's relationships." Link back to inbox. |

---

## Accessibility

- All interactive elements ≥44×44 CSS pixels (Broadcast base CSS enforces).
- Every form control has visible `<label>` (never placeholder-only).
- Stepper announces current step via `aria-current="step"` on the active pill and `aria-label="Step 3 of 4: Scope + dates"`.
- Radio groups use `role="radiogroup"` + `aria-labelledby`; each card uses arrow-key navigation.
- Cards use semantic `<article>` with `aria-labelledby` pointing to the type + party badges header.
- Status pills include `sr-only` text: "Status: active".
- Consent-danger state announces via `aria-live="polite"`: "This relationship has no consent record on file. Consent is required."
- Contested-exclusivity modal traps focus, Escape closes, close-on-outside-click enabled, `aria-describedby` on body.
- Dialog / Sheet titles use `<h2 id="dialog-title">` referenced by `aria-labelledby`.
- Every card action menu button has `aria-label` (visible icon + hidden text) — "More actions for {representation for buyer}".
- FAB on mobile has visible tooltip on focus + `aria-label="Add relationship"`.
- Focus rings two-tone (Broadcast base CSS).
- No color-only status differentiation — every status uses dot + label + optional icon.
- RTL: entire layout mirrors, but LTR-native fields (prices, dates in ISO, phone numbers) stay LTR via `dir="ltr"` on the input element.
- Screen-reader announces relationship changes: "Relationship created and awaiting confirmation" / "End date extended to 14 February 2027".

---

## Anti-patterns (do not do these)

- ❌ Do NOT allow saving any relationship without a consent record. Not even a stub. Not even "we'll add it later." Backend enforces via NOT NULL + non-empty JSONB check; UI blocks Save.
- ❌ Do NOT allow two active exclusive relationships from the same tenant for the same party_type on the same contact. DB unique index guards it; UI must prevent proactively via disabled Exclusive toggle when collision detected within tenant.
- ❌ Do NOT reveal another tenant's agent name, agency name, phone number, email, or scoped price range in the redacted Section 2 cards. Show only enough to prevent conflicts. Per audit #2, cross-tenant PII bleed is a P0 privacy violation.
- ❌ Do NOT hard-delete relationships from active / confirmed / ended / expired states. Only `pending` can be hard-deleted (Cancel request). All other terminations soft-transition to `ended`.
- ❌ Do NOT fabricate consent by defaulting the method to `verbal_in_person` when the user hasn't chosen. Force an explicit choice — audit-compliance depends on the record being deliberate.
- ❌ Do NOT allow the agent to edit another tenant's relationship even if their session accidentally has cross-tenant visibility. Route guard + backend guard: only rows where `tenant_id = current AND (agent_user_id = current OR role includes agency_admin)`.
- ❌ Do NOT surface the DB `uq_active_exclusive_buyer_rep` constraint error raw. Catch it and render the Contested-exclusivity modal with humane copy.
- ❌ Do NOT auto-send a confirmation link when the consent method is `verbal_in_person`. That method IS the confirmation — sending a redundant link confuses the contact.
- ❌ Do NOT allow price range fields without explicit currency. Currency inferred from tenant primary market and shown as prefix in the input.
- ❌ Do NOT collapse `Suspend` and `End` into a single action. Suspend is temporary and resumable; End is terminal-for-reporting. Different semantics.
- ❌ Do NOT show the relationship-type badge without its icon. Type is high-context, users need the glyph reinforcement.
- ❌ Do NOT allow file uploads >10 MB. Reject client-side + surface friendly error before hitting network.
- ❌ Do NOT skip the stepper on desktop just because "there's more room." The 4-step gating is a compliance UX pattern — mega-forms lead to skipped consent.
- ❌ Do NOT bounce or spring the add-relationship dialog. Motion budget: `--lc-duration-slow` (240ms) `--lc-easing-out`, no emphasis easing.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **HubSpot associations** — the paradigm of "this contact has relationships with these deals / companies" is directly analogous. Study their multi-object card stack + inline actions.
- **Salesforce contact relationships** — how they surface active-vs-inactive relationships and cross-org visibility (though we're less enterprise-heavy than Salesforce).
- **Notion database relations UI** — the way related-record cards render inline is a good visual precedent.
- **Linear cycle detail** — inline card stack with type/status badges + overflow menu, tight radii, hard offset shadows — feels the same as Broadcast.
- **Stripe Radar rules** — the stepper + condition-builder pattern for the add-relationship flow.
- **Airbnb guest profile — mutual-review disclosure** — the redacted / partial-disclosure card pattern for our Section 2.

Do NOT match:
- Freshworks CRM "relationship" panel (too dense, no consent surfacing, no cross-tenant awareness).
- Zoho contacts relationships (buries mandate/exclusivity in sub-tabs).

---

## Backend contract

**All routes MISSING today. `[BE-BLOCKER-08]` — file in kickoff §5a.**

### Endpoint 1 — List (mine)

`GET /api/contacts/:contactId/relationships?scope=mine`

**Response 200:**
```json
{
  "relationships": [
    {
      "id": "rel_01HXYZ...",
      "tenant_id": "personal:usr_...",
      "contact_id": "cnt_...",
      "agent_user_id": "usr_...",
      "party_type": "buyer",
      "relationship_type": "representation",
      "exclusivity": "exclusive",
      "scope": {
        "areas": ["dubai-marina", "jbr", "bluewaters"],
        "property_types": ["apartment"],
        "bedrooms": { "min": 1, "max": 3 },
        "price_range": { "currency": "AED", "min": 1200000, "max": 2400000 },
        "subject_property_ids": []
      },
      "status": "active",
      "consent_record": {
        "method": "signed_document",
        "summary": "Sara agreed to exclusive buyer representation for Dubai Marina...",
        "evidence": {
          "type": "application/pdf",
          "filename": "signed_mou_2026_08_14.pdf",
          "asset_id": "asset_..."
        },
        "captured_at": "2026-08-14T10:30:00Z",
        "confirmed_at": "2026-08-14T10:30:00Z",
        "confirmation_method": "in_person"
      },
      "starts_at": "2026-08-14T00:00:00Z",
      "ends_at": "2027-02-14T00:00:00Z",
      "created_at": "2026-08-14T10:30:00Z",
      "updated_at": "2026-08-14T10:30:00Z"
    }
  ]
}
```

### Endpoint 2 — List (other, redacted)

`GET /api/contacts/:contactId/relationships?scope=other-redacted`

**Response 200:**
```json
{
  "relationships": [
    {
      "id": "redacted",
      "relationship_type": "representation",
      "party_type": "buyer",
      "exclusivity": "exclusive",
      "status": "active",
      "starts_month": "2026-06",
      "ends_month": "2027-06",
      "scope_summary": {
        "areas_region": "Dubai",
        "property_types": ["apartment"]
      }
    }
  ]
}
```

**Response 403 (cross-tenant visibility disabled):**
```json
{
  "error": "CROSS_TENANT_VISIBILITY_DISABLED",
  "message": "This contact has disabled cross-agency awareness."
}
```

### Endpoint 3 — Create

`POST /api/contacts/:contactId/relationships`

**Request body:** same shape as list-response object, minus id / tenant_id / agent_user_id / created_at / updated_at (server derives).

**Response 201:** the created relationship object.

**Response 409 `EXCLUSIVE_CONFLICT`:**
```json
{
  "error": "EXCLUSIVE_CONFLICT",
  "message": "Another agency holds an active exclusive of this type.",
  "conflicting_relationship_summary": {
    "party_type": "buyer",
    "status": "active",
    "ends_at_month": "2027-06"
  }
}
```

**Response 400 field validation:**
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "consent_record.evidence": "required_unless_verbal",
    "ends_at": "must_be_after_starts_at"
  }
}
```

### Endpoint 4 — Update

`PATCH /api/contacts/:contactId/relationships/:relationshipId`

**Request body:** partial — any subset of `scope`, `starts_at`, `ends_at`, `status` (limited transitions), `consent_record`. Type / party_type / exclusivity IMMUTABLE post-creation (create new, end old for those).

**Response 200:** updated relationship object.

### Endpoint 5 — Delete (pending only)

`DELETE /api/contacts/:contactId/relationships/:relationshipId`

- Only allowed when `status = 'pending'`. Otherwise use PATCH `status='ended'`.
- Also invalidates the outstanding consent-confirmation token.

**Response 204** on success. **Response 409 `NOT_DELETABLE`** if status isn't pending.

### Endpoint 6 — Resend consent-confirmation link

`POST /api/contacts/:contactId/relationships/:relationshipId/resend-consent-link`

- Regenerates HMAC-signed token per SHR-AUT-005d pattern (see below).
- Re-sends via original channel (WhatsApp / email).
- Increments `consent_record.confirmation_resend_count`; rate-limit 3 resends per relationship per 24h.

**Response 200:**
```json
{ "sent_at": "2026-09-08T14:22:00Z", "expires_at": "2026-09-15T14:22:00Z" }
```

### Endpoint 7 — Consent confirmation landing (public, token-authed)

`GET /public/relationships/consent?token=<HMAC-signed-payload>`

- Piggybacks the SHR-AUT-005d HMAC token pattern. Server-signed token payload: `{ relationship_id, contact_id, expires_at, nonce }`.
- Renders a lightweight standalone confirmation page (own micro-brief — likely AGT-CTC-007b — flag as follow-up).
- On confirm: PATCH relationship to `status='confirmed'`, then transition to `active` if `starts_at <= now`.
- On decline: PATCH `status='ended'` with `end_reason='contact_declined_confirmation'`.

### Backend prerequisite table (`[BE-BLOCKER-08]`)

| Route | Status | Priority |
|---|---|---|
| `GET /api/contacts/:contactId/relationships?scope=mine` | MISSING | P0 |
| `GET /api/contacts/:contactId/relationships?scope=other-redacted` | MISSING | P0 |
| `POST /api/contacts/:contactId/relationships` | MISSING | P0 |
| `PATCH /api/contacts/:contactId/relationships/:relationshipId` | MISSING | P0 |
| `DELETE /api/contacts/:contactId/relationships/:relationshipId` (pending only) | MISSING | P1 |
| `POST /api/contacts/:contactId/relationships/:relationshipId/resend-consent-link` | MISSING | P1 |
| `GET /public/relationships/consent?token=...` (HMAC-authed) | MISSING | P1 |
| Cross-tenant visibility gating from `contacts.cross_tenant_visibility` flag | MISSING (field may not exist yet — verify) | P0 |
| Asset upload endpoint reused from AGT-LST evidence uploader | EXISTS | ✅ |
| HMAC token infrastructure (SHR-AUT-005d) | EXISTS | ✅ (reuse) |

**Consent-confirmation link tokens PIGGYBACK the existing HMAC token infrastructure used by SHR-AUT-005d (scheduled account deletion).** No new token infrastructure required — just a new token `type='relationship_consent'` variant + a new signing scope + a new public landing route. Reuses `backend/src/lib/webhook-verify.js` HMAC helpers.

---

## Downstream implementation (Cursor prompt handoff notes)

- **New page:** `web/src/pages/ContactRelationshipsPage.tsx` — or a `<RelationshipsTab>` component mounted inside AGT-CTC-002 `ContactDetailPage.tsx`'s tab shell.
- **Route:** register `/contacts/:contactId/relationships` in `web/src/App.tsx`. Deep-link from AGT-CTC-002 tab bar.
- **Component decomposition:**
  - `ContactContextHeader` — sticky top block with avatar + name + summary.
  - `RelationshipCard` — one card with badges, status, scope block, consent chip, actions.
  - `RedactedRelationshipCard` — variant of RelationshipCard, non-interactive, muted styling.
  - `EmptyRelationships` — the empty state.
  - `AddRelationshipDialog` — desktop Dialog wrapper.
  - `AddRelationshipSheet` — mobile Sheet wrapper.
  - `RelationshipStepper` — 4-pill stepper indicator.
  - `Step1Type` / `Step2Party` / `Step3Scope` / `Step4Consent` — one component per step.
  - `ContestedExclusivityModal` — the conflict handler.
  - `EndRelationshipDialog` / `SuspendRelationshipDialog` / `ExtendRelationshipDialog` — small confirmation dialogs.
  - `PropertyPicker` — reused / extracted; likely lives in `web/src/components/pickers/`.
  - `ConsentEvidenceUpload` — dropzone with file-type + size validation.
- **State management:** use React Query (`useQuery` / `useMutation`) against the new endpoints. Optimistic updates for PATCH actions (Suspend / Extend / End); rollback on failure.
- **Fabric hooks:** `useTenantContext()` (already exists) for tenant filtering. `useCrossTenantVisibility(contactId)` — new helper reading `contacts.cross_tenant_visibility` — for Section 2 gating.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green. All new components read `--lc-*` semantic tokens.
- **RTL:** covered by existing `screens.rtl.test.tsx` — add new signup entry to sweep.
- **Backend delivery plan:** ONE backend PR delivers all 7 routes + cross-tenant visibility gating + HMAC token variant. Split from frontend PR to keep review scoped.
- **Test discipline:**
  - Unit: each of the 10+ components renders + state transitions.
  - Integration: full add-relationship happy path per relationship_type (3 flows).
  - Integration: contested-exclusivity flow — 409 handling + modal option branches.
  - Integration: pending → confirmation-link → active transition (mock the token exchange).
  - Real-Postgres: at least one flow that creates + updates a relationship row and verifies the DB state.
  - Guard test: attempt to edit another tenant's relationship — expect 403.
  - Guard test: attempt to create second active exclusive for same party_type same tenant — expect DB constraint violation surfaced as modal.
- **Analytics events:** `relationship_created`, `relationship_ended`, `relationship_extended`, `relationship_suspended`, `consent_link_sent`, `consent_link_confirmed`, `exclusive_conflict_hit`.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Contact context header background: `--lc-surface-sunken`; bottom border `1px solid var(--lc-border)`.
- Section header spacing: `margin-top: var(--lc-space-2xl)`; between H2 and cards: `var(--lc-space-md)`.
- Relationship card background: `--lc-surface-raised`; radius `var(--lc-radius-lg)` (7px); elevation `var(--lc-elevation-sm)`.
- Left-edge status stripe: 4px width, color per `--lc-status-{status}-dot`.
- Card padding: `var(--lc-space-lg)` (20px).
- Type badge: representation → `--lc-status-active-{bg,fg}` + `Handshake` glyph. Mandate → `--lc-accent` bg + `--lc-accent-bold-text` ink with `--lc-accent-bold-edge` boundary + `FileSignature`. Affinity → `--lc-status-draft-{bg,fg}` + `Heart`.
- Party badge: `--lc-surface-sunken` bg + `--lc-text-primary` ink; radius `var(--lc-radius-sm)` (3px).
- Exclusivity ribbon (top-right): `--lc-action-primary` fill + `--lc-action-primary-text` ink + `Lock` icon; padding `var(--lc-space-xs) var(--lc-space-sm)`; radius `var(--lc-radius-md)`.
- Scope nested block: `--lc-surface-sunken` bg; nested radius `var(--lc-radius-md)`.
- Consent chip: `--lc-surface-sunken` bg + `--lc-text-primary` ink + `Paperclip` icon.
- Consent-missing danger chip: `--lc-status-danger-bg` + `--lc-status-danger-fg` + `AlertTriangle` icon + label "No consent on file".
- Primary CTA fill `--lc-action-primary`; hover DARKENS to `--lc-action-primary-hover`. Never lightens.
- FAB (mobile): 56×56 circle, `--lc-action-primary`, `--lc-elevation-lg`, `Plus` icon in `--lc-action-primary-text`.
- Dialog / Sheet elevation `--lc-elevation-lg`.
- Stepper: active pill `--lc-action-primary` + white icon; completed `--lc-accent-bold` + check; upcoming `--lc-surface-sunken` + `--lc-text-muted`. Connector line `--lc-border`.
- Countdown chip ("5 months left"): `<Numeric>` primitive; `var(--lc-type-data-sm)`.
- Focus rings: two-tone via base CSS — do not override.
- Motion: stepper transitions `--lc-duration-slow` (240ms) `--lc-easing-out`; toast in `--lc-duration-fast` (120ms); button hover `--lc-duration-fast`; NO emphasis easing (reserved for broadcast moment).
- Radii: cards `var(--lc-radius-lg)`; nested scope block `var(--lc-radius-md)`; inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`; ribbon `var(--lc-radius-md)`; badges `var(--lc-radius-sm)`.
- Numeric fields: every price, date range, countdown, bedroom range — wrapped in `<Numeric>` for IBM Plex Mono + tabular-nums.
- Redacted card: `background: var(--lc-surface-sunken)`, `opacity: 0.85`, `cursor: default`, `pointer-events: none` on inner content (except tooltip hover on the card itself).

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster contact relationships editor screen (AGT-CTC-007) — MENA real-estate B2B SaaS. The screen lets an agent formalize and manage representation / mandate / affinity relationships with a contact — party type on the other side (buyer/seller/landlord/tenant), exclusivity (exclusive/non-exclusive), scope (areas + property type + price range + subjects), start/end dates, and a mandatory consent record with evidence attachment. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast design tokens (--lc-* semantic).

First pass: render the desktop 1440px layout for contact "Sara Al-Mansoori" with three relationship cards in the "My relationships" section (see Sample content) and one redacted card in the "Other agencies representing this contact" section. Sticky contact context header at top. "+ Add relationship" button in Section 1 header. Empty state NOT shown for this first pass.

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, the add-relationship stepper dialog, the contested-exclusivity modal, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Use Broadcast tokens for all colors — never raw hex. Numerals in IBM Plex Mono via <Numeric>. Status pills always tint + dot + label. Every 44px tap floor + two-tone focus ring is automatic via the design system — don't override.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the "Add relationship" dialog OPEN at Step 3 (Scope + dates). Sample: relationship_type=representation, party_type=buyer, exclusivity toggle currently on Exclusive with the inline warning banner showing (client-anticipated collision with the redacted Section 2 exclusive). Areas: Dubai Marina + JBR. Type: apartment. Price: AED 1,200,000–2,400,000. Start 2026-09-08. End 2027-03-08.`
2. `Now show Step 4 (Consent record) with method="signed_document", summary field filled, evidence attachment showing "signed_mou_2026_09_08.pdf · 2.4 MB" chip, "Send confirmation link to contact" checkbox ON. Save button enabled.`
3. `Now show the Contested-exclusivity modal open OVER the Add-relationship dialog Step 3. Contact name Sara Al-Mansoori. Three option buttons: Save as non-exclusive · Save as pending · Cancel.`
4. `Now the mobile 375px viewport. Same populated state as pass 1. Sticky header condensed, cards full-width, "+ Add relationship" is a floating FAB bottom-right.`
5. `Now the mobile Add-relationship Sheet (bottom, full-height) at Step 1 — Type choice with three radio cards.`
6. `Now the empty state — no relationships in Section 1, illustration + "+ Add first relationship" CTA.`
7. `Now RTL Arabic desktop layout at 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout.`
8. `Now dark mode versions of the desktop LTR populated state and the mobile LTR populated state.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGT-CTC-007/` + screenshot to `docs/design/mockups/AGT-CTC-007-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states (desktop populated, Step 3 add-dialog, Step 4 add-dialog, contested-exclusivity modal, mobile populated, mobile add-sheet Step 1, empty state, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/AGT-CTC-007-<state>.png`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-CTC-007/`.
- [ ] Cursor Wave-Week-8 dispatch prompt references this brief + the mockup paths.
- [ ] `[BE-BLOCKER-08]` filed in kickoff §5a — contact_relationships CRUD routes (7 endpoints) + cross-tenant visibility gating + HMAC token variant reusing SHR-AUT-005d infrastructure.
- [ ] AGT-CTC-002 (contact detail) brief updated to reference the new Relationships tab entry point.
- [ ] Companion mini-brief AGT-CTC-007b (public consent-confirmation landing page) flagged as follow-up.
- [ ] `no-raw-hex.test.ts` stays green after implementation.
- [ ] RTL sweep test extended with AGT-CTC-007 scenario in `screens.rtl.test.tsx`.
- [ ] Real-Postgres integration test verifies at least the full add → confirm → active transition, and one contested-exclusivity 409 branch.
