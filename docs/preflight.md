# Preflight — reproduce CI before you push

CI runs a **wider** scope than the two gates people usually check locally
(`tsc` + the tests you touched). It also runs the theme visual/a11y/RTL
snapshot suites, the full app suite, the backend fast suite, and a
Real-Postgres suite. When any of those redden after a push, the fix costs a
full ~10-minute CI round-trip that a local run would have caught in seconds.

`web/scripts/preflight.mjs` mirrors `.github/workflows/web-tests.yml` and
`backend-tests.yml` so a clean preflight ≈ green CI.

## Run it

```bash
cd web
npm run preflight        # full gate: tsc + theme + app suite + build + backend fast
npm run preflight:fast   # quick loop: tsc + theme suites + build only
npm run preflight -- --list
```

## Enable the pre-push hook (once per clone)

```bash
git config core.hooksPath .githooks
```

Every `git push` then runs the **fast** preflight first and aborts the push
if it fails. Bypass intentionally with:

```bash
PREFLIGHT_SKIP=1 git push
```

## What preflight can't run for you

- **Real-Postgres suite** — needs a database. It asserts exact enum /
  constraint / checklist-key lists. If you touched a migration, a DAL table
  mapping, or a `*.postgres.test.js` assertion, run it yourself:

  ```bash
  cd backend && npm run test:pg:docker
  ```

- **Component-assertion drift** — after changing any component's props,
  exports, or rendered text, grep the test tree for that component/label name
  and read every hit. Sibling test files and hand-listed mocks
  (`*.a11y.test.tsx`, `*.rtl.test.tsx`, which don't `importActual`) routinely
  hard-code the old shape and only fail in CI.

- **Snapshots** — a token/markup/layout change drifts
  `src/theme/__snapshots__/*.snap`. Regenerate with `vitest -u`, then **read
  the diff** before committing — never blind-commit a regen.
