# WingCaster — Lead Qualification Agent + Daily Briefing Layer + Tier-1 Hardening

**Status: PROPOSED — added to scope 2026-09-18. NOT build-ready.** 14 items require ratification (see end). Bracketed `[values]` are placeholders to be calibrated, not committed numbers. This is the source-of-truth spec; a phased delivery plan + per-open-item decisions must precede any code.

**Standing bars:** in-house on the Claude API (no third-party agent platform); channel connectors already exist — do not rebuild them. Architectural stance: **one agent core, thin channel adapters** — the brain never knows which channel it is talking through.

---

## Part 1 — Qualification Agent

A conversational AI that engages inbound leads on any connected channel (WhatsApp, Instagram, Messenger, in-app), extracts qualification data, scores the lead, and routes it into the correct pipeline — or dismisses, or escalates to a human.

### 1.1 Qualification schema (`LeadQualification`)
Every conversation aims to fill this record; fields nullable until captured.

```
lead_id, contact_id(existing CRM contact), channel[whatsapp|instagram|messenger|in_app],
intent[buy|rent|sell|let|browse|unknown], property_type[apartment|villa|land|commercial|other|unknown],
area_preference: string[] (normalised vs WingCaster territories), budget_min/max: money|null, currency,
timeline[immediate|1_3_months|3_6_months|6_plus_months|unknown],
financing[cash|mortgage_approved|mortgage_pending|unknown|n_a], working_with_other_agent: bool|null,
source_listing_id: uuid|null (from a "Chat about this listing" button), language[en|ar|fr],
contact_preference[chat|call|viewing], notes: string
```
⚑ Ratify: fields per territory (some markets may need nationality/residency for eligibility — do not assume).

### 1.2 Conversation state (`ConversationState`, one per lead per channel thread)
```
lead_id, status[active|qualified|nurture|dismissed|handed_off|stale],
fields_captured[], fields_pending[], questions_asked[] (prevents repetition),
turn_count, last_inbound_at, last_outbound_at, assigned_agent_id|null, handoff_reason|null, score: 0-100|null
```
Model receives state every turn. Must never re-ask a captured field; prioritise `fields_pending` in the 1.4 order.

### 1.3 Agent loop (per inbound)
adapter normalises → load state + last `[20]` turns → build prompt (system + schema + state + transcript) → call Claude with tools (returns reply + tool calls in one turn) → execute tools, persist → reply via adapter → if a 1.6 routing rule fires, apply and stop the loop.
Model: `claude-sonnet-4-6` per turn. *(Evaluate Haiku for cost once calibrated.)*

### 1.4 Question priority
`intent → property_type → area_preference → budget → timeline → financing → working_with_other_agent → contact_preference`. One question per turn. Match lead's language/register. Never reveal it's AI unless asked directly; if asked, answer truthfully.

### 1.5 Tools (strict JSON schemas; model can write to no CRM object outside this list)
- `capture_field(field, value)` — writes one validated `LeadQualification` field
- `update_score(score, rationale)` — called at end of any turn that changed a field
- `route_lead(destination[pipeline_hot|pipeline_warm|nurture|dismissed], reason)` — terminal
- `request_handoff(reason, urgency[now|today|this_week])` — terminal; assigns per 1.7
- `lookup_listings(filters)` — up to 5 matching listings, read-only
- `schedule_viewing(listing_id, proposed_slots[])` — creates a viewing request; human confirms

### 1.6 Scoring & routing (thresholds in config, NOT the prompt)
- `score ≥ [70]` AND timeline in [immediate, 1_3_months] → **pipeline_hot**
- `score ≥ [40]` → **pipeline_warm**
- `score < [40]` AND intent ≠ browse → **nurture**
- intent == browse OR working_with_other_agent == true → **dismissed** (soft — stays in contacts)

Starting weights (to calibrate): budget in range `[25]`, timeline ≤3mo `[25]`, cash/mortgage-approved `[20]`, specific area+type `[15]`, arrived via listing `[10]`, prefers viewing/call `[5]`. ⚑ Expect 2–4 weeks calibration on live traffic.

### 1.7 Handoff triggers (escalate immediately)
Lead asks for a person · asks about price negotiation / legal / documents · crosses pipeline_hot AND requests call/viewing · negative sentiment 2 consecutive turns · `turn_count > [12]` without qualifying · any out-of-scope content (complaints/disputes/abuse).
Assignment: `assigned_agent_id` (listing owner) → round-robin in agency → agency manager. Handoff sends full transcript + `LeadQualification`.

### 1.8 Stale / follow-up
No inbound `[48h]` on active → `stale`, one automated follow-up (needs prior opt-in per territory consent). No response in `[72h]` → `nurture` (existing nurture mechanism; sequences out of scope here).

### 1.9 Channel adapters (only place channel-specific code lives)
`receive(webhook)→NormalisedInbound`, `send(lead_id,text,media[])→DeliveryReceipt`, `capabilities()→{max_length,supports_buttons,supports_media,supports_templates}`. Agent core reads `capabilities()` to shape output.

