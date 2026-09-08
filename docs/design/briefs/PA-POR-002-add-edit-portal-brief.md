# Screen Brief — PA-POR-002 · Add / edit portal (delta to PA-POR-001)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the Broadcast alignment section, PA console shell context, env-scoping conventions, PA-POR family invariants, and reusable component names from `PA-POR-001-portal-list-brief.md`. Read that anchor brief first; THIS brief specifies only the delta — the portal detail-form surface with three modes (view / edit / create) and the two-person-rule activation flow.

Wave 6 (Week 6 — Two-person-rule UI + PA-PKG-* admin + PA-POR-* portal admin) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §6. Same PR as PA-POR-001 + PA-POR-003.

---

## Broadcast alignment

**Inherits from `PA-POR-001-portal-list-brief.md` §Broadcast alignment + §Broadcast alignment callouts** — do not re-specify base tokens. Delta-specific callouts only:

- **Detail-form shell.** Two-column layout on desktop 1440px: left column 800px form area on `var(--lc-surface-raised)` with `var(--lc-elevation-sm)` + `var(--lc-radius-lg)`; right column 380px sticky preview panel on `var(--lc-surface-sunken)` showing how the portal appears in AGT-CHN-001 portal picker + AGT-INB-005 source badge + AGT-PUB tracker card. `var(--lc-space-2xl)` gap between columns.
- **Mode banner (sticky top of form area).** Read mode: no banner. Edit mode: thin `var(--lc-status-warning-bg)` strip with `Pencil` icon + copy "Editing {display_name} — changes create a new registry version. Activation flips still require two-person approval."; strip height 32px. Create mode: thin `var(--lc-accent-bold-edge)`-outlined `var(--lc-surface-raised)` strip with `Plus` icon + copy "New portal — a STUB row is created immediately on save; activation requires an adapter file and a second admin's approval."
- **Section headers within the form** (Identity / Coverage / Adapter / Validators / Metering / SLA / Activation): `var(--lc-type-heading-3)` (600 18/24) with a small `--lc-text-muted` helper line beneath explaining what fields in that section govern. Section separator: `border-top: 1px solid var(--lc-border)` above each subsequent section; `var(--lc-space-xl)` top margin.
- **Field labels:** ALWAYS visible above the input (never placeholder-only per Broadcast rule). Label `var(--lc-type-body-sm)` bold; helper text `var(--lc-type-caption)` `var(--lc-text-muted)`.
- **Input primitives:** `<Input>` for single-line, `<Textarea>` for description, `<Select>` for single-choice, headless `<Combobox>` multi-select for country codes, `<JSONBEditor>` (custom Monaco-based editor with schema validation — see §Component palette) for `publisher_config` + `inbound_config`.
- **Immutable-field styling (code field in edit mode):** input renders read-only with `--lc-surface-sunken` fill, `--lc-text-muted` text, `Lock` lucide icon suffix. Helper text: "Portal code is immutable — changing it would break metering event keys and feature registration."
- **Publisher-config + Inbound-config JSONB editor:** custom code editor with syntax highlighting via `--lc-code-*` tokens (falls back to `--lc-surface-sunken` gutter + `--lc-text-primary` body if code-tokens not in kit); schema-driven validation errors surface inline with `AlertCircle` icon + `--lc-status-danger-fg`. Config schema per adapter is discovered from the adapter file (see §Backend contract `GET /api/admin/portals/adapters/:className/schema`). If no schema available (STUB row with adapter not yet shipped): editor allows free-form JSON with a warning banner "Config schema not yet available — validation will run on adapter ship."
- **Credentials-adjacent config safety.** `publisher_config` fields whose schema declares `format: "secret_ref"` (e.g. `api_key_ref`, `oauth_secret_ref`) render as text inputs with a `Key` lucide icon prefix and a helper `"Store the actual secret in the secrets manager; enter only the reference key here (e.g. secrets/pf/ae/api_key)."`. NEVER accept the raw secret in the JSONB — server rejects with 400 if the value looks like a secret (heuristic: >32 chars with no `/` delimiter).
- **Logo upload cell:** 96×96 dropzone with dashed `--lc-border-strong` border, `Upload` lucide icon centered, "Drop SVG or PNG (max 200KB, min 64×64)". Uploaded logo previews in place at `var(--lc-radius-md)`. Right-side "Remove" ghost button on hover.
- **Country multi-select combobox:** `<Combobox>` with country flag + display name + ISO code per option; selected countries render as chips within the input with an `X` remove-affordance per chip. `var(--lc-border-strong)` border; `var(--lc-radius-md)`.
- **Validator ruleset dropdown:** `<Select>` listing available validator files from `backend/src/lib/portal-validators/*.js` discovered at build time. Each option shows the filename + a badge indicating LIVE (file exists AND exports `validate()`) or STUB (file missing OR exports missing). Selected validator ref stored as relative path.
- **Metering section (read-only).** Displays the auto-registered feature code `PUBLISHING_REALESTATE_{CODE_UPPERCASE}` in `var(--lc-type-data)` (mono) with a `Copy` icon button; helper text "Feature auto-registers when portal is activated. Per-country pricing configured in PA-PKG-002 with country_code dimension." No editable inputs — this section is informational.
- **SLA section.** Single numeric input `<Input type="number" min="1" max="72">` labeled "SLA target (hours)" with a helper "Per-portal PA-MOD-001 moderation SLA. Bayut standard 4h · Property Finder 6h · Dubizzle 8h. Override at portal renegotiation."
- **Activation section (BOTTOM of form, visually distinct).** `background: var(--lc-status-warning-bg-subtle)` (falls back to `--lc-surface-sunken` if warning-bg-subtle not in kit), `border: 1px solid var(--lc-status-warning)`, `var(--lc-radius-md)`, `padding: var(--lc-space-lg)`. Contains: `is_active` toggle (READ-ONLY — displays current state), `effective_from` date input, "Request activation" primary CTA (submit half of two-person-rule) OR "Request deactivation" outline CTA depending on current state. On the approver side, if the current PA is DIFFERENT from the submitter and the portal has a pending activation request, additional "Approve activation" + "Reject request" buttons appear here.
- **Preview panel (right column, sticky).** Card stack showing three preview surfaces:
  1. AGT-CHN-001 portal-credentials picker card — how this portal looks in the agent's channel-connect picker (logo + display_name + country chips + short description).
  2. AGT-INB-005 source-badge preview — the badge that appears on inbox conversations sourced from this portal.
  3. AGT-PUB tracker preview — mini card showing "Publishing to {display_name}" with SLA countdown chip.
