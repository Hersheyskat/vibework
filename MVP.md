# VibeWork MVP

## Product

Mobile-friendly workplace simulation. Learners pick a **scenario** (role + company), then practice inside a Slack-style workspace — scripted cartridges, AI colleagues, comparable scores.

Zippy Café PM is the first scenario, not the whole product.

## Auth

**Google login only** via Supabase Auth.

- No phone OTP
- No email OTP / magic link
- No password signup

## Flow

1. Open app (`/`) — VibeWork home + **scenario catalog**
2. Open a scenario (`/tracks/[trackId]`)
3. **Continue with Google** (if needed)
4. Start Day 1 or resume unfinished day
5. Day workspace (`/play/[runId]`)
6. Score → next day (Day 2+ pay gate — later)

Login is on the scenario page (and header Sign in). No mid-play sign-in.

## In scope

- Catalog UI that lists every folder under `scenarios/`
- 1 track content today: `scenarios/zippy-pm/` (10 work days)
- Slack-style workspace: inbox, dashboard, tasks, DMs, Saathi
- Engine: counters, triggers, clock, task submit, AI replies (OpenRouter)
- Google account → session (Supabase) → play

## Out of scope (later)

- Phone / email OTP
- Razorpay / payments
- College admin CSV
- Full scoring / employer dashboards
- Filters / search across many tracks (when catalog grows)

## Stack

Next.js App Router · Supabase Auth (Google) · OpenRouter · scenario JSON under `/scenarios`
