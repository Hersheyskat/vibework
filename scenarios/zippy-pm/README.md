# VibeWork · Zippy PM track · scenario files

The full two-week Product Manager track at Zippy, written as data. The engine loads these files; no story is hard-coded.

## What's here

| File | What it is |
| --- | --- |
| `SCENARIO_FORMAT.md` | **Read first.** The format: every field, the conditions and actions, the security rule, and the new engine features these days need |
| `track.json` | Shared across all days: company world, full cast (11 characters), Saathi assistant, six skills, scorer instructions and output format, read/watch library |
| `days/day01.json` | Day 1, converted 1:1 from the playable prototype (`zippy-day1.html`) |
| `days/day02.json` … `day10.json` | Days 2–10, new content |

## The two weeks

| Day | Title | The twist | New engine need |
| --- | --- | --- | --- |
| 1 | Diagnose low repeat orders | Aditya wants 50% off every second order | — (matches prototype) |
| 2 | Talk to three customers | A survey "proves" 92% love Café (it only reached active users) | Customer interviews with a 12-question limit |
| 3 | Size the problem in rupees | CFO asks: what if we shut Café tomorrow? | CFO character |
| 4 | Ops vs growth standoff | Aditya: the CEO wants Pune at 5,000 orders a day | **Group chat** (meeting room) |
| 5 | Write the one-page spec | Aditya asks to slip in a referral feature | Engineering review after submission |
| 6 | Prioritise the roadmap | The CEO messages directly: launch three new cities | CEO character, unlock mid-day |
| 7 | Negotiate scope with engineering | An engineer is pulled into an outage | — |
| 8 | Design the experiment | Aditya wants a Pune campaign during the test | — |
| 9 | Launch-day crisis | Config typo, influencer reel, broken espresso machine | Group chat (war room), clock starts at 8 am |
| 10 | Present to leadership | CEO: "shut it down or go big?" | Group chat (leadership review), submission to a group |

## For the developer

1. Day 1 must behave exactly like the prototype; use it to check the engine.
2. Build to `SCENARIO_FORMAT.md`. The five engine features listed at its end are what Days 2–10 need beyond Day 1.
3. **Nothing marked AI-only may reach the browser.** That covers hidden facts, personas, scoring and triggers.
4. All prompts in these files are starting points tuned in the prototype; keep them editable.
5. Every number across the ten days has been checked for consistency (for example Day 3's ₹82 lakh a month loss is computed from Day 1's dashboard). If you change a number, search all days for it.

## For the product owner (Hersh)

- To change a story, edit the day file, not code.
- To test a day before engineering builds it, ask Claude in the VibeWork project to make that day playable in the prototype.
- Validation: run `validate.py` (in the same folder) to catch broken references between tasks, triggers and characters.
