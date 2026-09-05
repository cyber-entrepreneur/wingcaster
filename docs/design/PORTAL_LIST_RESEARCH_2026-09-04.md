# Portal list research — top real-estate portals per market (D8)

**Purpose:** Provide data-backed recommendations for the top 3-5 real-estate portals per market so D8 has a real default instead of a guess. WingCaster metered-feature registry and PA-MOD moderation queue depend on this list.

**Method:** WebSearch across current (2026) traffic + market-share data per country. Sources cited inline. Where data is thin, marked as such.

**Decision framing:** For each market, recommend the top 3 for Phase 1 integration (metered features + PA moderation surface) and up to 2 more marked as Phase 2 additions. Backend `features.js` registry needs one metered feature per portal per market where integration is a first-class distribution channel.

**Current code baseline:** `backend/src/lib/notifications/realestate.js` supports only 4 portals (`olx`, `property_finder`, `bayut`, `dubizzle`) tagged `region: 'MENA'` — one entry per portal globally, not per country. All 4 are `NOT_IMPLEMENTED` stubs per the backend placeholder audit.

---

## 🇦🇪 UAE — Phase 1 primary market

### Recommended top 3 for Phase 1

1. **Bayut** (`bayut.com`) — 1.68M monthly visits (April 2026, Semrush). Owned by Dubizzle Group. Strong across sale + rent segments. Partner API available with commercial agreement.
2. **Property Finder** (`propertyfinder.ae`) — 1.45M monthly visits. #1 by broker base per most industry sources. Regarded as the market leader by total listings + 35-40% market share estimates. Partner API with commercial agreement.
3. **Dubizzle** (`dubizzle.com`) — 2.33M monthly visits (highest overall traffic; more generalist classifieds including cars/jobs). Same parent as Bayut (Dubizzle Group). Real-estate-section-scoped API.

### Phase 2 additions

4. **DXBinteract** — data-intensive analytics-heavy platform; smaller consumer traffic but strong for investor targeting.
5. **Houza** — newer entrant; growing in the mid-market segment.

### Notes

- **Bayut + Dubizzle share ownership** (Dubizzle Group, listed on DFM) — likely one commercial agreement covers both.
- **Property Finder is independent** — separate agreement.
- Traffic gap between top 3 and rest is significant; sticking to the top 3 covers > 90% of consumer discovery.

---

## 🇸🇦 KSA — Phase 1 primary market

### Recommended top 3 for Phase 1

1. **Aqar** (`aqar.fm`) — 12M+ app downloads, 400M+ monthly property searches per market sources. Widely cited as #1 for Saudi property discovery.
2. **Bayut KSA** (`bayut.sa`) — same ownership as UAE Bayut but distinct KSA market presence. Strong across Riyadh + Jeddah + Dammam.
3. **Wasalt** — AI-powered portal for verified properties + auctions. Growing rapidly, particularly strong for Riyadh.

### Phase 2 additions

4. **Property Finder KSA** — smaller than UAE presence but real.
5. **Sakani** — government-linked housing platform. Different segment (primary housing) but worth surfacing to agents dealing with Sakani-eligible units.

### Notes

- **Haraj** was mentioned in some sources but it's primarily general classifieds (not real-estate specialist) — deprioritize.
- KSA market is fragmented; the top 3 cover well over 80% of consumer traffic per available data.
- **ZATCA e-invoicing implication** — if commercial deals are signed with KSA-registered portal entities, WingCaster's Paddle MoR still handles VAT collection, but portal-side integration MAY need to be aware of the tax invoice reference for the agent's own reporting. Verify at deal-signing time.

---

## 🇪🇬 Egypt — Phase 1 primary market

### Recommended top 3 for Phase 1

1. **Property Finder Egypt** (`propertyfinder.eg`) — 782.25K monthly visits (April 2026, Semrush) — the traffic leader.
2. **Aqarmap** (`aqarmap.com.eg`) — 323.94K monthly visits; 2M+ monthly visitors per its own reporting; 200k+ listings.
3. **OLX Egypt** — general classifieds with strong real-estate section; large consumer presence.

### Phase 2 additions

4. **Nawy** — rising star, focus on simplifying property search; strong for new/primary market and off-plan.
5. **Bayut Egypt** — newer market entry; listed by market research sources but smaller than the top 3.

