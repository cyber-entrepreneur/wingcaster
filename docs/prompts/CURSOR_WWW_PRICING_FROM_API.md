# Cursor dispatch — Marketing site pricing from the packages API

**PR title:** `feat(www): pricing from /api/public/pricing-tiers (removes static pricing.ts) + comparison table + trial-first copy`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster-www`

**Estimated effort:** ~2 days of Cursor work + review.

**Rev 1 — 2026-09-06.**

**Depends on:** `CURSOR_PACKAGES_MARKETING_FIELDS.md` (product backend) is merged AND deployed. That PR ships the `GET /api/public/pricing-tiers` endpoint this PR fetches from.

---

## 1. Why this PR

Two immediate wrongs to fix on the marketing site:

1. **Pricing is a static file** (`wingcaster-www/src/config/pricing.ts`). PA can't edit tiers without a marketing-site deploy. Backend + PA prompts fix this end-to-end; this PR is the marketing-side plumbing.
2. **Pricing copy still positions a permanent Free tier.** The locked model (2026-09-06) is trial-first: no Free tier, 1-month trial on Semsar/Boutique/Small Team, sales-led for Agency/Brokerage/Enterprise, annual prepay = 2 months free.

This PR also adds the **comparison table** the user asked for — per-tier feature quotas rendered as a matrix (properties, agents, AI credits, pushes, SMS, WhatsApp, email, social cards, design credits, portals, support level).

---

## 2. Scope

### 2.1 Delete `src/config/pricing.ts` as source of truth

Remove the file entirely. Update every import site to pull from the new `src/lib/pricing.ts` (below).

Also delete `src/tests/pricing-config.test.ts` — it validated the old static config. Replace with `src/tests/pricing-api.test.ts` that mocks the API response and validates the fetch/parse.

### 2.2 New `src/lib/pricing.ts` — API fetch + typed shape

```ts
import { z } from 'zod'

const PriceSchema = z.object({
  monthly_usd: z.number(),
  annual_usd: z.number(),
  currency: z.literal('USD'),
})

const PortalGroupSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  description: z.string(),
  portal_scope: z.string(),
})

const TierSchema = z.object({
  id: z.string(),
  code: z.string(),
  display_name: z.string(),
  tagline: z.string().nullable(),
  agent_cap: z.number().nullable(),      // null = unlimited
  property_cap: z.number(),
  price: PriceSchema,
  trial_days: z.number(),
  sales_led: z.boolean(),
  portal_group: PortalGroupSchema,
  feature_quotas: z.record(z.number()),  // values: number or -1 for unlimited
  feature_toggles: z.record(z.boolean()),
  support_level: z.enum(['email', 'email_chat', 'dedicated', 'dedicated_slack']),
  sort_order: z.number(),
})

const PricingTiersResponseSchema = z.object({
  tiers: z.array(TierSchema),
  currency: z.literal('USD'),
  generated_at: z.string(),
})

export type Tier = z.infer<typeof TierSchema>
export type Price = z.infer<typeof PriceSchema>

const PRICING_API_URL =
  process.env.NEXT_PUBLIC_PRICING_API_URL ?? 'https://app.wingcaster.com/api/public/pricing-tiers'

export async function fetchTiers(): Promise<Tier[]> {
  const res = await fetch(PRICING_API_URL, {
    next: { revalidate: 300, tags: ['pricing-tiers'] },  // ISR: 5-minute default revalidate, tag for on-demand
  })
  if (!res.ok) throw new Error(`Failed to fetch pricing tiers: ${res.status}`)
  const raw = await res.json()
  const parsed = PricingTiersResponseSchema.parse(raw)
  return parsed.tiers.slice().sort((a, b) => a.sort_order - b.sort_order)
}

// Formatting helpers used by cards + comparison table.
export function formatPropertyCap(cap: number): string {
  return String(cap)
}
export function formatAgentCap(cap: number | null): string {
  return cap === null ? 'Unlimited' : String(cap)
}
export function formatQuota(value: number): string {
  if (value === -1) return 'Unlimited'
  return value.toLocaleString('en-US')
}
export function formatPrice(minor: number): string {
  return `$${minor.toLocaleString('en-US')}`
}
```

### 2.3 On-demand revalidation endpoint

New file `src/app/api/revalidate/route.ts`:

```ts
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.MARKETING_REVALIDATE_SECRET ?? ''

