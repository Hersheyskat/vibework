# VibeWork Try: design screens

Rendered from the prototype (`prototype/vibework-try.html`) with the sample Zippy day loaded, on 22 Oct 2026. Desktop shots are 1280 px wide at 1.5x, phone shots 390 px wide at 2x. Some are full-page captures, so they're taller than a screen. Match layout, copy, colours and spacing; the CSS tokens are in the prototype.

Two notes before you start:
- **A06 is the tester view only.** Customers never see check results or "failed" (see "NEW · Customers never see errors" in BRIEF.md). The customer-facing building screen shows friendly stages, and its design is still to be done.
- Chat replies in these shots are sample text. In the app, characters reply live.

## A. Setup and generation (desktop)
| File | Screen and state |
| --- | --- |
| A01-setup | Paste a job or type a role, example chips, three level cards (Medium selected) |
| A02-setup-link-refused | A bare LinkedIn link is refused before any AI call; the message asks for the pasted text |
| A03-building-in-progress | Steps ticking: job read, plan being written (live character count), Stop button |
| A04-building-ready | Every check listed, then "Your day is ready" with company, boss and team |
| A05-building-regulated-flag | Regulated-area banner (e.g. pharma supply chain); the day continues on the workplace side |
| A06-building-failed-tester-view | TESTER VIEW: failed after one repair, "What failed the first time" open, Try again / Play anyway / Change the job |
| A07-blocked-role | Licensed role (Staff Nurse, ICU) refused; three nearby roles offered |

## B. The work-day (desktop)
| File | Screen and state |
| --- | --- |
| B01-inbox | Welcome email from the boss, team table, unread badge in the rail, "Next" bar |
| B02-dashboard | Generated metrics with missed targets in red, callout, customer voices |
| B03-tasks-start-beginner-hints | Beginner level: four tasks with hints (first hint open), nothing submitted |
| B04-tasks-midday | Task 1 submitted with "Send a revised version", pull counter, twist arrived (badge + toast) |
| B05-tasks-revising | Revision mode: last version prefilled, Send revision / Cancel / mic |
| B06-tasks-day-complete | All four tasks done; "Finish day and get my practice score" |
| B07-chat-boss | Boss chat: submissions, short calibrated replies, one probing question |
| B08-chat-data-colleague | Precise questions get numbers and use a data pull ("pull 2 of 18") |
| B09-chat-locked-colleague | A colleague who hasn't messaged yet: "quiet" in the rail, input disabled |
| B10-chat-twist-arrives | The mid-day twist lands with a deadline |
| B11-chat-twist-handled | The learner pushes back with numbers and a narrow test; grudging acceptance |
| B12-new-message-toast | New-message toast and unread badge while on another screen |

## C. Support (desktop)
| File | Screen and state |
| --- | --- |
| C01-saathi | AI assistant: work help plus a ready prompt and a safety habit; "Use as a draft to Lakshmi"; four quick-prompt chips |
| C02-mentor-during-day | Mentor coaching during the day (no answers given), quick-question chips |
| C03-mentor-debrief | Mentor debrief after the day, in the fixed structure (role in a minute, what you did right, 3 improvement areas quoting the learner, right approach, exercises, read or watch) |

## D. Progress (desktop)
| File | Screen and state |
| --- | --- |
| D01-progress-not-scored | Before scoring: "Not scored yet", plus how the day was checked |
| D02-progress-scored-full-page | Practice score (labelled "not certified"), verdict, six skills with quoted evidence, practised, right vs improve, task by task (collapsed), senior view, clues missed, read or watch, drill, debrief button |
| D03-progress-all-sections-open | Same page with every expandable open: your answer vs expected answer per task, the check report, the plan file |

## E. Phone, 390 px
| File | Screen |
| --- | --- |
| E01-setup | Setup |
| E02-building-ready | Building, ready |
| E03-inbox | Inbox (the rail becomes a sideways-scrolling strip) |
| E04-dashboard | Dashboard (the table scrolls sideways inside its box; the page never does) |
| E05-tasks | Tasks |
| E06-chat | Chat with the data colleague |
| E07-saathi | Saathi with chips |
| E08-progress | Progress, full page |

## F. Dark theme (desktop)
The app follows the device's light or dark setting. F01 setup · F02 building ready · F03 dashboard · F04 chat · F05 progress.
