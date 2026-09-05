# Broadcast alignment reference for Screen Briefs

**Every Screen Brief in `docs/design/briefs/` inherits from this document.** When a brief says "colors", "fonts", "spacing", "motion", "radii", or "shadows", those references are governed by this file — NOT by any inline color/font/motion values that may still appear in a brief pre-dating Broadcast adoption (2026-08-13, merged 2026-09-04 via PR #41).

Source of truth: `docs/design-tokens/broadcast-theme.css` (127 CSS custom properties) + `docs/design-tokens/broadcast-tokens.json` (W3C DTCG, WCAG AA validated). Do NOT invent colors, fonts, radii, or motion values not in the kit.

---

## The one rule

**Every component reads `--lc-*` semantic tokens.** Never a raw hex. Never a `--lc-orange-600`-style primitive alias. The semantic tier is the only thing that follows the light/dark mode switch. Grep for `#[0-9a-fA-F]{3,8}` in any produced code should show ZERO hits outside `broadcast-theme.css`.

Enforced by `web/src/theme/no-raw-hex.test.ts` in CI.

---

## Colors — semantic tokens (light-mode values shown; dark mode values in the kit)

**Surfaces:**
- Page background: `var(--lc-bg-page)` → `#FAF8F7` warm off-white (dark: `#0C1533` cobalt)
- Card / raised surface: `var(--lc-surface-raised)` → `#FFFFFF` (dark: `#1C2749`)
- Table headers / wells: `var(--lc-surface-sunken)` → `#F2EFED` (dark: `#070C21`)
- Inverse blocks: `var(--lc-surface-inverse)` → `#191512`
- Hairline borders: `var(--lc-border)` → `#E6E1DD`
- Input borders / strong lines: `var(--lc-border-strong)` → `#CFC7C1`

**Text:**
- Body + data: `var(--lc-text-primary)` → `#0C1533` cobalt navy
- Section headings: `var(--lc-text-heading)` → `#1A2E77` cobalt (dark: `#FFFFFF`)
- Supporting copy: `var(--lc-text-secondary)` → `#1A2E77`
- Meta / labels / timestamps: `var(--lc-text-muted)` → `#5B6486`
- Links + inline emphasis: `var(--lc-text-brand)` → `#C93C08` broadcast orange
- Text on inverse surfaces: `var(--lc-text-inverse)` → `#FFFFFF`

**Actions:**
- Primary fill: `var(--lc-action-primary)` → `#C93C08` (dark: `#FF7440`) — Broadcast orange, may run LARGE (hero bands, section backgrounds)
- Primary hover: `var(--lc-action-primary-hover)` → `#A3320A` (dark: `#F0500F`) — always DARKER than default, never lighter (lighter = disabled)
- Primary text (ink on primary): `var(--lc-action-primary-text)` → `#FFFFFF` (dark: `#2A1206`)
- Primary scrim (recessed track inside primary surface): `var(--lc-action-primary-scrim)` → `#5C2010`
- Secondary fill: `var(--lc-action-secondary)` → `#F2EFED`
- Secondary text: `var(--lc-action-secondary-text)` → `#3E3733`

**Accent:**
- Teal signal: `var(--lc-accent)` → `#0A7A85` — SMALL only (chips, dots, live-broadcast lamp). Keep small next to orange or the focal point disappears.
- Accent bold: `var(--lc-accent-bold)` → `#0A7A85` — needs a boundary
- Accent bold text: `var(--lc-accent-bold-text)` → `#FFFFFF`
- Accent bold edge (its boundary; also the only accent legal as small text): `var(--lc-accent-bold-edge)` → `#0B626C`

**Focus (two-tone — never collapse to one outline):**
- Inner band: `var(--lc-focus-ring)` → `#0C1533`
- Outer band: `var(--lc-focus-ring-contrast)` → `#FFFFFF`
- Applied by base CSS via `box-shadow: 0 0 0 2px var(--lc-focus-ring), 0 0 0 4px var(--lc-focus-ring-contrast)` on `:focus-visible`. Do NOT override per component.

**Status tokens** — always tint + glyph + label; NEVER color alone:
- `var(--lc-status-{draft,published,underOffer,closed,archived,unpublished}-{bg,fg,dot})`
- Glyphs: draft ○ · published ● · underOffer ◐ · closed ◆ · archived ▢ · unpublished ✕

**Channel tokens** — chips / dots / 20-28px marks only; NEVER large surfaces, NEVER body text. Always pair with the matching `-on` ink:
- `var(--lc-channel-{instagram,whatsapp,messenger,facebook,tiktok,x,linkedin,olx})` + `-on`
- Polarity flips between light/dark automatically via the token kit

---

## Typography — Broadcast type scale

**Font families (Google Fonts, already loaded via `web/index.html`):**
- Display: `var(--lc-font-display)` → **Archivo** (weight 800, tracking -0.03em) — for headings ONLY, intentionally loud
- UI + body: `var(--lc-font-ui)` → **IBM Plex Sans** (400-700)
- Data + numerals: `var(--lc-font-mono)` → **IBM Plex Mono** (400-600) with `tabular-nums` ALWAYS ON

**Scale tokens (each has a matching `--lc-tracking-*` — apply alongside the shorthand):**
- `var(--lc-type-display-xl)` → `800 40px/44px Archivo` — screen hero, marketing
- `var(--lc-type-display)` → `800 32px/38px Archivo` — dashboard greeting, KPI value
- `var(--lc-type-heading-1)` → `600 26px/32px IBM Plex Sans` — screen title
- `var(--lc-type-heading-2)` → `600 21px/28px IBM Plex Sans` — section title
- `var(--lc-type-heading-3)` → `600 18px/24px IBM Plex Sans` — card title, listing address
- `var(--lc-type-body-lg)` → `400 16px/24px` — mobile body, descriptions
- `var(--lc-type-body)` → `400 15px/22px` — default UI text
- `var(--lc-type-body-sm)` → `400 13px/18px` — table cells, meta
- `var(--lc-type-caption)` → `500 12px/16px` — badges, timestamps
- `var(--lc-type-overline)` → `600 11px/14px + 0.08em tracking` — labels, column heads
- `var(--lc-type-data)` → `500 15px/20px IBM Plex Mono` — prices, counts
- `var(--lc-type-data-sm)` → `500 13px/18px IBM Plex Mono` — table numerics

**Numeric fields — every numeral** (price, count, percentage, ID, timestamp, area, beds, baths, credits, days) uses `--lc-font-mono` + `tabular-nums`. Enforced via the `<Numeric>` component at `web/src/components/ui/numeric.tsx` OR the `.lc-data` class OR the `data-lc-numeric` attribute. Any of the three hooks activates the base CSS rule.

**Arabic** — Broadcast v1 uses Archivo + IBM Plex Sans for both Latin and Arabic. Per architect-owner Arabic prompt review (2026-09-04), Arabic-first prompt engineering + Arabic-specific type stack (IBM Plex Sans Arabic) is Phase 2.

---

## Radii — tight on purpose

- `var(--lc-radius-sm)` → 3px
- `var(--lc-radius-md)` → 5px
- `var(--lc-radius-lg)` → 7px
- `var(--lc-radius-xl)` → 10px
- `var(--lc-radius-pill)` → 999px

**No 12-20px rounded cards anywhere.** If a design AI generates `border-radius: 16px`, that's a bug — replace with `var(--lc-radius-xl)`.

---

## Spacing — 4px base grid

- `var(--lc-space-3xs)` → 2px
- `var(--lc-space-2xs)` → 4px
- `var(--lc-space-xs)` → 8px
- `var(--lc-space-sm)` → 12px
- `var(--lc-space-md)` → 16px
- `var(--lc-space-lg)` → 20px
- `var(--lc-space-xl)` → 24px
- `var(--lc-space-2xl)` → 32px
- `var(--lc-space-3xl)` → 40px
- `var(--lc-space-4xl)` → 48px
- `var(--lc-space-5xl)` → 64px

---

## Elevation — offset, not blurred

- `var(--lc-elevation-sm)` → `2px 2px 0 rgba(25,21,18,0.10)`
- `var(--lc-elevation-md)` → `4px 4px 0 rgba(25,21,18,0.12)`
- `var(--lc-elevation-lg)` → `8px 8px 0 rgba(25,21,18,0.14)`

Hard-edged, poster-like. NOT soft blurred glow. If a design AI generates `box-shadow: 0 10px 20px rgba(0,0,0,0.1)`, that's wrong.

---

## Motion — duration + easing tokens

**Durations:**
- `var(--lc-duration-instant)` → 0ms — state flips with no spatial change
- `var(--lc-duration-fast)` → 120ms — hover, dot pulse, badge swap
- `var(--lc-duration-base)` → 180ms — theme + mode transition, tab change
- `var(--lc-duration-slow)` → 240ms — sheet, drawer, view switch
- `var(--lc-duration-deliberate)` → 320ms — full-screen route change

**Easings:**
- `var(--lc-easing-out)` → `cubic-bezier(0.2, 0.8, 0.2, 1)` — entering elements
- `var(--lc-easing-in-out)` → `cubic-bezier(0.4, 0, 0.2, 1)` — moving / resizing
- `var(--lc-easing-emphasis)` → `cubic-bezier(0.34, 1.4, 0.64, 1)` — publish / broadcast moment ONLY

**Respect `prefers-reduced-motion`.** Signal lamp (teal `--lc-accent-bold` dot pulsing at `--lc-duration-slow` on an orange surface) is reserved for the "live broadcast" moment on the home page + AGT-DSH-001 attention card when a listing just went live. Do NOT sprinkle it around.

---

## Interactive elements — 44px tap-target minimum

- `var(--lc-tap-target-min)` → 44px
- Applied by base CSS via `:where(button, a[role="button"], [role="button"]) { min-height: var(--lc-tap-target-min); }`
- Do NOT override down. Do NOT use `size="sm"` variants that shrink below 44px.

---

## Component palette — Broadcast-aware primitives

Use these primitives from `web/src/components/ui/*` (all migrated to Broadcast tokens as of PR #41):

- `<Button>` — variants: `default` (primary orange), `outline`, `secondary`, `ghost`, `link`, `destructive`. Every variant respects the two-tone focus ring + 44px min-height. Hover DARKER not lighter.
- `<Input>` with `<Label>` — Label ALWAYS visible, not placeholder-only. Input uses `--lc-border-strong` + `--lc-surface`.
- `<Card>` — `--lc-surface-raised` + `--lc-elevation-sm` OR none. Tight radii.
- `<Dialog>` — `--lc-elevation-lg`. Overlay uses `--lc-z-modal`.
- `<Dropdown>`, `<Tabs>`, `<Tooltip>`, `<Toast>` — all Radix primitives wrapped with Broadcast tokens.
- `<Badge>` — for status pills. Use with the required GLYPH + LABEL.
- `<ChannelMark>` — for social/portal channel icons. Pairs `--lc-channel-X` with `--lc-channel-X-on` ink. 20-28px only.
- `<Numeric>` — every numeric render. Activates mono + tabular-nums. Renders as `<span data-lc-numeric class="lc-data">` by default; override with `as="td"` / `as="dd"` / etc.
- `<ColorModeToggle>` — the light/dark/system cycler in the top nav.

**Icons:** `lucide-react`. Match the icon set already used across the app. For channel icons (Instagram, WhatsApp, etc.), use OFFICIAL provider SVGs, not Lucide's simplified versions.

---

## Anti-patterns — do NOT do (Broadcast-specific)

- Do NOT introduce raw hex colors in JSX / CSS. Guard: `no-raw-hex.test.ts`.
- Do NOT reference `--lc-orange-600` (primitive) — use the semantic alias `--lc-action-primary`.
- Do NOT paint teal `--lc-accent-bold` without a boundary (`--lc-accent-bold-edge` outline OR white ring when on primary orange).
- Do NOT collapse the two-tone focus ring to a single outline.
- Do NOT use un-aliased Tailwind palette classes (`bg-teal-500`, `bg-stone-100`, etc.) — either use the aliased ones (`bg-slate-*` → sunken surface, `bg-emerald-*` → published status, etc. — see `tailwind.config.js`) OR add the palette to the alias table in the same PR.
- Do NOT round any card to 12+ px. Broadcast is intentionally tight.
- Do NOT use soft/blurred shadows. Elevation is offset.
- Do NOT render a numeric value in the UI font. Every numeral → `<Numeric>`.
- Do NOT render a status only by color — always tint + glyph + label.
- Do NOT pair a channel-mark background with anything other than its matching `-on` ink (`--lc-channel-instagram` bg → `--lc-channel-instagram-on` fg).
- Do NOT lighten `--lc-action-primary-hover` — always darker than default.
- Do NOT use the signal lamp motif outside the "listing went live" moment.

---

## Downstream implementation notes (Cursor Code)

Every brief's implementation lands in `web/` on top of Broadcast (already merged via PR #41). No new tokens, no new fonts to load, no new mode-switching logic. Grep the codebase for the existing patterns:
- `<Button>`, `<Input>`, `<Card>`, `<Dialog>` etc. in `web/src/components/ui/*`
- `<Numeric>`, `<ChannelMark>`, `<ColorModeToggle>` — already-built Broadcast-specific primitives
- `useMode()` from `@/context/BrandContext` for light/dark/system mode
- `useBrand()` from `@/context/BrandContext` for tenant-specific brand overrides
- Tailwind class aliases in `web/tailwind.config.js` (colors are Broadcast tokens; the palette names may look Tailwind-standard but resolve to `--lc-*`)

Any specific per-brief implementation note takes precedence over this reference — the brief is the source of truth for what to build; this reference is the source of truth for HOW to style it.
