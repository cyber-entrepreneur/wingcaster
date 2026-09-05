# AGT-ONB-BLOCKER-01 — WhatsApp Business number provisioning model

**Decision needed for:** D4 (all 5 AGT-ONB screens ship together) — specifically AGT-ONB-002 (WhatsApp intake tour) and AGT-ONB-003 (first-listing review from a WhatsApp draft).

**Why this is blocking:** The onboarding "aha moment" is: new agent sends photos + voice + pin to a WhatsApp number → WingCaster's AI drafts a listing → agent approves it. For this to work AT SIGN-UP TIME (before the agent has any prior WingCaster history), the platform needs a WhatsApp number the agent can message immediately. Currently the WhatsApp intake pipeline (`backend/src/modules/whatsapp-listings/`) accepts inbound messages against ONE agency-level number and matches them to agents by the phone number they message FROM. That works for agents whose phone was already registered with an agency, but breaks at first-signup because no agency membership exists yet.

**Two viable models. This doc compares them so you can pick.**

---

## Model A — Dedicated WhatsApp Business number per agent

Each agent gets their own dedicated WhatsApp Business number the moment they sign up. Sent by the agent, received by WingCaster on THAT specific number, routed unambiguously to THAT agent.

### How it works

1. Agent signs up.
2. WingCaster provisions a new WhatsApp Business number (WABA line) via the Meta WhatsApp Business Platform API — allocated from a pool of pre-provisioned numbers OR provisioned on-demand.
3. Agent scans a QR code shown on AGT-ONB-002 that adds this number to their contacts.
4. Agent starts messaging that number. Every inbound message is unambiguously attributed to this agent.

### Pros

- **Zero ambiguity on routing** — the recipient number IS the agent identity. No activation code, no state.
- **Native WhatsApp UX** — the agent messages a real number, gets replies from that number, feels like messaging any other business contact.
- **Cleaner audit trail** — every inbound message has a clear from-agent + to-agent link.
- **Supports agent-to-consumer messaging via the same number** — same infrastructure serves both directions.
- **The number can appear on the agent's public profile** — becomes a differentiator.

### Cons

- **Cost per number.** Meta charges a monthly fee per WABA phone number (varies by region — typically $5-$25/month depending on tier). At 10,000 agents = $50k-$250k/year just in phone-number fees.
- **Verification latency.** Meta requires business verification on new WABA numbers. Can take 1-14 days depending on documentation quality and Meta's review queue. During verification, the number is limited to 250 messages/day.
- **Phone-number provisioning latency.** Even after Meta business verification, provisioning a new WABA number takes hours-to-days. Can't be truly instant at signup.
- **BSP (Business Solution Provider) dependency.** WingCaster becomes tightly coupled to a BSP like 360dialog, Twilio, WATI, or Wassenger. Switching later requires migrating every agent's number.
- **Number reclamation on churn.** When an agent churns, their WABA number must be released (or Meta business-verification workload accumulates). Adds ops burden.
- **Rate limits.** Meta imposes per-number send-rate limits (tiered by messaging quality). A high-volume agent could exhaust their per-number quota.

### Cost model summary

**Per-agent monthly:** $5-$25 WABA line fee + template message fees + conversation fees + BSP markup.
**At 10k agents:** $50k-$250k/year fixed costs. Real number depends on BSP negotiation.

---

## Model B — Shared platform number + activation code

WingCaster owns one (or a small number of) WhatsApp Business numbers. Agents share these. Identity is disambiguated by an activation code the agent sends first.

### How it works

1. Agent signs up.
2. WingCaster shows the agent a QR code + activation phrase like `WC-A4K9-JAMIL` on AGT-ONB-002. The QR opens WhatsApp with a pre-filled message to WingCaster's shared number containing the code.
3. Agent sends the message. WingCaster's webhook receives it, parses the activation code, binds that agent's `person_id` to the FROM phone number for future messages.
4. Any subsequent message from the same phone number is routed to that agent, no more codes needed.
5. Optional: agent can re-send `WC-BIND` to add another phone number to the same account.

### Pros

- **Instant.** No provisioning latency. QR code shows immediately at signup; agent messages the shared number the moment they've saved it as a contact.
- **Cheap.** WingCaster maintains 1-5 shared WABA numbers instead of 10k. Fixed cost: ~$25-$125/month total.
- **Fast to build.** The current `wa_listings` pipeline already matches inbound messages by phone; just add an activation-code path before the phone-to-agent mapping is established.
- **No per-agent Meta verification** — WingCaster's shared number is verified once. Adding agents doesn't touch Meta's queue.
- **Easier BSP migration.** Switching BSPs means migrating 1-5 numbers, not 10k.

### Cons

