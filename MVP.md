# VibeWork Try MVP

Source of truth: [`docs/BRIEF.md`](./docs/BRIEF.md). Behaviour spec: [`prototype/vibework-try.html`](./prototype/vibework-try.html). Standing rules: [`.cursor/rules/vibework.mdc`](./.cursor/rules/vibework.mdc).

**Implementation gap map (complete vs remaining):** [`docs/STATUS.md`](./docs/STATUS.md).

## Product

Paste a job post (or type a role), pick a level, get one AI-generated work-day at a fictional company: boss, colleagues, inbox, dashboard, twist, four tasks, practice score and mentor debrief.

## Auth

**Google login** via Supabase Auth.

- No phone OTP for now
- Email OTP deferred (brief allows it; Google-only until Hersh asks)

## Current milestone focus

See `docs/STATUS.md`. Snapshot:

| Milestone | Status |
| --- | --- |
| M0 Foundations | Done |
| M1 Generation | Done (two-pass + customer building) |
| M2 Playing the day | Mostly done (play + shelf fallback; polish optional) |
| M3 Support & scoring | Mostly missing |
| M4 Hardening | Barely started |

**AI:** only `OPENROUTER_API_KEY` (Claude via OpenRouter slugs). No Anthropic direct key.

## Stack

Next.js App Router · TypeScript strict · Supabase (Auth + Postgres) · Drizzle · OpenRouter · Inngest (optional) · Vercel

## Routes

| Path | Role |
| --- | --- |
| `/` | Try setup (paste job, pick level) |
| `/runs/[id]` | Building / blocked (today: tester-style checks) |
| `/games/[id]` | Play the generated day |
| `/me` | Past days |
| `/tracks/[trackId]` | Legacy handcrafted Zippy catalog |
| `/play/[runId]` | Legacy day workspace |

## In scope (full MVP, M0–M4)

See milestones in `docs/BRIEF.md`. Customers never see check failures; shelf of ready-made days; switchable models per AI job.
