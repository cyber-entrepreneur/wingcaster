# Wave 2F — SEO / Owned-Web — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main`. Migration max **773**; your block **790–809**. **Verified: no SEO/structured-data code exists — greenfield.**
- **SEO targeting is DECIDED** (see "SEO TARGETING & WEBSITE OWNERSHIP" below) — you SEO the pages WingCaster *serves*; you do NOT inject SEO into an agent's external self-hosted site.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md` (Part 4c). 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** — use exports (esp. `executions.js` for `Execution(kind='seo_page')`); no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write; RLS strict (mig 551); outside it the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); un-RLS'd reads SQL-scoped by tenant (throw if missing) — never `findAll` unbounded.
- **Wave 1 on `main`:** `backend/src/domain/{journeys,creative,audiences}`, `backend/src/lib/social-publishing`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant`). **Migration max on `main` is 773.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; cutover explicit + testful.
3. Idempotent migrations; run twice cleanly.
4. Shared enum/CHECK additions in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` (wrong-table gate vs missing seed).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG; FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; logger. Migrations `NNN_*.sql` (max 773; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts`; routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` for true pass/fail.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs; each green; targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: SEO / OWNED-WEB (structured listing pages)

### SEO TARGETING & WEBSITE OWNERSHIP (decided — do not re-litigate)
**Golden rule:** WingCaster can only do on-page SEO on pages **it serves and renders**. It can NOT inject SEO into an agent's external, self-hosted website — for those we export SEO-ready assets they apply themselves.

**Verified in code (main):** WingCaster serves white-label sites — `backend/src/lib/white-label/agency-site-config.js` (agency-level, `subdomain` + `custom_domain`), `WhiteLabelBuilderPage`, public pages `PublicWhiteLabelSitePage` / `PublicWhiteLabelPropertyPage` / `PublicAgentPortfolioPage` / `PublicAgencyPage`. An agent's own site is **external** (integration only): the "Company Website Feed" in `IntegrationSettingsPage` is an inbound listing *import*, not a page WingCaster hosts.

**Which surface is the SEO target, by agent type:**
- **Agent tagged to an agency** → the **agency white-label site** (agency-level config) is the canonical target.
- **Free agent** → their choice: their **own external website** OR a WingCaster white-label site (offer the toggle if they have both).

**What 2F does per case:**
1. **WingCaster-served surfaces** (white-label site on subdomain or the agency/agent's custom domain, + agent/agency public profile + white-label property pages) → **full on-page SEO**: SSR/correct meta, `schema.org/RealEstateListing` JSON-LD, canonical URLs, OG/Twitter, per-listing recommendations, and **sitemaps** (respecting each site's custom domain).
2. **Agent's own EXTERNAL website** → WingCaster **cannot** inject SEO. Instead: (a) generate **SEO-ready structured data / JSON-LD + a listings feed/sitemap** they can embed; (b) ensure the **publish-to-own-website** path (their integration) carries that SEO-ready markup; (c) the profile refer-link points to it. Recommendations + export, never injection.
3. **No site at all** → **Bazaar** (the consumer marketplace) carries the listing's SEO once it's live.

**Own-website integration context (not all 2F's scope — know the ecosystem):** the agent's external site integration exists for three purposes — (i) a refer-link from their profile; (ii) an *option to also publish a listing to their own site / white-label site* alongside standard portals + social (publish path — overlaps Wave 1B/2B); (iii) *receive listings FROM their site* pegged to an agent to avoid double entry (the inbound feed, already present). 2F owns the SEO markup/feed export and making the publish-to-own-site path SEO-ready; the publish/ingest plumbing itself is Wave 1B/existing.

### MISSION
Make listings **earn** organic search: SEO-optimised, indexable listing pages with structured data, sitemaps, and per-listing meta tooling. SEO is **earned, not a send** — modelled as `Execution(kind=seo_page)` for the *act* of (re)generating/optimising a page. Read reconciliation Part 4c + `docs/canonical-object-model.md` (owned-web layer).

### SCOPE — BACKEND
1. **Migrations (790–809):** listing SEO metadata (`seo_pages` or listing-page metadata: `id · property_id · slug · title · meta_description · canonical_url · og_tags JSONB · schema_jsonld JSONB · status · indexed_at`), keyed to properties. Strict RLS where tenant-scoped.
2. **Structured data:** generate valid `schema.org/RealEstateListing` (or `Product`/`Residence`) JSON-LD from property data; canonical URLs; OG/Twitter tags. Validate the JSON-LD.
3. **Sitemaps + robots:** one sitemap/robots per **WingCaster-served** site (each white-label subdomain/custom domain + public profiles); Bazaar owns the marketplace sitemap.
4. **`Execution(kind='seo_page')`** records the (re)generation/optimisation act via `executions.js`; emits appropriate Events.
5. **SEO tooling:** per-listing recommendations (title/meta length, keyword presence, alt text, content score) — HubSpot/Yoast-style, server-side.
6. **SEO-target resolver:** given an agent/listing, resolve the canonical SEO surface — **agency-tagged → agency white-label site; free agent → own external site OR white-label (their choice; toggle if both)**. Persist the choice.
7. **External-site export:** for agents whose target is their **own external website**, expose an **SEO asset bundle** (per-listing JSON-LD + OG + a listings feed/XML sitemap) via API for them to embed, and make the **publish-to-own-website** path emit that SEO-ready markup. No page injection — export only.

### SCOPE — FRONTEND
1. Per-listing SEO panel: editable title/meta/slug, JSON-LD preview, OG preview, recommendations/score.
2. **SEO-target control**: show the resolved target (agency site / white-label / own external site); for a free agent with both, a toggle to choose.
3. WingCaster-served pages render correct SSR meta/JSON-LD; for an **own external site**, surface a "copy/embed SEO assets" panel (JSON-LD, feed URL, sitemap URL) instead of an editable page.

### OUT OF SCOPE
Paid search (2A/Google Ads). Off-page SEO/backlinks. Rank tracking (fast-follow). **Injecting SEO into an agent's external self-hosted site** (export only). Building the Bazaar marketplace pages (Bazaar's own concern).

### ACCEPTANCE CRITERIA
- [ ] SEO target resolves correctly by agent type (agency-tagged → agency site; free agent → own/white-label, toggle if both).
- [ ] WingCaster-served surfaces (white-label on subdomain/custom domain + public profiles) get valid `schema.org` JSON-LD + canonical + OG + per-site sitemap (validated).
- [ ] Own-external-site case produces an embeddable SEO asset bundle (JSON-LD + feed + sitemap) and the publish-to-own-site path carries SEO markup — no page injection.
- [ ] `Execution(kind=seo_page)` records the act; SEO recommendations computed.
- [ ] Tenant-isolated where applicable via `withTenant`.

### TEST MATRIX
1. JSON-LD validity for a sample listing (schema.org RealEstateListing).
2. Canonical/OG/meta correctness + length rules.
3. Per-site sitemap includes only that site's published, indexable listings.
4. Recommendation/score computation.
5. `Execution(kind=seo_page)` + Events emitted.
6. SEO-target resolver: agency-tagged agent → agency site; free agent with both → honours the toggle.
7. Own-external-site: API returns the JSON-LD/feed/sitemap bundle; no attempt to render/inject an external page.
