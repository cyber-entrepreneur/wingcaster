# Paddle billing integration

WingCaster collects money through **Paddle** as merchant of record (Paddle owns
money, invoices and tax). This document lists the environment variables, the
catalog objects that must exist in Paddle, and the end-to-end money paths.

> **Status:** built **sandbox-first**. With no Paddle keys configured the whole
> integration is inert and degrades gracefully — checkout CTAs disable with a
> clear message, the portal endpoint returns `501`, and the webhook accepts and
> ignores events. Nothing breaks before the account exists.

## Architecture (locked)

- **Paddle = source of truth for money / invoices / tax.**
- **`public.credit_wallets` = the entitlement/spend record.** One **shared**
  credit balance per tenant (`credits_remaining`); every feature consumes from
  it. Per-feature "credit types" shown in the UI are display-only labels, not
  separate balances.
- Money grants entitlement fast via the signed webhook; the `fin.*` double-entry
  ledger is a separate, later reconciliation and never on the hot path.
- All money paths reduce to one shape: **Paddle event → `/webhooks/paddle` →
  grant entitlement.**

| Path | Trigger | Result |
| --- | --- | --- |
| Subscription (package for N properties) | `subscription.created/updated/canceled` | upsert `public.tenant_subscriptions` |
| Credit top-up / overage | `transaction.completed` (`custom_data.kind='topup'`) | grant credits into `public.credit_wallets` |
| Gated-feature unlock *(future)* | `transaction.completed` (`kind='feature_unlock'`) | grant the feature entitlement |
| Template purchase *(future)* | `transaction.completed` (`kind='template'`) | grant the template |

## Environment variables

### Backend (`backend/`)

| Var | Example | Purpose |
| --- | --- | --- |
| `PADDLE_ENV` | `sandbox` | `sandbox` or `production`; selects the Paddle API base URL and which `paddle_price_map` rows are used. |
| `PADDLE_API_KEY` | `pdl_sdbx_apikey_...` | Server-side API key. Portal sessions, catalog reads. **Never sent to the browser.** |
| `PADDLE_WEBHOOK_SECRET` | `pdl_ntfset_...` | Notification-destination secret used to verify the `Paddle-Signature` header on `/webhooks/paddle`. |

### Web (`web/`)

| Var | Example | Purpose |
| --- | --- | --- |
| `VITE_PADDLE_ENV` | `sandbox` | `sandbox` or `production`; passed to `Paddle.Environment.set()`. |
| `VITE_PADDLE_CLIENT_TOKEN` | `test_...` | Client-side token (safe to expose) used by `Paddle.Initialize()`. |

## Paddle catalog objects to create

Run `node backend/scripts/paddle-seed-catalog.mjs` against the sandbox (needs
`PADDLE_API_KEY` + `PADDLE_ENV=sandbox`) once the account exists. It creates and
prints the IDs for:

- One **product + price per plan tier** (monthly, and annual where offered):
  `semsar`, `boutique`, `small_team`, `agency`, `brokerage`, `enterprise`.
- One **credit-unit price** (1 unit = 1 shared credit) used for top-ups /
  consumption purchases, quantity = number of credits.

Then load the printed `pri_.../pro_...` IDs into `public.paddle_price_map`
(`kind='subscription'` keyed by `product_package_versions.id`; `kind='credit_unit'`
keyed by `'credit_unit'`), scoped by `environment`.

## Webhook

- Endpoint: `POST /webhooks/paddle` (already wired in `server.js`, raw body
  captured for signature verification).
- Subscribe the notification destination to: `customer.created`,
  `customer.updated`, `subscription.created`, `subscription.updated`,
  `subscription.canceled`, `transaction.completed`.

## Local sandbox testing

See the `paddle-sandbox-testing` skill. In short: expose `/webhooks/paddle` via a
tunnel, register it as the notification destination, use test card
`4242 4242 4242 4242` (any future expiry, any CVC), and use the dashboard webhook
simulator to replay `subscription.*` / `transaction.completed`.
