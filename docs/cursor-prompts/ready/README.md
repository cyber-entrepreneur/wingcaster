# Wave 1 — ready-to-paste prompts (self-contained)

Each file in this folder is **complete on its own** — coordination + house-rules + module scope merged. Paste one whole file into one Cursor agent. Nothing else to assemble.

| Agent | File | Builds |
|---|---|---|
| 1 | `wave-1a.md` | Journeys: rename + reconcile #294/#302/#311; branch-capable engine; sends emit canonical Executions; consent-gated |
| 2 | `wave-1b.md` | Social publishing: consolidate 3 paths onto the real path; all connected platforms deliver |
| 3 | `wave-1c.md` | Creative Asset Service + AI Adaptive Composer (≥4 variants/channel); AI-content approval gate |
| 4 | `wave-1d.md` | Audience: first-class segments + consent-aware membership |

**Prerequisite:** Wave 0 is merged to `main` (done). Run all four in parallel.

**Migration number blocks** (re-check the live max first; currently 552): 1a `600–619` · 1c `620–644` · 1d `645–664` · 1b `665–669`.

**Coordination invariants (baked into each file too):**
- One owner per table; cross-module refs (`creative_id`/`audience_id`/journey `creative_id`) stay nullable — no cross-module hard FKs during Wave 1.
- Everyone imports the Wave 0 access layer (`backend/src/lib/growth-os/`) and uses `withTenant`; nobody re-implements publishing, eligibility, or event ingestion.
- **Consent applies to owned messaging (email/SMS/WhatsApp to a contact), NOT to public social posts.**

Wave 2 (`../wave-2*.md`) stays piecemeal for now; ask me to consolidate it the same way when you reach it.
