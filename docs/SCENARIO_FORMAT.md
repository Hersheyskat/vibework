# VibeWork Scenario Format, v1.0

This is the contract between product (who writes the content) and engineering (who builds the engine). The engine never hard-codes a story. Everything a learner experiences on a work-day comes from these files.

The analogy: the engine is a **game console**, and each day file is a **cartridge**.

> VibeWork Try note: Try generates one track plus one day per run, and adds two keys beside them: `ledger` (every key number, some with formulas) and `claims` (comparisons the story relies on). Both are AI-only and are checked by code. The track also carries `mentor` and each cast member a public `cares_about`. See `scenarios/example/example-bundle-zippy-medium.json`.

## Files

```
track.json            One per track (role × company): company world, full cast, skills, assistant, learning library
days/day01.json       One per work-day: today's story, public screens, characters' hidden facts, tasks, triggers, scoring
days/day02.json ...
```

A day file only adds to the track file; it never repeats it. The engine builds every AI prompt by layering:

`track.company.world_briefing` → `day.story_so_far` → `day.world_today` → the character's `track.cast[].persona` → `day.characters[].today` → that character's `hidden_facts` → `track.style_rules` → the conversation.

## Security rule (non-negotiable)

Any field marked **AI-only** below must never be sent to the browser. That covers `world_briefing`, `story_so_far`, `world_today`, `persona`, `today`, `hidden_facts`, `scoring.*` (until that day is scored), and all trigger definitions. The browser receives only what sits under `public`, plus the task text, the chat messages and the learner's own scorecard.

## track.json

| Field | Type | Meaning |
| --- | --- | --- |
| `schema_version` | string | `"1.0"` |
| `id`, `title`, `role` | string | e.g. `"zippy-pm"`, `"Product Manager at Zippy"` |
| `company` | object | `name`, `one_liner` (public), `world_briefing` (**AI-only**): facts every character knows |
| `days[]` | array | `{day, file, title}` in order |
| `skills[]` | array | `{id, name, description}`: the six scored skills |
| `cast[]` | array | Every character who appears in any day: `id, name, role, kind (colleague, customer, leader), color, initials, persona (AI-only), first_day` |
| `assistant` | object | Saathi: `id, name, role, opener, rules` (AI-only) |
| `style_rules` | string | **AI-only**. How all characters write (length, tone, no breaking character) |
| `scorer` | object | `instructions` (**AI-only**) and `output_schema` (the JSON the scorer must return) |
| `learning_library` | object | `skill_id → [{type, title, by, why, search}]`, used for read/watch picks |

## days/dayNN.json

| Field | Meaning |
| --- | --- |
| `day`, `id`, `title`, `theme` | Identity. `theme` is a one-line public subtitle |
| `duration_minutes` | `[min, max]` |
| `skills_focus[]` | Skill ids this day stresses (all six are still scored) |
| `practised[]` | Public list for the progress page ("What you practised today") |
| `story_so_far` | **AI-only.** The canon summary of earlier days. Characters treat it as true |
| `world_today` | **AI-only.** New facts that everyone knows today |
| `canon_after_day` | **AI-only.** What is true going into tomorrow regardless of the learner's choices |
| `public` | What the browser shows: `inbox[]`, `dashboard`, `reviews[]`, `documents[]` |
| `characters[]` | Today's cast: `id, available ("start" or "locked"), opener, today (AI-only), hidden_facts[], limits{}, reply_flags[]` |
| `group_chats[]` | *(Future engine feature)* Meeting rooms: `id, name, members[], available, opener` |
| `tasks[]` | `id, title, minutes, description, kind ("submission" or "chat"), submit_to (a character id or group chat id), done_when` (Try adds an optional `hint` at Beginner level) |
| `triggers[]` | `id, when (condition), do[] (actions)`. Each fires once |
| `clock` | `start, end, steps[] {when, time}`: cosmetic in-game time |
| `scoring` | **AI-only.** `strong_player, expected_answers{task_id: text}, common_mistakes[], senior_view, drill` |

### Hidden facts

```json
{"id": "first-order-late", "fact": "Customers whose first order arrived in under 12 minutes with no complaint repeat at 31%...", "reveal_if": "The player asks for repeat rate split by first-order delivery time or experience"}
```

`reveal_if` is guidance for the model, not code. The character releases a fact only when the learner's question clearly targets it.

### Reply flags

A character with `reply_flags: ["returned_data"]` must return structured output alongside its text: `{"text": "...", "returned_data": true|false}`. The engine increments `<character>.data_pulls` when the flag is true.

### Limits

`limits` caps a counter: `{"data_pulls": 25}` locks the analyst's chat once she reaches 25. `{"questions": 12}` (used for customers) counts the learner's messages; at the cap the customer politely ends the call.

## Conditions (`when`, `done_when`, `clock.steps[].when`)

| Condition | True when |
| --- | --- |
| `{"task_done": "t1"}` | Task t1 is complete |
| `{"submitted": "t1"}` | The learner submitted task t1 (submission tasks) |
| `{"counter_at_least": {"counter": "lakshmi.data_pulls", "value": 2}}` | A counter has reached a value |
| `{"messages_sent": {"to": "aditya", "at_least": 1}}` | The learner has sent N messages to a character or group chat |
| `{"trigger_fired": "twist"}` | Another trigger has already fired |
| `{"all": [ ... ]}` / `{"any": [ ... ]}` | Combine conditions |

Built-in counters: `<character>.data_pulls`, `<character>.messages` (sent by the learner), `<group>.messages`.

## Actions (`do[]`)

| Action | Effect |
| --- | --- |
| `{"message": {"from": "aditya", "text": "..."}}` | A fixed message lands in that character's chat, with a notification |
| `{"unlock": "aditya"}` | The character or group chat becomes available |
| `{"ai_reply": {"from": "meera", "direction": "..."}}` | The character writes a reply now, steered by `direction` (AI-only) |
| `{"open": "chat:meera"}` | Navigate the learner to a screen |

## Scoring

At the end of each day, the scorer reads: the scoring instructions, the day's `scoring` block, every hidden fact, the full transcript of all chats (Saathi included), and all submissions (final versions). It returns the scorecard JSON. Scores are 1–5 per skill, out of 30 per day. Store the scenario and prompt `version` with every score.
