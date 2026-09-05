# Cursor dispatch — Consumer notification dispatch (SUPERSEDED — split into 2 PRs)

**Status:** Superseded by two smaller PRs per architect-owner review (2026-09-04). Do not implement this file as-is.

## Why the split

Original dispatch bundled email/SMS/WhatsApp/in-app dispatch + retry logic + FCM push + push token migration + dead-letter surfacing in one PR. Estimated 2-3 days. Architect-owner review found this understated FCM complexity (JWT signing, OAuth token refresh, iOS APNS relay through FCM) and flagged risk that push issues would block the whole PR.

Split so email/SMS/WhatsApp/in-app + retry + rate-limit + dead-letter ships independently even if push has integration issues.

## The two PRs

1. **`CURSOR_CONSUMER_NOTIFICATION_DISPATCH_PART1.md`** — email + SMS + WhatsApp + in-app channels + retry logic + rate limiting + batching + dead-letter surfacing. Estimated 3-4 days.
2. **`CURSOR_CONSUMER_NOTIFICATION_DISPATCH_PART2_PUSH.md`** — push notifications via FCM + `user_push_tokens` migration + push-token registration API. Estimated 3-4 days. Depends on PART1 being merged (uses the dispatcher framework PART1 establishes).

Both prompts incorporate all 8 review items: server.js bloat fix (module extraction), skipped-vs-pending distinction, dead-letter surfacing, per-channel recipient validation, retry policy, `metadata` field documentation, global-unique push tokens, rate limiting.
