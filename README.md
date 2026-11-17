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

## Project layout

```
src/app/            router, providers, layout shell
src/components/     shadcn ui/ + shared/ components
src/features/       one folder per feature (api, hooks, schemas, components, pages)
src/lib/            supabase client, money & validation helpers
supabase/           config, SQL migrations, Edge Functions, seed
tests/              unit/, integration/, e2e/
```
