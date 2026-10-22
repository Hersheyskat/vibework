import { getCastMap, loadDay, loadTrack } from "@/lib/scenarios/load";
import type { DayRunState, PublicDayPayload } from "@/lib/scenarios/types";
import { nextHint, resolveClock } from "./conditions";

export function toPublicPayload(run: DayRunState): PublicDayPayload {
  const track = loadTrack(run.trackId);
  const day = loadDay(run.trackId, run.day);
  const castMap = getCastMap(track);

  const cast = day.characters
    .map((c) => castMap[c.id])
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      kind: c.kind,
      color: c.color,
      initials: c.initials,
    }));

  return {
    runId: run.id,
    track: {
      id: track.id,
      title: track.title,
      role: track.role,
      companyName: track.company.name,
      companyOneLiner: track.company.one_liner,
    },
    day: {
      day: day.day,
      title: day.title,
      theme: day.theme,
      practised: day.practised,
      duration_minutes: day.duration_minutes,
    },
    clock: resolveClock(run, day),
    public: day.public,
    cast,
    assistant: {
      id: track.assistant.id,
      name: track.assistant.name,
      role: track.assistant.role,
      opener: track.assistant.opener,
    },
    characters: day.characters.map((c) => ({
      id: c.id,
      available: run.unlocked.includes(c.id),
      locked: !run.unlocked.includes(c.id),
      opener: c.opener,
      limits: c.limits,
      reply_flags: c.reply_flags,
    })),
    groupChats: day.group_chats.map((g) => ({
      id: g.id,
      name: g.name,
      members: g.members,
      available: run.unlocked.includes(g.id),
      opener: g.opener,
    })),
    tasks: day.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      minutes: t.minutes,
      kind: t.kind,
      description: t.description,
      submit_to: t.submit_to,
      done: run.tasksDone.includes(t.id),
    })),
    messages: run.messages,
    counters: run.counters,
    openHint: run.openHint,
    learnerName: run.learnerName,
    nextHint: nextHint(run, day),
  };
}