### Notes

- Property Finder Egypt is the clear leader by consumer traffic.
- Nawy is worth watching — different UX approach (curation + off-plan focus) may become primary market for a segment of agents.
- Aqarmap has strong developer/agency relationships historically — its integration terms may favor developer accounts.

---

## 🇱🇧 Lebanon — Phase 1 primary market (with caveat)

### Recommended top 3 for Phase 1

1. **Property Finder Lebanon** (`propertyfinder.com.lb`) — top-ranked per available sources; Lebanese counterpart of the Dubai property portal, acquired by PropertyFinder.ae group.
2. **OLX Lebanon** (`olx.com.lb`) — general classifieds with a real-estate section; the backend already has a scraper for this (`modules/property-valuation/application/scraper-providers.js :: createOlxLebanonProvider`) which suggests it was targeted for a reason.
3. **3akarat** (`3akarat.net`) — Lebanese real-estate portal with home listings, agents, prices; historically well-known in Lebanese market.

### Phase 2 additions

4. **Blue Door** (the user-mentioned portal — needs confirmation of URL + current traffic; not in top hits from WebSearch but the user specifically named it earlier, so treating it as Phase 2 pending confirmation).
5. **JSK Real Estate** and other agency-branded listing sites — smaller / agency-specific.

### Notes

- **Data confidence is LOWER for Lebanon** than for UAE / KSA / Egypt. The Lebanese real-estate portal landscape is thinner and less well-documented in public sources.
- The Lebanese market has structural friction around online property discovery — per one source: "although almost all of Lebanon's competitive real estate agents accept the importance of the internet ... many are still reluctant to share details of their properties online." So the top-3 addressable-market share is smaller in absolute terms than in UAE.
- **The backend already has `property_finder_lb` + `olx_lebanon` scrapers** for INBOUND comparables data. Repurposing these into publishers (outbound) is a smaller integration lift than starting from scratch.
- **The user should confirm the exact identity of "Blue Door"** they mentioned earlier in the session — the WebSearch did not surface a portal named exactly this in Lebanon, so it may be an agency, a private-sector player, or a name the user knows better than public sources reflect.

---

## Secondary MENA markets (Phase 2 — defer per D8 default)

If Phase 1 goes well and expansion capacity opens up, these are the next markets in order of GDP-per-capita + digital-real-estate maturity:

### 🇯🇴 Jordan
- **OpenSooq** — regional Levant classifieds giant; dominant
- **Bayut Jordan**
- **Property Finder Jordan**

### 🇶🇦 Qatar
- **Property Finder Qatar**
- **Qatar Living** (general classifieds with strong real-estate section)

### 🇰🇼 Kuwait
- **Q84Sale** (dominant Kuwaiti classifieds)
- **Property Finder Kuwait**

### 🇧🇭 Bahrain
- **Property Finder Bahrain** (leader by default; market is small)

### 🇴🇲 Oman
- **Property Finder Oman** (leader; market is small)

**Recommendation:** Phase 2 markets get generic OLX + Property Finder integrations (both are pan-regional so one integration serves multiple countries with per-country configuration). Don't build market-specific portal adapters for Phase 2 until a customer specifically demands it.

---

## Backend implication — extending `features.js`

The current `features.js` has ONE entry per portal globally (`publishing.realestate.olx`, `publishing.realestate.property_finder`, `publishing.realestate.bayut`, `publishing.realestate.dubizzle`). For per-country pricing + moderation, the schema needs either:

- **Option 1: Per-country feature codes** — `publishing.realestate.bayut.ae`, `publishing.realestate.bayut.sa`, `publishing.realestate.aqarmap.eg`, etc. Explicit, but 15+ new feature codes.
- **Option 2: Country dimension on the metered event** — keep one feature code per portal, add `country_code` to the metering event payload for pricing / analytics. Simpler feature registry, more work in pricing config.

**Recommend Option 2.** Simpler feature registry + per-country pricing configured via `fin.prices` versioning (already versioned per-feature) with a `region` dimension. Backend change: extend `metered_features.data.regions` array with supported countries; `fin.prices` gets a `country_code` column on the version.

New portals to add to the registry:

- `publishing.realestate.aqar` (KSA)
- `publishing.realestate.wasalt` (KSA)
- `publishing.realestate.aqarmap` (Egypt)
- `publishing.realestate.3akarat` (Lebanon — needs confirmation this is the right identifier vs. `blue_door`)