### 1.10 Guardrails
Never fabricate listings/prices/availability/agent names (`lookup_listings` is the only truth). Never promise a viewing/price/outcome — only propose + hand off. Never collect payment details / IDs / documents in chat. Respect territory consent + retention. Log every model turn (prompt hash, tools, score delta) for audit + calibration.

### 1.11 Observability
Per-conversation: turns-to-qualification, fields/turn, handoff rate, dismissal rate, route distribution, time-to-first-reply. Feeds calibration (1.6) + the briefing layer (Part 2).

---

## Part 2 — Briefing Layer
On request ("what did I miss" / "morning rundown" / scheduled) produce a **triage list, not a report** — actionable without opening the CRM.

- **Scope by role:** Agent → own leads/listings/viewings since last open/briefing; Agency manager → all agents, aggregated + per-agent.
- **2.3 Digest job (no model call):** new leads (channel/score/route), stage changes, handoffs awaiting reply (with age), stale leads, viewings requested/confirmed/cancelled, inbound awaiting reply, listing events (enquiries, portal sync failures), missed calls `[confirm logging exists]`. → structured `DigestPayload`.
- **2.4 Ranking:** hot leads awaiting reply (oldest first) → handoffs urgency=now → viewings today/tomorrow → stale in window → everything else as counts. Cap ranked list at `[7]`; rest collapse to counts.
- **2.5 Summarisation (the only model call):** input DigestPayload+role+language → **Headline** (1 sentence) / **Act now** (≤`[3]`, each with lead name + why + one-tap action) / **Watch** (≤`[4]`) / **Counts**. No filler, no praise, no restating counts in prose. Language = lead/user preference. Every item links to the CRM record.
- **2.6 Delivery:** in-app card (primary) + WhatsApp (if opted in, approved template) + scheduled `[07:30]`/`[18:30]` local (configurable) + on-demand.
- **2.7 Manager variant:** per-agent table (leads received, replied within SLA, handoffs open, stale). Flags agents with handoffs older than `[4h]`.

---

## Part 3 — Platform Hardening (Tier One)
The layers that separate an agent from a platform. Parts 1–2 stay as written.

- **3.1 Eval + regression harness.** Golden set `[50→200]` real anonymised conversations, stratified by channel/language(en/ar/fr)/intent/outcome, min `[10]`/language, versioned at `evals/golden/{id}.json`. Simulator: synthetic buyer via a 2nd Claude call with persona spec, runs the full loop vs a sandbox CRM; `[30]` archetypes (cooperative, evasive, tyre-kicker, already-represented, hostile, multilingual code-switcher). **Gates:** field accuracy ≥`[90%]`, route accuracy ≥`[85%]`, handoff precision ≥`[80%]`/recall ≥`[90%]`, repeat-question ≤`[2%]`, median turns-to-qualified ≤`[8]`, hallucination rate **0**. **CI gate:** any change to `prompts/`, routing config, or tool schemas runs the full golden set + `[20]` sims; merge blocked on any gate fail or >`[3pt]` regression.
- **3.2 Prompt/config versioning.** Prompts, routing, weights, tool schemas under `agent/` with semver. Every turn logs `{prompt_version, config_version, model_id}`. Feature-flag per agency: pin / canary `[10%]` / one-action rollback. A/B two configs on split traffic, compare after `[500]` conversations or `[14d]`. Rollback is a config change, not a deploy.
- **3.3 Human-in-the-loop (co-pilot).** **Takeover** (human presses Take over → status `human_active`, AI stops; Hand back resumes AI with human turns as transcript; logged). **Suggested replies** while human_active (Send/Edit/Dismiss; `{suggested,sent}` logged as preference data). **Whisper** internal AI notes to the human only. Inbox sort: awaiting human → AI-active high score → AI-active → stale.
- **3.4 Identity resolution.** One Contact holds many `ChannelIdentities`. State keys on `contact_id` (a lead = contact + intent episode). Merge on same phone/email or human action; IG/Messenger merge only on explicit signal or human action — no probabilistic matching without ratification `[confirm]`. On merge: union captured fields, keep higher score, append transcripts in time order. Split is human-only + audited.
- **3.5 Returning-lead memory.** Each Contact carries `LeadHistory[]`. On new inbound from a known contact, prompt gets a compressed summary of last `[3]` episodes (≤`[300]` tokens), generated once at episode close + stored. Never reference a prior dismissal to the lead; carry forward stable facts, confirm changeable ones. Prior dismissed-with-other-agent older than `[6mo]` = expired.
- **3.6 Knowledge grounding.** Per-agency + territory `KnowledgeBase` (FAQs, financing rules, fees, viewing policy, doc checklists, area guides). Tool `lookup_knowledge(query, scope[agency|territory|both])` → up to 5 cited chunks, read-only. Every non-listing factual claim must cite a chunk id (logged, not shown); uncited = hallucination. Content approved before entering base; chunks unreviewed `[90d]` excluded + surfaced to admin.
- **3.7 Outcome feedback loop (the moat).** Every episode ends in an `Outcome` (written by the CRM, not the agent). Weekly job joins Outcome ↔ `LeadQualification`-at-routing-time, recomputes empirical conversion per signal per territory/intent → **proposed** weight set with CIs + sample sizes, never auto-applied; human ratifies via 3.2 (triggers eval harness). Min `[100]` closed outcomes/territory before a proposal shows. Dashboard: signal-lift table, calibration curve, drift alert if calibration error >`[10pt]`.
- **3.8 Deterministic + LLM hybrid.** Structured pickers (WhatsApp Flows / in-app forms / Messenger quick replies) for intent, property_type, timeline, financing, contact_preference — write via `capture_field` with `source: structured`, no model call. Model handles area, budget, objections, free text. Fall back to prose after `[2]` ignored pickers. Target `[40–60%]` fewer model calls per qualified lead — measure it.
- **3.9 Operational hardening.** Outage/p95>`[8s]`: holding-message template, queue turn, alert; outage >`[15min]` → all active threads flagged for human. Model routing: primary `claude-sonnet-4-6`, fallback Haiku for holding+capture only (never routing). Per-lead cap `[30]` turns then forced handoff. Per-agency budget metered vs credits wallet (soft `[80%]`, hard stop `[100%]`→human-only). Rate limit `[5]`/min/lead then 1 reply/`[60s]`. Abuse → dismissed, no reply. PII redaction in all logs/fixtures. Eval fixtures anonymised, own `[24mo]` cap. Right-to-erasure deletes transcripts/state/history/derived fixtures. Roles: agent / agency_admin / wingcaster_ops; no role edits weights outside 3.2. Every config change audited. Latency: p50 ≤`[3s]`, p95 ≤`[6s]` text; streaming required only in in-app chat.
- **3.10 Multilingual eval.** Gates apply **per language, not aggregate** (a change passing EN but failing AR is blocked). Code-switching personas mandatory (Arabic+French numerals, Franco-Arabic). RTL rendering of pickers + briefings in adapter acceptance tests. Human review panel: `[1]` native reviewer/language scores `[20]` live conversations/week on 1–5 naturalness; sustained <`[3.5]` triggers prompt review.

