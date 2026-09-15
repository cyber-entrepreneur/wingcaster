# Sentry setup (WingCaster)

Error tracking for the API (`backend/`) and React app (`web/`). Both SDKs are
silent no-ops when their DSN env vars are unset, so local development works
without a Sentry account.

## Projects to provision

Create **two** Sentry projects in the same organization (recommended slug `wingcaster`):

| Project | Platform | Used by | DSN env var |
|---|---|---|---|
| `wingcaster-backend` | Node.js / Express | `backend/` | `SENTRY_DSN` |
| `wingcaster-web` | React | `web/` | `VITE_SENTRY_DSN` |

### Getting DSNs

1. Open [Sentry](https://sentry.io/) → Organization Settings → Projects → Create Project.
2. Choose the platform above, name the project, finish the wizard.
3. Copy **Client Keys (DSN)** from Project Settings → Client Keys.
4. Put the backend DSN in Railway / `.env` as `SENTRY_DSN`.
5. Put the web DSN in the frontend build env as `VITE_SENTRY_DSN` (must be `VITE_`-prefixed).

### Source-map upload (web)

Production builds upload source maps via `@sentry/vite-plugin` when
`SENTRY_AUTH_TOKEN` is present.

1. Create an org auth token with `project:releases` + `org:read` (Sentry → Settings → Auth Tokens).
2. Set CI / build secrets:
   - `SENTRY_AUTH_TOKEN`
   - `SENTRY_ORG` (default `wingcaster`)
   - `SENTRY_PROJECT_WEB` (default `wingcaster-web`)
   - `VITE_GIT_SHA` / `GIT_SHA` ← set to `${{ github.sha }}` in GitHub Actions
3. Run `npm run build` in `web/`. Maps are uploaded, then deleted from `dist/` so they are not served publicly.

Without `SENTRY_AUTH_TOKEN`, the Vite plugin is skipped and the app still builds.

## Runtime env vars

| Variable | Where | Purpose |
|---|---|---|
| `SENTRY_DSN` | backend runtime | Enable Node SDK |
| `VITE_SENTRY_DSN` | web build + runtime | Enable React SDK |
| `SENTRY_AUTH_TOKEN` | web **build** only | Source-map upload |
| `GIT_SHA` | backend runtime | `release` tag |
| `VITE_GIT_SHA` | web build | `release` tag |

See also `backend/.env.example` and `web/.env.example`.

## Verify end-to-end

### Backend

```bash
cd backend
SENTRY_DSN=https://…@….ingest.sentry.io/… GIT_SHA=local-dev npm run dev
curl -s http://localhost:3001/api/dev/sentry-test
```

Open the backend project → Issues. You should see `Error: sentry test` within a few seconds (refresh if needed). The `/api/dev/sentry-test` route is **dev-only** (`NODE_ENV !== 'production'`).

### Frontend

1. Set `VITE_SENTRY_DSN` and restart Vite.
2. Temporarily throw in a route component, or call `Sentry.captureException(new Error('web sentry test'))` from the browser console after import.
3. Confirm the event in the `wingcaster-web` project. With a prod build + auth token, the stack should resolve to original TypeScript via uploaded maps.

## PII scrubbing policy (strict)

Standing rule: **PII default MASKED** — never send raw PII to Sentry.

### Never send

- Passwords, session tokens, JWTs, API keys
- OTP / TOTP codes, backup codes
- Email plaintext, phone plaintext
- Applicant SSN / national ID, credit-card numbers
- Session IDs, raw `Authorization` / cookie headers
- Revealed PA account-recovery field values

### OK to send

- `user_id`, `tenant_id`, `agency_id` (UUIDs)
- Route path, HTTP method, status code
- Stack traces, breadcrumb **category** + non-PII metadata

Both SDKs register a `beforeSend: scrubPii` hook. Unit tests live at:

- `backend/src/lib/observability/sentry.test.js`
- `web/src/lib/observability/sentry.test.ts`

Auth breadcrumbs (`login_success` / `login_fail`, `mfa_challenge*`, `cast_vote`, `pii_reveal`) record only IDs and outcome — never credentials or revealed values.

## Alert routing

Suggested starter alerts (Project Settings → Alerts):

1. **New issue** — notify `#eng-oncall` (Slack) or email when a new fingerprint appears in `production`.
2. **Spike** — > N events in 1 hour on a single issue.
3. **Regression** — resolved issue regresses.

Tag releases with `GIT_SHA` / `VITE_GIT_SHA` so alert noise can be filtered by deploy.

Environment mapping:

| `NODE_ENV` / Vite `MODE` | Sentry environment |
|---|---|
| `development` | `development` |
| `production` | `production` |
| `test` | usually no DSN |

## Sampling

Defaults (both apps):

- `tracesSampleRate: 0.1`
- Backend `profilesSampleRate: 0.1`
- Web session replay: **off** (`replaysSessionSampleRate: 0`)
- Web error replay: `0.1` with `maskAllText` + `blockAllMedia`

Raise sample rates only after confirming scrubbing and cost budget.
