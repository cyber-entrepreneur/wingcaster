# Marketing Website — Copy Skeleton

**Purpose:** Every page's copy, in a form the user can fill in and Design AI + Cursor can consume verbatim.

**Author instruction:** the actual words are YOUR job — this doc is scaffolding. Sections marked `[FILL IN]` need your input. Sections in `> quote blocks` are locked from D-M-08 or prior workstream decisions. English-first. Arabic mirror comes later (Design AI can pass on the translation; a native MENA copywriter should do the final Arabic pass).

**Voice guardrails:**
- Sentences under 20 words. Punchy, declarative, no marketing throat-clearing.
- Never use "leverage", "empower", "unlock", "seamless", "solution", "unlock potential."
- Every claim must be either self-evident, a specific product capability, or ONE named integration. No "trusted by hundreds of agencies" until we have specific customer names.
- Numbers are always in `<Numeric>` component fonts (IBM Plex Mono, tabular-nums) — matters for the actual site build, not for this doc.
- Arabic mirror is not a translation — it's a rewrite by someone who sells to agents in Dubai/Riyadh/Beirut. Reserve Arabic copy work for that pass.

---

## Global — nav + footer

**Header nav (left→right, LTR):**
`Features` · `Portals` · `For agencies` · `Pricing` · `Sign in` · **`Start free`** (primary button)

**Footer sections:**
- **Product:** Features · Portals · Pricing · Changelog (Phase 2)
- **Company:** About · Contact · Careers (Phase 2)
- **Legal:** Terms · Privacy · DPA
- **Language:** EN · ع
- Bottom line: `© 2026 WingCaster. Built for MENA real estate.`

---

## `/` — Home

### Hero

**Tagline (H1):**
> **Capture · Cast · Catch · Convert.**

**Subhead (H2):**
> One system for the whole business. Enter a listing once. Cast it everywhere. Catch every lead.

**Primary CTA:** `Start free`
**Secondary CTA:** `Book a demo` (goes to `/for-agencies`)

**Visual:** hero mockup of the product's AGT-DSH-001 mobile dashboard on the left, AGN-LST-001 desktop listing table on the right (or a single mobile-first hero showing the dashboard — Design AI to iterate).

### The four Cs (equal-weight cards)

Each C is one paragraph + one link to the corresponding `/features` anchor.

**Capture — [FILL IN one sentence, ~15 words]**
Suggested seed: *"Send a listing via WhatsApp. WingCaster extracts the details, generates the media, and stages the draft — nothing to type."*
Link: `/features#capture`

**Cast — [FILL IN one sentence, ~15 words]**
Suggested seed: *"Publish to Property Finder, Bayut, Dubizzle, OLX, and your social channels from one action."*
Link: `/features#cast`

**Catch — [FILL IN one sentence, ~15 words]**
Suggested seed: *"Every inquiry from every portal lands in one inbox, labeled by source. Nothing gets lost."*
Link: `/features#catch`

**Convert — [FILL IN one sentence, ~15 words]**
Suggested seed: *"Track leads through your pipeline. Re-engage cold ones with AI-drafted follow-ups in your voice."*
Link: `/features#convert`

### Trust band (post-launch — placeholder for now)

**Copy at launch (before we have named customers):**
> Built for agents in Dubai, Abu Dhabi, Riyadh, Beirut, Amman, and Cairo.

**Copy after 5+ agency customers:**
> `[LOGO STRIP]` · [FILL IN: 3-5 agency names as a proof line]

### Pricing preview strip

**H2:** `Simple, transparent pricing.`
**Body:** `Free tier available. Paid tiers start at $15/month for 1 active property.`
**CTA:** `See all tiers →` (goes to `/pricing`)

### Bottom CTA

**H2:** `Ready to try it?`
**Body:** `Free tier. No credit card. In the product in under 60 seconds.`
**CTA:** `Start free`

---

## `/features`

**Anchor structure:** `#capture`, `#cast`, `#catch`, `#convert` — each is a full-width section with H2, body, screenshots, and a spec table.

### `#capture` — Capture

**H2:** `Capture — send a listing the way you already do.`

**Body (2-3 paragraphs, [FILL IN]):**
- Paragraph 1 seed: *"WhatsApp is where agents in this region actually work. Send us the photos and a voice memo. We extract the price, bedrooms, area, and location. A draft listing is waiting when you're back at your desk."*
- Paragraph 2 seed: *"Every message, media file, and location pin is dedup'd and staged. The AI picks the hero image, drafts a description in English or Arabic, and stages the whole thing for your review before anything goes live."*
- Paragraph 3 seed: what the credit costs are, what the free tier includes, what the AI providers are (OpenAI + Anthropic with fail-over).

**Spec table:**
| | |
|---|---|
| Input channels | WhatsApp Business, web upload |
| AI providers | OpenAI GPT-4o-mini, Anthropic Claude Haiku 4.5 (fail-over) |
| Languages | English, Arabic (extraction; RTL captions Phase 2) |
| Media | Photos, videos, voice memos, PDF floor plans |
| Location | WhatsApp location pins, text address, Google Places lookup |

