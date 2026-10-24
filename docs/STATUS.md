# VibeWork Try — implementation status

**Date:** 24 Oct 2026  
**Sources:** uploaded MVP build guide (PDF = `docs/BRIEF.md`), starter kit (`vibework-starter 2`), current repo (`vibework`).

This is the gap map for what to build next. Product rules stay in `docs/BRIEF.md`; do not treat this file as a second brief.

---

## Verdict

| Milestone | Status | One-line |
| --- | --- | --- |
| **Starter kit assets** | Complete | BRIEF, SCENARIO_FORMAT, prototype, example bundle, design (38), screens (10), Cursor rules — all in repo |
| **M0 · Foundations** | Complete | Next.js, Google auth, Drizzle 8 tables + RLS, setup UI, CSS port |
| **M1 · Generation** | Done (polish landed 24 Oct) | Two-pass plan + worked example; customer building hides checks/`failed`; silent recovery ladder (fresh→repair→fresh). Shelf match still M2/M4 |
| **M2 · Playing the day** | Mostly done | Play path + customer building + shelf fallback seeded. Engine test gaps / design polish remain |
| **M3 · Support & scoring** | Done (24 Oct) | Scorer + Progress + mentor debrief mode + Saathi draft-to-colleague |
| **M4 · Hardening & launch** | Done enough to launch (24 Oct) | Caps, budget, admin, events, mic/screenshots, Playwright; nightly shelf stub |

**Recommended next work order:** polish fragile edges (full shelf batch, signed-in e2e, PostHog/Sentry verify in prod). Confirm before expanding scope.

---

## 1. Starter kit vs current project

| Starter path | In `vibework`? |
| --- | --- |
| `docs/BRIEF.md` | Yes (byte-identical to starter) |
| `docs/SCENARIO_FORMAT.md` | Yes |
| `docs/design/` (38 screens + INDEX) | Yes |
| `docs/screens/` (10 key PNGs) | Yes |
| `prototype/vibework-try.html` | Yes |
| `scenarios/example/example-bundle-zippy-medium.json` | Yes |
| `.cursor/rules/vibework.mdc` | Yes (+ project `supabase-mcp.mdc`) |

**Extra in current (not in starter):** full app, Zippy handcrafted track (`scenarios/zippy-pm/`, `/tracks`, `/play`), legacy `day-runs` API. Keep until Try path is solid; do not expand it.

**Intentional stack delta vs PDF:** AI goes through **OpenRouter only** (`OPENROUTER_API_KEY`), not direct Anthropic. Models still switchable per job via `lib/ai/config.ts` / `AI_MODEL_*`. PDF’s Anthropic SDK path is not used.

---

## 2. M0 · Foundations — DONE

| Brief item | Status | Where |
| --- | --- | --- |
| Next.js App Router, TS strict | Done | `app/`, `tsconfig` |
| Prototype CSS → `globals.css` | Done | `app/globals.css` |
| Supabase Auth (Google) | Done | `lib/supabase/*`, `app/auth/*` |
| Email OTP | Deferred | `MVP.md` — Google-only until asked |
| Drizzle schema + migration + RLS | Done | `lib/db/schema.ts`, `drizzle/0000_init.sql` |
| Tables: runs, plans, games, messages, scores, llm_calls, events, **ready_days** | Done (schema) | Same |
| Setup screen (paste job, levels, chips) | Done | `components/try/SetupScreen.tsx`, `/` |
| Env wiring (no `NEXT_PUBLIC_` secrets) | Done | `.env.example` |
| Inngest / Sentry / PostHog keys | Partial | Inngest optional; Sentry/PostHog listed but not wired |

---

## 3. M1 · Generation — MOSTLY DONE

### Done

