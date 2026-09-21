# Cursor prompt pack — OAuth unification (ready-to-paste)

One self-contained prompt per PR. Each file can be pasted straight into a fresh Cursor session — it
inlines the engineering standards and guardrails, so no other doc needs to be loaded. Full design context
lives in `../oauth-connect-unification.md`.

## Launch order & gates

| File | PR | Start only after | Parallel-safe with |
|---|---|---|---|
| `PR1-shared-oauth-core.md` | Shared `lib/oauth/` core + real PKCE; refactor X/TikTok | **PR0 (#371) merged to main** | — |
| `PR2-token-refresh.md` | Refresh at publish time | PR1 merged | PR3 |
| `PR3-connect-ux.md` | Unified connect UX + config model | PR1 merged | PR2 |
| `PR4-meta-oauth.md` | Meta OAuth (Facebook + Instagram) | PR1 + PR3 merged | PR5 |
| `PR5-linkedin-oauth.md` | LinkedIn OAuth | PR1 + PR3 merged | PR4 |
| `PR6-rls-scoping.md` | RLS + step-up (tenant isolation) | PR0 + PR1 merged | PR4/PR5 (coordinate on marketplace_connections writes) |
| `PR7-whatsapp-oauth.md` | WhatsApp via Meta Embedded Signup | PR4 merged | PR8 |
| `PR8-email-oauth.md` | Email OAuth (Google + Microsoft) | PR1 merged (RLS assertions need PR6) | PR7 |

**Immediate next when PR0 lands:** `PR1-shared-oauth-core.md`.

## How to use
1. When a PR's gate clears (its dependency is merged to `main`), cut a fresh branch from `main`.
2. Paste that PR's file as the Cursor task prompt.
3. Cursor works the acceptance checklist at the bottom of the prompt; it must run the listed CI commands
   before opening the PR (green CI is not a substitute for the checklist).
4. PR targets `main`. Architecture (not Cursor) signs off deviations from the design.

## Do NOT
- Start a PR before its gate clears (schema/behaviour it depends on won't be in `main` yet).
- Create branches now, pre-PR0 — they'd be based on a `main` without the schema. Cut each branch when its
  gate clears.
