# DummyPay

A simulated peer-to-peer payment platform: real registered accounts, entirely fictional money.
Product requirements: [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md).

**Stack:** React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query,
Supabase (Postgres, Auth, Realtime, Edge Functions), Vitest, Playwright.

## Prerequisites

- Node.js 22+
- Supabase CLI — installed as a dev dependency (`npx supabase ...`)
- A hosted Supabase project. **Docker is not used**: development and tests run against the
  hosted project (`vtimmqlnyoyxiwczfdwf`). Schema changes are SQL migrations in
  `supabase/migrations/`, applied with `npm run db:push`; Auth settings live in
  `supabase/config.toml` and are applied with `npx supabase config push`.

## Setup

```bash
npm install
npx playwright install chromium
npx supabase login
npx supabase link --project-ref vtimmqlnyoyxiwczfdwf
cp .env.example .env          # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (publishable key)
npm run dev
```

Integration tests additionally read `.env.test` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`) to create and delete throwaway test users. Both env files are git-ignored.

Only the public publishable key belongs in `.env`. The secret key and the exchange-rate API key
are server-side secrets and must never appear in frontend code.

> The project is shared by development and tests. Never run `supabase db reset --linked` —
> it would wipe all data. Tests create users under `@test.dummypay.dev` and clean up after
> themselves. Auth sign-in/sign-up is rate-limited to 30 per 5 minutes per IP, so tests reuse
> a small pool of users.

## Exchange rates

Rates come from [ExchangeRate-API](https://www.exchangerate-api.com/) through the `fx-refresh`
Edge Function, so the API key never reaches the browser:

```bash
npx supabase secrets set EXCHANGERATE_API_KEY=<your key>   # once
npm run fn:deploy                                           # after changing functions
```

- The app calls `fx-refresh` when its rates are more than an hour old; the function contacts the
  provider at most once every 30 minutes (atomic claim in Postgres) and keeps the previous rates
  if the provider fails or returns anything invalid.
- Cross rates are derived in Postgres `numeric`; conversions round half-up to the minor unit.
- A rate whose provider timestamp is older than 26h is treated as unavailable for conversions.

## Simulated payment methods

Cards and bank accounts are added through the `add-payment-card` and `add-bank-account` Edge
Functions. They validate the full input (Luhn, brand/length, MM/YY expiry, CVV; IBAN country length
and mod-97, or a 4–20 digit account number) and store only what is safe: card brand, last four
digits, expiry and a random `tok_sim_…` token; bank identifiers masked (`GB•• •••• 5432`). The
tables have no columns for full card numbers or CVVs. The same validation module
(`supabase/functions/_shared/payment-validation.ts`) runs in the browser for instant feedback.

## Security model

- **Postgres is the only authority over money.** Signed-in users have `SELECT` only on wallets,
  transactions, quotes and notifications; every write goes through a vetted function. Row Level
  Security is enabled on every table.
- **Identity comes from the session.** Functions use `auth.uid()`; none accepts a user id. Edge
  Functions verify the JWT and ignore any `user_id` in the body.
- **Elevated-privilege surface (SECURITY DEFINER), all deliberate:** `add_wallet`,
  `set_preferred_currency`, `lookup_recipient`, `create_transfer_quote`, `execute_transfer`,
  `mark_notifications_read`. Each pins `search_path = ''` and is not executable by `anon`. These
  six are the only findings from `npx supabase db advisors --remote`.
- **Transfers** lock the quote and both wallets (`FOR UPDATE`, wallet-id order), re-check the
  balance under lock, and are idempotent per `(sender, idempotency_key)`; quotes are single-use and
  expire after 60s. `CHECK (balance_minor >= 0)` and an immutability trigger on transactions are
  the last line of defence.
- **Secrets:** only the publishable key ships to the browser. The secret key lives in
  `.env.test` (tests only) and the Edge Function environment; the FX key only in Edge Function
  secrets.
- Tests: `tests/integration/phase6-security-matrix.test.ts` probes every table and function as an
  outsider and as an anonymous visitor; `tests/e2e/a11y.spec.ts` scans every page with axe
  (WCAG 2.1 AA, fails on serious/critical issues).

## Known limitations & before going to production

- **Exchange-rate key:** live rates need `EXCHANGERATE_API_KEY` set as an Edge Function secret
  (see above). Until then conversions and cross-currency transfers are paused; same-currency
  transfers still work.
- **Shared project:** development and automated tests use one Supabase project. Use a separate
  project for production.
- **Recipient lookup reveals whether an email is registered** (inherent to the spec); it is
  authenticated, exact-match only and limited to 20 lookups per minute.
- **Account deletion** (admin only — there is no self-service delete) cascades to that account's
  transactions, which also removes them from counterparties' history.
- **Hosting:** serve over HTTPS with a Content-Security-Policy restricting `connect-src` to the
  Supabase project URL. Consider enabling Supabase Auth's leaked-password protection (paid plans).
- **`npm audit`:** 4 moderate findings, all in `minimatch` via the shadcn CLI's code-generation
  tooling (`ts-morph`); it runs only when adding components and is not part of the app bundle.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` / `npm run lint` | TypeScript / oxlint |
| `npm run test:unit` | Vitest unit + component tests (jsdom) |
| `npm run test:int` | Vitest integration tests against the hosted project (needs `.env.test`) |
| `npm run test:e2e` | Playwright end-to-end tests (desktop + mobile viewports) |
| `npm run db:new <name>` | Create a new SQL migration file |
| `npm run db:status` | Compare local migrations with the hosted database |
| `npm run db:push` | Apply pending migrations to the hosted database |
| `npm run db:types` | Regenerate `src/types/database.ts` from the hosted schema |
| `npm run fn:deploy` | Deploy Edge Functions (bundled server-side, no Docker) |

## Testing notes

- Integration and E2E tests run against the hosted project. Tests that need exchange rates
  snapshot the real `fx_rates`, seed fixed fixture rates, and restore the originals afterwards.
- Playwright runs with one worker (specs share that rate fixture). Full flows run on the desktop
  project; the mobile project runs `shell.spec.ts` and `mobile.spec.ts` (layout + navigation).
- Transfer concurrency, idempotency and ledger-reconciliation tests live in
  `tests/integration/phase3-transfers.test.ts`.

## Project layout

```
src/app/            router, providers, layout shell
src/components/     shadcn ui/ + shared/ components
src/features/       one folder per feature (api, hooks, schemas, components, pages)
src/lib/            supabase client, money & validation helpers
supabase/           config, SQL migrations, Edge Functions, seed
tests/              unit/, integration/, e2e/
```