- **Save-bar (sticky bottom of form area).** `background: var(--lc-surface-raised)`, `border-top: 1px solid var(--lc-border)`, `padding: var(--lc-space-md) var(--lc-space-xl)`. Left: "Discard changes" ghost link (only visible when form is dirty). Right: "Save as new version" primary CTA + "Save and request activation" secondary primary CTA (only in create mode + edit mode; in view mode this bar is absent).

---

## Meta

| | |
|---|---|
| Screen ID | PA-POR-002 |
| Screen name | Portal detail (view / edit / create) |
| Persona | PA (Platform Admin — read requires `portal-registry-read`; edit + save-new-version requires `portal-registry-write`; activation flip requires `portal-registry-activate`) |
| Device targets | Desktop 1440px ONLY (inherited from PA-POR-001) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/portals/new` (create mode) · `/admin/portals/:code` (view mode) · `/admin/portals/:code/edit` (edit mode) |
| Current state | MISSING. Depends on `[BE-DESIGN-01]` `portal_registry` CRUD routes + `[BE-VERIFY-11]` adapter-file-existence check + `[BE-VERIFY-13]` logo asset upload pipeline. |
| Workflow role | Portal-catalog CRUD + activation two-person-rule submit/approve pair |
| Backend prerequisites | Same as PA-POR-001 + additionally: `POST /api/admin/portals`, `PATCH /api/admin/portals/:code`, `POST /api/admin/portals/:code/activate`, `POST /api/admin/portals/:code/activate/approve`, `POST /api/admin/portals/:code/deactivate` (+ /approve), `POST /api/admin/portals/:code/deprecate`, `POST /api/admin/portals/logo-upload`, `GET /api/admin/portals/adapters/:className/schema`. See §Backend contract. |
| Cluster | Wave 6 (Week 6) — same PR as PA-POR-001 + PA-POR-003 |

---

## Purpose

Platform Admin creates a new portal catalog entry, views an existing portal's full configuration, edits fields to produce a new registry version, uploads a portal logo, or initiates a two-person-rule activation / deactivation flip.

Three modes, one screen:

- **CREATE (`/admin/portals/new`)** — blank form. On save, creates a new `portal_registry` row with `is_active=false` and adapter_status derived from adapter-file check. If adapter file exists → STUB or LIVE per contract-satisfaction check; otherwise STUB. Row lands in PA-POR-001 catalog immediately, discoverable + editable.
- **VIEW (`/admin/portals/:code`)** — all fields render read-only. Preview panel populated. Save-bar absent. "Edit" affordance in the header (requires `portal-registry-write`). "Request activation" / "Request deactivation" in Activation section (requires `portal-registry-activate`).
- **EDIT (`/admin/portals/:code/edit`)** — all fields editable EXCEPT `code` (immutable). On save, creates a new `portal_registry_versions` row and updates the current row's `updated_at` + `current_version`. Preview panel updates live as fields change (debounced 200ms).

The activation two-person-rule flow works like PA-APR-003 pattern: submitter drafts the change (edits `is_active` intent in the Activation section + writes activation notes + clicks "Request activation") → the row enters `pending_activation` state visible to all `portal-registry-activate` PAs in a new "Pending activation" filter on PA-POR-001 → a DIFFERENT PA opens PA-POR-002 for this row and sees "Approve activation" + "Reject request" buttons in the Activation section → approval triggers step-up (SHR-MFA-007) + fires the actual flip and writes to PA-POR-003 history.

Success outcome: portal registry row created / updated / activated / deactivated / deprecated with immutable audit trail. Adapter-file gate enforced server-side (`is_active=true` refused when adapter absent). Metering feature auto-registers on activation. Downstream consumers (AGT-CHN-001 picker, AGT-PUB tracker, PA-MOD-001 filter dropdown, `credits/features.js`) reload their portal cache on activation event.

---

## Design goals (delta over PA-POR-001)

1. **Field density with breathable sections.** Portal detail has ~20 fields; grouping into 7 sections with clear headers + helper copy keeps cognitive load low.
2. **Adapter separation is a first-class concept.** The Adapter section makes it OBVIOUS that adding a portal row does not deploy code — the class-name field references a file that ships separately. Server-side gate prevents activation until file exists.
3. **JSONB editors are safe by construction.** Schema-driven validation, secret-ref helper hints, and a heuristic against pasting raw secrets prevent the most common credential-leak footgun.
4. **Two-person rule is visually inescapable.** Activation section styled with warning color; submit CTA phrased as "Request" not "Activate"; approve-side only appears for a different PA than the submitter.
5. **Preview panel proves the change lands correctly downstream.** Live preview of AGT-CHN + AGT-INB + AGT-PUB surfaces catches display_name typos, wrong country coverage, and logo issues before they hit agents.

---

## Layout (delta over PA-POR-001)

### Desktop 1440px

Two-column layout inside the PA console shell:

**Header block (sticky under top bar + optional TEST strip):**
- Left: breadcrumb "Portal registry / {display_name}" (link back to PA-POR-001 preserving `return_to`) + page title.
  - Create mode title: "Add portal"
  - View mode title: "{display_name}" (large) + code monospaced (`var(--lc-type-data-sm)`) + adapter-status badge + active-status badge inline
  - Edit mode title: "Edit {display_name}"
- Right (view mode only): `View activation history` outline button (opens PA-POR-003), `Edit` primary CTA (requires write cap).
- Right (edit mode only): `Discard` ghost link (if dirty) — separate from bottom save-bar to give a top-of-page exit affordance.

**Mode banner (sticky under header, conditional per mode).**

**Left column (form area, 800px):**

Section 1 — **Identity**
- Fields: `code` (create: editable + validated to match `/^[a-z][a-z0-9_]{2,63}$/`; view/edit: read-only), `display_name` (required), `description` (optional textarea, max 500 chars), `logo` (upload dropzone).

Section 2 — **Coverage**
- Fields: `country_codes` (multi-select combobox, ≥1 required), `primary_language` (single-select — `en` / `ar` / `fr` / `other`).

Section 3 — **Adapter**
- Fields: `adapter_class_name` (single-select fed from discovered adapter files at `backend/src/lib/notifications/portals/*.js`; also allows free-text for a not-yet-shipped adapter — validated as `portals/<snake>.js` path), `publisher_config` (JSONB editor, schema-driven from adapter), `inbound_config` (JSONB editor, schema-driven).
- Helper: "Adapter file must exist and export the PortalPublisher contract before this portal can be activated. New adapter? Draft the row here (STUB), ship the file via Cursor, then activate."

Section 4 — **Validators**
- Fields: `validator_ref` (single-select fed from `backend/src/lib/portal-validators/*.js`, badge LIVE/STUB per file existence).
- Helper: "Per-portal validator ruleset — runs PRE-queue-render in PA-MOD-001 + server-side pre-approve. See PORTAL_LIST_RESEARCH §C for the per-portal spec."

Section 5 — **Metering (read-only)**
- Feature code display: `PUBLISHING_REALESTATE_{CODE_UPPERCASE}` in mono with Copy button.
- Helper: "Feature auto-registers via credits/features.js when portal is activated. Per-country pricing (country_code dimension on metered event) configured in PA-PKG-002."

Section 6 — **SLA**
- Field: `sla_hours` (numeric 1-72, default 8).
- Helper: "PA-MOD-001 moderation SLA target. Overriding this on an active portal takes effect on next-submitted item; in-flight submissions keep their original SLA."

Section 7 — **Activation** (warning-styled block, bottom of form)
- Fields: `is_active` (read-only display + toggle preview of intent when submitter drafts a request), `effective_from` (date input, defaults to now).
- Copy varies by state:
  - Portal is Inactive + no pending request → CTA "Request activation" (submit half of two-person rule).
  - Portal is Active + no pending request → CTA "Request deactivation" (submit half of two-person rule).
  - Portal has pending request + current PA IS the submitter → info block "You submitted an activation request on {timestamp}. Waiting on a second admin to approve." + "Withdraw request" outline button.
  - Portal has pending request + current PA is NOT the submitter → "Approve activation" primary CTA + "Reject request" outline button + preview of the intent + submitter identity + submitter notes.
  - Portal is Inactive + has `is_active=false` AND `is_active_at IS NULL` (never activated) → additional "Deprecate portal" red-tinted outline button (permanent-ish; sets `deprecated_at`).

**Save-bar (sticky bottom of form area, only in create + edit modes):**
- Left: `Discard changes` ghost link (dirty-state).
- Right: `Save as new version` primary CTA + (optional, when Activation section has a request drafted) `Save and request activation` primary CTA (bundles the save + activation-request into one submit).

**Right column (preview panel, 380px, sticky):**
- Card 1: "In AGT-CHN-001 portal picker" — mini card showing logo + display_name + country chips + description (first 80 chars).
- Card 2: "In AGT-INB-005 source badge" — small badge showing portal name as it would render in an inbox row.
- Card 3: "In AGT-PUB tracker" — mini card "Publishing to {display_name}" with SLA countdown chip preview.

Preview panel updates live as the form changes (debounced 200ms).

### Below-min-viewport fallback (<1024px)

Same as PA-POR-001 — "PA console requires a desktop screen (1024px or wider)."

---

## Explicit copy (English, delta only — inherits PA-POR-001 copy where shared)

| Slot | Copy |
|---|---|
| Breadcrumb prefix | Portal registry |
| Create — page title | Add portal |
| Edit — page title template | Edit {displayName} |
| View — edit CTA | Edit |
| View — history CTA | View activation history |
| Discard changes (top + bottom) | Discard changes |
| Mode banner — edit | Editing {displayName} — changes create a new registry version. Activation flips still require two-person approval. |
| Mode banner — create | New portal — a STUB row is created immediately on save; activation requires an adapter file and a second admin's approval. |
| Section — identity | Identity |
| Section helper — identity | The public-facing name and code for this portal. Code is immutable after creation. |
| Field label — code | Portal code |
| Field helper — code (create) | Lowercase letters, digits, and underscores. 3-64 chars. e.g. `property_finder_ae`. |
| Field helper — code (edit) | Portal code is immutable — changing it would break metering event keys and feature registration. |
| Field label — display name | Display name |
| Field helper — display name | Shown to agents in AGT-CHN-001 portal picker + AGT-PUB tracker + PA-MOD-001 filters. |
| Field label — description | Description |
| Field helper — description | Optional. 0-500 chars. Shown in AGT-CHN-001 picker card. |
| Field label — logo | Logo |
| Field helper — logo | SVG or PNG, max 200KB, min 64×64. Displayed at 32×32 in the catalog + 20×20 in inbox source badges. |
| Logo dropzone empty | Drop SVG or PNG (max 200KB, min 64×64) |
| Logo remove button | Remove |
| Section — coverage | Coverage |
| Section helper — coverage | Countries this portal operates in. Multiple countries allowed for pan-regional portals (e.g. OLX MENA). |
| Field label — country codes | Country codes |
| Field helper — country codes | ISO 3166-1 alpha-2. Add ≥1. Metered event carries country_code dimension per PORTAL_LIST_RESEARCH §132 Option 2. |
| Field label — primary language | Primary language |
| Section — adapter | Adapter |
| Section helper — adapter | Publisher and inbound adapter class — the code file that translates WingCaster listings to/from the portal's API. |
| Field label — adapter class | Adapter class name |
| Field helper — adapter class | Path relative to backend/src/lib/notifications/. If the file doesn't exist yet, this row becomes a STUB — activation requires the adapter to ship first. |
| Adapter file status — live | Adapter file present, contract satisfied |
| Adapter file status — stub | Adapter file missing OR contract unmet (must export publish() + receiveInbound()) |
| Field label — publisher config | Publisher config (JSON) |
| Field helper — publisher config | Schema loaded from adapter file. Store secrets in the secrets manager and reference them here as `secrets/…/…` paths. |
| Field label — inbound config | Inbound config (JSON) |
| Field helper — inbound config | Webhook secret refs, email-forward addresses, inbound polling intervals. Same secret-ref rule. |
| Secret-ref helper | Store the actual secret in the secrets manager; enter only the reference key here (e.g. `secrets/pf/ae/api_key`). |
| Secret-in-jsonb error | Looks like a raw secret. Store the value in the secrets manager and enter its reference path here. |
| Section — validators | Validators |
| Section helper — validators | Per-portal validation ruleset — enforces portal-specific required fields (trakheesi number, broker license, photo counts). |
| Field label — validator ref | Validator ruleset |
| Field helper — validator ref | Points at backend/src/lib/portal-validators/<code>.js. See PORTAL_LIST_RESEARCH §C for per-portal rules. |
| Validator status — live | Validator file present, exports validate() |
| Validator status — stub | Validator file missing — activation blocked until it ships |
| Section — metering | Metering |
| Section helper — metering | Auto-registered metered feature on activation. Per-country pricing lives in PA-PKG-002. |
| Field label — feature code | Feature code |
| Feature code helper | Auto-generated from portal code. Reads: `PUBLISHING_REALESTATE_{CODE_UPPERCASE}`. |
| Copy button aria-label | Copy feature code |
| Section — sla | SLA |
| Section helper — sla | PA-MOD-001 moderation target. Sets `publisher_config.sla_hours` on the current version. |
| Field label — sla | SLA target (hours) |
| Field helper — sla | Bayut standard 4h · Property Finder 6h · Dubizzle 8h. Override at portal renegotiation. |
| Section — activation | Activation |
| Section helper — activation | Activation flips require two-person approval. A different admin than the submitter must approve. |
| Field label — is_active display | Current state |
| Field label — effective from | Effective from |
| Field helper — effective from | Date the activation change takes effect. Defaults to now. |
| CTA — request activation | Request activation |
| CTA — request deactivation | Request deactivation |
| CTA — withdraw request | Withdraw request |
| CTA — approve activation | Approve activation |
| CTA — approve deactivation | Approve deactivation |
| CTA — reject request | Reject request |
| CTA — deprecate | Deprecate portal |
| Deprecate confirm modal title | Deprecate {displayName}? |
| Deprecate confirm modal body | Deprecation marks this portal as retired. Existing publishes complete; no new publishes are accepted. This can be reversed by editing the portal and clearing the deprecated_at field, but downstream systems may take time to re-register. |
| Deprecate confirm CTA | Deprecate |
| Deprecate cancel | Cancel |
| Save bar — save as new version | Save as new version |
| Save bar — save and request activation | Save and request activation |
| Save bar — discard | Discard changes |
| Save success toast | Saved {displayName} as version {N}. |
| Save + request success toast | Saved {displayName} and requested activation. Waiting on a second admin. |
| Approve success toast | Approved activation of {displayName}. Portal is now Active. |
| Reject success toast | Rejected the activation request for {displayName}. |
| Withdraw success toast | Withdrew the activation request for {displayName}. |
| Adapter-missing activation-block toast | Can't activate — adapter file `{adapterClass}` is missing. Ship it via Cursor first. |
| Validator-missing activation-block toast | Can't activate — validator file `{validatorRef}` is missing. Ship it first. |
| Own-submission block | You can't approve your own activation request. A different admin must approve. |
| Preview — chn header | In AGT-CHN-001 portal picker |
| Preview — inb header | In AGT-INB-005 source badge |
| Preview — pub header | In AGT-PUB tracker |
| Unsaved-changes leave prompt | You have unsaved changes. Leave anyway? |
| Unsaved leave — confirm | Leave |
| Unsaved leave — cancel | Stay |

---

## Component palette (delta only)

| Element | Primitive |
|---|---|
| Breadcrumb | Custom `<nav>` with links + `ChevronRight` separator |
| Mode banner | Custom `<div>` with icon + `--lc-status-warning-bg` or `--lc-accent-bold-edge` outline |
| Section header | plain `<h2>` with `--lc-type-heading-3` + helper `<p>` |
| Section separator | `border-top: 1px solid var(--lc-border)` |
| Text input | `Input` + `Label` (always visible) |
| Description | `Textarea` |
| Logo upload | Custom `<Dropzone>` with drag-drop + click-to-select + preview |
| Country multi-select | Headless `Combobox` (from `@headlessui/react` or the shadcn combobox recipe) with per-option flag + name + ISO |
| Primary language | `Select` |
| Adapter class select | `Select` with LIVE/STUB badge per option; free-text fallback via "Not listed? Enter path" toggle |
| Publisher-config JSONB editor | Custom `<JSONBEditor>` — Monaco Editor lite (imported from `@monaco-editor/react`) with JSON language + schema validation |
| Inbound-config JSONB editor | Same |
| Validator ref select | `Select` with LIVE/STUB badge |
| Feature code display | `<Numeric as="code">` + `Copy` icon Button |
| SLA input | `Input type="number"` |
| Activation section | Custom card with warning styling |
| Effective-from date | `Input type="date"` OR shadcn `DatePicker` |
| Request activation CTA | `Button variant="default"` |
| Request deactivation CTA | `Button variant="outline"` |
| Approve activation CTA | `Button variant="default"` (only for non-submitter) |
| Reject request CTA | `Button variant="outline"` |
| Deprecate CTA | `Button variant="destructive"` |
| Deprecate confirm modal | `AlertDialog` |
| Save-bar | Custom sticky `<div>` at bottom of form area |
| Preview panel cards | `Card` primitive; three cards stacked |
| Live preview updates | React state debounced 200ms feeds preview components |
| Unsaved-changes prompt | `AlertDialog` triggered by `beforeunload` + in-app navigation guard |
| Toast | `Sonner` toast |
| Icons | `lucide-react` — `Pencil`, `Plus`, `Lock`, `Upload`, `Key`, `Copy`, `AlertCircle`, `ChevronRight`, `X`, `Info` |

---

## Sample content (for v0 / mockup)

**Pass 1 — VIEW mode, Property Finder AE (existing LIVE portal):**
- Env: LIVE badge in top bar.
- Breadcrumb: "Portal registry / Property Finder AE".
- Header: title "Property Finder AE" + code `property_finder_ae` monospaced + LIVE adapter badge + Active status badge inline; right side `View activation history` + `Edit` primary CTA.
- Identity section: code `property_finder_ae` (read-only, Lock icon), display name "Property Finder AE", description "Property Finder UAE — flagship agent portal for Dubai + Abu Dhabi listings.", logo shown at 96×96.
- Coverage: country_codes chip [🇦🇪 AE], primary_language `en`.
- Adapter: `portals/property_finder.js` LIVE, publisher_config JSONB pretty-printed showing `{ "sla_hours": 6, "endpoint_env": "prod", "auth_secret_ref": "secrets/pf/ae/api_key" }`, inbound_config `{ "webhook_secret_ref": "secrets/pf/ae/webhook", "email_forward": "leads-pf-ae@in.wingcaster.io" }`.
- Validators: `portal-validators/property_finder.js` LIVE.
- Metering: feature code `PUBLISHING_REALESTATE_PROPERTY_FINDER_AE` + Copy button.
- SLA: 6 hours.
- Activation section: state "Active"; effective_from "2026-06-14"; CTA "Request deactivation" outline.
- Preview panel populated with all three cards.

**Pass 2 — CREATE mode:**
- Blank form. Mode banner visible. Save-bar at bottom shows `Save as new version` disabled until required fields filled.

**Pass 3 — EDIT mode, Bayut UAE STUB with pending activation request from a different PA:**
- Mode banner "Editing Bayut UAE — changes create a new registry version…"
- Adapter section: `portals/bayut.js` STUB badge, publisher-config JSONB free-form (no schema loaded), warning banner "Config schema not yet available — validation will run on adapter ship."
- Activation section: state "Inactive" · pending request from admin "Karim Nasr" ("Ready to activate — adapter shipped in PR #67, validator shipped in PR #68") · Approve activation primary CTA + Reject outline (current PA is different from Karim).

Do NOT fabricate portal secrets. Use placeholder secret refs only (`secrets/…/…`).

---

## Interactions (delta only)

**On mode entry:**
- View mode: fetch `GET /api/admin/portals/:code`. Render all fields read-only. Preview panel populates.
- Edit mode: same fetch + enable form. Dirty tracking begins on first change.
- Create mode: blank form + dirty tracking on first change.

**On adapter class change:**
- Fetch `GET /api/admin/portals/adapters/:className/schema`. If schema returns: JSONBEditor loads schema for validation. If 404: JSONBEditor free-form with warning.
- Adapter status badge updates immediately from the discovered file existence.

**On JSONBEditor content change:**
- Parse JSON on debounce 300ms. Show inline errors for parse failures + schema violations.
- Heuristic-check every string value against secret-shape heuristic; flag with inline error if matched.

**On logo upload:**
- Client-side validate file type + size + dimensions. If pass: `POST /api/admin/portals/logo-upload` (multipart). On success: `logo_url` field populates + preview renders in place.

**On country chip add / remove:**
- Update `country_codes` state. Trigger live-preview refresh.

**On preview-panel refresh (debounced 200ms):**
- Preview components re-render with the current draft state.

**On Save (either variant):**
- If create mode: `POST /api/admin/portals` with the full form body. On 200: navigate to view mode at `/admin/portals/:code` with a success toast.
- If edit mode: `PATCH /api/admin/portals/:code` with the diff. On 200: refresh view mode; success toast.
- If "Save and request activation": bundle the save with a subsequent `POST /:code/activate` in one server transaction.

**On Request activation:**
- Requires `portal-registry-activate` capability.
- Requires SHR-MFA-007 step-up.
- Fires `POST /api/admin/portals/:code/activate` with `{ effective_from, submitter_notes }`. Row enters `pending_activation` state.
- Toast + reload form with pending state visible.

**On Approve activation:**
- Server-side guards: current PA ≠ submitter (own-submission block); adapter file exists; validator file exists; publisher_config schema-valid.
- Requires SHR-MFA-007 step-up.
- Fires `POST /:code/activate/approve` with `{ approver_notes }`.
- Row flips to `is_active=true`. Feature auto-registers via `credits/features.js`. Downstream caches invalidate. Toast + reload.

**On Reject activation:**
- Fires `POST /:code/activate/reject` with `{ rejection_reason, notes }`. Pending request cleared. Submitter notified via in-app inbox.

**On Withdraw request:**
- Fires `POST /:code/activate/withdraw`. Only the submitter can withdraw. Toast + reload.

**On Deprecate portal:**
- Requires portal already Inactive. AlertDialog confirms. On confirm: `POST /:code/deprecate`. Row shows `deprecated_at` timestamp; adapter_status → DEPRECATED.

**On Discard changes (top or bottom):**
- AlertDialog: "Discard unsaved changes?" Confirm → navigate back to view mode / list; Cancel → stay.

**On page-leave with unsaved changes:**
- `beforeunload` + in-app navigation guard triggers the unsaved-changes prompt.

**On env switch mid-edit:**
- Warn: "You have unsaved changes. Env switch will discard them." Confirm → discard + refetch; Cancel → stay.

---

## State variants (delta only)

| Variant | Trigger | Behavior |
|---|---|---|
| **View mode — Active** | Route `/admin/portals/:code` with is_active=true | Read-only form; Edit CTA + View history CTA in header; Activation section shows "Request deactivation". |
| **View mode — Inactive STUB** | is_active=false + adapter absent | STUB banners on Adapter + Validator sections; Activation section: "Request activation" CTA DISABLED with tooltip "Adapter file missing". |
| **View mode — Inactive with adapter present** | is_active=false + adapter LIVE | Activation section: "Request activation" CTA enabled. |
| **View mode — Pending activation (current PA is submitter)** | pending_activation + is_own=true | Info block + Withdraw button. Rest of form still read-only. |
| **View mode — Pending activation (current PA is approver)** | pending_activation + is_own=false | Approve activation primary CTA + Reject outline. |
| **Edit mode — clean** | Just entered edit mode, no changes yet | Save-bar Discard link hidden; Save buttons disabled. |
| **Edit mode — dirty** | Any field changed | Save-bar Discard link visible; Save buttons enabled. Preview panel live-updates. |
| **Edit mode — validation errors** | Field errors present | Save buttons disabled; error summary at top of form area listing invalid fields with anchor links. |
| **Create mode — empty** | Route `/admin/portals/new`, no fields filled | Save buttons disabled. |
| **Create mode — code taken** | Server 409 on save | Inline error on code field: "This portal code is already in use." |
| **Create mode — adapter-file check** | Adapter class name typed | Live adapter-status badge updates (LIVE / STUB). |
| **JSONBEditor — parse error** | Invalid JSON typed | Inline error at the malformed line; Save disabled. |
| **JSONBEditor — schema error** | Valid JSON but schema violation | Inline error per field; Save disabled. |
| **JSONBEditor — secret detected** | String value matches secret heuristic | Inline error "Looks like a raw secret…"; Save disabled until reverted or replaced with a `secrets/…` ref. |
| **Logo upload — success** | Upload 200 | Preview renders in place; remove button on hover. |
| **Logo upload — validation fail** | File too big / wrong type / too small | Inline error under dropzone. |
| **Request activation — adapter missing** | Server 400 | Toast "Can't activate — adapter file missing." |
| **Request activation — validator missing** | Server 400 | Toast "Can't activate — validator file missing." |
| **Request activation — step-up required** | 401 STEP_UP_REQUIRED | SHR-MFA-007 modal opens; retries request on success. |
| **Approve activation — own-submission** | is_own=true on approve attempt | Approve button hidden; tooltip "You can't approve your own activation request." |
| **Deprecate confirm — success** | POST 200 | Toast "Deprecated {displayName}"; view mode reloads with DEPRECATED badges. |
| **Env switch mid-edit** | PA-NAV-001 env change with dirty form | Unsaved-changes prompt fires. |
| **Insufficient permission — write** | PA has read but not write | Edit CTA disabled with tooltip; edit mode redirects to view mode. |
| **Insufficient permission — activate** | PA has write but not activate | Activation section CTAs disabled with tooltip; Save-and-request-activation button hidden. |
| **RTL** | Locale = ar | Two-column layout mirrors; JSONBEditor stays LTR (code is universally LTR). |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; JSONBEditor Monaco theme swaps to dark. |

---

## Accessibility (delta only)

- Every field label uses `htmlFor` tied to input `id`. Helper text via `aria-describedby`.
- JSONBEditor keyboard-navigable (Monaco native). Screen-reader announces line + column + error.
- Mode banner is `role="status"` with `aria-live="polite"`.
- Approve / Reject / Request activation CTAs announce their action + portal name via `aria-label`.
- Preview panel is `role="complementary"` with `aria-label="Portal preview across downstream surfaces"`.
- Save-bar sticky at bottom; keyboard-reachable via Tab.
- Unsaved-changes prompt traps focus + Esc = Cancel.
- Skip link at top jumps into first field (code in create; display_name in edit — first editable field).

---

## Anti-patterns (delta only)

- Do NOT accept the raw secret value in `publisher_config` / `inbound_config` JSONB. Always reference via `secrets/…/…` path.
- Do NOT allow `code` edit post-creation. Server rejects; UI locks the input.
- Do NOT allow the submitter to approve their own activation request. Server enforces; UI hides the button.
- Do NOT enable "Request activation" while adapter or validator is STUB. Server rejects; UI disables the button with a tooltip explaining why.
- Do NOT auto-save. Every save is explicit — dirty state is preserved on nav within the app; browser reload prompts.
- Do NOT bundle logo upload into the save transaction. Upload happens synchronously on drop; save writes the returned `logo_url`.
- Do NOT allow bulk portal creation from this form. Add-on-the-fly is one-at-a-time.
- Do NOT render the JSONBEditor with insufficient height (<200px) — schema violations become invisible.
- Do NOT expose adapter class file editing here. This form REFERENCES the adapter file by class name; the file itself ships via Cursor PR.

---

## Reference designs (delta only)

- **Stripe Dashboard → Product → New product** — clean multi-section form with sticky save-bar, live preview panel on right.
- **AWS console → IAM → Create role** — sectioned form with adapter/policy references + JSONB editing.
- **Vercel → Project settings → Environment variables** — secret-ref safety pattern (reference vault, not raw).
- **PA-PKG-002 add/edit package (WingCaster)** — direct sibling pattern for CRUD detail form.
- **PA-APR-003 action confirmation (WingCaster)** — two-person-rule submit/approve pair pattern.

---

## Backend contract (delta only)

**Create portal:** `POST /api/admin/portals`
```json
{
  "code": "aqar_sa",
  "display_name": "Aqar KSA",
  "description": "…",
  "logo_url": "/assets/portals/aqar_sa.svg",
  "country_codes": ["SA"],
  "primary_language": "ar",
  "adapter_class_name": "portals/aqar.js",
  "publisher_config": { … },
  "inbound_config": { … },
  "validator_ref": "backend/src/lib/portal-validators/aqar.js"
}
```
Response 201: full portal object per PA-POR-001 §Backend contract.
Response 409 `PORTAL_CODE_TAKEN` if `code` already in use.
Response 400 `INVALID_CODE_FORMAT` / `SCHEMA_VIOLATION` / `SECRET_IN_JSONB`.

**Update portal:** `PATCH /api/admin/portals/:code`
- Accepts partial body. `code` field rejected if present.
- Creates a new `portal_registry_versions` row on any config-shape change.
- Response 200 with updated portal object.

**Activate submit:** `POST /api/admin/portals/:code/activate` body `{ effective_from, submitter_notes }`.
Response 202 `PENDING_APPROVAL` with `pending_activation_id`.
Response 400 `ADAPTER_MISSING` / `VALIDATOR_MISSING` / `SCHEMA_INVALID`.

**Activate approve:** `POST /api/admin/portals/:code/activate/approve` body `{ approver_notes }`. Requires step-up.
Response 200 with updated portal (is_active=true).
Response 403 `OWN_SUBMISSION`.

**Activate reject / withdraw:** `POST /:code/activate/reject` / `.../withdraw` — same shape.

**Deactivate submit / approve:** parallel to activate.

**Deprecate:** `POST /:code/deprecate` — requires is_active=false. Sets `deprecated_at`.

**Logo upload:** `POST /api/admin/portals/logo-upload` multipart. Response `{ logo_url }`.

**Adapter schema lookup:** `GET /api/admin/portals/adapters/:className/schema`. Response 200 with JSON Schema for `publisher_config` + `inbound_config`; 404 if adapter absent.

**Prerequisites tracked / to file:**

- **`[BE-VERIFY-14] Adapter config schema exposure — NEW.** Adapter base class must expose static `configSchema` (JSON Schema) for its publisher_config + inbound_config shapes. Route `/api/admin/portals/adapters/:className/schema` reads it. ~1 day per adapter to add schema + 1 day to build the route. **File as new `[BE-VERIFY-14]` in kickoff §5a.**
- **`[BE-VERIFY-15] Two-person-rule activation state machine — NEW.** `portal_registry_pending_activations` table + state machine (draft → pending → approved/rejected/withdrawn). ~2 days backend. **File as new `[BE-VERIFY-15]` in kickoff §5a.**
- **`[BE-VERIFY-16] Downstream cache invalidation on activation — NEW.** On `is_active` flip, invalidate cached portal registry in `credits/features.js`, AGT-CHN-001 picker cache, PA-MOD-001 filter dropdown. Publish event on internal bus. ~1 day.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/portals/PortalDetailPage.tsx` — one component, three modes via route + query.
- **Route registration:** `<Route path="/admin/portals/new" element={<PortalDetailPage mode="create" />} />`, `<Route path="/admin/portals/:code" element={<PortalDetailPage mode="view" />} />`, `<Route path="/admin/portals/:code/edit" element={<PortalDetailPage mode="edit" />} />` — all behind `PAConsoleGuard`.
- **Component decomposition:**
  - `PortalDetailPage.tsx` — page shell + mode routing + data fetching + form state + dirty tracking + navigation guards.
  - `PortalDetailForm.tsx` — the seven sections rendered from a shared schema descriptor.
  - `PortalDetailPreviewPanel.tsx` — three preview cards fed by live form state.
  - `PortalActivationSection.tsx` — the warning-styled activation block with all state variants.
  - `PortalJSONBEditor.tsx` — Monaco wrapper with schema validation + secret heuristic.
  - `PortalLogoUploader.tsx` — dropzone + upload.
  - `PortalDetailSaveBar.tsx` — sticky bottom save bar.
- **Data layer:**
  - Hook: `usePortalDetail(code, mode)` — SWR/React Query pattern.
  - Hook: `useAdapterSchema(className)` — cached schema lookup.
  - Mutation helpers: `usePortalCreate`, `usePortalUpdate`, `usePortalActivate`, `usePortalActivateApprove`, `usePortalActivateReject`, `usePortalActivateWithdraw`, `usePortalDeprecate`, `usePortalLogoUpload`.
- **Test discipline:**
  - Unit: each sub-component + form state transitions + dirty tracking + unsaved-leave prompt.
  - Integration: create-full-portal happy path × edit-existing × activate-request → approve-by-different-PA × approve blocked by own-submission × approve blocked by missing adapter × deprecate confirm.
  - Real-Postgres: create → activate-request → approve E2E writes `portal_registry_versions` + `portal_activation_history` rows.
  - RTL + dark mode: form renders correctly.
  - Broadcast: `no-raw-hex.test.ts` stays green.
- **Copy/i18n:** `web/src/locales/en/paPortalDetail.json` + `ar/paPortalDetail.json`.

---

## Handoff instruction to v0

Framing prompt:

```
I'm designing the WingCaster PA portal detail screen (PA-POR-002) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the CRUD detail form for a portal registry row, with three modes (view / edit / create) and a two-person-rule activation flow. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Monaco Editor, all tokens Broadcast semantic (--lc-*).

First pass: VIEW mode for Property Finder AE (LIVE portal). Two-column layout — left 800px form area with 7 sections read-only, right 380px sticky preview panel with 3 preview cards. Sample data per the brief.

Follow the brief copy exactly. Do NOT fabricate secret values.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. VIEW mode Property Finder AE (LIVE, Active).
2. VIEW mode Bayut UAE STUB (pending activation from Karim Nasr; current PA is approver — show Approve + Reject buttons).
3. CREATE mode, blank form.
4. EDIT mode with dirty state + save-bar visible.
5. JSONBEditor validation-error state (secret-in-JSONB flagged).
6. Deprecate confirm modal open.
7. TEST env + RTL Arabic + dark mode passes.

Save to `docs/design/mockups/v0-outputs/PA-POR-002/`.

---

## Definition of done

- [ ] v0 has produced all 7 iteration states.
- [ ] Screenshots + JSX committed.
- [ ] Cursor Wave-6 dispatch prompt references PA-POR-001 + PA-POR-002 + PA-POR-003.
- [ ] `[BE-VERIFY-14..16]` filed in kickoff §5a.
