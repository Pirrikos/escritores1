This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables

Configure the following variables for local dev, CI, and production:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only).
- `BASE_URL`: App base URL for tests (default `http://localhost:3000`).
- `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`: Credentials for E2E admin tests.

Local setup:

- Copy `.env.example` to `.env.local` and fill values.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only on server; never expose it to the client.

## CI Configuration (GitHub Actions)

Set repository secrets to run E2E in CI:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`

The workflows read these via `${{ secrets.* }}` and run E2E against the built app.

## Supabase Migrations (Docker-free)

This project uses a Docker-free workflow with Supabase:

- Author SQL migrations under `supabase/migrations/`.
- Apply changes with `npx supabase db push` (no password prompts, non-interactive).
- Do not use `supabase db pull` (it requires Docker for a shadow DB).
- When you need to document or inspect schema, use Supabase Studio (SQL Editor) and export views or run inspection queries. See `docs/docker-free-workflow.md`.

Recommended migration header (timeouts, no extensions):

```
SET lock_timeout = '5s';
SET statement_timeout = '30s';
-- Avoid CREATE EXTENSION; assume required extensions exist
```

Convenience scripts:

- `npm run db:push` — aplica migraciones a Supabase.
- `npm run db:push:debug` — lo mismo con salida detallada.
- `npm run db:status` — muestra migraciones locales y aplicadas (usando `public.migration_log`).

## Vercel Deployment

Add environment variables in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL` (Environment: Production/Preview/Development)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Environment: Production/Preview/Development)
- `SUPABASE_SERVICE_ROLE_KEY` (Environment: Production/Preview/Development, server-only)

The service role key is used exclusively on the server to verify `profiles.role` and perform admin-only operations (e.g., signed URLs, backup initialization). It must never be exposed to the browser.

## API Security (Admin)

- Admin-only endpoints currently include:
  - `/api/storage/signed-url` (signed URLs via service role)
  - `/api/debug-insert` (non-production only)
  - `/api/backup`
  - `/api/system/init`
  - `/api/monitoring/errors`
- Server-side authorization uses `ensureAdmin(req)` from `src/lib/adminAuth.server.js` to validate the session and confirm `profiles.role === 'admin'` via the service role.
- Do not use the service role key on the client; only in server modules and route handlers.
- Any new endpoint that performs privileged operations (service role, administrative actions, or cross-project tasks) must gate access with `ensureAdmin`.

### Testing Admin Gating (E2E)

- Playwright global setup (`tests/e2e/global.setup.ts`) creates/ensures a test admin and persists session state to `tests/e2e/.storage/admin.json`.
- E2E tests validate admin gating for sensitive endpoints, e.g.:
  - `tests/e2e/storage.signed-url.spec.ts`
  - `tests/e2e/debug-insert.spec.ts`
- Base URL is controlled by `BASE_URL`; default is `http://localhost:3000`.
