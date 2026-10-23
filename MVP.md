# VibeWork Try MVP

Source of truth: [`docs/BRIEF.md`](./docs/BRIEF.md). Behaviour spec: [`prototype/vibework-try.html`](./prototype/vibework-try.html). Standing rules: [`.cursor/rules/vibework.mdc`](./.cursor/rules/vibework.mdc).

## Product

Paste a job post (or type a role), pick a level, get one AI-generated work-day at a fictional company: boss, colleagues, inbox, dashboard, twist, four tasks, practice score and mentor debrief.

## Auth

**Google login** via Supabase Auth (our existing setup).

- No phone OTP for now
- Email OTP deferred (brief allows it; we keep Google-only until Hersh asks)

## Current milestone

**M1 · Generation** — OpenRouter-only AI; guard → screen → plan → check → repair; Building / Blocked screens. Play day is M2.

**AI:** only `OPENROUTER_API_KEY` (Claude models via OpenRouter slugs). No Anthropic direct key.

## Stack

Next.js App Router · TypeScript strict · Supabase (Auth + Postgres) · Drizzle · Anthropic (M1+) · Inngest (M1+) · Vercel

## Routes

| Path | Role |
| --- | --- |
| `/` | Try setup (paste job, pick level) |
| `/tracks/[trackId]` | Legacy handcrafted Zippy catalog (kept for now) |
| `/play/[runId]` | Legacy day workspace |

## In scope (full MVP, M0–M4)

See milestones in `docs/BRIEF.md`. Customers never see check failures; shelf of ready-made days; switchable models per AI job.
