# Cursor dispatch — Marketing website scaffold

**PR title:** `chore(www): scaffold wingcaster-www — Next.js 15 + Broadcast tokens + i18n + Paddle + PostHog`

**Base branch:** `main` (of the new `wingcaster-www` repo — see §1 for repo creation)

**Estimated effort:** 3-4 days of Cursor work + review. Scaffold only — no page content yet. Content copy comes in separate per-page PRs (see `docs/design/MARKETING_WEBSITE_COPY.md`).

**Rev 1 — 2026-09-05.**

---

## 1. Repo setup

This is a **new repository**, not a branch off the existing `wingcaster` product repo.

Steps:
1. Create a new GitHub repo `cyber-entrepreneur/wingcaster-www`. Private for now; will be made public at launch.
2. Local scaffold via `pnpm create next-app@latest wingcaster-www --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"` — App Router, TypeScript, Tailwind, ESLint, `src/` layout.
3. Push the initial commit as `chore: initial Next.js 15 scaffold`.
4. Open THIS PR against the newly initialized `main`.

---

## 2. Scope of this PR

Scaffold only. No copy, no design polish, no page content. This PR creates the foundation every subsequent per-page PR builds on.

### 2.1 Framework baseline

- **Next.js 15** with App Router. Node 22 LTS runtime.
- **TypeScript strict mode.** `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`.
- **Tailwind CSS** with a custom preset that maps Tailwind color names to the Broadcast `--lc-*` semantic tokens (same pattern as the product repo's `tailwind.config.js`).
- **ESLint** with Next.js defaults + `@typescript-eslint/no-explicit-any` set to error.
- **Prettier** with 2-space indent, single-quote strings, no semicolons at line end. Match the product repo's config.

### 2.2 Broadcast token layer

Copy the token layer from the product:
- Source-of-truth CSS custom properties file at `C:\Users\AliAchkar\Desktop\Wingcaster Design Tokens\broadcast-theme.css` — port this into `src/styles/broadcast-tokens.css`.
- All 127 `--lc-*` properties MUST be defined at `:root` (light) and again inside `:root:not([data-theme="light"])` `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` (per the PR #41 pattern).
- Tailwind config maps color aliases to `var(--lc-*)` — see the product's `tailwind.config.js` for the exact list. Do NOT allow raw hex.
- Add a `no-raw-hex.test.ts` guard (Vitest) that greps the built CSS + all `.tsx` files for raw hex and fails if any are found. Reuse the pattern from the product repo.

### 2.3 Fonts

Load via `next/font` (not Google Fonts `<link>` — Next.js self-hosts for privacy + perf):
- **Archivo 800** for display.
- **IBM Plex Sans 400/500/600** for body.
- **IBM Plex Mono 400/500 with `tabular-nums`** for numeric.

Expose CSS variables `--font-display`, `--font-body`, `--font-mono` at `:root`.

### 2.4 App layout + theme provider

- `src/app/layout.tsx` — root layout with `<html lang>` and `dir` attributes driven by the locale (see §2.7).
- **FOUC script** in `<head>` that reads `localStorage` for the theme choice synchronously — same pattern as the product's `index.html` fixup from PR #41.
- **`<ThemeProvider>`** component with `useLcMode` hook, `applyLcMode`, `persistLcMode`, and a `prefers-color-scheme` listener — port from the product's `BrandContext.tsx`.
- **`<ColorModeToggle>`** component (light / dark / system cycle) — port from `web/src/components/ui/color-mode-toggle.tsx`.

### 2.5 Base components (design-agnostic)

Create the following shells with sensible defaults. Design AI polish will land in the per-page PRs; this PR just makes them exist:
- `<Container>` — max-width wrapper, responsive padding.
- `<Section>` — vertical rhythm helper.
- `<Button variant="primary|outline|ghost|destructive" size="sm|md|lg">` — matches the product's button primitive semantics.
- `<Numeric>` — wrapper that applies `font-mono` + `tabular-nums`.
- `<ChannelMark channel="instagram|whatsapp|tiktok|x|linkedin|facebook">` — matches the product's channel-badge primitive.
- `<Nav>`, `<Footer>` — global layout.
- `<PrimaryCTA>`, `<SecondaryCTA>` — reusable CTA cards for section-bottom prompts.

Do NOT design the pages themselves in this PR. Design AI + per-page PRs handle that.

### 2.6 MDX pipeline

- `next-mdx-remote` for statically compiled MDX.
- MDX files live at `src/content/{en,ar}/{home,features,pricing,portals,for-agencies,about}.mdx`.
- Custom MDX components map to the base components in §2.5.
- MDX frontmatter schema (validated with Zod at build time):
  ```yaml
  ---
  title: string          # <title> tag
  description: string    # meta description, 150-160 chars
  ogImage: string        # path under /public/og/
  path: string           # canonical path, e.g. "/features"
  ---
  ```

### 2.7 Internationalization (i18n)

- **Route strategy:** `/ar/*` subpath. English at root (`/features`), Arabic at `/ar/features`.
- **Middleware:** `src/middleware.ts` detects locale from URL prefix and sets `<html lang>` + `dir` on the response.
- **Language toggle:** clicking `EN`/`ع` in the nav swaps between the paired route (`/features` ↔ `/ar/features`), preserving scroll position.
- **hreflang tags:** every page emits `<link rel="alternate" hreflang="en" href="...">` and `<link rel="alternate" hreflang="ar" href="...">` in the head.
- **Arabic content:** MDX files under `src/content/ar/*.mdx` are placeholders in this PR. Real Arabic content lands in a later PR (needs a native MENA copywriter).
- **RTL:** Tailwind's built-in `dir="rtl"` handling + logical properties (`start`/`end` instead of `left`/`right`) throughout the base components.

### 2.8 Paddle checkout integration

- Load the [`paddle-checkout-web` skill](https://claude.com/plugins/paddle-billing) before writing any Paddle code — do not hand-roll.
- Environment: sandbox at scaffold time (`NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`), production toggle documented in `README.md`.
- `<PricingCard tier={...} />` component that opens the Paddle checkout overlay on click. Tier metadata (name, price, active_properties, paddle_price_id) lives in `src/config/pricing.ts` — hard-coded for launch (7 tiers), can migrate to a CMS later.
- Success callback: redirects to `/thank-you?session={paddle_txn_id}` — that page is a stub in this PR, content in a later PR.

### 2.9 PostHog analytics

- Client-side snippet loaded via `next/script` in `layout.tsx` after user consent.
- **Consent gate:** cookie banner blocks PostHog until visitor accepts. Use `@vercel/analytics` cookie-free by default, PostHog for opt-in.
- Env: `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com` (EU region for MENA data-residency posture).
- Event catalog documented in `docs/analytics-events.md`:
  - `page_view` (auto)
  - `cta_click` (props: `cta_label`, `page`, `variant`)
  - `pricing_tier_clicked` (props: `tier_name`, `price_usd`)
  - `checkout_started` (props: `tier_name`, `paddle_price_id`)
  - `demo_requested` (props: `page`, `agency_size_hint`)
  - `language_toggled` (props: `from`, `to`, `page`)

### 2.10 SEO baseline

- `src/app/sitemap.ts` — dynamic sitemap generation from the MDX files.
- `src/app/robots.ts` — `Allow: /`, `Sitemap: https://wingcaster.com/sitemap.xml`.
- **Metadata API** for every page: `title`, `description`, `openGraph`, `twitter`, `alternates.languages` (EN + AR pairing).
- OG images: generate at build time via `next/og` at `/public/og/*.png` — one per page. Use the Broadcast display font (Archivo 800) and the primary color token.
- Structured data: `Organization` schema at the root, `Product` schema on `/pricing`, `SoftwareApplication` on `/features`.

### 2.11 Legal placeholders

`src/app/legal/{terms,privacy,dpa}/page.tsx` — one-liner "Coming soon" page each. Real legal content is a separate track (external counsel or Termly/iubenda vendor). Not this PR's concern.

### 2.12 CI + deployment

- **GitHub Actions:** `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on every PR.
- **Vercel deploy:** `main` → `wingcaster.com` (production), every PR → `pr-{n}.wingcaster-www.vercel.app` (preview).
- **Domain wiring:** DNS on Cloudflare (proxy OFF — Vercel handles TLS at the edge). `wingcaster.com` and `www.wingcaster.com` both point to Vercel.
- **Env-var management:** all `NEXT_PUBLIC_*` vars documented in `README.md` under an `Environment` section. Server-only vars (Paddle webhook secret, if we add one Phase 2) documented separately.

---

## 3. Non-negotiables

1. **No raw hex colors anywhere.** Semantic tokens (`var(--lc-*)`) or Tailwind aliases that resolve to them.
2. **All fonts self-hosted via `next/font`.** No third-party font-loading network hops (privacy + perf).
3. **`/ar/*` subpath, not query param.** SEO-critical.
4. **PostHog gated by cookie consent.** No tracking before opt-in.
5. **TypeScript strict mode.** No `any` escape hatches.
6. **Design AI polish is NOT this PR's job.** Base components are functional shells; per-page PRs bring the visual density.
7. **Paddle uses the skill.** No hand-rolled Paddle SDK usage.

---

## 4. Test discipline

- `no-raw-hex.test.ts` — guards CSS + TSX.
- `broadcast-tokens.test.ts` — asserts all 127 `--lc-*` properties are defined at `:root`, and the dark-mode block redefines the correct subset.
- `i18n-route-pairing.test.ts` — asserts every EN page has an AR counterpart at `/ar/{same-path}` and both emit `hreflang` tags.
- `mdx-frontmatter.test.ts` — Zod-validates every MDX file's frontmatter.
- `pricing-config.test.ts` — asserts every tier in `src/config/pricing.ts` has a `paddle_price_id` (or is explicitly marked `custom` for the Enterprise contact-sales tier).

---

## 5. Definition of done

1. Repo `cyber-entrepreneur/wingcaster-www` created; PR opens against `main`.
2. `pnpm dev` runs a working site with placeholder pages at every route in the sitemap (EN + AR).
3. Broadcast tokens live at `:root`; theme toggle works; FOUC script prevents flash.
4. Fonts self-hosted; Archivo/IBM Plex Sans/IBM Plex Mono render correctly.
5. i18n middleware works; `/features` ↔ `/ar/features` toggle works; `hreflang` tags emit correctly.
6. MDX pipeline compiles placeholder content; frontmatter validation is enforced.
7. Paddle sandbox checkout opens from a `<PricingCard>` demo on `/pricing`.
8. PostHog snippet loads after cookie consent; test events fire correctly.
9. `sitemap.xml`, `robots.txt`, OG images all generate at build time.
10. Vercel preview deployment works from the PR; screenshot in the PR body.
11. All tests in §4 pass. Lint + typecheck clean.

---

## 6. Follow-up PRs (do NOT include in this one)

- **Copy fill:** per-page PRs that plug real copy from `docs/design/MARKETING_WEBSITE_COPY.md` (once user fills the `[FILL IN]` blocks).
- **Design AI polish:** per-page PRs that apply v0-generated visual density to each page (hero motion, screenshot mockups, four-C card layout, portal grid, pricing comparison, etc.).
- **Real legal content:** external counsel or Termly/iubenda integration.
- **CMS migration:** if content velocity demands it. Not before 6 months of hand-editing MDX.
- **Blog / changelog:** Phase 2 workstream.
- **Case studies + customer logos:** wait until we have named customers with permission.

---

## 7. Explicitly out of scope

- Real Estate Bazaar's website (separate product).
- The product itself (that's `wingcaster` repo).
- Product-side screens, UI, features (four Screen Matrix docs cover those).
- Any actual customer-visible copy (Design AI polish + copy fill are follow-ups).