export async function POST(request: Request) {
  if (!SECRET) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 })
  const body = await request.text()
  const signature = request.headers.get('x-wingcaster-signature') || ''
  const expected = createHmac('sha256', SECRET).update(body).digest('hex')
  const sigBuf = Buffer.from(signature, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ ok: false, reason: 'bad_signature' }, { status: 401 })
  }
  const { tag = 'pricing-tiers' } = JSON.parse(body || '{}')
  revalidateTag(tag)
  return NextResponse.json({ ok: true, revalidated: tag })
}
```

Backend's `triggerMarketingRevalidate` (from the packages PR) POSTs here after PA saves a tier change.

### 2.4 Rework `PricingCard`

Update `src/components/pricing/pricing-card.tsx` to accept a `Tier` (from `src/lib/pricing.ts`) instead of the old static shape. Behavior:

- Card header: `display_name` + `tagline`.
- Price display: monthly OR annual based on the parent's toggle state. Annual shows "$X/yr — 2 months free" badge.
- Agent + property caps rendered as small stats.
- Primary CTA:
  - `sales_led === true` → "Book a demo" button linking to `/get-started`.
  - `sales_led === false` → "Start free trial" button opening Paddle checkout with the tier's Paddle price ID.
- Trial disclaimer under the CTA: "30-day free trial. No commitment. Cancel anytime."
- Feature-quota preview: 3-4 highlighted quota values (e.g. "20 AI posts", "1 portal", "Email support") — the full matrix lives in the comparison table below.

**Paddle integration:** every non-sales-led tier still needs a `paddle_price_id`. The public endpoint from the backend PR should return these (add `paddle_price_id_monthly` and `paddle_price_id_annual` to the tier row schema — coordinate with the backend PR reviewer if not already present).

### 2.5 New `PricingComparisonTable`

New file `src/components/marketing/pricing-comparison-table.tsx`:

```tsx
// Responsive comparison matrix. Columns = tiers, rows = capability categories.
// Mobile: horizontal scroll with sticky first column (row labels).
// Desktop: full grid.

// Row categories (h4 headers + rows) — pulled from the tiers' feature_quotas + feature_toggles + caps:
//
// **Capacity**
//   Properties
//   Agents
//
// **AI credits**
//   AI post creation
//   Property ratings
//   Pricing benchmarks
//   Property scorings
//
// **Communications**
//   Push notifications
//   SMS
//   WhatsApp messages
//   Email sends
//
// **Social cards**
//   OOTB templates          ✓/—
//   Open Design template    ✓/—
//   Design credits
//
// **Distribution**
//   Portal access           (portal_group.display_name)
//
// **Support**
//   Support level           (support_level → human label)

// Cell values: formatQuota() for numbers, checkmark/dash for booleans, human labels for portal + support.
// Use Numeric wrapper (tabular-nums) for every numeric cell.
// Use --lc-* tokens only.
// Fully RTL-safe via logical properties (start/end, ms-/me-).
```

The component takes `{ tiers: Tier[] }` — the parent (pricing page) fetches once and passes to both `PricingTierGrid` and `PricingComparisonTable`.

Row category labels + display-unit labels come from a small map at the top of the file (English strings — Arabic mirror waits for the copywriter).

### 2.6 Rewrite `src/content/en/pricing.mdx`

Replace the current content with:

- **Hero:** `Simple, transparent pricing.` H1. Subhead: `Start with a 30-day free trial. Pay per active property. Save 2 months when you pay annually.` Include an annual/monthly toggle mockup in the hero (state lives on the client and drives both the tier grid AND the comparison table below).
- **Model explainer:** 3-4 explanation cards ("Per property, not per feature", "Annual = 2 months free", "Trial = 30 days full access", "Enterprise = custom contract").
- **Tier grid:** `<PricingTierGrid />` — reads from API, respects the annual/monthly toggle.
- **Comparison table:** `<PricingComparisonTable />` — same data source.
- **FAQ:** update the placeholders. Real answers for:
  - "What counts as an active property?" — `[FILL IN BY USER]`
  - "What happens after my free trial ends?" — "Your account converts to the paid plan you selected. Cancel anytime during the trial and you won't be charged. Cancelling ends your access; existing listings pause until you resubscribe."
  - "Can I claim the free trial twice?" — "No. Each free trial is tied to your email, phone, and username. Support can help if you lost access to your original account."
  - "What about the annual discount?" — "Pay annually and you get 12 months for the price of 10. Switch billing frequency any time from your account settings."
  - "Do you support VAT invoicing?" — "Yes. Paddle handles VAT for KSA, UAE, and every other jurisdiction."
- **Enterprise CTA band:** "Larger than 25 agents or 75 properties? Talk to us." with "Book a demo" button.
- **Bottom CTA:** "Try free for 30 days. No card charged until day 31." + "Start free trial" button.

### 2.7 Update `src/content/en/home.mdx`

Two edits:
- Hero footnote line 20: `Free tier included. No card required.` → `30-day free trial. Card required. No charge until day 31.`
- Anywhere else "free tier" language appears — replace with "free trial" or "start free". Grep and audit.

### 2.8 Arabic mirrors

Every `src/content/ar/pricing.mdx` and `src/content/ar/home.mdx` edit:
- Frontmatter: keep the English `title` verbatim (per the last decision — no `[TRANSLATION-PENDING]` in metadata).
- Body: keep the existing `[TRANSLATION-PENDING]` top + bottom markers. If the structural components change (e.g. new `<PricingComparisonTable />`), mirror the JSX. The English body text stays until the MENA copywriter passes over it.

### 2.9 Remove old free-tier language across all MDX

Grep the entire `src/content/**/*.mdx` tree for "free tier", "free plan", "free forever", "no credit card" (in Free-tier context — trial context is fine to say "no card charged until day 31"). Replace with the trial-first language.

### 2.10 Env var + `.env.example`

Add:
- `NEXT_PUBLIC_PRICING_API_URL` — defaults to `https://app.wingcaster.com/api/public/pricing-tiers`
- `MARKETING_REVALIDATE_SECRET` — shared secret for the revalidate endpoint (matches backend env)

