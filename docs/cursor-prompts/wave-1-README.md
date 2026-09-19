# Wave 1 — Orchestration & how to run the pack

**Prerequisite:** Wave 0 (canonical foundation: `channels`, `executions`, `events`, `consent` + access layer) is **merged to `main`**. Wave 1 imports that layer; do not start Wave 1 modules until Wave 0 has landed, or they will build on shifting sand.

## The four modules (run in parallel — one Cursor agent each)
| Module | Prompt | Builds | New tables |
|---|---|---|---|
| **1A Journeys** | `wave-1a-journeys.md` | Rename + reconcile #294/#302/#311 into one Journey builder; branch-capable engine; send-nodes emit canonical Executions; consent-gated | `journeys`, `journey_versions`, `journey_runs`, `journey_node_runs` |
| **1B Social publishing** | `wave-1b-social-publishing.md` | Consolidate 3 publish paths onto real path B; wire the UI; **all** connected platforms deliver | none (uses `executions`) |
| **1C Creative + AI composer** | `wave-1c-creative-ai-composer.md` | Creative Asset Service; AI Adaptive Composer (≥4 variants/channel); AI-content approval gate | `creatives`, `creative_variants`, `creative_renditions`, `approval_requests` |
| **1D Audience** | `wave-1d-audience.md` | Extract inline rules into first-class Audience + consent-aware membership | `audiences`, `audience_memberships` |

## How to launch each agent
Prepend `_house-rules.md` to the module prompt, then paste both into the Cursor agent as its task. (House rules carry the non-negotiables; the module carries the scope.)

## Coordination rules (so parallel agents don't collide)
1. **Migration number blocks** (continue from the true max after Wave 0; these are reserved ceilings, take the lowest free numbers within your block):
   - 1A → `600–619` · 1C → `620–644` · 1D → `645–664` · 1B → `665–669` (1B is mostly logic; only needs numbers if it adds views).
   Re-check the live max before writing; never reuse a number.
2. **Cross-module references are nullable + loosely coupled.** `executions.creative_id` (owned by 1C), `executions.audience_id` (1D), and a Journey `send` node's `creative_id` (1C) are **nullable TEXT columns with an index, no hard FK during Wave 1** (Wave 0 already created them this way). No module blocks another; hard FKs are added in a later tightening pass.
3. **Everyone imports Wave 0's access layer** (`executions.js`, `consent.js`, `channels.js`, `events.js`). Nobody re-implements publishing, execution state, or eligibility.
4. **One owner per table.** Only the module in the table above creates/alters a given table. If you need a column on someone else's table, raise it — don't add it yourself.
5. **API-contract-first for FE/BE split.** 1A, 1B, 1C each have frontend + backend. If you split them across two sub-agents, freeze the REST contract (paths, request/response shapes) in the PR description first so FE and BE proceed in parallel.

## Consent applies to messaging, not public broadcast (important nuance)
- **Owned messaging** (Journey email/SMS/WhatsApp to a *contact*, and the WhatsApp *listing-to-recipient* send in today's `distribute-own`) → **must** pass `consent.checkEligibility` (1A, and 1B's WhatsApp path).
- **Public organic posts** (IG/FB/X/TikTok/LinkedIn feed posts) → no per-contact consent; eligibility = channel-connection health only (1B).
Get this distinction right; it's a compliance line, not a preference.

## Sequencing within Wave 1
All four can start together. Natural merge order when ready: **1D + 1C first** (Audience + Creative are referenced by the others) → **1A + 1B** (consume creatives/audiences). But none hard-blocks another because cross-refs are nullable.

## Definition of done for the wave
Every module: its Definition-of-Done checklist met, Real-PG + FE tests green (CI-equivalent output pasted), PRs merged to `main`, and **no regression to existing behaviour** (expand-contract verified). Then Wave 2 (paid shells, content calendar, attribution rollups, experimentation) can begin.
