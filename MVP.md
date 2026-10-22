# VibeWork MVP

## Product

Mobile-friendly workplace simulation. Learners practice **Product Manager at Zippy Café** inside a Slack-style workspace — scripted scenario cartridges, AI colleagues, comparable scores.

## Auth (this MVP)

**Google login only** via Supabase Auth.

- No phone OTP
- No email OTP / magic link
- No password signup

### Flow

1. Open app (`/`)
2. **Continue with Google**
3. Resume unfinished day, or start Day 1
4. Day workspace (`/play/[runId]`)
5. Score → next day (Day 2+ pay gate — later)

Login lives only on the landing gate. No mid-play sign-in.

## In scope

- 1 track: `scenarios/zippy-pm/` (10 work days)
- Slack-style workspace: inbox, dashboard, tasks, DMs, Saathi
- Engine: counters, triggers, clock, task submit, AI replies (OpenRouter)
- Google account → session (Supabase) → play

## Out of scope (later)

- Phone / email OTP
- Razorpay / payments
- College admin CSV
- Multi-track catalog UI
- Full scoring / employer dashboards

## Stack

Next.js App Router · Supabase Auth (Google) · OpenRouter · scenario JSON under `/scenarios`