Total new metered features: 4 (Aqar, Wasalt, Aqarmap, 3akarat), plus per-country data flag on existing 4 (Bayut / PF / Dubizzle / OLX which are pan-regional).

---

## Ranked commercial-agreement priority (for BD track)

For each portal you'll need a commercial agreement (Bayut / PF / Dubizzle at minimum require partner API access via a commercial deal). Approach in this order:

1. **Property Finder Group** — one deal covers UAE + KSA + Egypt + Lebanon + Jordan + Qatar + Kuwait + Bahrain + Oman. Highest ROI per agreement.
2. **Dubizzle Group (Bayut + Dubizzle)** — one deal covers UAE + KSA + Egypt.
3. **Aqar** (KSA-specific).
4. **Aqarmap** (Egypt-specific).
5. **Wasalt** (KSA-specific — newer entrant, likely more flexible on terms).
6. **OLX MENA** — pan-regional; potentially the most permissive integration (has public XML feed for some markets already).
7. **3akarat** (Lebanon-specific).

Rough BD timeline per deal: 2-8 weeks depending on portal size + partnership tier. Property Finder + Dubizzle group deals often 4-8 weeks. Smaller portals often faster.

---

## Recommendation for user's D8 decision

**Confirm this list within the D8 deadline (2026-09-11) OR let the default stand.** The default = the ranked list above. Backend `features.js` extends to include Aqar / Wasalt / Aqarmap / 3akarat. PA-MOD-001 supports moderation for all 8 (4 existing + 4 new) at launch, with country attribution.

**One clarification you should provide:** the exact identity of "Blue Door" you mentioned earlier — is that a Lebanese portal name I'm missing, or a specific agency, or does it map to one of the portals above under a different name?

---

---

## Rev 2 additions — 2026-09-04 (post architect-owner review)

The portal SELECTIONS are strong. Missing: how the agent EXPERIENCES the integration. Seven new sections + one strategic-question-driven restructure below.

### A. Agent portal account model — P0 product-strategy blocker

**Question:** Does each agent bring their own pre-existing Bayut/PF/Dubizzle account with API credentials, does WingCaster broker a master agency agreement + sub-allocate publishing slots, or a hybrid?

**Three sub-models to negotiate per portal:**

- **Sub-model X — Agent BYO credentials.** Agent already has (or creates) their own portal account, connects to WingCaster via OAuth or an API key stored in WingCaster's encrypted credentials store. Publishing happens under the agent's own account.
  - Pros: agent owns the relationship + billing; WingCaster has zero portal liability; scales without commercial deal
  - Cons: onboarding friction (agent must have + configure the portal account); adoption gated on the agent having / getting each portal's account; per-portal auth flows to maintain
- **Sub-model Y — WingCaster brokers master agreement.** WingCaster signs one commercial deal with the portal, gets a bulk API allocation, sub-allocates publishing slots to agents via internal quota. Publishing happens under WingCaster's account with `posted_by=<agent>` metadata.
  - Pros: instant onboarding (agent needs zero portal account); WingCaster negotiates volume pricing; single audit trail
  - Cons: WingCaster owns the relationship + liability; portal may reject; revenue share to portal; complex billing
- **Sub-model Z — Hybrid.** If agent has their own credentials, use them (Sub-model X path). If not, use WingCaster's brokered slot (Sub-model Y path). Best UX, most complex to build.

**Different portals may prefer different sub-models.** Bayut may only accept Sub-model X (individual agent accounts). OLX may only accept Sub-model Y (feed-based bulk). Property Finder may support both.

**MUST resolve per-portal before backend integration work begins.** Decision blocks: `features.js` shape (per-agent-credential or per-tenant-broker), auth flow UI (AGT-CHN-* for portals), and per-portal PA-MOD moderation semantics.

### B. Inbound lead flow per portal — total gap in original doc

Original doc is publish-only. It doesn't address whether leads generated on portals flow BACK into WingCaster's CRM.

**Per architect-owner review: inbound is arguably HIGHER agent value than outbound.** A portal that generates 10 leads with 2 conversions > a portal with 100 views and 0 leads. If WingCaster's CRM is the agent's central nervous system, capturing portal leads INTO WingCaster is essential.

