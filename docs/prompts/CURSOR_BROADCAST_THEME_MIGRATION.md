# Cursor dispatch — Broadcast theme migration in `web/`

**PR title:** `feat(web): migrate to Broadcast design theme (adopt --lc-* semantic tokens across every UI surface)`

**Base branch:** `main`

**Estimated effort:** 5-8 days of focused Cursor work + architect-owner review.

---

## 1. Why this PR

WingCaster has a formal design system: the **Broadcast** theme, adopted 2026-08-13. Source of truth lives at `docs/design-tokens/` (assets shipped as part of this PR — see §3.1). Currently the `web/` app runs on an older gold-and-ink legacy token set. This PR replaces the legacy system with Broadcast across every component and page — a foundational refactor that MUST land before any new-screen work is dispatched.

Broadcast is not a paint job. It is a validated design system with WCAG AA compliance across both light and dark modes, tabular numerics everywhere, tight radii, offset (not blurred) shadows, and a strict "components read semantic tokens only, never raw hex" contract. Getting this contract right is what makes light/dark, RTL, and per-tenant branding all work without per-screen rework later.

**Non-goals (explicit out of scope):**
- No per-screen mobile-first redesign (that's per-workflow-cluster work; happens after this).
- No Arabic RTL implementation (that's a separate workstream — the tokens already RTL-safe by construction).
- No new features, no refactors beyond the token substitution + shell wiring.
- No dependency changes beyond adding Google Fonts + (if truly needed) a `data-lc-mode` initializer utility.
- **Do NOT touch** `backend/**` — this is a frontend-only PR.
- **Do NOT touch** `docs/design/SCREEN_MATRIX_*.md` — those describe target-state UX, not current implementation.

---

## 2. Non-negotiables

Each of these exists because the alternative measured below WCAG AA during Broadcast authoring. Do not compromise them for shipping speed.

1. **Semantic-tier only.** Components read `var(--lc-action-primary)`, `var(--lc-surface-raised)`, etc. — never a raw hex, never `--lc-orange-600`-style primitive tokens. Grep for `#[0-9a-fA-F]{3,8}` in `web/src/**/*.{ts,tsx,css}` at end of PR; the only legitimate hits should be inside `broadcast-theme.css` itself (which you drop in unmodified) and inside SVG file contents (agency logos etc.).
2. **Numerals use `--lc-font-mono` with `font-variant-numeric: tabular-nums`.** Every price, count, percentage, ID, timestamp. The base stylesheet already implements `:where(.lc-data, [data-lc-numeric])`; use one of those hooks on every numeric span. No proportional digits anywhere.
3. **Two-tone focus ring.** The base stylesheet already implements `box-shadow: 0 0 0 2px var(--lc-focus-ring), 0 0 0 4px var(--lc-focus-ring-contrast)`. Do NOT collapse to a single `outline`. Do NOT override it with a custom focus style per component. Any component that currently overrides `:focus` must lose that override.
4. **44px minimum tap target on every interactive element.** The base stylesheet sets `:where(button, a[role="button"], [role="button"]) { min-height: var(--lc-tap-target-min); }`. Do NOT override down.
5. **Both light + dark modes must ship correct.** A token is only correct if it resolves in both. Test in both via `document.documentElement.setAttribute('data-lc-mode', 'dark')` — every screen must render without visual bugs.
6. **`--lc-action-primary-hover` is DARKER than default.** A lighter orange reads as disabled. If any hover style you add on top does the opposite (lightens on hover), that is a bug — the base rule is set by the token, not per-component.
7. **Status is never colour alone** — always tint + glyph + label. Glyphs: draft ○ · published ● · underOffer ◐ · closed ◆ · archived ▢ · unpublished ✕. Any existing status badge that uses colour-only must be updated with the matching glyph.
8. **Channel marks always take their matching `-on` ink.** White glyphs on dark-mode channel marks land 1.1:1 to 2.7:1 — a legibility failure. Pair every `--lc-channel-instagram` background with `--lc-channel-instagram-on` foreground, and so on for every channel.

---

## 3. Scope

### 3.1 Ship the token kit into the repo

Copy the following files (currently at `C:\Users\AliAchkar\Desktop\Wingcaster Design Tokens\`) into `docs/design-tokens/` in this PR:

- `broadcast-theme.css` — drop in **unmodified**. This becomes the app's stylesheet source of truth.
- `broadcast-tokens.json` — reference (source of truth for future regenerations)
- `listingclarion-all-themes.json` — reference only
- `README.md` — reference documentation for future contributors
- `wingcaster logo.svg`, `wingcaster logo.png`, `wingcaster logo.webp`, `wingcaster logo.ai` — brand assets

Move the logo assets into `web/public/brand/` so Vite serves them at `/brand/wingcaster-logo.svg` etc.

**Do not hand-edit `broadcast-theme.css`.** The README says: *"Change values at the source and regenerate. Never edit the CSS directly — it will be overwritten."* If you find you WANT to edit a value, stop the PR and flag it to the architect-owner.

### 3.2 Load the theme

- `web/src/index.css`: replace whatever token set is currently there. Import Broadcast CSS at the top of `index.css` (`@import '../../docs/design-tokens/broadcast-theme.css';` — or the equivalent Vite path resolution). Keep any global reset rules; delete any color/typography/spacing/radius rules that Broadcast now owns.
- `web/index.html`: add Google Fonts stylesheet link EXACTLY as the Broadcast README specifies:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  ```
- Verify the base body renders in Broadcast tokens (warm off-white `#FAF8F7` background, cobalt navy `#0C1533` text, IBM Plex Sans 15/22).

### 3.3 Wire `[data-lc-mode]` to `BrandContext.tsx`

`web/src/context/BrandContext.tsx` currently stores a legacy brand config in localStorage. Extend it:

- Add `mode: 'light' | 'dark' | 'system'` to the BrandContext state (default `'system'`).
- On mount + on change: if `mode === 'system'`, set `document.documentElement.removeAttribute('data-lc-mode')` (lets `prefers-color-scheme` win). If `mode === 'light'` or `'dark'`, set `document.documentElement.setAttribute('data-lc-mode', mode)`.
- Persist the choice in localStorage (`wingcaster.brand` key already exists; extend the shape).
- Export a `useMode()` hook that returns `[mode, setMode]`.
- The `[data-lc-mode]` attribute must be set BEFORE the first render (to avoid a flash of light content in dark mode). Do this via an inline `<script>` in `web/index.html` that reads localStorage synchronously.

### 3.4 Refactor `web/src/components/ui/*` shadcn primitives

Every file in `web/src/components/ui/*`. For each:

- Replace all Tailwind color classes (`bg-white`, `text-gray-900`, `border-slate-200`, etc.) with CSS variable references via inline `style={{}}` or a small utility class in the base CSS.
- Preferred approach: define a Tailwind plugin OR CSS utility classes in `web/src/index.css` that map Tailwind class names to Broadcast tokens (`.bg-surface { background: var(--lc-surface); }`, `.text-primary { color: var(--lc-text-primary); }`, etc.). Then components consume those.
- Refactor buttons, inputs, cards, dialogs, dropdowns, tabs, toasts. Every variant.
- Replace border-radius classes (`rounded-lg`, `rounded-xl`) with Broadcast radii (`var(--lc-radius-sm)` = 3px, `md` = 5px, `lg` = 7px, `xl` = 10px, `pill` = 999px). **No 12-20px rounded corners anywhere.**
- Replace shadow classes with Broadcast elevation tokens (`--lc-elevation-sm/md/lg` — offset shadows, not blurred).
- Every focus style: remove custom focus rings; let the base two-tone ring apply.
- Numerics: any component that renders a number (Badge with count, Progress with percent, Alert with amount) must render via the `.lc-data` class or `data-lc-numeric` attribute.

### 3.5 Refactor `web/src/pages/*` and `web/src/components/*`

For every non-ui component and every page:

- Replace raw hex color references (grep for `#[0-9a-fA-F]{3,8}` in `.tsx`, `.ts`, `.css`, `.module.css`) with Broadcast semantic tokens. Every hit needs a replacement.
- Replace Tailwind color classes with the utility classes defined in §3.4.
- Every numeric render → `data-lc-numeric` attribute or `.lc-data` class.
- Every status pill (property status, notification status, etc.) → use Broadcast `--lc-status-*` tokens + the required glyph (○ ● ◐ ◆ ▢ ✕).
- Every channel badge (Instagram, WhatsApp, etc.) → use Broadcast `--lc-channel-*` tokens with the paired `-on` ink for the foreground glyph/text.
- Every dialog/drawer/toast → use `--lc-elevation-*` tokens (offset shadows).

### 3.6 Fix known copy bug alongside the refactor

Per memory `wingcaster-vs-bazaar`, the following user-facing pages incorrectly say "Real Estate Bazaar" — replace with "WingCaster" (the customer-facing product name is WingCaster; Real Estate Bazaar is a DIFFERENT platform):

- `web/src/pages/TermsPage.tsx` lines 7, 11, 19, 23
- `web/src/pages/PrivacyPage.tsx` line 7
- `web/src/pages/AgentRegisterPage.tsx` lines 445, 961

Just the noun substitution — no other copy changes.

### 3.7 Preserve behavior

Every existing screen must render correctly after the migration. This is a PAINT JOB with strict semantics, not a rebuild:

- Every route in `App.tsx` still works
- Every form still submits
- Every modal still opens
- Every dropdown still filters
- Every table still sorts

Behavior tests must continue to pass unchanged.

---

## 4. Test discipline

**You MUST run the full CI locally before pushing.** Not just typecheck, not just lint — the full test suites Real-Postgres + Fast + Web.

- **Fast suite:** `cd web && npm run test` — all existing Vitest tests must pass.
- **Web RTL suite:** the `*.rtl.test.tsx` files under `web/src/**` — these validate that key screens render correctly. All must pass. If a test fails because a color assertion is no longer valid (e.g., "background is `#FFFFFF`" is now "background is `var(--lc-surface)`"), update the assertion to check the token OR remove the color assertion and assert on the element's role instead. **Do NOT delete tests to make CI green.**
- **Visual regression (add new):** add a `broadcast-theme.postgres.test.ts` under `web/src/` (or Vitest equivalent) that:
  - Renders every top-level page under both `data-lc-mode="light"` and `data-lc-mode="dark"`
  - Asserts the `body` computed background matches the Broadcast token
  - Asserts every element with `data-lc-numeric` uses the mono font family
  - Asserts no element's inline style contains a raw hex color
- **Accessibility check:** add a `jest-axe` pass on the top 10 highest-traffic pages (Dashboard, Listings, Listing detail, Inbox, Contacts, Contact detail, Login, Register, Settings, Command Center). Zero violations required.

**Green CI on push is not sufficient** — the architect-owner has a standing requirement to do a full end-to-end read of every file changed. Keep the diff clean; keep commits atomic per concern (theme wiring / ui primitives refactor / pages refactor / tests / copy fix — five separate commits, not one giant blob).

---

## 5. Definition of done

1. `docs/design-tokens/*` present in repo, `broadcast-theme.css` loaded via `web/src/index.css`, Google Fonts linked in `web/index.html`.
2. Grep for raw hex colors in `web/src/**/*.{ts,tsx,css}` (excluding `broadcast-theme.css` and SVG files): **zero hits**.
3. Grep for legacy token names (whatever they are — probably `--wc-*`, `--brand-*`, `--gold-*`, `--ink-*`): **zero hits**.
4. Every `web/src/components/ui/*` primitive consumes Broadcast tokens only.
5. Every `web/src/pages/*` page consumes Broadcast tokens only.
6. `[data-lc-mode]` toggle works: dark mode renders correctly across every page.
7. `prefers-color-scheme: dark` fallback works when `data-lc-mode` is not set.
8. Every numeric field uses mono + tabular-nums.
9. Two-tone focus ring is visible on every interactive element in both modes on both light-surface and orange-primary-button.
10. Status badges use glyph + label + tint (no colour-only).
11. Channel marks use paired `-on` ink.
12. Copy fix from §3.6 applied.
13. Fast + RTL + Web CI green.
14. Zero jest-axe violations on the top-10 pages.
15. Screenshot artifacts (light + dark, top 10 pages) attached to the PR for visual verification by the architect-owner.

---

## 6. Non-obvious constraints (reminders)

- **`--lc-accent-bold` needs a boundary.** Either an `--lc-accent-bold-edge` outline OR (when it sits on a primary surface) an `--lc-action-primary-text` ring. Do not paint teal-bold on a page without one.
- **Keep the teal accent small.** At equal area against orange, the page loses its focal point.
- **The signal lamp motif** (teal `--lc-accent-bold` dot pulsing at `--lc-duration-slow` on an orange surface) is reserved for the "live broadcast" moment on the home page. Do NOT sprinkle it around the app.
- Radii are tight ON PURPOSE. `--lc-radius-lg` is 7px, not 16px. If a component feels "too square" — that's the theme.
- Motion tokens: `--lc-duration-fast` (120ms) for hovers; `--lc-duration-base` (180ms) for tab/theme transitions; `--lc-duration-slow` (240ms) for sheets; `--lc-duration-deliberate` (320ms) for full-screen transitions. `--lc-easing-emphasis` (spring) is reserved for the "publish" confirmation.
- Respect `prefers-reduced-motion` — the base body already animates the theme transition; guard it with `@media (prefers-reduced-motion: reduce)`.

---

## 7. Reporting

On PR ready-for-review, include:

- 20 screenshots (10 pages × 2 modes) — attached to the PR description
- A one-page summary of what changed at a high level (files touched, commits, test additions)
- Any deviations from this spec with reasoning (there shouldn't be any without prior approval)
- Confirmation of the 15 items in §5

---

## 8. Prior-art references (already-shipped patterns to follow)

- `docs/prompts/CURSOR_QUALITY_HARDENING_PASS_1.md` — most recent five-fix precedent for concentrated, well-scoped PRs
- `docs/prompts/CURSOR_FEATURE_WIRING_AND_TENANT_UI.md` — precedent for shipping frontend + backend + tests in one PR (this PR is frontend-only but same discipline)
- Backend placeholder audit `docs/design/BACKEND_PLACEHOLDER_AUDIT_2026-09-04.md` — reference only (not this PR's scope, but useful context)
- Broadcast theme kit `docs/design-tokens/README.md` (once landed in this PR) — the ONE authoritative source on Broadcast constraints

---

## 9. Architect-owner review process

After PR is ready:

1. Cursor reports CI green + screenshots attached
2. Architect-owner does a full end-to-end read of every changed file (standing requirement, not a checkbox — actual review)
3. Architect-owner spot-checks 3-5 random screens in both modes in the browser
4. Any blocker findings → new commit, back to step 1
5. Squash-merge when everything checks out

This PR is foundational. It gates every subsequent UI dispatch. Getting it right matters more than shipping it fast.