- **Two-hop UX for signup.** Agent has to send the activation code first. Not as smooth as "just message us."
- **Activation-code UX friction.** If the agent's phone auto-corrects the code, or they hand-type it wrong, or the QR-to-WhatsApp deep-link fails, they hit an error state.
- **Phone-number reuse issue.** If two agents accidentally sign up from the same phone (shared family device), the code disambiguates but reveals the ambiguity — messy edge case.
- **Rate-limit blast radius.** All agents share the send-rate limit of the shared number(s). At scale, need multiple shared numbers with round-robin distribution AND per-agent send caps.
- **Cannot expose the shared number as the agent's public phone** — it's WingCaster's, not the agent's brand.
- **Perception risk.** Agents may prefer having "their own" WhatsApp number for professionalism; sharing WingCaster's could feel less premium.

### Cost model summary

**Fixed:** ~$25-$125/month total (1-5 shared numbers).
**Variable:** template + conversation fees per message (same regardless of model).
**At 10k agents:** cost per agent trends toward $0.10/month for phone-number-infrastructure; economics dramatically better than Model A.

---

## Third option — Model C: Hybrid (Model B for free tier, Model A for paid)

Ship Model B at signup so every new agent gets instant WhatsApp intake with the activation code. When an agent upgrades to a paid tier (or reaches a usage threshold), automatically upgrade them to Model A — provision a dedicated WABA number, port their WhatsApp history and identity, expose the new number as their contact-of-record.

**Pros:** Instant onboarding + low fixed cost at scale + premium tier gets premium UX + brand differentiation for paid.
**Cons:** More complex codebase (two paths to maintain) + migration event when tier changes + upfront investment in Model A infrastructure that only paid users benefit from.

---

## Recommendation

**Model B for v1 → Model C when Paddle payments are live + first paid tier ships.**

**Rationale:**
- Model A is expensive AND slow to ship. Provisioning latency alone blocks the "instant onboarding" experience.
- Model B ships now, unblocks D4, delivers real user value.
- Model C keeps the door open to differentiate paid tiers later — but doesn't gate v1 on it.
- The economics of Model B at signup are dramatically better ($125/month vs $50k+/month at 10k agents).
- The activation-code UX friction is real but SMALL — a well-designed QR + auto-copy of the code minimizes error.