**Screenshot:** product AGT-WLB-001 (WhatsApp intake screen) + the resulting AGT-LST-003 (mobile listing detail).

### `#cast` — Cast

**H2:** `Cast — every portal in this region, one action.`

**Body:** [FILL IN — same pattern as Capture. Emphasize:]
- Portal list with per-portal notes (source of truth: [PORTAL_LIST_RESEARCH_2026-09-04.md](PORTAL_LIST_RESEARCH_2026-09-04.md)).
- Social channels — Instagram Business, Facebook Pages, TikTok, X, LinkedIn, WhatsApp.
- AI post creation — captions per platform in the tone the platform expects.
- Broadcast theme — every branded asset uses your agency's palette + logo.

**Spec table:**
| | |
|---|---|
| Real-estate portals | Property Finder (critical path), Bayut, Dubizzle, OLX, Blue Door LB, more coming |
| Social channels | Instagram, Facebook, TikTok, X, LinkedIn, WhatsApp status |
| Post creation | AI-generated per-channel captions (English at launch, Arabic Phase 2) |
| Compliance | RERA, DLD, RAK permit numbers required and validated per emirate |

**Screenshot:** the publish-to-all-channels action + the per-channel post preview.

### `#catch` — Catch

**H2:** `Catch — every inquiry, from every source, in one inbox.`

**Body:** [FILL IN.] Key beats:
- Inquiries from PF, Bayut, Dubizzle, Blue Door, OLX all funnel to one inbox.
- Every conversation is labeled by source — you know if the lead came from WhatsApp status, Instagram DM, or a Bayut inquiry.
- Real Estate Bazaar (our consumer portal, sister product) feeds inquiries here too. Same inbox, different label.
- Duplicate leads (same buyer, multiple portals) are auto-merged.

**Spec table:**
| | |
|---|---|
| Inbound sources | 6 portals + 6 social channels + email + WhatsApp direct |
| Deduplication | Automatic on phone + email match |
| Labeling | Every message tagged with source portal / social channel / WhatsApp status view |
| Notifications | Email, SMS, WhatsApp, in-app, push (iOS + Android) |

**Screenshot:** the unified inbox with source labels visible.

### `#convert` — Convert

**H2:** `Convert — track every deal from first message to closed.`

**Body:** [FILL IN.] Key beats:
- CRM stages: New · Qualified · Viewing · Offer · Contract · Closed.
- Pipeline visualization + weighted forecast.
- AI-drafted re-engagement for cold leads (in your voice, not generic).
- Task automation: reminders to follow up, viewing confirmations, offer expiry alerts.

**Spec table:**
| | |
|---|---|
| Pipeline stages | 6 default; customizable per agency |
| Forecasting | Weighted by stage probability + expected close date |
| Automations | Follow-up reminders, viewing confirmations, offer-expiry alerts |
| Reporting | Agent-level and agency-level dashboards (Agency plan and above) |

**Screenshot:** the CRM pipeline view (AGT-CRM-001) + the re-engagement AI compose modal.

---

## `/pricing`

**H1:** `Simple, transparent pricing.`

**Subhead:** `Pay for what you list. Not per seat, not per feature. One active-property count sets the tier.`

### Free trial (one-time)

**Model locked 2026-09-05:** one free active listing per identity, one time ever. Identity = email + phone + username; a returning user (same email OR phone OR username) does not get another free trial. See [MARKETING_WEBSITE_KICKOFF.md §6c](MARKETING_WEBSITE_KICKOFF.md) for the backend dedup requirement.

**Copy seed (rewrite in your voice):**
> **Try WingCaster free** · $0
> Post one listing on us. No card. When you're ready for your second listing, pick a paid tier.

**FAQ addition (goes in the pricing FAQ below):**
- **What happens after my free trial listing?** You keep everything you built — the CRM, the inbox, the imported portals stay in your account. To post a second listing, upgrade to any paid tier.
- **Can I claim the free trial twice?** No. Each free trial is tied to your email, phone, and username. If any of those match a prior free-trial account, you'll be prompted to sign in to that account or subscribe.
- **What if I lose access to my old email?** Contact support. We don't grant a second free trial, but we can help you recover the original account.

**Copy DON'Ts:**
- Don't call it "Free forever" or "Free tier" — inaccurate and creates expectation whiplash when the second listing needs paying.
- Don't call it a "14-day trial" or any time-bounded language — it's listing-bounded, not time-bounded.
- Don't hide the one-listing limit — put it in the hero copy, not just the fine print.

### Paid tiers table

| Tier name | Active properties | Monthly price | Best for |
|---|---|---|---|
| Starter | 1 | **$15** | Solo agent testing the waters |
| Small team | 3 | **$40** | Growing solo or two-agent team |
| Growth | 10 | **$99** | Established solo or small agency |
| Agency | 30 | **$175** | Multi-agent agency, one office |
| Brokerage | 60 | **$250** | Multi-office brokerage |
| Enterprise | 100 | **[FILL IN — P1]** | Regional or multi-country brokerage |

Every tier includes: WhatsApp intake, all portal integrations, unified inbox, CRM, English + Arabic support, all social channels, AI post creation, credit-metered AI features.

