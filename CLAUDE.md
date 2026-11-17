
# DummyPay - Project Instructions

## Project
A simulated peer-to-peer payment platform.
Real registered users can transfer fictional money.

## Architecture
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL

## Development Rules

1. Follow docs/PRODUCT_REQUIREMENTS.md.
2. Never implement frontend-only financial operations.
3. All balance modifications must happen server-side.
4. All transfers must be atomic.
5. Never allow transfers to unregistered users.
6. Never trust user IDs supplied by the frontend.
7. Enforce Supabase Row Level Security.
8. Never store CVV values.
9. Never expose API secrets in frontend code.
10. Write tests for business logic.
11. Run relevant tests after every implementation phase.
12. Do not silently change business requirements.

## Workflow

- Work incrementally.
- Explain architectural decisions.
- Ask before making significant architectural changes.
- Keep documentation updated.
- Never claim a feature is complete without testing it.
