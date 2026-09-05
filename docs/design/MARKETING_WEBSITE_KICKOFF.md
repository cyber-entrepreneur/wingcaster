# Marketing Website — Workstream Kickoff

**Author:** Architect-owner
**Created:** 2026-09-05
**Status:** Rev 2 — decisions D-M-01, 02, 04, 05, 06, 07, 08 locked 2026-09-05. Two open items (P1, P2) gate the pricing page ONLY; every other workstream can proceed.

Companion documents (existing):
- [SCREEN_MATRIX_SHARED.md](SCREEN_MATRIX_SHARED.md), [SCREEN_MATRIX_AGENT.md](SCREEN_MATRIX_AGENT.md), [SCREEN_MATRIX_AGENCY.md](SCREEN_MATRIX_AGENCY.md), [SCREEN_MATRIX_PA.md](SCREEN_MATRIX_PA.md) — the product's screens (NOT the marketing website)
- [PORTAL_LIST_RESEARCH_2026-09-04.md](PORTAL_LIST_RESEARCH_2026-09-04.md) — MENA portal ecosystem context that shapes messaging
- Broadcast theme tokens at `C:\Users\AliAchkar\Desktop\Wingcaster Design Tokens\`

---

## 1. What this workstream is (and isn't)

**IS:** WingCaster's public-facing acquisition website. The site cold prospects (agents, agency owners, brokerage decision-makers) land on before they've heard of us. Its job is:
1. Explain what WingCaster is in under 10 seconds.
2. Prove it's built for MENA real-estate professionals, not generic CRM.
3. Convert qualified visitors to `Start free` (self-serve free tier) or `Book a demo` (agency-sized deals).
4. Surface pricing so a serious buyer doesn't have to email us for a number.
5. Rank on relevant search: "real estate CRM Dubai", "WhatsApp property posting agent tool", "portal syndication Bayut Property Finder", Arabic equivalents.

**IS NOT:**
- The product itself (that's the `web/` React app under `web/src/`).
- Real Estate Bazaar (that's a separate consumer portal, out of scope for this workstream).
- A blog-first / content-marketing site — content pillars can come Phase 2 once positioning is validated.
- A separate app for existing customers — logged-in agents go to the product; the site is for prospects.

---

## 2. What we already know (locked-in constraints)

These carry over from prior WingCaster decisions and DON'T need to be re-litigated on the site:

- **Product identity:** WingCaster is B2B SaaS for real-estate agents and agencies. Not a listings portal. Not a consumer-facing property search.
- **Primary market:** MENA / Gulf — Dubai, Abu Dhabi, Riyadh, Jeddah, Beirut, Cairo, Amman. English + Arabic (RTL) as first-class locales.
- **Personas the site addresses:**
  - **Solo agent** (mobile-first user, buys the free tier or the first paid tier themselves)
  - **Agency owner / broker-of-record** (desktop-first, evaluates multi-seat plans, wants proof of MENA portal integrations + compliance)
  - **Property manager / VRM operator** (Phase 2 — deferred until PMF; the site should not scope UX for them yet, but positioning should not exclude them either)
- **Positioning versus incumbents:**
  - Vs. **Property Finder Agent Tools** — we integrate WITH their portal, we don't compete with it as a portal. We give the agent tools their portal doesn't (WhatsApp listing intake, cross-portal syndication, unified inbox for inquiries coming in from PF + Bayut + Dubizzle + OLX + Bazaar + social).
  - Vs. **generic CRM (Salesforce, HubSpot, Zoho)** — we're vertical for real estate in MENA. Native Arabic, native RERA/DLD/RAK compliance, native portal integrations.
  - Vs. **Zillow-style US tools** — those don't work here. Zillow doesn't operate in MENA; their tooling is coupled to their portal.
- **Design system:** Broadcast (adopted 2026-08-13, W3C DTCG tokens, WCAG AA). "Loud + fast" character. IBM Plex Sans + Archivo + IBM Plex Mono. Semantic tokens `--lc-*` only, never raw hex.
- **Compliance / billing:** Paddle Merchant-of-Record (handles VAT + PSP dunning + refunds). Free tier available. Paid tiers priced per active property, not per seat.
- **Trust signals we CAN claim now:** Broadcast-driven UI (WCAG AA); tenant-based access model with two-person approvals; portal-agnostic architecture; WhatsApp Business intake (Model B blocker resolved). Test claims like "trusted by X agencies" MUST wait until we have named customers.

---

## 3. Site scope — proposed sitemap

Minimal launch site. Every page justified by a decision the visitor is making.

| Path | Purpose | Primary CTA |
|---|---|---|
| `/` | Positioning, one-screen "what is this", the three loudest features, social proof placeholder, pricing preview, footer CTA. | Start free / Book a demo |
| `/features` | Deep dive: WhatsApp listing intake, portal syndication (PF + Bayut + Dubizzle + OLX), unified inbox, AI post creation, credit-metered pricing. Sub-anchors per feature. | Start free |
| `/pricing` | Full transparency: free tier + paid tiers with per-active-property costs, Paddle checkout link. FAQ (VAT, cancellation, upgrade/downgrade, credit rollover). | Start free / Contact for enterprise |
| `/portals` | Which MENA portals are supported today, which are planned, per-portal caveats (e.g., "Aqarmap review pending, Wasalt beta"). Referenced in [PORTAL_LIST_RESEARCH_2026-09-04.md](PORTAL_LIST_RESEARCH_2026-09-04.md). | See features |
| `/for-agencies` | Multi-seat story: two-person approvals, agency roles, per-agent quotas, unified reporting. Different tone from the solo-agent home. | Book a demo |
| `/about` | Who's building this, why, MENA-first credentials. Contact info, support email, physical presence if applicable. | Contact |
| `/legal/terms`, `/legal/privacy`, `/legal/dpa` | Legal boilerplate. Paddle MoR reduces our tax exposure but doesn't eliminate customer-facing terms. | — |
| `/ar/*` OR `?lang=ar` toggle | Full Arabic mirror. See D-M-05 below. | — |

**Not in launch scope:** blog, changelog, careers, integrations marketplace, case studies. Each is a Phase-2 addition once the launch site is validated.

---

## 4. Design direction

The marketing site should feel like a **louder, more expressive version of the Broadcast product UI** — same design system, same fonts, same semantic colors, but with editorial-scale hero moments the product doesn't need (giant type, gradient washes, motion on scroll, screenshot mockups of the product surface).

Rationale: a prospect who lands on the site should recognize the product they eventually use. Different fonts + palette between site and product creates a jarring "is this the same company" moment.

**Concrete guardrails:**
- Semantic tokens only (`--lc-action-primary`, `--lc-text-brand`, etc.) — same as the product.
- Type stack: Archivo (display), IBM Plex Sans (body), IBM Plex Mono (numeric + code).
- Character: "Loud + fast" — bold headlines, tight radii (3-10px), offset shadows, two-tone focus rings on interactive elements.
- Motion: reserved. Signal-lamp pulse (teal accent) exists in the product for "just published"; the site can borrow it for "just signed up" moments only. Not sprinkled elsewhere.
- Screenshots of the product must show it in Broadcast light-mode by default, dark-mode as a togglable variant.

---

## 5. Tech stack — proposed

Recommendation for the site itself (separate from the backend / app repos):

- **Framework:** Next.js 15 (App Router). Rationale: (a) matches Cursor's already-installed Paddle checkout skill (`paddle-checkout-web` targets Next.js), (b) SSR/SSG for SEO, (c) same React ecosystem as the product so components can be shared if needed, (d) Vercel hosting is one-click.
- **Styling:** Tailwind + the same Broadcast token layer used by the product (`--lc-*` custom properties applied at `:root`).
- **Content model:** MDX for the marketing pages (developer-editable) — no CMS at launch. Add a CMS in Phase 2 if content velocity demands it (probably Sanity or Contentful; NOT WordPress).
- **Analytics:** PostHog (self-hostable, privacy-friendly, has session recording). GA4 optional but a distant second choice.
- **Deployment:** Vercel (free tier for pre-launch, hobby → pro when traffic justifies). Custom domain on Cloudflare DNS with proxy off (Vercel handles TLS + edge).
- **Repo:** separate repo `wingcaster-www` (or a subdirectory `marketing/` in the existing monorepo — see D-M-04).

Alternative if speed to market matters more than long-term flexibility: **Framer** (nocode) — the user or a designer can hand-build the site without engineering. Sacrifices SEO polish and translation ergonomics but ships in days not weeks. Only recommend if D-M-03 = "want live in <2 weeks and don't need a blog yet".

---

## 6. Workstream phases

Same "Design AI first, then Cursor" model established in D13 (b):

### Phase 1 — Positioning + copy (this doc + follow-ups)
- Lock the answers to D-M-01 through D-M-08 below.
- Write the actual copy for each page. This is a HUMAN task, not a Design AI or Cursor task — the words are the product's positioning and only the founder / architect-owner should set them.
- Output: `docs/design/MARKETING_WEBSITE_COPY.md` (page-by-page copy blocks).

### Phase 2 — Design AI mockups
- Feed the copy + Broadcast tokens into a Design AI tool (v0 by Vercel, Framer AI, Lovable — see D-M-06).
- Iterate on 2-3 rounds of visual mockups per page until the designs match the "loud + fast" Broadcast character.
- Output: exported design files (Figma / Framer / HTML+CSS) — one per page in the sitemap.

### Phase 3 — Cursor implementation
- Write CURSOR_MARKETING_SITE_SCAFFOLD.md prompt: scaffold Next.js 15 App Router, Broadcast token layer, base layout, i18n plumbing (English + Arabic RTL), MDX pipeline, Paddle checkout integration, PostHog analytics, deploy to Vercel.
- Write per-page CURSOR_MARKETING_SITE_PAGE_*.md prompts (home, features, pricing, portals, for-agencies, about) that take the Design AI output + the copy and produce the actual pages.
- Standard architect-owner review pattern per PR.

### Phase 4 — Launch
- Domain cutover.
- Analytics validation.
- Manual smoke on all pages + Arabic RTL.
- SEO submission (Google Search Console, IndexNow).
- Announce on our own channels — LinkedIn, WhatsApp Business status, existing MENA agent networks.

---

## 6a. Locked decisions (2026-09-05)

| # | Decision |
|---|---|
| **D-M-01** | Primary domain: **`wingcaster.com`**. `.ae` redirect not scoped for launch — can add Phase 2 if MENA search benefits from it. |
| **D-M-02** | Free tier signup: **fully self-serve**. `Book a demo` still available on `/for-agencies` for 10+ seats. |
| **D-M-03** | Launch urgency: **OPEN** — user hasn't specified. Working assumption is Rec (b) "4-6 weeks, Arabic RTL at launch, SEO baseline in place." Flag any deviation. |
| **D-M-04** | Repo strategy: **separate repo `wingcaster-www`**. |
| **D-M-05** | Bilingual URLs: **`/ar/*` subpath** (user "open" → default to recommendation). |
| **D-M-06** | Design AI tool: **v0 by Vercel** (user "open" → default to recommendation). |
| **D-M-07** | Pricing transparency: **full transparency**. Publish every tier with per-property cost. |
| **D-M-08** | Positioning tagline: **two-line, "Capture · Cast · Catch · Convert" framework.** |

### D-M-08 — Tagline (locked)

**Primary (short, ties to brand name):**
> **Capture · Cast · Catch · Convert.**

**Secondary (subhead, explains the mechanism):**
> One system for the whole business. Enter a listing once. Cast it everywhere. Catch every lead.

**Implications beyond the tagline itself:**
- **`/features` restructures** around the four Cs, not a generic feature list:
  - **Capture** — WhatsApp listing intake, AI extraction, media pipeline.
  - **Cast** — cross-portal syndication (PF, Bayut, Dubizzle, OLX, Bazaar, social).
  - **Catch** — unified inbox for inquiries from every source with source labeling.
  - **Convert** — CRM stages, pipeline, deal tracking, AI post creation for re-engagement.
- **`/` home page hero** uses the primary tagline. The four Cs get equal-weight visual treatment below the fold (four cards / four bands).
- **Product-side impact:** the four Cs are also a useful mental model for the product's information architecture. Not scoped into this workstream, but worth remembering when the next Screen Matrix pass happens.

## 6b. Pricing tiers (P2 locked 2026-09-05; P1 still open)

Per-active-property pricing (billing model already decided in prior conversations). Numbers below reflect the user's 2026-09-05 answers:

| Tier | Active properties | Monthly price | Notes |
|---|---|---|---|
| **Free trial (one-time)** | 1 | $0 | **NOT a persistent free tier.** One free active listing per user, one time only, ever. Identity dedup on email + phone + username — a returning user (same email OR phone OR username) does NOT get another free trial. See §6c for backend implications. |
| Starter | 1 | $15 | Same property allowance as trial, but recurring. |
| Small team | 3 | $40 | |
| Growth | 10 | $99 | |
| Agency | 30 | $175 | |
| Brokerage | 60 | $250 | |
| Enterprise | 100 | **P1 — need answer** | Price extrapolation suggests ~$325-$350 based on the per-property curve, but do NOT guess — user to confirm. |

Tier names above are my proposals for the copy — user to confirm or rename in the copy skeleton.

## 6c. Free-trial identity dedup — backend requirement (out of scope for this workstream, must be tracked)

The "one-time free trial" model requires backend enforcement that does NOT exist today. Without it, anyone can register a new account with a throwaway email and claim another free listing forever, and the entire trial economics collapse.

**Required backend behavior at signup (or at first-listing-post):**
1. Check whether the incoming user's email has ever claimed a free trial → reject or convert to paid.
2. Check whether the incoming user's phone number has ever claimed a free trial → reject or convert to paid.
3. Check whether the incoming user's chosen username has ever claimed a free trial → reject or convert to paid.
4. All three checks must be against normalized values (lowercase email, E.164 phone, case-folded username) and against SOFT-deleted accounts too — deleting an account can't reset the trial.
5. Race-safe: two concurrent signups for the same identity must not both succeed. Use a unique constraint or an advisory lock.

**Follow-up:** draft `docs/prompts/CURSOR_FREE_TRIAL_DEDUP_ENFORCEMENT.md` when the user is ready. Migration will need to add either a `free_trial_claimed_at` column on `users` with unique-per-identity constraints, or a separate `free_trial_claims` table keyed by all three identifiers. Frontend consequence: signup form must gracefully handle "email/phone/username was already used for a trial" without leaking user existence (security-sensitive — see similar pattern in the product's SHR-AUT flow).

**UX open question — not answering here, just flagging:** what happens the moment the user's free listing count exceeds 1? Auto-upgrade to Starter (needs card at signup)? Freeze the listing (recovery-friendly, keeps the listing intact)? Downgrade to no-active-listings? This is a product decision to make BEFORE the marketing site launches, because the pricing FAQ must answer it.

## 7. Open decisions — need YOUR input before Phase 1 completes

Numbered D-M-* to keep them distinct from the product-side D-* decisions.

### D-M-01 — Primary domain
Options:
- (a) `wingcaster.com` — global reach, works in English-first markets.
- (b) `wingcaster.ae` — signals UAE-first commitment, but excludes KSA/LB/EG/JO from the domain identity.
- (c) `wingcaster.io` — tech-startup vibe, may feel less trustworthy to conservative agency owners.
- (d) Something else.

**Recommendation:** (a) `wingcaster.com` primary + `wingcaster.ae` redirect. Best of both.

### D-M-02 — Free tier signup path
Options:
- (a) Fully self-serve — visitor signs up on the site, is in the product in 60 seconds, credit card only required at first paid tier.
- (b) Verification-gated — visitor requests access, we email an invite after RERA/DLD number check.
- (c) Book-a-demo only — no self-serve at launch, every prospect talks to us first.

**Recommendation:** (a) fully self-serve free tier. Friction kills top-of-funnel. Agencies with 10+ seats can still `Book a demo` for hand-holding.

### D-M-03 — Launch urgency
Options:
- (a) Ship in <2 weeks — accept Framer nocode + minimal SEO polish + English-only at launch.
- (b) Ship in 4-6 weeks — Next.js proper, English + Arabic at launch, SEO baseline in place.
- (c) Ship when it's ready — no external pressure.

**Recommendation:** (b). Arabic RTL at launch is non-negotiable given the market; Framer's Arabic RTL story is weak; 4-6 weeks is realistic if D-M-06 is a mature Design AI.

### D-M-04 — Repo strategy
Options:
- (a) Separate repo `wingcaster-www` — cleanest, own CI/deploy, no risk of breaking product from marketing pushes.
- (b) Monorepo subdirectory `marketing/` alongside `backend/` and `web/` — one place to grep, shared token package possible.

**Recommendation:** (a) separate repo. The marketing site's release cadence and CI needs are different from the backend; coupling them slows both down.

### D-M-05 — Bilingual URL strategy
Options:
- (a) `/ar/*` subpath (e.g., `/ar/pricing`) — cleanest for SEO, Google indexes each language separately, `hreflang` tags straightforward.
- (b) `?lang=ar` query param — one URL per page, feels less production-grade to search engines.
- (c) Separate subdomain `ar.wingcaster.com` — most invasive, requires DNS + cert, but strongest signal to Arabic search.

**Recommendation:** (a) `/ar/*` subpath.

### D-M-06 — Design AI tool
Options:
- (a) **v0 by Vercel** — best React/Next.js output, weakest at production visual polish, free tier generous.
- (b) **Framer AI** — best visual polish, hardest to hand off to Cursor (outputs Framer components, not clean React).
- (c) **Lovable** — decent React output, ships a full deployable app; overlaps with what we'd do in Cursor anyway.
- (d) **Manual Figma + freelance designer** — highest quality, slowest, most expensive.
- (e) Something else the user has already been using.

**Recommendation:** (a) v0. It's the best fit for the "Design AI outputs, Cursor implements" split we're already running.

### D-M-07 — Pricing page transparency
Options:
- (a) **Full transparency** — publish every tier price, per-active-property cost, all included/excluded features. Enterprise via `contact us`.
- (b) **Ranges only** — publish price ranges ("from $X/mo"), require sign-up or contact for exact numbers.
- (c) **Contact-only** — no numbers on the site, every price is negotiated.

**Recommendation:** (a) full transparency. Serious MENA agency buyers do the math before contacting — hiding prices costs top-of-funnel.

### D-M-08 — Positioning tagline
This isn't for the doc — it's the actual tagline that goes at the top of the home page. Options to consider (draft, not commitments):

- (a) "**The real-estate operating system MENA agents actually use.**" — vertical + geographical claim, strong.
- (b) "**WhatsApp in. Listings out. Everywhere your buyers look.**" — mechanism-first, memorable, might undersell the CRM depth.
- (c) "**Post once. Publish everywhere. Never lose a lead.**" — outcome-first, feels more like a portal syndication tool than a full platform.
- (d) Something you already have in mind — say the word.

**Recommendation:** iterate on (a). It commits to vertical + geography without being pretentious. Copy-review discipline before it goes on the site.

---

## 8. Immediate next step

Answer D-M-01 through D-M-08 (either "recommendation is fine" or your alternative). Once those are locked, I'll:

1. Write `docs/design/MARKETING_WEBSITE_COPY.md` — a page-by-page copy skeleton for you to fill in with the actual words.
2. Draft the `CURSOR_MARKETING_SITE_SCAFFOLD.md` prompt (Phase 3 kickoff, but the scaffold prompt can be written now — it doesn't need copy).
3. Give you the exact input to feed the Design AI you pick in D-M-06 (a paste-able brief with the sitemap, tokens reference, character notes, and per-page purpose).

Nothing else needs to happen before we get moving.

---

## 8a. Path B decision — Kimi content ported into wingcaster-www (2026-09-05)

A parallel scaffold was produced by another AI (Kimi) at `C:\Users\AliAchkar\Documents\kimi\workspace\wingcaster\` — static HTML with real, hand-written content across 20+ pages: WhatsApp cast-fan hero, 7-dimension area radar SVG, price-band indicator, 8-capability feature grid, per-persona solutions strip, honest placeholder discipline.

Structural convergence with our Cursor scaffold was significant. Both used Broadcast tokens, both landed on the same value pitch, both produced a comparable sitemap.

**Decision:** Path B — port Kimi's content into `wingcaster-www`'s Next.js/i18n/Paddle/PostHog scaffold. Result: Kimi's UI density + our infrastructure + user's locked D-M-08 tagline.

**Executing via:** [docs/prompts/CURSOR_PORT_KIMI_CONTENT_TO_MDX.md](../prompts/CURSOR_PORT_KIMI_CONTENT_TO_MDX.md). This is the biggest content PR of the workstream (3-5 days).

**Kimi's `wingcaster/` folder becomes source-material reference** — not committed anywhere. `wingcaster-website/` (Kimi's earlier draft) is ignored entirely.

**One decision the port surfaces for you (§3.5 of the port prompt):**
- **Do we name specific portals on the marketing site** (Property Finder, Bayut, Dubizzle, OLX, Blue Door LB) or stay with Kimi's cautious "listing channels / portal syndication (rolling out)" phrasing?
- Default in the port is Kimi's cautious version. Requires a follow-up PR to swap in named portals if you choose to. Naming portals gives serious agency buyers confidence; not naming avoids "as seen on" vendor-approval friction.

## 9. Non-goals for this workstream (do NOT scope creep)

- Real Estate Bazaar's website — separate product, separate workstream, do not confuse.
- Product-side screens (Agent / Agency / PA matrices) — already covered by the four Screen Matrix docs.
- CMS selection — Phase 2 concern.
- Blog / content marketing / SEO content pillars — Phase 2 concern.
- Careers page, changelog, integrations marketplace, community — all Phase 2 or later.
- Public roadmap — deliberately vague at launch; commit to concrete quarterly milestones later.
