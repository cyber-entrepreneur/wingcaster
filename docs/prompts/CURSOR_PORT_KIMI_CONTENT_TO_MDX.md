# Cursor dispatch — Port Kimi's marketing content into wingcaster-www

**PR title:** `feat(www): port Kimi's marketing content into MDX + extract reusable components`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster-www`

**Estimated effort:** 3-5 days of Cursor work + review. This is the biggest content PR of the marketing-website workstream.

**Rev 1 — 2026-09-05.** User picked Path B from the architect-owner side-by-side.

---

## 1. Why this PR

Two parallel scaffolds exist:

- **Kimi's static-HTML site** at `C:\Users\AliAchkar\Documents\kimi\workspace\wingcaster\` — real hand-written content, 20+ pages, engaging UI (WhatsApp cast-fan hero, 7-dimension area radar SVG, price-band indicator, 8-capability feature grid with SVG icons, per-persona solutions strip, trust block, honest placeholder discipline). Zero-deps. Missing i18n, Paddle, PostHog.
- **`wingcaster-www` scaffold** (merged as `685bc6f`) — Next.js 15 + i18n `/ar/*` + Paddle sandbox + PostHog behind consent + MDX pipeline + JSON-LD + dynamic sitemap/OG. Placeholder MDX with no content.

**Port Kimi's content into `wingcaster-www`'s infrastructure.** Kimi's HTML becomes MDX; Kimi's inline components become React components; Kimi's copy stays (with the tagline swap in §3.4); Kimi's guardrails are preserved. The result is one site with Kimi's UI density AND our i18n/Paddle/PostHog scaffold AND the user's locked D-M-08 tagline.

---

## 2. Source materials

- **Kimi source (READ ONLY — do not commit into `wingcaster-www`):** `C:\Users\AliAchkar\Documents\kimi\workspace\wingcaster\`
  - `src/pages/**/*.html` — canonical source per page (edit source, ignore `dist/`).
  - `src/assets/css/site.css` — Kimi's component styles (all `--lc-*` tokens). Use as reference; DO NOT copy the file — port each style into per-component Tailwind classes.
  - `src/assets/js/site.js` — progressive-enhancement scripts. Reference only.
  - `CONTENT-INVENTORY.md` — Kimi's placeholder catalog. Carry the placeholders forward verbatim.
  - `brand/wingcaster logo.png` + `.webp` — the official logo. Copy into `wingcaster-www/public/brand/` per §3.7.
- **Target:** `cyber-entrepreneur/wingcaster-www` main.
- **Design tokens:** already in place from PR #1. Do not modify.
- **Copy skeleton (secondary reference):** `docs/design/MARKETING_WEBSITE_COPY.md` in the product repo — resolves the tagline (§3.4) and gives voice guardrails.

---

## 3. Scope

### 3.1 Extend the sitemap

Current `wingcaster-www` routes 6 pages: home, features, pricing, portals, for-agencies, about. Kimi covers ~20. Extend `src/lib/site.ts` (`mdxPages`, `routedMdxPages`, `extraPaths`, `navItems`, `allLocalizedPaths`), the router (`src/app/**` and `src/app/ar/**`), `sitemap.ts`, and `Nav.tsx`/`Footer.tsx` to include:

**Platform sub-pages** (all under `/platform`):
- `/platform` (overview)
- `/platform/mobile-app`
- `/platform/listing-management`
- `/platform/crm-pipeline`
- `/platform/broadcasting-marketing`
- `/platform/unified-inbox`
- `/platform/pricing-intelligence`
- `/platform/area-intelligence`
- `/platform/whatsapp-listing-intake`

**Solutions by persona** (all under `/solutions`):
- `/solutions/agents`
- `/solutions/agencies`
- `/solutions/developers`
- `/solutions/holiday-homes`

**Other**:
- `/directory` (teaser)
- `/get-started` (book demo — replaces the earlier `/for-agencies` demo CTA target; keep `/for-agencies` too, cross-link)
- `/resources/blog`
- `/resources/help-center`
- `/resources/product-updates`
- `/company/about`
- `/company/contact`
- `/company/careers`
- `/legal/terms` (already stub — replace with Kimi's placeholder structure)
- `/legal/privacy` (already stub — replace with Kimi's placeholder structure)
- `/legal/dpa` (already stub — keep, mark as `[LEGAL COUNSEL PENDING]`)

**Route pattern:** every EN path has a paired AR path at `/ar/<same>`. The existing `i18n-route-pairing.test.ts` must be updated to cover the new sitemap breadth.

### 3.2 Extract reusable React components from Kimi's inline HTML

Under `src/components/marketing/`, create the following. Every component uses **only** `--lc-*` semantic tokens (Tailwind aliases OK), supports LTR + RTL via logical properties, respects `prefers-reduced-motion`, and wraps all numerals in `<Numeric>`.

| Component | Purpose | Kimi source (line refs approximate) |
|---|---|---|
| `<WhatsAppCastFan>` | Hero animated SVG — arcs + phone frame + chat messages + channel chips radiating out | `src/pages/index.html:16-76` (hero) and `:186-215` (signature-flow). Take `variant: 'hero' \| 'signature-flow'` prop. |
| `<PhoneFrame>` + `<PhoneChatMessage>` | Phone frame + message bubble primitives (used by `<WhatsAppCastFan>` and standalone) | `src/pages/index.html:25-62` |
| `<PricingBandIndicator>` | Horizontal below/market/above band with marker | `src/pages/index.html:257-262` |
| `<AreaRadar>` | 7-dimension SVG radar chart | `src/pages/index.html:267-283` |
| `<FeatureIcon name="mobile\|listing\|crm\|broadcasting\|inbox\|pricing\|area\|whatsapp">` | 8 SVG icons from the feature grid | `src/pages/index.html:127-173` |
| `<CaptureCastCatchConvert>` | The 4-step "How it works" flow. Uses the user's locked framework language. | `src/pages/index.html:108-116` |
| `<Beat number="01" title="…">` | Numbered problem beat card | `src/pages/index.html:85-101` |
| `<SolutionCard persona="agents\|agencies\|developers\|holiday-homes">` | Persona-solution card | `src/pages/index.html:222-243` |
| `<TrustItem title body>` | Trust & security cell | `src/pages/index.html:316-320` |
| `<ChannelChip channel label>` | Channel pill with dot + label | `src/pages/index.html:65-72`. Distinct from existing `<ChannelMark>` (icon-only). Reconcile: ChannelMark for icon-only, ChannelChip for chip+label. |
| `<StatusChip status>` | Broadcast status pill (draft/published/underOffer/closed/archived/unpublished). Uses `--lc-status-*` tokens. |  |
| `<ListingCard>` | Branded listing preview card | `src/pages/index.html:41-49` |
| `<SignalLamp>` | Pulsing teal-dot "Live" indicator | `src/pages/index.html:185`. Existing product primitive — reference; keep the "reserved motif" rule (don't sprinkle). |
| `<PlaceholderBlock>` | Honest `[…TO BE SUPPLIED]` block | `src/pages/index.html:328-332`. Preserve Kimi's guardrail explicitly. |
| `<StepFlow>` | Generic numbered-step flow (also usable outside "How it works") | Derived from `src/pages/index.html:110-115` |

Add each to `src/components/mdx/mdx-components.tsx` so MDX can reference them by name.

### 3.3 Per-page MDX conversion

For every page in §3.1:

**English:** `src/content/en/<slug>.mdx`
- Frontmatter — `title`, `description`, `ogImage`, `path` — Zod-validated by existing schema.
- Semantic content ported from Kimi HTML. Preserve Kimi's copy verbatim EXCEPT where §3.4 (tagline) or §3.5 (portal names) override.
- Use extracted components via MDX component map.
- No inline `style="..."` — port to Tailwind + tokens.
- No raw hex colors — `no-raw-hex.test.ts` will fail otherwise.

**Arabic:** `src/content/ar/<slug>.mdx`
- Same frontmatter (Arabic title + description — Kimi has none; use a literal Arabic string derived from the English title, but flag as `[TRANSLATION-PENDING]` at the top of the body).
- Structural components (`<WhatsAppCastFan>` etc.) still render so the RTL layout is testable.
- Body text = `[TRANSLATION-PENDING — copywriter pass required]`. **Do NOT machine-translate.**

### 3.4 Tagline swap — apply user's locked D-M-08 decision

Kimi's home uses H1 `Take back your time.` Replace throughout the port with the user's locked framework:

- **Home page H1:** `Capture · Cast · Catch · Convert.`
- **Home page subhead:** `One system for the whole business. Enter a listing once. Cast it everywhere. Catch every lead.`
- **Optional supporting strapline below subhead:** `Take back your time.` — Kimi's line is good outcome-focused copy and can live here as a strapline. Include it in the port; the user can strip it later if they want single-tagline discipline.

The **Capture / Cast / Catch / Convert** framework becomes the anchor of `/features`. Restructure that page into four sections `#capture`, `#cast`, `#catch`, `#convert`. Each section absorbs the relevant Kimi platform sub-pages as anchored deep-content OR keeps them as separate detail pages under `/platform/*` (both patterns work — pick per section based on content length).

### 3.5 Naming portals — DEFAULT to Kimi's cautious phrasing

Kimi's site says "listing channels / portal syndication (rolling out)" and never names specific portals. Our copy skeleton names Property Finder, Bayut, Dubizzle, OLX, Blue Door LB.

**Default in this port: Kimi's cautious phrasing everywhere.** Reason: naming portals requires vendor sign-off for "as seen on / integrated with" claims and creates legal exposure if a partnership status shifts.

**PR body flags this as a decision point.** If the user says "name them", a follow-up PR swaps in the specific portal names on the `/portals` page and the `#cast` section of `/features`. Do NOT anticipate this — default to cautious.

### 3.6 Preserve Kimi's honesty guardrails

Carry forward as PR-body notes AND enforce with tests where possible:

1. No named portal integrations (see §3.5).
2. No invented testimonials, logos, stats, ratings.
3. No pricing numbers baked into copy — pricing renders from `src/config/pricing.ts` which already exists.
4. No regional framing that would exclude any MENA country.
5. No competitor names.
6. Placeholders always marked in `<PlaceholderBlock>` — never disguised as real content.

**Optional lint step:** add a `content-honesty.test.ts` that greps compiled MDX for banned phrases (competitor names, "trusted by", star-rating emoji, "as seen in", "certified partner"). Wire into CI.

### 3.7 Assets

- **Logo:** copy `C:\Users\AliAchkar\Documents\kimi\workspace\wingcaster\brand\wingcaster logo.png` and `wingcaster logo.webp` (rename with hyphens: `wingcaster-logo.png`) into `wingcaster-www/public/brand/`. Wire into `<Nav>` and `<Footer>`. Keep the white chip wrapper on dark surfaces per Kimi's rule until a reversed logo is confirmed.
- **OG images:** keep wingcaster-www's `next/og` dynamic generation. Do NOT port Kimi's Python OG generator.
- **Illustrative product mockups:** preserve Kimi's Broadcast-styled SVG approach for hero + demo visuals. When real product screenshots exist, swap in later PRs.
- **Favicon:** derive from the logo. Kimi has `scripts/make-logo-assets.py`; instead, generate favicon + apple-touch-icon via `next/og` in a build step or embed statically. Cursor picks the simpler path.

### 3.8 Do NOT port

- Kimi's `build.js`, `server.js`, `dev-server.js` — `wingcaster-www` uses Next.js.
- Kimi's `site.config.json` — its fields (`baseUrl`, `appBaseUrl`, `contactEmail`, `formEndpoint`) already map to env vars in `wingcaster-www/.env.example`. Add any missing keys there.
- Kimi's `scripts/make-og.py`, `scripts/make-logo-assets.py` — not needed with Next.js.
- Kimi's `src/assets/css/site.css` as a global stylesheet — port each style into the extracted components as Tailwind + tokens.
- Kimi's `dist/` — build output, ignore.

---

## 4. Non-negotiables

1. **Tagline: `Capture · Cast · Catch · Convert.` as H1** on home. Kimi's `Take back your time.` optionally as a strapline below the subhead — NEVER as H1.
2. **Every new page has both EN and AR MDX files.** AR = `[TRANSLATION-PENDING]` placeholders. **Do NOT machine-translate.**
3. **All colors via `--lc-*` semantic tokens** (Tailwind aliases OK). `no-raw-hex.test.ts` must stay green.
4. **All new components support LTR + RTL** via logical properties (`ms-*` / `me-*`, `start` / `end`, not `left` / `right`). Verify by rendering an Arabic page and confirming layout mirrors.
5. **Preserve Kimi's guardrails** (§3.6).
6. **Fast + typecheck + test + build CI green** before flipping to ready-for-review.
7. **Do NOT modify `broadcast-tokens.css`** — the tokens are the source of truth from PR #1. If a new token is genuinely needed, request it from the reviewer instead of adding inline.

---

## 5. Test discipline

- Extend `i18n-route-pairing.test.ts` to cover the new sitemap (every EN path pairs with `/ar/<path>`).
- Extend `mdx-frontmatter.test.ts` to enforce frontmatter on every new MDX file. Update the count assertion to match the new page total.
- New: `src/components/marketing/*.test.tsx` — one snapshot or DOM test per extracted component. Assert no raw hex in the rendered output.
- New: `content-honesty.test.ts` (optional per §3.6) — greps compiled MDX for banned phrases.
- Existing tests (`no-raw-hex.test.ts`, `broadcast-tokens.test.ts` including the dark-hover regression guard from PR #1's fix commit `17dde39`, `pricing-config.test.ts`) must stay green.

---

## 6. Definition of done

1. All Kimi source pages ported to `src/content/en/<slug>.mdx` per §3.3.
2. Arabic `[TRANSLATION-PENDING]` mirrors for every new page.
3. All Kimi inline components extracted to `src/components/marketing/*.tsx` per §3.2, all wired into `mdx-components.tsx`.
4. Sitemap extended per §3.1; nav + footer updated.
5. Tagline swap applied per §3.4.
6. Guardrails preserved per §3.6.
7. Logo + brand assets in place per §3.7.
8. All tests pass. CI green.
9. Vercel preview attached to the PR shows:
   - The ported home page with the WhatsApp cast-fan hero, "Capture · Cast · Catch · Convert." H1, and Kimi's subhead + optional strapline.
   - The area radar and pricing band rendering correctly.
   - `/ar/` responding with the RTL layout and structural components still rendering.
10. PR body includes:
    - Screenshot of the home page (English + Arabic).
    - Screenshot of `/pricing` (still shows the 7 tier cards from `src/config/pricing.ts`).
    - Note on the §3.5 decision (defaulted to Kimi's cautious phrasing; user override needed to name portals).
    - Note that the Kimi source folder is source-material only, NOT committed into `wingcaster-www`.
    - List of every new MDX slug (EN + AR) so the reviewer can spot-check coverage.

---

## 7. Follow-ups (do NOT include in this PR)

- **Real Arabic content pass** — MENA copywriter takes the `[TRANSLATION-PENDING]` files and writes production Arabic. Separate PR.
- **Per-page v0 / Design AI polish** — once content is in, Design AI can iterate on specific pages. Per-page PRs.
- **Real product screenshots** — swap illustrative mockups for actual captures when the product is stable.
- **Pricing page final copy** — depends on user's answer to P1 (Enterprise 100-property price) and the free-trial-post-1-listing UX question in `MARKETING_WEBSITE_KICKOFF.md §6c`.
- **Legal copy** — external counsel or Termly/iubenda.
- **Testimonials / customer logos** — only when named customers exist with permission.
- **Portal-naming toggle** (§3.5) — a small follow-up PR to name specific portals if the user chooses to.
- **Blog / product-updates content** — separate content workstream.
- **Free-trial dedup enforcement in the backend** — separate Cursor prompt (`CURSOR_FREE_TRIAL_DEDUP_ENFORCEMENT.md` — not yet drafted; user to say the word).

---

## 8. Out of scope

- Any change to the product's `web/` app.
- Any change to the product's backend.
- Any change to `broadcast-tokens.css` — those tokens are locked from PR #1.
- Any Arabic content writing — placeholders only.
- Any real testimonials, customer logos, legal copy, or blog posts.
- Kimi's `wingcaster-website/` folder (the earlier draft) — ignore entirely; work from `wingcaster/` only.