| Item | Where |
| --- | --- |
| Zod scenario schemas | `lib/scenario/schema.ts` |
| `normalize()` + five code checks + tests | `lib/scenario/{normalize,checks,formula,brands}.ts`, `checks.test.ts` |
| AI wrapper: routing, logging, retries, error copy | `lib/ai/client.ts`, `config.ts`, `errors.ts` |
| Prompts: screen, plan, repair, audit | `lib/ai/prompts/*` |
| Job: guard → screen → plan → check → audit → one repair | `lib/jobs/generate-day.ts`, `lib/try/guard.ts` |
| Building + Blocked screens (live poll) | `components/try/BuildingScreen.tsx`, `/runs/[id]` |
| Eval script (fixture + golden inputs) | `scripts/eval.ts` |
| Per-job model from config | `lib/ai/config.ts` |

### Still open (M1 leftovers → next)

| Item | Status | Notes |
| --- | --- | --- |
| Two-pass planning | **Done** | `planPass1Prompt` / `planPass2Prompt` + `generate-day` |
| Example Zippy day as worked example | **Done** | `lib/ai/prompts/example-day.ts` |
| Customer never sees “failed” / check report | **Done** | Default `/api/runs/:id` + customer BuildingScreen; tester via `?tester=1` or `VIBEWORK_TESTER=1` |
| Silent recovery ladder (retry / repair / fresh) | **Done** | Shelf offer still open |
| Role-in-a-minute wait activity | **Done** | Haiku after screen |
| Eval: compare 2–3 models per job | Missing | Eval runs golden inputs; no model bake-off |
| Shelf fallback when recovery exhausted | **Done** | `lib/shelf/*`, seed Zippy→product-manager ×3; soft copy only if no match |
| JSON-schema structured output where allowed | Partial | `completeJson` + Zod; OpenRouter path |

---

## 4. M2 · Playing the day — PARTIAL

### Done

| Item | Where |
| --- | --- |
| Engine: conditions, triggers, clock, next step, task done | `lib/try/engine/*` + `engine.test.ts` |
| Submit / revise (actions) | `lib/try/actions.ts` |
| Public allowlist + leak test | `lib/scenario/public.ts`, `public.test.ts` |
| APIs: create game, GET state, SSE messages, submissions, drafts | `app/api/runs/[id]/games`, `app/api/games/[id]/*` |
| Play UI: inbox, dashboard, tasks, chats, unread, drafts, locked | `components/try/play/PlayScreen.tsx`, `/games/[id]` |
| Info-source structured reply + pull counting | `lib/try/reply.ts` |
| Reload-safe state in Postgres | `lib/try/load-game.ts` |
| My past days list | `/me`, `MyDaysScreen.tsx` |

### Still open

| Item | Status |
| --- | --- |
| Customer building screen (friendly stages, role-in-a-minute, meet-the-team) | **Done** (shelf offer still open) |
| Silent recovery: JSON retry → repair → fresh → shelf offer | **Done** (shelf seeded with PM × 3 variants; auto-offer on fail) |
| Hide check report behind admin/tester flag for customers | **Done** |
| Engine tests: third revision refused, chat lock at pull limit | Missing |
| Prototype visual fidelity (match `docs/screens` / design) | Unverified / polish |
| Remove or quarantine legacy Zippy path | Optional cleanup |

---

## 5. M3 · Support and scoring — DONE (24 Oct)

| Item | Status | Notes |
| --- | --- | --- |
| Saathi quick-prompt chips | Done | `ASSIST_CHIPS` in PlayScreen |
| Saathi “Use as a draft to …” | Done | Chips per unlocked colleague; prefills their draft |
| Mentor coach mode during day | Done | `mentorPrompt` during day (no answers) |
| Mentor first-submission note | Done | `lib/try/actions.ts` |
| Mentor debrief mode (fixed structure) | Done | Debrief block in `character.ts` + chips when `dayOver` |
| Boss calibration | Done | In character prompt |
| Two revisions per task | Done | Cap in `applyRevision` |
| Scorer + `POST /api/games/:id/score` | Done | `lib/try/score-day.ts`, `lib/db/scores.ts`, route |
| Progress page | Done | `ProgressPane` — practice label, skills, gaps, answer vs expected, clues, learning, drill, senior view, debrief CTA |
| Full raw plan dump in browser | Skipped | Standing allowlist: no `hidden_facts` / plan dump to client; expected answers + feedback clues only after score |
| Replay same plan / try another job | Partial | Try another + My days; no explicit “replay this plan” new game |

