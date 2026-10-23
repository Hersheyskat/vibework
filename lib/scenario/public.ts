import type { ScenarioBundle } from "./schema";
import type { GameState } from "@/lib/try/engine/types";
import {
  bossId,
  clockText,
  infoId,
  isAvail,
  nextStep,
  taskDone,
} from "@/lib/try/engine/cond";

const SECRET_KEYS = [
  "world_briefing",
  "story_so_far",
  "world_today",
  "canon_after_day",
  "persona",
  "today",
  "hidden_facts",
  "reply_flags",
  "triggers",
  "style_rules",
  "scoring",
  "ledger",
  "claims",
  "expected_answers",
] as const;

/** Build browser-safe game payload (allowlist — never delete-from-secret). */
export function toPublicGame(opts: {
  gameId: string;
  runId: string;
  level: string;
  bundle: ScenarioBundle;
  state: GameState;
}) {
  const { bundle, state, gameId, runId, level } = opts;
  const boss = bossId(bundle);
  const info = infoId(bundle);
  const [nextMsg, nextView] = nextStep(state, bundle);

  const castOf = (id: string) => bundle.track.cast.find((c) => c.id === id);

  return {
    gameId,
    runId,
    level,
    status: "playing" as const,
    clock: clockText(state, bundle),
    view: state.view,
    next: { message: nextMsg, view: nextView },
    toast: state.toast,
    company: {
      name: bundle.track.company?.name || "",
      one_liner: bundle.track.company?.one_liner || "",
    },
    role: bundle.track.role || "",
    title: bundle.track.title || "",
    theme: bundle.day.theme || "",
    practised: bundle.day.practised || [],
    public: {
      inbox: bundle.day.public.inbox,
      dashboard: bundle.day.public.dashboard,
      reviews: bundle.day.public.reviews,
      documents: bundle.day.public.documents,
    },
    mentor: bundle.track.mentor
      ? {
          name: bundle.track.mentor.name,
          title: bundle.track.mentor.title,
        }
      : { name: "Mentor", title: "Your mentor" },
    characters: bundle.day.characters.map((c) => {
      const cast = castOf(c.id);
      const pulls = state.counters[`${c.id}.data_pulls`] || 0;
      const pullLimit = c.limits?.data_pulls;
      const locked = !isAvail(c.id, state, bundle);
      return {
        id: c.id,
        name: cast?.name || c.id,
        role: cast?.role || "",
        cares_about: cast?.cares_about || "",
        color: cast?.color || "#555",
        initials: cast?.initials || (c.id[0] || "?").toUpperCase(),
        available: !locked,
        locked,
        opener: locked ? null : c.opener,
        isBoss: c.id === boss,
        isInfoSource: c.id === info,
        dataPulls: info === c.id ? pulls : undefined,
        dataPullLimit: info === c.id ? pullLimit : undefined,
        chatLocked:
          info === c.id &&
          pullLimit != null &&
          pulls >= pullLimit,
        unread: state.unread[c.id] || 0,
      };
    }),
    tasks: bundle.day.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      minutes: t.minutes,
      kind: t.kind,
      description: t.description,
      submit_to: t.submit_to,
      hint: t.hint,
      done: taskDone(t, state, bundle),
      submitted: Boolean(state.sub[t.id]),
      submission: state.sub[t.id] || null,
      revisions: (state.subHist[t.id] || []).length,
      canRevise:
        Boolean(state.sub[t.id]) &&
        (state.subHist[t.id] || []).length < 2,
      revising: Boolean(state.revising[t.id]),
      draft: state.tdraft[t.id] || "",
    })),
    threads: Object.fromEntries(
      Object.entries(state.threads).map(([id, msgs]) => [
        id,
        msgs.map((m) => ({
          from: m.f,
          text: m.t,
          returned_data: m.returned_data,
        })),
      ]),
    ),
    drafts: state.drafts,
    unread: state.unread,
    support: {
      assist: {
        id: "assist",
        name: "Saathi",
        role: "Your AI assistant",
        unread: state.unread.assist || 0,
      },
      mentor: {
        id: "mentor",
        name: bundle.track.mentor?.name || "Mentor",
        role: bundle.track.mentor?.title || "Your mentor",
        unread: state.unread.mentor || 0,
      },
    },
  };
}

export function containsSecretKeys(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      o.forEach(walk);
      return;
    }
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if ((SECRET_KEYS as readonly string[]).includes(k)) found.add(k);
      // Also catch secret text if somehow leaked as string keys in nested objects
      walk(v);
    }
  };
  walk(payload);
  return [...found];
}

export { SECRET_KEYS };