**Per-portal inbound spec:**

| Portal | Inbound mechanism (if known) | Priority |
|---|---|---|
| Bayut | Partner API includes leads endpoint (subject to commercial tier) | **P0** |
| Property Finder | Partner API + email-forward + webhook per tier | **P0** |
| Dubizzle | Web-form → email; scraping-fragile | **P1** — verify at BD |
| OLX | Contact button → email or platform message; per-country varies | **P1** — verify at BD |
| Aqar (KSA) | In-app chat + email — unknown API availability | **P1** — verify at BD |
| Wasalt | API mentioned in marketing but details thin | **P1** — verify at BD |
| Aqarmap (EG) | Partner API with tier | **P0** |
| 3akarat (LB) | Unknown | **P2** |

Every inbound inquiry lands in WingCaster's unified inbox (AGT-INB-001) with `source=<portal>` badge (per `SCREEN_MATRIX_AGENT.md` AGT-INB-005). Attribution back to the specific listing publish enables per-post-ROI in AGT-LST-006 analytics.

**Recommendation:** treat inbound-lead-flow as INSEPARABLE from outbound-publishing per portal. If a portal's commercial deal doesn't include inbound leads, that portal is worth LESS to WingCaster agents than the outbound-only value suggests.

### C. Per-portal validation rules for PA-MOD

Each portal has different required fields, image specs, category trees, price format expectations. PA-MOD-001 queue must enforce per-portal validation BEFORE PA sees the item — otherwise queue fills with portal-rejects PA can't fix.

**Per-portal validation table (indicative, verify at BD):**

| Portal | Known-required fields not in WingCaster's canonical listing | Image spec | Category tree |
|---|---|---|---|
| Bayut (UAE) | `trakheesi_number` (Dubai permit), `broker_orn` | Min 800px, JPG/PNG, ≤5MB | Bayut's own taxonomy — needs mapping table |
| Property Finder (UAE) | `agency_license`, `broker_id` | Min 1200px, JPG/PNG | PF taxonomy — needs mapping |
| Bayut KSA | `advertiser_license` (Fal license) | Same as UAE | KSA-specific taxonomy overlay |
| Wasalt (KSA) | AI-verification metadata (auto-populated?) | TBD | Wasalt taxonomy — thin docs |
| Aqarmap (EG) | `developer_registration` for primary/off-plan | Min 600px | Aqarmap taxonomy |
| Property Finder (EG / LB / etc.) | Country-variant of UAE spec | Same | Country-variant taxonomy |

**PA-MOD-002 (submission detail) MUST render per-portal validation lint results BEFORE PA sees the manual-review action.** Rejection message must name WHICH portal + WHICH field + WHAT'S expected. Backend needs a per-portal validator module (e.g., `backend/src/lib/portal-validators/{bayut,property_finder,dubizzle,olx,aqar,wasalt,aqarmap,3akarat}.js`).

### D. Lebanon structural friction — reframe as market-risk

Original doc flagged Lebanese agents as "reluctant to share property details online" — I called it a data-confidence caveat. Per architect-owner review: this is a MARKET-FIT RISK, not a data caveat.

**Implication:** even with a technically-perfect Lebanon portal integration, adoption is structurally capped. Agents may reject the value prop because the underlying behavior (publish full details online) isn't compatible with their operating model.