---

## 6. M4 · Hardening — DONE ENOUGH (24 Oct)

| Item | Status | Notes |
| --- | --- | --- |
| Per-person caps + allowance indicator | Done | Defaults 2/day · 3/month; `GET /api/me/allowance`; Setup banner |
| Global daily budget alarm | Done | `VIBEWORK_DAILY_BUDGET_USD` (default 50); pauses `POST /api/runs` + optional webhook |
| Admin runs page (`/admin/runs`) | Done | `VIBEWORK_ADMIN_EMAILS` or `VIBEWORK_TESTER=1` |
| Analytics events | Done | `lib/analytics/track.ts` on submit/check/finish/start/task/score/debrief/shelf/budget |
| Mic dictation (en-IN) + screenshot attachments | Done | Compose 🎤 + 📎; data-URL imgs in thread (max 2) |
| Playwright e2e (390px + 1280px) | Done | `npm run test:e2e` — setup + mocked play (auth/AI not live) |
| Shelf nightly restock | Partial | Inngest cron 02:00 seeds if empty; Batch API top-50 roles still open |
| Sentry / PostHog | Wired (optional) | Lightweight capture when `SENTRY_DSN` / `POSTHOG_KEY` set |
| Plain error copy + way forward | Improved | `copyFor` + cap/budget messages |

**Still fragile:** live Google-auth e2e; full debrief smoke; Batch shelf restock; mic needs Chrome/Edge; screenshot vision depends on model image support via OpenRouter.

---

## 7. PDF API surface vs repo

| Brief endpoint | Status |
| --- | --- |
| `POST /api/runs` | Done |
| `GET /api/runs/:id` | Done (tester checks exposed) |
| `POST /api/runs/:id/games` | Done |
| `GET /api/games/:id` | Done |
| `POST /api/games/:id/messages` (SSE) | Done |
| `POST /api/games/:id/submissions` | Done |
| `PUT /api/games/:id/drafts` | Done |
| `POST /api/games/:id/score` | Done |
| `GET /api/me/games` | Done |
| `/admin/runs` | Done |

Legacy (not in brief): `/api/day-runs/*`, `/api/tracks/*`, `/play/[runId]`.

---

## 8. Suggested build sequence (for next chats)

Use one Agent chat per milestone chunk. Stop for confirmation between chunks.

1. ~~**M1 polish**~~ — landed 24 Oct 2026.
2. ~~**M2 CX / shelf**~~ — seeded + offer on fail (24 Oct). Optional: engine tests / UI polish.
3. ~~**M3**~~ — score + Progress + debrief + Saathi draft (24 Oct).
4. ~~**M4**~~ — caps, budget, admin, events, mic/screenshots, Playwright (24 Oct). Shelf Batch API + live e2e still thin.

Open product decisions (Hersh): free allowance numbers (env defaults 2/day · 3/month), email OTP?, post-debrief CTA, planning model.

---

## 9. How to verify what’s already green

```bash
npm test                              # unit tests
npx tsx --env-file=.env.local scripts/smoke-m1.ts   # offline + 1 live day + blocked
npx tsx --env-file=.env.local scripts/smoke-shelf.ts
npm run shelf:seed                    # bootstrap ready_days if empty
npm run eval                          # full golden set (slow/costly)
npm run dev                           # / → Google → Build → /runs/[id] → /games/[id]
```

**Verified 24 Oct 2026:** 26/26 unit tests; `tsc --noEmit` clean; Playwright 6/6 (phone+laptop). smoke-m1 / smoke-shelf previously PASS.

```bash
npm run test:e2e   # port 3010; mocked play path
```

Manual: allowance line on setup; hit cap; `/admin/runs` with admin email; mic/📎 in chat; score + debrief.