Document both in the top of `.env.example` and in `README.md`.

---

## 3. Non-negotiables

1. **No static `src/config/pricing.ts`.** All tier data via `fetchTiers()`.
2. **Comparison table + tier grid share the same fetched data.** Do NOT double-fetch.
3. **ISR with 5-minute revalidate + on-demand tag.** Not full SSG (PA needs edits to reflect within minutes).
4. **All colors via `--lc-*` tokens.** `no-raw-hex.test.ts` must stay green.
5. **RTL-safe.** Logical properties throughout.
6. **Every tier's Paddle price ID comes from the API,** not hardcoded. Coordinate with backend PR reviewer if the API response is missing them.
7. **Frontmatter titles in Arabic MDX stay clean** (no `[TRANSLATION-PENDING]` per prior decision).
8. **Every "Free tier" phrase across MDX is audited** and replaced with trial-first language.
9. **CI green** (fast + build).

---

## 4. Test discipline

- **Fast tests** (`pricing-api.test.ts`): mock the API response, assert `fetchTiers` parses correctly, sorts by `sort_order`, handles `agent_cap: null`, handles `-1` unlimited quotas.
- **Fast tests** (`pricing-comparison-table.test.tsx`): renders every row category, `formatQuota(-1)` shows "Unlimited", RTL variant renders in `dir="rtl"`.
- **Fast tests** (`no-raw-hex.test.ts`): still green (the comparison table must not introduce raw hex).
- **Fast tests** (`revalidate-route.test.ts`): signed request accepted, unsigned rejected 401, missing secret returns 503.
- **Build check** (via CI): the /pricing page compiles + fetches successfully during `next build` (mock the API endpoint in the build environment via `MSW` or a fixture file for CI reliability).

---

## 5. Definition of done

1. `src/config/pricing.ts` deleted.
2. `src/lib/pricing.ts` created with schemas, fetch, formatters.
3. `PricingCard` reworked to consume `Tier` type + Paddle IDs from API.
4. `PricingComparisonTable` component built + wired into pricing page.
5. `pricing.mdx` rewritten (both `en` + `ar`).
6. `home.mdx` free-tier language replaced (both `en` + `ar`).
7. All other MDX audited + fixed.
8. On-demand revalidation endpoint live at `/api/revalidate`.
9. Env vars documented.
10. Fast + build CI green.
11. Vercel preview attached to PR shows:
    - Home hero with "30-day free trial" language.
    - `/pricing` with 6 tiers + comparison table + annual toggle showing "2 months free".
    - `/ar/pricing` in RTL with structural components rendering.

---

## 6. Follow-ups (do NOT include in this PR)

- **Real Arabic content:** MENA copywriter takes the `[TRANSLATION-PENDING]` MDX files and writes production Arabic. Separate PR.
- **Multi-currency display:** endpoint returns USD only in v1. Multi-currency (AED, SAR, EGP, LBP) is a Phase-2 concern.
- **Paddle checkout wiring for trial subscriptions:** the `paddle-checkout-web` skill handles this; ensure the fetched `paddle_price_id_monthly` OR `paddle_price_id_annual` is passed based on the annual/monthly toggle state. Detailed wiring might slip to a follow-up if it's substantial.
- **Trial claim UX post-signup:** the day-25/day-28/day-29 warning emails + auto-charge experience are backend + email-template work, separate from this PR.

---

## 7. Out of scope

- Any product-side change.
- Multi-currency display.
- The PA admin UI for editing tiers (companion PR).
- The backend endpoint itself (companion PR ships it).
- Real Arabic body content.
- Real customer testimonials or logos.
