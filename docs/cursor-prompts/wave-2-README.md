# Wave 2 — Orchestration & how to run the pack

**Prerequisite:** Waves 0 + 1 merged to `main`. Wave 2 builds on the canonical spine (`channels`, `executions`, `events`, `consent`) **and** Wave 1's `journeys`, social publishing, `creatives`, `audiences`. Do not start until those are in.

**Prepend `_house-rules.md` to every module prompt.** (Non-negotiables, conventions, verification, PR format.)

## The six modules
| Module | Prompt | Builds | Realistic depth |
|---|---|---|---|
| **2A Paid Ads** | `wave-2a-paid-ads.md` | Meta + Google (incl. Gmail/Demand Gen) channels; `Execution(kind=paid_ad)`; objective/budget/targeting; **connect-ready shells** | Shell now; live only after external approval (the clock you started in parallel) |
| **2B Content Calendar** | `wave-2b-content-calendar.md` | Unified publishing control plane: calendar, drafts, previews, network validation, drag-reschedule | Fast-follow |
| **2C Attribution & Commission** | `wave-2c-attribution-commission.md` | `Conversion` + `AttributionCredit` engine over Events; campaign rollups → **commission/ROAS** | Fast-follow — the moat |
| **2D Experimentation** | `wave-2d-experimentation.md` | `Experiment` + `ExperimentAssignment`; A/B/n on creative/copy/cta/channel/timing/journey; holdouts | Post-PMF |
| **2E Journey Engine 2.0 + ContactPolicy** | `wave-2e-journey-engine-contactpolicy.md` | Full branching/condition/suppression UI; `ContactPolicy` (frequency caps, quiet hours, conflict/priority) wired into `checkEligibility` | Fast-follow |
| **2F SEO / Owned-Web** | `wave-2f-seo-owned-web.md` | SEO listing pages + schema.org structured data + sitemaps + meta tooling | Post-PMF; may be Bazaar-side |

## Coordination
1. **Migration number blocks** (re-check the live max first; take the lowest free within your block): 2A `700–719` · 2B `720–729` · 2C `730–749` · 2D `750–769` · 2E `770–789` · 2F `790–809`.
2. **Everyone imports the Wave 0 access layer** (`executions.js`, `events.js`, `consent.js`, `channels.js`) and the Wave 1 modules they depend on. Nobody re-implements publishing, eligibility, or event ingestion.
3. **One owner per table.** 2A owns nothing new beyond paid channel config on `channels`/`executions`; 2C owns `conversions`+`attribution_credits`; 2D owns `experiments`+`experiment_assignments`; 2E owns `contact_policies`+the branch runtime; 2F owns `seo_*`/page metadata.
4. **Cross-refs stay nullable** (Wave 0 already made `executions.creative_id`/`audience_id` nullable; `events.execution_id`/`campaign_id` populated by Wave 1).

## Dependency order (natural merge sequence; none hard-blocks another)
**2C + 2E** are the highest-value fast-follows (commission attribution + real journey depth) → **2B** (calendar) → **2A** (paid, when approvals land) → **2D/2F** (post-PMF). 2C depends on Wave 1 emitting the `business`/`engagement` Events per `docs/event-taxonomy-catalog.md`.

## The external clock (unchanged)
2A cannot go **live** until Meta/Google business verification + app review complete on their side. Build the shells now; light them up on approval. Same for WhatsApp marketing templates (needed by Wave 1B/1A messaging) and Google Demand Gen (the legit "Gmail ads" path).

## Definition of done for the wave
Each module: its DoD met, Real-PG + FE tests green (CI-equivalent output pasted), PRs merged to `main`, no regression (expand-contract). 2A merges as shells with feature flags OFF until approvals land.
