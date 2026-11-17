# Project Progress

## 1. Project Overview

DummyPay is a simulated peer-to-peer payment platform: real registered users transfer fictional
money. Requirements: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md). Setup, security model
and limitations: [README.md](../README.md).

## 2. Current Status

- **Phase:** all six PRD phases are complete and the app is live at https://dummypay.vercel.app.
  CI/CD is merged (PR #5). The current work is the sliding-window rate limit (branch
  `fix/sliding-window-rate-limit`).
- **Overall:** feature-complete. CI passes on pull requests.
- **Last updated:** 2026-11-17

## 3. Completed Work

| Item | Merged in | Verification |
| --- | --- | --- |
| Phases 0–6: auth, wallets/FX, transfers, notifications, payment methods, security/a11y | PR #1 | Unit, integration and E2E tests (local runs) |
| Vercel frontend deployment | PR #2 | Deployed |
| Password reset | PR #3 | E2E `password-reset.spec.ts` |
| Recovery from stale chunks after a deploy | PR #4 | Unit and E2E `stale-deploy.spec.ts` |
| GitHub Actions CI/CD ([ci.yml](../.github/workflows/ci.yml)) | PR #5 | Passed on the PR, as reported by the user |

## 4. Work in Progress

**Sliding-window rate limit**, in migration
[20261117165311_sliding_window_rate_limit.sql](../supabase/migrations/20261117165311_sliding_window_rate_limit.sql).
`hit_rate_limit` now logs each allowed call in `rate_limit_events` and counts the calls in the
trailing window. Before, it counted per clock minute, so a burst across a minute boundary could
make 2× the limit. The function's signature is unchanged, and the change covers both
`lookup_recipient` (20 per minute) and `create_transfer_quote` (30 per minute). The old
`rate_limits` table was dropped.

- **Already applied to the hosted database (2026-11-17), but not on `main` yet.** Until it's
  merged, a `deploy-backend` run on `main` will fail on the unknown migration.

## 5. Known Issues and Blockers

- `deploy-backend` has never run on `main`. The `SUPABASE_ACCESS_TOKEN` and
  `SUPABASE_PROJECT_REF` values are untested.
- If `DummyPay env` limits deployment branches, `db-tests` can't run on pull request branches.
- React logs "Select is changing from uncontrolled to controlled" warnings during E2E runs. They
  are harmless and haven't been fixed.
- Other limitations are listed in the README under "Known limitations".

## 6. Important Decisions

- **One shared hosted Supabase project** for the live site, development and tests. Docker is
  not used. Never run `supabase db reset --linked`.
- All money operations go through Postgres functions. Identity comes only from `auth.uid()`.
- CI: the jobs that use the hosted project share non-cancelling concurrency groups. Vercel still
  deploys the frontend. Supabase values live in the `DummyPay env` environment. The `checks` job
  runs as 4 parallel jobs.
- **Integration and E2E tests must not overlap** while they share the live project: both swap
  and restore the exchange rates, integration tests make the rates stale on purpose, and the
  integration setup deletes all `@test.dummypay.dev` users. A separate test project was decided
  against (2026-11-17).
- Rate limits use a sliding window (2026-11-17), not fixed clock windows.
- On an Auth 429, `signInAs` retries after 30, 60, 90 and 120 s, covering the full 5-minute
  window. Every hook and test that calls it uses `SIGN_IN_TIMEOUT_MS` (6 min), so retries aren't
  cut off by the default 60 s hook or 30 s test timeouts. Other tests keep the 30 s limit.

## 7. Next Steps

1. Open and merge the PR for `fix/sliding-window-rate-limit`.
2. Confirm that `deploy-backend` passes on `main`. It should report the migration as already
   applied.
3. Optional: decide whether to require approval in `DummyPay env` before deploys.

## 8. Verification

2026-11-17:

- Local runs with `CI=true` and the CI placeholder env, before the sliding-window change:
  typecheck, lint and build passed; unit tests 129 of 129, integration tests 163 of 163, E2E
  tests 15 of 15.
- After the sliding-window change: typecheck and lint passed.
  `phase3-transfers.test.ts` passed 43 of 43, including 2 new sliding-window tests.
  `phase6-security-matrix.test.ts` passed. `supabase db advisors` showed no new findings.
- After the `signInAs` timeout fix: a temporary probe used up the sign-in limit on purpose, and
  `signInAs` recovered from the 429 inside a `beforeAll` within `SIGN_IN_TIMEOUT_MS`. The full
  integration suite then passed: 165 of 165.
- GitHub Actions: the PR #5 checks and `db-tests` passed (reported by the user).

## 9. Important Files

- [supabase/migrations/20261117165311_sliding_window_rate_limit.sql](../supabase/migrations/20261117165311_sliding_window_rate_limit.sql)
- [tests/integration/phase3-transfers.test.ts](../tests/integration/phase3-transfers.test.ts), [tests/integration/helpers.ts](../tests/integration/helpers.ts)
- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
