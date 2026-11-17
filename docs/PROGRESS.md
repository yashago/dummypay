# Project Progress

## 1. Project Overview

DummyPay is a simulated peer-to-peer payment platform: real registered users transfer fictional
money. Requirements: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md). Setup, security model
and limitations: [README.md](../README.md).

## 2. Current Status

- **Phase:** all six PRD phases are complete and the app is live at https://dummypay.vercel.app.
  The current work is CI/CD (branch `ci/github-actions`).
- **Overall:** feature-complete. The CI pipeline has never had a green run on GitHub.
- **Last updated:** 2026-11-17

## 3. Completed Work

| Item | Merged in | Verification |
| --- | --- | --- |
| Phases 0–6: auth, wallets/FX, transfers, notifications, payment methods, security/a11y | PR #1 | Unit, integration and E2E tests (local runs) |
| Vercel frontend deployment | PR #2 | Deployed |
| Password reset | PR #3 | E2E `password-reset.spec.ts` |
| Recovery from stale chunks after a deploy | PR #4 | Unit and E2E `stale-deploy.spec.ts` |

## 4. Work in Progress

**GitHub Actions CI/CD**: [.github/workflows/ci.yml](../.github/workflows/ci.yml). Committed and
pushed (`b82d340`, `2f7be4a`). The pull request has been opened by hand.

- Jobs: `checks` (no secrets), `deploy-backend` (pushes to `main` only), `db-tests` (hosted project).
- `checks` runs typecheck, lint, unit tests and build as 4 parallel matrix jobs. In `db-tests`,
  the Playwright browser installs in the background while the integration tests run. Neither
  change has been run on GitHub yet.
- The first run failed because none of the Supabase values reached the jobs. They are stored in
  the GitHub environment `DummyPay env`, and the jobs didn't declare it. Fixed in `2f7be4a`; the
  re-run result is **unverified**.

## 5. Known Issues and Blockers

- CI has not passed on GitHub yet (see §4).
- If `DummyPay env` limits deployment branches (for example to `main`), `db-tests` can't run on
  pull request branches.
- `deploy-backend` has never run. The `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` values
  are untested in CI.
- React logs "Select is changing from uncontrolled to controlled" warnings during E2E runs. They
  are harmless and haven't been fixed.
- Other known limitations (password-reset email limits, `npm audit` findings and more) are
  listed in the README under "Known limitations".

## 6. Important Decisions

- **One shared hosted Supabase project** for the live site, development and tests. Docker is
  not used. Never run `supabase db reset --linked`.
- All money operations go through Postgres functions. Identity comes only from `auth.uid()`.
- CI: the jobs that use the hosted project share non-cancelling concurrency groups. Vercel still
  deploys the frontend. Supabase values live in the `DummyPay env` environment.
- **Integration and E2E tests must not overlap** while they share the live project: both swap
  and restore the exchange rates, integration tests make the rates stale on purpose, and the
  integration setup deletes all `@test.dummypay.dev` users. Real test parallelism would need a
  separate test project (decided against on 2026-11-17).
- Tests account for Auth's limit of 30 sign-ins per 5 minutes per IP: users are created through
  the admin API, `signInAs` retries on a 429, and Playwright retries only once in CI.

## 7. Next Steps

1. Check the CI re-run on the `ci/github-actions` pull request. If `db-tests` fails, look at the
   environment's branch restrictions and the configuration-check step.
2. Merge, then confirm that `deploy-backend` passes on `main`.
3. Optional: decide whether to require approval in `DummyPay env` before deploys.
4. Optional: fix the controlled/uncontrolled Select warnings.

## 8. Verification

Local runs on 2026-11-17 with `CI=true` and the CI placeholder env:

- Typecheck, lint and build: passed.
- Unit tests: 129 of 129 passed.
- Integration tests: 163 of 163 passed (hosted project).
- E2E tests: 15 of 15 passed (desktop and mobile).
- GitHub Actions: the first run failed at the configuration check. The re-run is pending.

## 9. Important Files

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [tests/integration/helpers.ts](../tests/integration/helpers.ts), [tests/e2e/support.ts](../tests/e2e/support.ts)
- [playwright.config.ts](../playwright.config.ts)
- [README.md](../README.md), the "CI/CD (GitHub Actions)" section
