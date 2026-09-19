# Wave 2E — Journey Engine 2.0 + ContactPolicy

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged (1A shipped the branch-capable journey schema). Migration block: **770–789**.

## MISSION
Bring the journey engine to enterprise depth: full **conditional branching / event branches / exits / suppression** in the UI (1A shipped the schema; v1 UI was linear), and add **ContactPolicy** — the global frequency/quiet-hours/conflict layer — wired into the eligibility gate so we stop over-messaging contacts.

Read `docs/canonical-object-model.md` §D (Journey graph, JourneyNodeRun) + §G (ContactPolicy), `docs/campaign-and-social-publishing-reconciliation.md` Part 6.2 (D16/D18), and `docs/consent-and-compliance-spec.md` §5 (the `checkFrequencyCap` hook is currently a stub returning not-capped — this wave implements it).

## SCOPE — BACKEND
1. **Journey Engine 2.0 runtime** (extend 1A's engine): fully execute `condition` (attribute + **event/engagement** branches, e.g. "if no `message.replied` in 2 days"), `branch`, `lead_score`, `goal`, `exit`, and node-level `experiment` splits (2D). Record every `JourneyNodeRun` + transition reason for explainability. Add re-entry rules + exit criteria.
2. **ContactPolicy (migration 770–789):** `contact_policies` (`id · scope(agency/agent) · rules JSONB: frequency caps per channel/purpose/window, quiet hours, do-not-contact windows, campaign-priority, negotiation suppression`). RLS.
3. **Wire into eligibility:** implement `checkFrequencyCap` (currently a Wave-0 stub) to read ContactPolicy + recent sends (from `events` delivery/`executions`) and return `DENY_FREQUENCY_CAPPED` when over cap / in quiet hours / within a do-not-contact window. Every journey `send` and 1B/2A dispatch already calls `checkEligibility`; this makes the frequency branch real. **Launch-depth = frequency caps + quiet hours + do-not-contact; conflict/priority resolution across campaigns = the deeper part of this wave.**
4. **Suppression audit:** a suppressed send emits `journey.node.suppressed` with the `reason_code` (Wave 0 vocabulary).

## SCOPE — FRONTEND
1. **Journey canvas**: visual branching editor (drag nodes: trigger/wait/send/condition/branch/lead_score/goal/exit/experiment), with condition builder (attribute + event predicates), exits, and per-node preview. This is the "if X → then Y" designer.
2. ContactPolicy admin UI (agency-level caps/quiet-hours/do-not-contact).
3. Run inspector: for a contact's JourneyRun, show node-by-node path + why each transition happened (from JourneyNodeRun/transitions) — enterprise observability.
4. `--lc-*` tokens; accessible; responsive.

## OUT OF SCOPE
Journey authoring basics (1A). Experiment stats (2D — just invoke assignment at `experiment` nodes). AI journey optimisation (post-PMF).

## ACCEPTANCE CRITERIA
- [ ] Conditional/event branches, exits, re-entry execute correctly; every node run + transition reason recorded.
- [ ] ContactPolicy enforced through `checkEligibility` (`checkFrequencyCap` no longer a stub): frequency caps, quiet hours, do-not-contact honoured; over-cap sends → `DENY_FREQUENCY_CAPPED` + `journey.node.suppressed`.
- [ ] Journey canvas authors branches; run inspector shows the causal path.
- [ ] Tenant-isolated via `withTenant`.

## TEST MATRIX
1. Branch on an engagement event (replied vs not) routes correctly.
2. Exit + re-entry rules behave.
3. Frequency cap: 3rd promo WhatsApp in the window → `DENY_FREQUENCY_CAPPED`; quiet-hours suppression; do-not-contact window suppression.
4. Suppressed send emits `journey.node.suppressed` with reason_code.
5. Run inspector reconstructs a contact's path from JourneyNodeRun/transitions.
6. Tenant isolation on contact_policies.