**Lebanon-specific product design consideration:**
- **Teaser-listing publish mode:** publish price + area + district + hero photo to portals; full details (address, floor plans, agent contact) revealed ONLY when a qualified lead requests via WhatsApp
- **WhatsApp-gated inquiry flow:** portal shows "Contact agent via WhatsApp for full details" (deep-link to WingCaster's WhatsApp intake number)
- **Anonymized cross-portal listings:** agent's listing appears on multiple portals with agent identity hidden; leads route through WingCaster's shared number then attribute back to the agent
- This preserves the Lebanese agents' "control the disclosure" pattern while still getting portal reach

**Recommendation:** design Lebanon publish flow separately from UAE/KSA/EG. Don't force portal-published-with-full-details behavior on agents who reject it. Lebanon may lead with 3akarat + a WingCaster-hosted teaser-listing model instead of driving hard on OLX + PF.

### E. Aqarmap developer-favoritism — risk to verify at BD

If Aqarmap's commercial terms favor developer accounts (bulk primary/off-plan) over individual agents (resale/secondary), then:
- Individual agents may face higher API fees, lower listing priority, restricted premium-feature access
- WingCaster's Aqarmap integration creates a two-tier experience (developers get full Aqarmap functionality, agents get degraded)

**Mitigation:**
- Verify at BD whether Aqarmap offers a small-agency / individual-agent tier
- If not: consider agency-level aggregation (WingCaster brokers a small-agency-pool tier on Aqarmap under the sub-model Y path)
- If neither: push Aqarmap to Phase 2 for Egypt; lead with PF Egypt + OLX Egypt

### F. Wasalt "AI-powered" — positioning callout

Wasalt markets itself as AI-powered (verified properties, AI matching). If agents ask "why do I need WingCaster's AI when Wasalt already has AI?", WingCaster's answer needs to be crisp:

- **Wasalt AI** = single-portal listing verification + property-match (property-side)
- **WingCaster AI** = cross-channel workflow AI — WhatsApp voice → structured listing → per-channel captions → unified inbox routing → lead scoring → drip campaigns (agent's operations-side)

The AIs solve DIFFERENT problems. WingCaster is upstream of Wasalt in the agent's day. This is a marketing/positioning task — not a portal-selection issue — but flagging so it's visible.

### G. Metering event granularity — define now

Ambiguity: is a metering event fired per (listing × portal × publish) OR per (listing × portal × month active)?

**Definition (recommended):**
- **Publish event** — one metered event per (listing × portal) at the moment of publish. Charges the agent's per-portal credit once per publish action.
- **Republish event** — auto-repost by a saved-search-alert-scheduler or a manual republish fires a NEW event, charged again. Prevents free-riding via auto-repost.
- **Update event** — updating an already-published listing (price change, photo swap) fires ONE update event per (listing × portal), charged at ~30% of the publish rate (cheaper than a fresh publish).
- **Removal event** — un-publishing is FREE (no metering).

Add to `features.js` metering event payload: `{event_type: 'publish' | 'republish' | 'update' | 'removal', listing_id, portal, country_code}`. Pricing per event type in `fin.prices`.

Transparent to agents on AGT-SUB-003 credits page: "1 listing × 3 portals × 1 publish + 2 updates = 3 credits (publish) + 0.9 credits (updates) = 3.9 credits."

---

## Rev 2 restructure — Property Finder Group as Phase-1 critical path (per D19 a)

**User confirmed 2026-09-04:** PF drives the most high-intent leads across every WingCaster target market. Therefore Property Finder Group deal is not just "highest ROI" — it is **the ONE Phase-1 portal integration that must ship for agent revenue**. Everything else is deprioritizable.

### Revised Phase-1 sequencing (was 8 portals; now 1 critical + 7 optional)

**Tier 0 — Critical path (single-portal launch is viable with this alone):**

1. **Property Finder Group** — one commercial agreement covers PF UAE (`propertyfinder.ae`) + PF KSA + PF Egypt (`propertyfinder.eg`) + PF Lebanon (`propertyfinder.com.lb`) + PF Jordan + PF Qatar + PF Kuwait + PF Bahrain + PF Oman. **9 countries with one deal.**
   - BD lead-time: 4-8 weeks (larger portal, more legal cycles)
   - Backend integration: 3-5 days per API adapter (may be one adapter for all countries given PF's platform, or country-variant)
   - Inbound lead flow: partner API included in higher tier — negotiate for
   - **Ship Phase-1 with PF only if BD or engineering capacity tightens.** WingCaster still delivers agent value.

**Tier 1 — High value, dispatch when capacity available:**

2. **Dubizzle Group** — one deal covers Bayut + Dubizzle across UAE + KSA + EG. Second-most reach after PF Group. Priority second BD.
3. **Aqar (KSA-specific)** — dominant in KSA per 12M downloads. Priority third BD.
4. **Aqarmap (EG-specific)** — dominant in Egypt after PF. Priority fourth BD (subject to §E terms-verification).

**Tier 2 — Nice to have, dispatch if capacity + demand:**

5. **OLX MENA** — pan-regional, often permissive; scraping-fallback if API unavailable
6. **Wasalt (KSA)** — newer entrant, likely flexible terms
7. **3akarat (LB)** — Lebanon-specific, subject to §D market-fit reframing
8. **Blue Door (LB)** — pending user's identity confirmation of what "Blue Door" refers to

### Revised BD priority table

| Priority | Portal / group | Countries covered | Estimated BD lead-time | Ship Phase 1? |
|---|---|---|---|---|
| **1** | Property Finder Group | 9 (UAE/KSA/EG/LB/JO/QA/KW/BH/OM) | 4-8 weeks | **Critical path** |
| 2 | Dubizzle Group (Bayut + Dubizzle) | 3 (UAE/KSA/EG) | 4-8 weeks | Yes if capacity |
| 3 | Aqar (KSA) | 1 | 2-4 weeks | Yes if capacity |
| 4 | Aqarmap (EG) | 1 | 2-4 weeks | Verify terms first |
| 5 | Wasalt (KSA) | 1 | 2-4 weeks | Phase 2 |
| 6 | OLX MENA | Multiple | 1-2 weeks or scrape-based | Phase 2 |
| 7 | 3akarat (LB) | 1 | 2-4 weeks | Phase 2 |
| 8 | Blue Door (LB) | 1 | Unknown | Pending identity clarification |

### Implication for backend `features.js`

Given PF is critical path + covers 9 countries, the `publishing.realestate.property_finder` feature with a `country_code` metering dimension (Option 2 from original doc) is more essential than ever. First `features.js` update:

- `publishing.realestate.property_finder` — add `regions: ['AE','SA','EG','LB','JO','QA','KW','BH','OM']` to `metered_features.data`
- `fin.prices` gets `country_code` column on price versions so per-country PF pricing is possible

Other portal features stay as originally defined but explicitly marked "Phase 2 unless BD lands the deal."

### Ship-with-just-PF viability check

If ONLY PF Group ships in Phase 1:
- **UAE agents:** PF is #1 by broker base — solid single-portal experience
- **KSA agents:** PF KSA less dominant than Aqar/Bayut — thinner experience, but works
- **Egypt agents:** PF #1 by traffic (782K/mo) — solid
- **Lebanon agents:** PF LB well-known — solid, though subject to §D market-fit caveat
- **Jordan/Qatar/Kuwait/Bahrain/Oman:** PF is present but not dominant — thin, but present

**Verdict:** Phase-1 with PF-only is a viable MVP for agent-facing portal integration. Additional portals compound reach but do not gate launch.

---

## Sources

- [Top Real Estate Websites in United Arab Emirates - April 2026 - Semrush](https://www.semrush.com/website/top/united-arab-emirates/real-estate/)
- [Best Property Portals UAE 2026: Bayut vs Property Finder](https://www.uaeexperthub.com/best-property-portals-uae/)
- [Best Property Portals in Dubai: The Ultimate Guide to Property Finder, Bayut & Dubizzle 2026](https://knsproperty.com/best-property-portals-in-dubai/)
- [Bayut KSA - Real Estate](https://www.bayut.sa/en/)
- [Aqar - Saudi Real Estate](https://play.google.com/store/apps/details?id=fm.aqar)
- [Key Aqar (Wasalt equivalent) - AI-Powered Property Portal](https://keyaqar.com/)
- [Best Real Estate Website in Saudi Arabia - ARAB MLS](https://arabmls.org/best-real-estate-website-in-saudi-arabia/)
- [Most Visited Real Estate Websites in Egypt April 2026 - Semrush](https://www.semrush.com/trending-websites/eg/real-estate)
- [Egypt Online Real Estate Portals Market - Ken Research](https://www.kenresearch.com/egypt-online-real-estate-portals-market)
- [Aqarmap Egypt](https://aqarmap.com.eg/en/)
- [Best Real Estate Website in Egypt](https://elbayt.com/en/real-estate/best-real-estate-website-in-egypt)
- [Real Estate Lebanon - Properties in Lebanon (Property Finder LB)](https://propertyfinder.com.lb/)
- [3akarat.net - Buy Sell Real Estate Lebanon](https://www.3akarat.net/)
- [Properties a click away - Executive Magazine (Lebanon context)](https://www.executive-magazine.com/business-all/real-estate/properties-click-away)
- [Best Property Listing Platforms in the GCC & MENA Region](https://boyot.app/blogs/1/best-property-listing-platforms-in-the-gcc-mena-region.html)