**Currency:** all prices in USD. VAT handled by Paddle (our merchant of record) per local jurisdiction.

**Above 100 properties:** `Contact sales for volume pricing.` (`Book a demo` CTA)

### FAQ

Standard FAQ block. Each `[FILL IN]` is one paragraph.

- **What counts as an active property?** [FILL IN — needs a precise definition from your side.]
- **What happens if I go over my tier's property limit?** [FILL IN — auto-upgrade, block, or something else?]
- **Can I downgrade?** [FILL IN — mid-cycle? end-of-cycle only?]
- **Is there an annual discount?** [FILL IN — usually 15-20% for annual pre-pay. Your call.]
- **Do you support VAT invoicing?** Yes — Paddle handles VAT for KSA, UAE, and all other jurisdictions where we sell.
- **Can I cancel anytime?** Yes. No lock-in. Your data exports on cancellation.
- **What about AI credits?** [FILL IN — the metered credit model. Reference credit costs per feature.]
- **Is Arabic support the same on every tier?** Yes. Language is not a feature gate.

### Bottom CTA

> Not sure which tier fits? `Book a 15-minute call →`

---

## `/portals`

**H1:** `Every MENA portal that matters. Working today.`

**Subhead:** `Publish to portals in one action. Inquiries flow back in the same channel.`

### Per-portal cards (source: [PORTAL_LIST_RESEARCH_2026-09-04.md](PORTAL_LIST_RESEARCH_2026-09-04.md))

For each portal: card with logo, "Live · Beta · Coming soon" pill, one-sentence description, one-sentence caveat if any.

**Working today (target list — verify against research doc before publishing):**
- **Property Finder Group** — Live. UAE + KSA. Critical-path integration.
- **Bayut** — Live. UAE + KSA.
- **Dubizzle** — Live. UAE only.
- **OLX** — Live. MENA-wide.
- **Blue Door** — Live. Lebanon only.
- **Real Estate Bazaar** — Live. Our sister consumer portal.

**Coming soon:**
- **Aqarmap** — Egypt. Pending terms review.
- **Wasalt** — KSA. Positioning under evaluation.

Design AI should render this as a scannable grid, not a wall of text.

### Bottom CTA

> Don't see a portal you need? `Request an integration →`

---

## `/for-agencies`

**H1:** `Built for the way agencies actually run.`

**Subhead:** `Multi-agent teams, two-person approvals, per-agent quotas, unified reporting.`

### Sections

**1. Roles that reflect how you actually work.**
[FILL IN.] Beats:
- Four canonical roles: owner, admin, agent, viewer (finance / marketer / read-only as capability packs).
- Broker-of-record signs off on high-impact actions.
- Agents own their listings but the agency can pull audit trails.

**2. Two-person approvals where they matter.**
[FILL IN.] Beats:
- Vendor rate changes above 20% require two-person approval.
- Credit grants above configurable threshold require two-person approval.
- Everything is logged, exportable, and Ledger-backed.

**3. Reporting that shows the whole agency.**
[FILL IN.] Beats:
- Agent-level: activity, pipeline, forecast, conversion rates.
- Agency-level: revenue attribution, portal spend, cost per lead per portal.
- Export to CSV for your accountant.

**4. Compliance, not compliance-theatre.**
[FILL IN.] Beats:
- RERA / DLD / RAK permit validation per listing.
- Environment-scoped test data (LIVE vs TEST) so you can rehearse deployments.
- Full audit trail on every material action.

### CTA band

**H2:** `See it running with your listings.`
**Body:** `15-minute demo with your data. No slides.`
**CTA:** `Book a demo`

---

## `/about`

**H1:** `Real-estate software, built by people who use real-estate software.`

**Body:** [FILL IN — this is the founder's story page. Beats to consider:]
- Why this exists (the gap between US-first CRMs and MENA workflows).
- Who's building it (team, location, background).
- Why MENA-first (not "expansion to MENA later" — MENA from day one).
- What "Broadcast" is (our design system, since a curious visitor might click through).
- Contact — support email, physical address if applicable, WhatsApp Business number.

---

## `/legal/*`

Standard legal pages. Not this doc's concern.
- `/legal/terms` — commercial terms + acceptable use.
- `/legal/privacy` — GDPR-style privacy notice + MENA-specific data residency notes.
- `/legal/dpa` — data processing addendum, needed by any agency handling client PII.

Recommendation: use a legal template service (Termly, iubenda, or a MENA-specific vendor) rather than hand-writing these.

---

## What's next

Once the `[FILL IN]` blocks are populated and P1 + P2 are answered, this doc becomes the source of truth for the Design AI brief (Phase 2) and the per-page Cursor prompts (Phase 3).

**Suggested fill order:**
1. Home hero + four Cs paragraphs (1 hour) → unblocks Design AI on the highest-impact page.
2. Pricing FAQ + "what counts as an active property" (1 hour) → unblocks /pricing.
3. Features per-C paragraphs (2 hours) → unblocks /features.
4. For-agencies sections (1 hour) → unblocks the enterprise-track story.
5. About page (30 minutes; founder's voice).

Nothing else is on the critical path.