**If you strongly prefer Model A:** budget for the provisioning latency (signup can't complete WhatsApp intake for 1-14 days) + build a fallback experience for the interim ("Your WhatsApp number is being provisioned. Add listings manually for now; we'll email you when WhatsApp is ready.").

**Model B implementation scope (if approved):**
- Backend: extend `wa_listings/application/webhook.js` to parse activation codes on FIRST inbound from a phone number; bind `person_id` to phone via a new `user_whatsapp_bindings` table; subsequent messages from that phone route to the bound person.
- Backend: `POST /api/auth/whatsapp/activation-code` returns a fresh code + shared-number pair for the current agent.
- Frontend: AGT-ONB-002 renders the QR + code prominently; polls `GET /api/auth/whatsapp/binding-status` to auto-advance to AGT-ONB-003 when the bind completes.
- Ops: acquire 1-3 shared WABA numbers now (or use existing agency number in dev/test).
- Effort estimate: ~1 week Cursor work.

---

## Decision needed

Choose one:

- **(a) Model A — dedicated per agent.** Commit to $50k-$250k/year phone infrastructure. Accept 1-14 day provisioning latency at signup.
- **(b) Model B — shared with activation code.** Recommended. Ship this for v1. Revisit when paid tiers launch.
- **(c) Model C — hybrid.** Model B for free tier now + Model A for paid tier later. Best long-term but more work.
- **(d) Defer entire WhatsApp-at-signup feature.** Ship AGT-ONB with the manual-first-listing path only (AGT-ONB-001 → AGT-LST-004 → AGT-ONB-004 celebration). WhatsApp intake becomes discoverable-later. Fastest to ship. Loses the "aha moment" from the onboarding funnel.

**Once you pick, I write the Cursor dispatch prompt for the chosen model + update AGT-ONB-002/003 entries in the Agent matrix.**

---

## Rev 2 additions — 2026-09-04 (post architect-owner review of Model B)

Model B endorsed. 8 hardening additions to lock in before dispatch:

### H1 — Activation code UX friction mitigations

QR-scan + WhatsApp-deep-link + auto-copy paths ALL have real failure modes on real phones (low-end Android cameras, iOS deep-link pre-fill quirks, browser clipboard blocks, WhatsApp Business vs personal handling). Mitigate:
- **Partial-match parsing** — `A4K9` alone is a valid activation code; the human-readable prefix (`WC-`) and name-hint suffix (`-JAMIL`) are cosmetic and optional
- **Case-insensitive parsing** — `a4k9` = `A4K9`
- **Auto-retry with hint** — if first inbound from an unbound phone is NOT a valid code, reply "Please send your activation code. It looks like `WC-XXXX-YOURNAME`. Tap 'Get a new code' in the WingCaster app if you don't have one."
- **"I didn't get it" button** in AGT-ONB-002 that invalidates the current code + generates + resends a fresh one
- **Manual fallback (see H5)**

### H2 — Multiple person_id bindings per phone (MENA shared-device pattern)

Husband + wife both doing real estate from one phone is common in MENA. Current binding `phone → person_id` (1:1) breaks this.

**Fix:** support multiple active bindings per phone number with an active-selector prompt:
- Schema: `user_whatsapp_bindings (id, person_id, phone, active_from, deactivated_at)` — multiple rows per phone allowed
- On new code from a phone with existing binding(s): reply "This phone is linked to [Existing Name]. Send `1` to keep sending as [Name], `2` to switch to [New Name] for this and future messages."
- Active binding for a given inbound is the most-recent-selected row for that phone

Adds one message to the shared-device onboarding path. Prevents husband's listings getting attributed to wife's account.

### H3 — Rate-limit blast radius — infrastructure floor

1-shared-number is insufficient at scale. Meta WABA send rate tiers:
- Tier 1: 1,000 msgs/day per number
- Tier 2: 10,000 msgs/day per number
- Tier 3: 100,000 msgs/day per number

At 1,000 active agents × 50 msgs/day = 50,000 msgs/day. One Tier 2 number is capped. Failures cascade.

**Fix v1 infrastructure floor:**
- **3 shared WABA numbers minimum** at launch. Provision at Tier 2.
- **Round-robin distribution** — `agent_number_index = hash(person_id) % 3`. Deterministic per agent (same agent always messages the same number).
- **Per-agent send caps** — CFG key `WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP` (default 500 msgs/day) prevents one heavy agent exhausting a number's daily quota.
- **Auto-tiering monitoring** — track daily send-per-number, alert when > 70% of tier cap so ops can request Meta tier promotion.

### H4 — Shared-number "not my brand" perception — Model C monetization framing

The strongest argument for Model C is agent branding: real-estate agents personalize everything. A shared WingCaster number feels less premium.

**Fix framing (not v1 code):** When Model C's paid-tier upgrade path is designed, market it as:
> "Upgrade to Pro and get **your own branded WhatsApp Business number**. Your clients see YOUR name, not WingCaster's. Cross-listing on Google, Facebook, and Bayut all point to YOUR line."

Turns infrastructure cost into a revenue feature. Add to marketing website Pricing page copy.

### H5 — Manual fallback for QR/deep-link failures

If QR scan fails OR WhatsApp deep-link doesn't pre-fill, agent must have a paved manual path. AGT-ONB-002 ALWAYS shows below the QR:
```
Can't scan? Save this number and send the code:

📞 +971 XX XXX XXXX (tap to copy)
💬 WC-A4K9-JAMIL (tap to copy)

Save the number as "WingCaster" in your contacts,
then message it with the code above.
```
Plain text, tap-to-copy on both, no dependencies on deep-links.

### H6 — Binding expiry semantics

If an agent scans the QR but never sends the message, the code cannot dangle forever.

**Fix:**
- Codes expire **24 hours** after generation
- AGT-ONB-002 shows a **live countdown** (e.g., "Code expires in 23h 45m")
- On expiry: screen shows "Code expired" state with a "Get a new code" button that generates + polls again
- Server-side: expired codes are cleaned up by janitor worker (existing 1022 lock or a new light one)

### H7 — Re-binding + device changes

Not scoped in the original doc but WILL generate support tickets:

**Fix — add basic user commands to the WhatsApp bot:**
- `WC-BIND` — bind THIS phone as an additional device to my account (requires the sender to already be authenticated in the app — generates a code from AGT-SET-* that they paste into the WhatsApp reply)
- `WC-UNBIND` — remove THIS phone from my account's active bindings
- `WC-LIST` — reply with the list of phones currently bound to my account
- `WC-TRANSFER` — for phone-number changes (rare — agent gets a new SIM). Requires re-auth flow via AGT-SET-*.

Reserved keywords, case-insensitive, prefix `WC-` required.

### H8 — Model C trigger — data-driven, not vague

Original doc said "when Paddle payments are live + first paid tier ships" — too vague; Model C could sit theoretical forever.

**Fix — data-driven trigger:**
> Move to Model C evaluation when BOTH: (a) paid tier is available in the product (Paddle integrated), AND (b) **first 10 paid subscribers have upgraded** (proves demand for the premium AND validates the "own branded number" value prop). Until (b), the shared-number path is proven sufficient.

Trigger is measurable, not date-based. Prevents both premature investment (before demand) and infinite deferral (theoretical premium tier).

---

## Rev 2 decision — locked

**Model B for v1, with the 8 H-additions above baked into the Cursor dispatch prompt.**

Next step: draft `CURSOR_WHATSAPP_INTAKE_PROVISIONING_MODEL_B.md` once AGT-ONB screen dispatch is ready. That prompt scopes: `user_whatsapp_bindings` table, activation-code endpoint, webhook parser extension, WC-* bot commands, 3-number provisioning, rate-limit + cap enforcement, expiry + regeneration.
