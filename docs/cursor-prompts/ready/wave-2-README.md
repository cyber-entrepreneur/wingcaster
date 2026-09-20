# Wave 2 — ready-to-paste prompts (self-contained)

Each `wave-2*.md` here is **complete on its own** — coordination + house-rules + module scope merged. Paste one whole file into one Cursor agent. Nothing to assemble.

**Prerequisite:** Wave 0 **and** Wave 1 are merged to `main` (foundation + Journeys/Social/Creative/Audience). Migration max on `main` is **649**.

| Agent | File | Builds | Depth |
|---|---|---|---|
| 1 | `wave-2a.md` | Paid Ads (Meta + Google incl. Gmail/Demand Gen) — connect-ready shells | shell now; live post external approval |
| 2 | `wave-2b.md` | Publishing control plane + Content Calendar | fast-follow |
| 3 | `wave-2c.md` | Attribution & Commission engine (the moat) | fast-follow |
| 4 | `wave-2d.md` | Experimentation (A/B/n + holdouts) | post-PMF |
| 5 | `wave-2e.md` | Journey Engine 2.0 + ContactPolicy (implements the checkFrequencyCap stub) | fast-follow |
| 6 | `wave-2f.md` | SEO / owned-web (Bazaar-boundary gated) | post-PMF |

**Migration blocks** (re-check live max 649 first): 2a `700–719` · 2b `720–729` · 2c `730–749` · 2d `750–769` · 2e `770–789` · 2f `790–809`.

**Coordination invariants (in each file too):** one owner per table; everyone imports the Wave 0 access layer + `withTenant`; new tenant tables copy the strict-RLS pattern (mig 551); reading an existing un-RLS'd table must be SQL-scoped by tenant (never `findAll` unbounded — see the Wave 1D fix); resolve tenant before `ingestEvent`.

**Dependency order (natural merge sequence; none hard-blocks another):** 2C + 2E (commission attribution + real journey depth) → 2B (calendar) → 2A (paid, when approvals land) → 2D/2F (post-PMF). 2A cannot go **live** until Meta/Google business verification + app review clear (external clock).
