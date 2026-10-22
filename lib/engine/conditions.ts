import type { Condition, DayRunState, DayScenario } from "@/lib/scenarios/types";

export function getCounter(state: DayRunState, key: string): number {
  return state.counters[key] ?? 0;
}

export function evalCondition(
  cond: Condition,
  state: DayRunState,
  day: DayScenario,
): boolean {
  if ("task_done" in cond) {
    return state.tasksDone.includes(cond.task_done);
  }
  if ("submitted" in cond) {
    return Boolean(state.submissions[cond.submitted]);
  }
  if ("counter_at_least" in cond) {
    const { counter, value } = cond.counter_at_least;
    return getCounter(state, counter) >= value;
  }
  if ("messages_sent" in cond) {
    const { to, at_least } = cond.messages_sent;
    const key = `${to}.messages`;
    return getCounter(state, key) >= at_least;
  }
  if ("trigger_fired" in cond) {
    return state.triggersFired.includes(cond.trigger_fired);
  }
  if ("all" in cond) {
    return cond.all.every((c) => evalCondition(c, state, day));
  }
  if ("any" in cond) {
    return cond.any.some((c) => evalCondition(c, state, day));
  }
  return false;
}

export function recomputeTasksDone(state: DayRunState, day: DayScenario) {
  const done = new Set(state.tasksDone);
  for (const task of day.tasks) {
    if (evalCondition(task.done_when, state, day)) {
      done.add(task.id);
    }
  }
  state.tasksDone = [...done];
}

export function resolveClock(state: DayRunState, day: DayScenario): string {
  let time = day.clock.start;
  for (const step of day.clock.steps) {
    if (evalCondition(step.when, state, day)) {
      time = step.time;
    }
  }
  return time;
}

export function nextHint(state: DayRunState, day: DayScenario): string {
  for (const task of day.tasks) {
    if (!state.tasksDone.includes(task.id)) {
      return task.title;
    }
  }
  return "All tasks done — score your day when ready";
}
