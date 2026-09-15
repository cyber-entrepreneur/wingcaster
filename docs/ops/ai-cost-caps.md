# AI cost caps (two-tier)

Per-user daily caps on inbox AI suggested replies, with agency-configurable
per-member overrides and a month-to-date agency dashboard.

## Defaults

| Scope | Daily cap | Monthly cap |
|-------|-----------|-------------|
| Individual agent (no agency membership) | **200** suggestions / UTC day | none |
| Agency member (no override row) | **200** | none |
| Agency member with `agency_ai_settings` row | `daily_cap` (10–2000) | optional `monthly_cap` |

Caps are enforced **before** the Anthropic call. Exceeding a cap returns HTTP
`429` with `code: AI_DAILY_CAP` or `AI_MONTHLY_CAP`, plus `cap`, `used`, and
`resets_at` (next midnight UTC for daily; first of next UTC month for monthly).

Usage is stored in `ai_usage_daily` (UPSERT on `(user_id, usage_date)`).

## How to raise caps

1. Sign in as an agency **owner** or **admin**.
2. Open **Agency → AI usage** (`/agency/ai-usage`).
3. Click **Edit** on a member, set daily cap (10–2000) and optional monthly cap,
   then **Save**.
4. This calls `PATCH /api/agency/ai-caps/:userId` and writes an audit row
   (`type = ai_cap_change`).

Agents can see their own headroom via `GET /api/users/me/ai-usage/today`
(`{ used, cap, resets_at }`). The inbox counter appears only when `used ≥ 150`.

## Cost math

Inbox suggestions use Claude Haiku. Typical cost per successful call is about
**$0.001–$0.005** (roughly a few thousand input tokens + short reply drafts).

Examples at the default 200/day:

- 1 agent × 200 calls/day ≈ **$0.20–$1.00 / day**
- 10 agents at full daily cap ≈ **$2–$10 / day** (~$60–$300 / month)

Raising a member to 1000/day multiplies that member’s ceiling by 5×. Prefer
monthly caps for noisy accounts.

## Schema

- Migration `361_ai_usage_daily_and_agency_ai_settings.sql`
- Tables: `ai_usage_daily`, `agency_ai_settings`

## Related code

- Cap helpers: `backend/src/lib/ai-caps.js`
- Enforcement: `backend/src/lib/conversations/ai-suggestions.js`
- Agency API: `backend/src/lib/agencies/ai-caps-routes.js`
- Inbox counter: `web/src/components/inbox/AISuggestedReplyRow.tsx`
- Dashboard: `web/src/pages/agency/AgencyAiUsagePage.tsx`
