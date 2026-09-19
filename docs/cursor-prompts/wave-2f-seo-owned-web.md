# Wave 2F — SEO / Owned-Web (structured listing pages)

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged. Migration block: **790–809**. **Verified: no SEO/structured-data code exists today — greenfield.**

## MISSION
Make listings **earn** organic search: SEO-optimised, indexable listing landing pages with structured data, sitemaps, and per-listing meta tooling. SEO is **earned, not a send** — it's a supporting capability, modelled as `Execution(kind=seo_page)` for the *act* of (re)generating/optimising a page.

Read `docs/campaign-and-social-publishing-reconciliation.md` Part 4c and `docs/canonical-object-model.md` (owned-web layer).

## ⚠️ FIRST: resolve the Bazaar boundary
Public listing pages likely live on **Real Estate Bazaar** (the consumer product), not the WingCaster B2B app (`[[project_wingcaster_vs_bazaar]]`). **Before building, confirm where the public listing page is served.** If Bazaar owns the page, this wave = WingCaster produces the SEO *inputs* (structured metadata, content recommendations, `Execution(kind=seo_page)` records) and Bazaar renders them. If unclear, STOP and raise it — do not build a duplicate public page in the WingCaster app.

## SCOPE — BACKEND
1. **Migrations (790–809):** listing SEO metadata (`seo_pages` or listing-page metadata: `id · property_id · slug · title · meta_description · canonical_url · og_tags JSONB · schema_jsonld JSONB · status · indexed_at`), keyed to properties. RLS where tenant-scoped.
2. **Structured data:** generate valid `schema.org/RealEstateListing` (or `Product`/`Residence` as appropriate) JSON-LD from property data; canonical URLs; Open Graph/Twitter tags. Validate the JSON-LD.
3. **Sitemaps + robots:** generate/refresh XML sitemaps for published listings (wherever the pages are served — coordinate with the Bazaar boundary).
4. **`Execution(kind=seo_page)`** records the (re)generation/optimisation act via Wave 0 `executions.js`; emits appropriate Events.
5. **SEO tooling:** per-listing recommendations (title/meta length, keyword presence, alt text, content score) — HubSpot/Yoast-style, computed server-side.

## SCOPE — FRONTEND
1. Per-listing SEO panel: editable title/meta/slug, JSON-LD preview, OG preview, and the recommendations/score.
2. If pages are WingCaster-served: the indexable listing page (SSR/meta correct). If Bazaar-served: the panel writes metadata Bazaar consumes.
3. `--lc-*` tokens; accessible; responsive.

## OUT OF SCOPE
Paid search (2A/Google Ads). Off-page SEO/backlinks. Rank tracking (fast-follow). Building a public consumer page if Bazaar owns it.

## ACCEPTANCE CRITERIA
- [ ] Bazaar boundary resolved + documented before building.
- [ ] Valid `schema.org` JSON-LD + canonical + OG generated per listing (validated).
- [ ] Sitemap generation for published listings.
- [ ] `Execution(kind=seo_page)` records the act; SEO recommendations computed.
- [ ] Tenant-isolated where applicable via `withTenant`.

## TEST MATRIX
1. JSON-LD validity for a sample listing (schema.org RealEstateListing).
2. Canonical/OG/meta correctness + length rules.
3. Sitemap includes only published, indexable listings.
4. Recommendation/score computation.
5. `Execution(kind=seo_page)` + Events emitted.
