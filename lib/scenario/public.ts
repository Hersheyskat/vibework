import type { PracticeFeedback } from "./feedback";
import { feedbackTotal } from "./feedback";
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
import { dayOver } from "@/lib/try/transcript";

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
  feedback?: PracticeFeedback | null;
  gameStatus?: string;
}) {
  const { bundle, state, gameId, runId, level } = opts;
  const feedback = opts.feedback ?? null;
  const scored = Boolean(feedback);
  const boss = bossId(bundle);
  const info = infoId(bundle);
  const [nextMsg, nextView] = nextStep(state, bundle, {
    scored,
    hasFeedback: scored,
  });

  const castOf = (id: string) => bundle.track.cast.find((c) => c.id === id);

  const learning: {
    skill: string;
    items: { type: string; title: string; by: string; why: string; search: string }[];
  }[] = [];
  if (scored && feedback) {
    const weak = [...feedback.scores]
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((s) => s.skill);
    for (const skillName of weak) {
      const skill = bundle.track.skills.find((s) => s.name === skillName);
      if (!skill?.id) continue;
      const raw = (bundle.track.learning_library?.[skill.id] || []) as {
        type?: string;
        title?: string;
        by?: string;
        why?: string;
        search?: string;
      }[];
      learning.push({
        skill: skillName,
        items: raw.slice(0, 3).map((r) => ({
          type: String(r.type || "Read"),
          title: String(r.title || ""),
          by: String(r.by || ""),
          why: String(r.why || ""),
          search: String(r.search || r.title || ""),
        })),
      });
    }
  }

  return {
    gameId,
    runId,
    level,
    status: scored
      ? ("scored" as const)
      : opts.gameStatus === "scored"
        ? ("scored" as const)
        : ("playing" as const),
    dayOver: dayOver(state, bundle),
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
    skills: bundle.track.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
    })),
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
      // Only after scoring (BRIEF)
      expectedAnswer: scored
        ? bundle.day.scoring.expected_answers[t.id] || ""
        : undefined,
    })),
    threads: Object.fromEntries(
      Object.entries(state.threads).map(([id, msgs]) => [
        id,
        msgs.map((m) => ({
          from: m.f,
          text: m.t,
          returned_data: m.returned_data,
          imgs: m.imgs,
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
    feedback: scored
      ? {
          ...feedback!,
          total: feedbackTotal(feedback!),
          practiceLabel: "Practice score · not certified",
        }
      : null,
    learning,
    drill: scored
      ? feedback?.drill || bundle.day.scoring.drill || ""
      : null,
    seniorView: scored ? feedback?.senior || bundle.day.scoring.senior_view || "" : null,
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
      walk(v);
    }
  };
  walk(payload);
  return [...found];
}

export { SECRET_KEYS };
