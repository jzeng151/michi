# Michi

Michi turns the photos from a walk into a map-based memory: import a camera roll, place the moments that need help, replay the route in time order, and reveal stories from the path beneath your own.

The repository is in active development. The landing page, seasonal themes, authenticated gallery, map shell, media storage, and an initial replay experience are working. Batch EXIF import, resilient drafts, complete time-based replay, and the Layered Memory experience are still planned work. See [ROADMAP.md](./ROADMAP.md) for the mergeable PR plan and release gates.

## Stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS 4
- Supabase Auth, Postgres, Storage, migrations, and row-level security
- MapLibre GL for maps
- GSAP for motion, with reduced-motion paths

## Prerequisites

- Node.js 24 or newer
- pnpm
- Docker or another Supabase-compatible container runtime

## Local setup

Install dependencies and start the local Supabase stack:

```bash
pnpm install --frozen-lockfile
pnpm db:start
```

Create the local environment file:

```bash
cp .env.example .env.local
pnpm supabase status
```

The checked-in example already uses the default local API URL. Copy the `anon key` reported by `pnpm supabase status` into `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, then start the app:

```bash
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The local seed includes a demo account:

```text
michi@seed.local
michi-demo-password
```

These are development-only credentials. Never use the seed or its known passwords in production.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Postcard Club landing page and seasonal theme selector |
| `/login` | Local email/password sign-in and sign-up |
| `/dashboard` | Curated and personal walk gallery |
| `/dashboard/new` | Current walk creation flow |
| `/dashboard/walks/[id]` | Authenticated walk detail and replay |
| `/walks/[id]` | Read-only public walk page; anonymous private media is not complete |
| `/palettes` | Internal palette reference |

## Quality checks

Install Chromium once before the first browser-test run:

```bash
pnpm exec playwright install chromium
```

With local Supabase running and `.env.local` configured, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm supabase db lint --local --level warning --fail-on warning
pnpm test:db
pnpm build
pnpm test:e2e
```

Vitest covers pure TypeScript logic, pgTAP covers database authorization, and Chromium Playwright covers the seeded user journey with `axe-core`. CI runs the same gate on every push and pull request.
Playwright serves the most recent production build on port 3100, so run `pnpm build` before `pnpm test:e2e` locally.

To smoke-test the production build locally:

```bash
pnpm build
pnpm start
```

## Local database maintenance

Resetting the local database is destructive. It reapplies migrations and `supabase/seed.sql`:

```bash
pnpm supabase db reset --local
pnpm supabase seed buckets --local --yes
```

After changing the schema, regenerate the checked-in database types:

```bash
pnpm supabase gen types --local --schema public > src/lib/supabase/database.types.ts
```

Useful lifecycle commands:

```bash
pnpm supabase status
pnpm db:stop
```

## Product scope

- The marketing page lives at `/`; the signed-in gallery lives at `/dashboard`.
- Spring, Summer, Autumn, and Winter themes are approved, including light and dark modes.
- The photo-first import, replay, and Layered Memory paths are the v1 priority.
- GPS recording, audio capture, and social data remain available in code and schema but are not exposed in the v1 UI.
- Install prompts, offline maps/media, and anonymous share links are cuttable. Core import and replay correctness are not.

## Deployment

There is no checked-in production deployment runbook yet. Do not infer production secrets or run remote Supabase reset/link commands from the local setup above. Production environment validation, OAuth callbacks, migrations, rollback, security headers, and release smoke tests are tracked in the final roadmap PR.
