# Docker-free Supabase Workflow

This repo avoids Docker for database operations. Use SQL migrations plus `db push` and Supabase Studio for inspection.

## Prerequisites
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in `.env.local`.
- Optional: `SUPABASE_SERVICE_ROLE_KEY` for server scripts (never used client-side).
- Supabase CLI installed as a dev dependency (`supabase@latest`).

## Apply Migrations
- Place SQL files in `supabase/migrations/`.
- Run `npx supabase db push` (add `--debug` for verbose logs). This is non-interactive and does not require Docker.
- Use timeouts at the top of files and avoid `CREATE EXTENSION`:

```
SET lock_timeout = '5s';
SET statement_timeout = '30s';
-- Avoid CREATE EXTENSION; assume required extensions exist
```

## Inspect or Export Schema (without Docker)
- Use Supabase Studio → SQL Editor to run introspection queries or export views.
- For a human-readable snapshot, maintain `docs/schema-inventory.md` and update as needed.
- If you need full DDL, export from Studio or query system catalogs (e.g., functions, grants, RLS policies).

## When NOT to Use
- Do not run `npx supabase db pull` (requires Docker shadow DB).
- Do not alter login roles via CLI; manage roles exclusively in Supabase Dashboard.

## Verification
- After `db push`, validate core RPCs and tables from the app or Studio.
- Keep migrations idempotent: guard drops/creates with `IF EXISTS` / `IF NOT EXISTS` and avoid role/extension changes.