---

## Build sequence (from the spec)
| Phase | Scope | Exit |
|---|---|---|
| 0 | Schema, state store, tool layer, CLI harness, golden set seeded `[50]` | Harness runs end-to-end |
| 1 | Agent loop, in-app adapter, versioning (3.2) | Golden gates pass |
| 2 | Routing config, handoff assignment, identity (3.4), returning-lead memory (3.5) | Route accuracy ≥ gate |
| 3 | Co-pilot: takeover, suggested replies, whisper (3.3) | Agents work a thread end-to-end |
| 4 | Hybrid pickers (3.8), knowledge base + retrieval (3.6) | Hallucination 0 on golden |
| 5 | WhatsApp adapter, then IG/Messenger; hardening (3.9); multilingual gates (3.10) | All channels pass per-language gates |
| 6 | Simulator personas (3.1), observability dashboard | CI gate enforced on merge |
| 7 | Digest job, ranking, summarisation, in-app delivery (Part 2) | Briefing usable without CRM |
| 8 | WhatsApp delivery, scheduling, manager variant (2.6/2.7) | — |
| 9 | Outcome feedback loop (3.7), calibration dashboard | First ratified weight revision shipped |

**Live traffic can begin after Phase 5.** Phase 9 needs `[100]` closed outcomes and lags by nature.

## Open items for ratification (14)
1. Qualification fields per territory (1.1) · 2. Score thresholds + weights (1.6) · 3. Turn cap before forced handoff (1.7/3.9) · 4. Stale/follow-up windows (1.8) · 5. Briefing schedule + item cap (2.4/2.6) · 6. Missed-call logging availability (2.3) · 7. Eval gate thresholds + golden size (3.1) · 8. Canary % + A/B sample (3.2) · 9. Probabilistic identity matching on IG/Messenger: allowed or human-only (3.4) · 10. Returning-lead expiry (3.5) · 11. Knowledge staleness window (3.6) · 12. Min outcome sample before weight proposals (3.7) · 13. Credits-wallet conversion rate for AI turns (3.9) · 14. Retention cap for anonymised fixtures (3.9).

**Phase 0 note:** golden set needs real conversations you don't have yet. Start with `[20]` hand-written from your best agent's memory; replace with live transcripts as they arrive. Don't let that block Phase 1.

---

## Scope + timeline read (WingCaster planning note, added 2026-09-18)
Go-live is **2026-09-30** ([[project_go_live_sept_30]]). This spec is a **multi-week/multi-month program**, not a Sept-30 deliverable: its own build sequence gates each phase on eval accuracy that requires live conversation data that does not exist yet, live traffic cannot begin before Phase 5, and Phase 9 lags by design. Attempting the full spec by Sept 30 would force MVP/demo quality — which violates the standing bar. Recommended framing: the Sept-30 launch is the **base platform** (existing waves); this agent is a **post-launch roadmap program** delivered phase-by-phase, with a possible thin Phase-0/1 slice (schema + loop + in-app adapter + versioning + a hand-written `[20]`-conversation golden set) started in parallel but **not** gated to the launch date. Per-open-item ratification precedes Phase 1.
