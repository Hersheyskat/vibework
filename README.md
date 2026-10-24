# VibeWork Try

Paste a job post, get one realistic AI-generated work-day, practise with AI colleagues, Saathi and a mentor.

- Product + engineering brief: [`docs/BRIEF.md`](./docs/BRIEF.md)
- Scenario contract: [`docs/SCENARIO_FORMAT.md`](./docs/SCENARIO_FORMAT.md)
- Design screens: [`docs/design/INDEX.md`](./docs/design/INDEX.md)
- Behaviour prototype: [`prototype/vibework-try.html`](./prototype/vibework-try.html)
- Scope snapshot: [`MVP.md`](./MVP.md)
- Complete vs remaining: [`docs/STATUS.md`](./docs/STATUS.md)

## Quick start

```bash
npm install
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_* (Google Auth) and DATABASE_URL
npm run db:migrate   # applies drizzle/0000_init.sql when DATABASE_URL is set
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → setup screen → **Continue with Google**.

### Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Publishable / anon key |
| `DATABASE_URL` | server | Postgres URI for Drizzle |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Jobs / admin (M1+) |
| `ANTHROPIC_API_KEY` | server | Generation (M1+) |
| `INNGEST_*` | server | Background jobs (M1+) |
| `SENTRY_DSN` / `POSTHOG_*` | server | Optional in M0 |

Never prefix secrets with `NEXT_PUBLIC_`.

### Supabase Google

1. Auth → Providers → Google → enable  
2. Redirect allow list includes `http://localhost:3000/**`  
3. Callback: `/auth/callback`

### Database

Schema lives in `lib/db/schema.ts`. SQL + RLS: `drizzle/0000_init.sql`.

```bash
npm run db:migrate
```

## Scripts

- `npm run dev` — local Next.js
- `npm run build` — production build
- `npm run db:migrate` — apply `drizzle/0000_init.sql`
- `npm run db:studio` — Drizzle Studio (needs `DATABASE_URL`)

## Milestone status

Full checklist: [`docs/STATUS.md`](./docs/STATUS.md).

- **M0** Foundations — done
- **M1** Generation — mostly done (OpenRouter pipeline, Building/Blocked, eval)
- **M2** Playing — partial (playable; customer building/recovery open)
- **M3–M4** — mostly open; see STATUS

### M1 commands

```bash
npm test          # codeChecks + guard
npm run eval      # fixture checks; live golden inputs if OPENROUTER_API_KEY + DATABASE_URL set
```

Build a day: sign in → paste job → **Build my work-day** → `/runs/[id]` polls until ready/blocked/failed.
