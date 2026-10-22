# VibeWork

Mobile-friendly workplace simulation. Learners pick a role inside a fictional company and practice inside a Slack-style workspace — scripted scenario files, AI colleagues, fair scoring.

See [MVP.md](./MVP.md) for scope. Auth is **Google login only** (no OTP).

## Quick start

```bash
npm install
cp .env.example .env.local
# add OPENROUTER_API_KEY + Supabase URL/publishable key
# enable Google provider in Supabase Auth (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → pick a scenario card → **Continue with Google** → Start Day 1.

Without an OpenRouter key the app still runs in **demo mode** (scripted fallbacks for chats).

### Supabase Google setup

1. Supabase Dashboard → Authentication → Providers → **Google** → enable
2. Google Cloud OAuth Web client → Client ID + Secret into Supabase
3. Redirect URLs:
   - Supabase callback: `https://<project-ref>.supabase.co/auth/v1/callback` (shown in dashboard)
   - App allow list: `http://localhost:3000/**` (covers `/auth/callback` and `?next=…`)

## Stack

- Next.js (App Router) + TypeScript
- Supabase Auth — Google OAuth only
- Scenario cartridges in `/scenarios/<track-id>/`
- OpenRouter for AI (`OPENROUTER_API_KEY`)
- Day-run state stored under `.data/runs/` (local MVP)

## Routes

| Path | Role |
|---|---|
| `/` | Home + scenario catalog |
| `/tracks/[trackId]` | Scenario detail + Google / start |
| `/play/[runId]` | Day workspace |

## Scenarios

```
scenarios/zippy-pm/
  track.json
  days/day01.json … day10.json
  SCENARIO_FORMAT.md
```

Add another company/role by dropping a new folder under `scenarios/` — it shows up on the homepage automatically.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
