# VibeWork

Mobile-friendly workplace simulation. Learners practice a Product Manager role at Zippy Café inside a Slack-style workspace — scripted scenario files, AI colleagues, fair scoring.

See [MVP.md](./MVP.md) for scope. Auth is **Google login only** (no OTP).

## Quick start

```bash
npm install
cp .env.example .env.local
# add OPENROUTER_API_KEY + Supabase URL/publishable key
# enable Google provider in Supabase Auth (see MVP.md / below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Continue with Google** → Start Day 1.

Without an OpenRouter key the app still runs in **demo mode** (scripted fallbacks for chats).

### Supabase Google setup

1. Supabase Dashboard → Authentication → Providers → **Google** → enable
2. Google Cloud OAuth Web client → Client ID + Secret into Supabase
3. Redirect URLs:
   - Supabase callback: `https://<project-ref>.supabase.co/auth/v1/callback` (shown in dashboard)
   - App Site URL / redirect allow list: `http://localhost:3000` and `http://localhost:3000/auth/callback`

## Stack

- Next.js (App Router) + TypeScript
- Supabase Auth — Google OAuth only
- Scenario cartridges in `/scenarios/<track-id>/`
- OpenRouter for AI (`OPENROUTER_API_KEY`)
- Day-run state stored under `.data/runs/` (local MVP)

## Scenarios

```
scenarios/zippy-pm/
  track.json
  days/day01.json … day10.json
  SCENARIO_FORMAT.md
```

The engine is track-agnostic: add another folder under `scenarios/` for a new company/role.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
