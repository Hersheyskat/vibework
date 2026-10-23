# VibeWork Try: starter kit

Unzip this at the root of a new repository, open it in Cursor, and paste the initial prompt from `docs/BRIEF.md` (section "Building it with Cursor") into a new Agent chat.

| Path | What it is |
| --- | --- |
| `docs/BRIEF.md` | The build guide: product, architecture, stack, AI calls, generation pipeline, engine, data model, API, safety and cost, analytics, tests, scope, milestones, Cursor prompts. Source of truth. |
| `docs/SCENARIO_FORMAT.md` | The scenario file format (content ↔ engine contract). |
| `docs/screens/` | The 10 key screenshots referenced from the brief. |
| `docs/design/` | The full design set: 38 screens (desktop, phone, dark theme) with `INDEX.md`. |
| `prototype/vibework-try.html` | The working prototype. The behaviour spec: port its prompts, checks and engine; don't copy its single-file, browser-side architecture. Runs fully only inside Claude. |
| `scenarios/example/example-bundle-zippy-medium.json` | A valid generated day (Medium). Passes all code checks; use it as the main test fixture. |
| `.cursor/rules/vibework.mdc` | Standing rules Cursor applies to every chat (security, AI calls, code style, working style). |

Never commit `.env.local` or any API key.
