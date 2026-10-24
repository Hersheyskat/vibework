import { BRANDS, PLATFORMS, lev, reEsc } from "./brands";
import { evalFormula } from "./formula";
import {
  bossId,
  castOf,
  charOf,
  idSlug,
  toMin,
} from "./normalize";
import type { ScenarioBundle } from "./schema";
import type { ScreenResult } from "./schema";
import { LEVELS, type LevelId } from "@/lib/try/levels";

export type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  name: string;
  status: CheckStatus;
  detail: string;
  errs: string[];
  warns: string[];
};

type CondCtx = {
  tasks: string[];
  chars: string[];
  triggers: string[];
};

function checkCond(
  c: unknown,
  ctx: CondCtx,
  errs: string[],
  where: string,
  depth = 0,
): void {
  if (depth > 6) {
    errs.push(`${where}: condition nests too deep`);
    return;
  }
  if (!c || typeof c !== "object") {
    errs.push(`${where}: missing condition`);
    return;
  }
  const cond = c as Record<string, unknown>;
  if ("submitted" in cond || "task_done" in cond) {
    const id = (cond.submitted ?? cond.task_done) as string;
    if (!ctx.tasks.includes(id))
      errs.push(`${where}: refers to unknown task "${id}"`);
    return;
  }
  if (cond.counter_at_least) {
    const cal = cond.counter_at_least as { counter?: string };
    const m = /^([a-z0-9_-]+)\.(data_pulls|messages|questions)$/.exec(
      String(cal.counter || ""),
    );
    if (!m || !ctx.chars.includes(m[1]!))
      errs.push(`${where}: unknown counter "${cal.counter}"`);
    return;
  }
  if (cond.messages_sent) {
    const ms = cond.messages_sent as { to?: string };
    if (!ctx.chars.includes(idSlug(ms.to)))
      errs.push(`${where}: messages to unknown person "${ms.to}"`);
    return;
  }
  if ("trigger_fired" in cond) {
    if (!ctx.triggers.includes(cond.trigger_fired as string))
      errs.push(
        `${where}: refers to unknown trigger "${cond.trigger_fired}"`,
      );
    return;
  }
  if (Array.isArray(cond.all)) {
    cond.all.forEach((x) => checkCond(x, ctx, errs, where, depth + 1));
    return;
  }
  if (Array.isArray(cond.any)) {
    cond.any.forEach((x) => checkCond(x, ctx, errs, where, depth + 1));
    return;
  }
  errs.push(`${where}: condition type not in the scenario format`);
}

function strings(
  o: unknown,
  skip: string[],
  out: string[] = [],
): string[] {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, skip, out));
  else if (o && typeof o === "object") {
    for (const k of Object.keys(o as object)) {
      if (skip.includes(k)) continue;
      strings((o as Record<string, unknown>)[k], skip, out);
    }
  }
  return out;
}

function firstName(bundle: ScenarioBundle, id: string): string {
  const p = castOf(bundle, id);
  return (p?.name || id).split(" ")[0] || id;
}

/** Port of prototype codeChecks — five named checks. */
export function codeChecks(
  b: ScenarioBundle,
  level: LevelId,
  scr: ScreenResult | null,
): CheckResult[] {
  const out: CheckResult[] = [];
  const add = (
    name: string,
    errs: string[],
    warns: string[],
    okText: string,
  ) =>
    out.push({
      name,
      status: errs.length ? "fail" : warns.length ? "warn" : "pass",
      detail: errs.length
        ? errs.slice(0, 4).join("; ")
        : warns.length
          ? warns.slice(0, 3).join("; ")
          : okText,
      errs,
      warns,
    });

  const t = b.track;
  const d = b.day;

  /* 1. format */
  let e: string[] = [];
  let w: string[] = [];
  for (const k of [
    "title",
    "theme",
    "story_so_far",
    "world_today",
    "canon_after_day",
  ] as const) {
    if (!d[k]) e.push(`day.${k} missing`);
  }
  if (
    !t.company ||
    !t.company.name ||
    !t.company.world_briefing ||
    !t.company.one_liner
  )
    e.push("track.company incomplete");
  if (!t.role) e.push("track.role missing");
  if (!t.style_rules) e.push("track.style_rules missing");
  if (t.skills.length !== 6)
    e.push(`needs 6 skills, has ${t.skills.length}`);
  if (!d.public.inbox.length) e.push("inbox is empty");
  if (
    d.public.dashboard.columns.length < 2 ||
    d.public.dashboard.rows.length < 4
  )
    e.push("dashboard needs columns and at least 4 rows");
  d.public.dashboard.rows.forEach((r, i) => {
    if (
      !r ||
      !Array.isArray(r.cells) ||
      r.cells.length !== d.public.dashboard.columns.length
    )
      e.push(`dashboard row ${i + 1} doesn't match the columns`);
  });
  for (const k of ["t1", "t2", "t3", "t4"]) {
    if (!d.scoring.expected_answers[k])
      e.push(`expected answer for ${k} missing`);
  }
  if (!d.scoring.strong_player) e.push("scoring.strong_player missing");
  add("Format matches our scenario format", e, w, "track and day fields all present");

  /* 2. cast */
  e = [];
  w = [];
  const chars = d.characters.map((c) => c.id);
  const boss = bossId(b);
  const colleagues = chars.length - 1;
  if (colleagues < 3 || colleagues > 5)
    e.push(
      `needs a boss and 3–5 colleagues, has ${colleagues} colleagues`,
    );
  if (colleagues !== LEVELS[level].colleagues)
    w.push(
      `${level} level expects ${LEVELS[level].colleagues} colleagues, has ${colleagues}`,
    );
  if (new Set(chars).size !== chars.length)
    e.push("two characters share an id");
  d.characters.forEach((c) => {
    const k = castOf(b, c.id);
    if (!k) e.push(`"${c.id}" has no cast entry`);
    else if (!k.persona) e.push(`${k.name || c.id} has no persona`);
  });
  if (!chars.includes(boss))
    e.push("the boss (who tasks are sent to) isn't in today's cast");
  else if (charOf(b, boss)?.available === "locked")
    e.push("the boss is locked at the start");
  const infos = d.characters.filter((c) =>
    (c.reply_flags || []).includes("returned_data"),
  );
  if (infos.length !== 1)
    e.push(
      `needs exactly one info source with returned_data, has ${infos.length}`,
    );
  else {
    if (!infos[0]!.limits || !infos[0]!.limits.data_pulls)
      e.push("info source has no data-pull limit");
    if (infos[0]!.hidden_facts.length < 4)
      e.push(
        `info source holds ${infos[0]!.hidden_facts.length} hidden facts, needs at least 4`,
      );
  }
  const totalFacts = d.characters.reduce(
    (a, c) => a + c.hidden_facts.length,
    0,
  );
  if (totalFacts < 5) e.push(`only ${totalFacts} hidden facts in total`);
  d.characters.forEach((c) =>
    c.hidden_facts.forEach((f) => {
      if (!f.reveal_if) w.push(`fact "${f.id || "?"}" has no reveal_if`);
    }),
  );
  const locked = d.characters.filter((c) => c.available === "locked");
  if (!locked.length) e.push("no locked twist character");
  add(
    `Boss and ${colleagues} colleagues with agendas`,
    e,
    w,
    `${totalFacts} hidden facts; ${infos[0] ? castOf(b, infos[0].id)?.name || "?" : "?"} holds the data`,
  );

  /* 3. tasks + triggers */
  e = [];
  w = [];
  const ctx: CondCtx = {
    tasks: d.tasks.map((x) => x.id),
    chars,
    triggers: d.triggers.map((x) => x.id!).filter(Boolean),
  };
  if (d.tasks.length !== 4)
    e.push(`needs 4 tasks, has ${d.tasks.length}`);
  if (new Set(ctx.tasks).size !== ctx.tasks.length)
    e.push("two tasks share an id");
  d.tasks.forEach((x) => {
    if (!x.title || !x.description)
      e.push(`task ${x.id} needs a title and description`);
    if (x.kind !== "submission" && x.kind !== "chat")
      e.push(`task ${x.id} kind must be submission or chat`);
    if (x.kind === "submission" && !chars.includes(x.submit_to || ""))
      e.push(`task ${x.id} is sent to unknown "${x.submit_to}"`);
    if (x.kind === "chat" && !x.done_when)
      e.push(`chat task ${x.id} has no done_when`);
    if (x.done_when) {
      const dw = x.done_when as { task_done?: string };
      if (dw.task_done === x.id)
        e.push(`task ${x.id} depends on itself`);
      checkCond(x.done_when, ctx, e, `task ${x.id}`);
    }
    if (level === "beginner" && !x.hint)
      w.push(`task ${x.id} has no beginner hint`);
  });
  if (d.tasks.filter((x) => x.kind === "submission").length < 2)
    e.push("needs at least 2 submission tasks");
  d.triggers.forEach((tr) => {
    if (!tr.id) e.push("a trigger has no id");
    checkCond(tr.when, ctx, e, `trigger ${tr.id}`);
    if (!Array.isArray(tr.do) || !tr.do.length)
      e.push(`trigger ${tr.id} does nothing`);
    (tr.do || []).forEach((a) => {
      if (a.message) {
        if (!chars.includes(idSlug(a.message.from)))
          e.push(
            `trigger ${tr.id}: message from unknown "${a.message.from}"`,
          );
        if (!a.message.text)
          e.push(`trigger ${tr.id}: empty message`);
      } else if (a.unlock) {
        if (!chars.includes(idSlug(a.unlock)))
          e.push(`trigger ${tr.id}: unlocks unknown "${a.unlock}"`);
      } else if (a.ai_reply) {
        if (!chars.includes(idSlug(a.ai_reply.from)))
          e.push(
            `trigger ${tr.id}: reply from unknown "${a.ai_reply.from}"`,
          );
      } else if (a.open) {
        const o = String(a.open);
        if (
          !(o.startsWith("chat:") && chars.includes(o.slice(5))) &&
          !["tasks", "dashboard", "brief"].includes(o)
        )
          e.push(`trigger ${tr.id}: opens unknown screen "${o}"`);
      } else e.push(`trigger ${tr.id}: action not in the scenario format`);
    });
  });
  locked.forEach((c) => {
    if (
      !d.triggers.some((tr) =>
        (tr.do || []).some(
          (a) =>
            idSlug(a.unlock) === c.id ||
            idSlug(a.message?.from) === c.id,
        ),
      )
    )
      e.push(
        `${castOf(b, c.id)?.name || c.id} is locked and nothing unlocks them`,
      );
  });
  const twist = d.triggers.find((tr) =>
    (tr.do || []).some(
      (a) =>
        a.message && locked.some((c) => c.id === idSlug(a.message?.from)),
    ),
  );
  if (!twist) e.push("no mid-day twist message from a locked colleague");
  (d.clock.steps || []).forEach((s, i) => {
    checkCond(s.when, ctx, e, `clock step ${i + 1}`);
    if (toMin(s.time) < 0) e.push(`clock step ${i + 1} has a bad time`);
  });
  const twistFrom = twist?.do?.find((a) => a.message)?.message?.from;
  add(
    "4 tasks, triggers and the twist wire up",
    e,
    w,
    `twist from ${twistFrom ? firstName(b, idSlug(twistFrom)) : "?"}; every reference resolves`,
  );

  /* 4. numbers */
  e = [];
  w = [];
  const vals: Record<string, number> = {};
  let formulas = 0;
  let okF = 0;
  b.ledger.forEach((x) => {
    if (x && x.id != null && typeof x.value === "number" && isFinite(x.value))
      vals[String(x.id)] = x.value;
    else if (x) e.push(`ledger "${x.id}" has no numeric value`);
  });
  if (b.ledger.length < 6)
    e.push(`ledger has ${b.ledger.length} numbers, needs at least 6`);
  b.ledger.forEach((x) => {
    if (!x?.formula) return;
    formulas++;
    try {
      const v = evalFormula(x.formula, vals);
      const tol = Math.max(Math.abs(x.value!) * 0.05, 0.6);
      if (!isFinite(v)) e.push(`"${x.label || x.id}" formula divides by zero`);
      else if (Math.abs(v - x.value!) > tol)
        e.push(
          `"${x.label || x.id}" is ${x.value} but its formula gives ${Math.round(v * 100) / 100}`,
        );
      else okF++;
    } catch (err) {
      e.push(
        `"${x.label || x.id}" formula ${(err as Error).message}`,
      );
    }
  });
  if (formulas < 4)
    e.push(`only ${formulas} formulas tie numbers together, needs 4`);
  b.ledger.forEach((x) => {
    if (
      x &&
      /%/.test(x.label || "") &&
      !/change|growth|vs|differ|gap|uplift|drop/i.test(x.label || "") &&
      (x.value! < 0 || x.value! > 100)
    )
      e.push(`"${x.label}" is a percentage outside 0–100`);
  });
  let okC = 0;
  if (b.claims.length < 3)
    e.push(
      `only ${b.claims.length} claims check the story's comparisons, needs 3`,
    );
  const ops: Record<string, (a: number, z: number) => boolean> = {
    ">": (a, z) => a > z,
    "<": (a, z) => a < z,
    ">=": (a, z) => a >= z,
    "<=": (a, z) => a <= z,
  };
  b.claims.forEach((c) => {
    if (!c) return;
    const f = ops[String(c.op || "").trim()];
    if (!f) {
      e.push(`claim "${c.text}" has an unknown comparison "${c.op}"`);
      return;
    }
    try {
      const L = evalFormula(String(c.left), vals);
      const R = evalFormula(String(c.right), vals);
      if (!f(L, R))
        e.push(
          `claim "${c.text}" is false: ${Math.round(L * 100) / 100} is not ${c.op} ${Math.round(R * 100) / 100}. Change the numbers or the story and everything that relies on it`,
        );
      else okC++;
    } catch (err) {
      e.push(`claim "${c.text}" ${(err as Error).message}`);
    }
  });
  const cellNums: number[] = [];
  d.public.dashboard.rows.forEach((r) =>
    (r.cells || []).slice(1).forEach((c) => {
      const m = String(c)
        .replace(/−/g, "-")
        .match(/-?\d[\d,]*(?:\.\d+)?/);
      if (m) cellNums.push(parseFloat(m[0]!.replace(/,/g, "")));
    }),
  );
  const ledgerVals = Object.values(vals);
  const hit = cellNums.filter((n) =>
    ledgerVals.some(
      (v) => Math.abs(v - n) <= Math.max(Math.abs(n) * 0.01, 0.01),
    ),
  ).length;
  if (cellNums.length && hit / cellNums.length < 0.5)
    w.push(
      `only ${hit} of ${cellNums.length} dashboard figures are tracked in the ledger`,
    );
  add(
    "Numbers and conclusions add up",
    e,
    w,
    `${okF} of ${formulas} formulas and ${okC} of ${b.claims.length} conclusions check out; ${hit} of ${cellNums.length} dashboard figures tracked`,
  );

  /* 5. brands */
  e = [];
  w = [];
  const text = strings(
    { track: { ...t, learning_library: undefined }, day: d },
    ["learning_library", "color", "initials"],
  ).join("\n");
  const found = new Set<string>();
  BRANDS.forEach((br) => {
    if (new RegExp(`(?<![A-Za-z0-9])${reEsc(br)}(?![A-Za-z0-9])`).test(text))
      found.add(br);
  });
  (scr?.employer_names || []).forEach((n) => {
    const name = String(n || "").trim();
    // Skip industry phrases / generics the screener sometimes returns
    if (!isProperEmployerName(name)) return;
    if (
      new RegExp(`(?<![A-Za-z0-9])${reEsc(name)}(?![A-Za-z0-9])`, "i").test(
        text,
      )
    )
      found.add(name);
  });
  if (found.size)
    e.push(`real names found: ${[...found].slice(0, 6).join(", ")}`);
  const cname = String(t.company?.name || "").replace(/[^A-Za-z]/g, "");
  if (cname) {
    const close = BRANDS.concat(
      PLATFORMS as unknown as typeof BRANDS,
      (scr?.employer_names || []) as unknown as typeof BRANDS,
    )
      .map((x) => String(x).replace(/[^A-Za-z]/g, ""))
      .filter((x) => x.length >= 4)
      .find((x) => {
        const dd = lev(cname, x);
        return (
          cname.toLowerCase() === x.toLowerCase() ||
          (cname.length >= 5 && dd <= 2) ||
          (cname.length < 5 && dd <= 1)
        );
      });
    if (close)
      e.push(
        `company name "${t.company?.name}" is too close to a real brand`,
      );
  }
  add(
    "No real brands",
    e,
    w,
    `company "${t.company?.name || "?"}" is fictional; no known brands found`,
  );

  return out;
}

/** Real employer/brand tokens only — not "food delivery app" style phrases. */
export function isProperEmployerName(name: string): boolean {
  const n = name.trim();
  if (n.length < 3 || n.length > 40) return false;
  if (/\s{2,}/.test(n)) return false;
  const words = n.split(/\s+/);
  if (words.length > 3) return false;
  // All-lowercase multi-word industry blurb
  if (words.length >= 2 && n === n.toLowerCase()) return false;
  if (
    /\b(app|industry|sector|company|role|job|manager|executive|analyst|support|nurse|doctor|intern)\b/i.test(
      n,
    ) &&
    words.length >= 2
  )
    return false;
  return true;
}

export function hasStructuralFail(checks: CheckResult[]): boolean {
  return checks.slice(0, 3).some((c) => c.status === "fail");
}

export function failingReasons(checks: CheckResult[]): string[] {
  return checks
    .filter((c) => c.status === "fail")
    .flatMap((c) => c.errs);
}

/**
 * Pass-1 core checks: company/cast/hidden facts, ledger+claims, brands.
 * Skips inbox, tasks, triggers and expected_answers (filled in Pass 2).
 */
export function codeChecksPass1(
  b: ScenarioBundle,
  level: LevelId,
  scr: ScreenResult | null,
): CheckResult[] {
  const full = codeChecks(b, level, scr);
  const keep = new Set([
    "Boss and", // prefix — cast check name varies by colleague count
    "Numbers and conclusions add up",
    "No real brands",
  ]);
  const castName = full.find((c) => c.name.startsWith("Boss and"));
  const numbers = full.find((c) => c.name === "Numbers and conclusions add up");
  const brands = full.find((c) => c.name === "No real brands");

  const out: CheckResult[] = [];
  const add = (
    name: string,
    errs: string[],
    warns: string[],
    okText: string,
  ) =>
    out.push({
      name,
      status: errs.length ? "fail" : warns.length ? "warn" : "pass",
      detail: errs.length
        ? errs.slice(0, 4).join("; ")
        : warns.length
          ? warns.slice(0, 3).join("; ")
          : okText,
      errs,
      warns,
    });

  const t = b.track;
  const d = b.day;
  let e: string[] = [];
  let w: string[] = [];
  for (const k of [
    "title",
    "theme",
    "story_so_far",
    "world_today",
    "canon_after_day",
  ] as const) {
    if (!d[k]) e.push(`day.${k} missing`);
  }
  if (
    !t.company ||
    !t.company.name ||
    !t.company.world_briefing ||
    !t.company.one_liner
  )
    e.push("track.company incomplete");
  if (!t.role) e.push("track.role missing");
  if (t.skills.length !== 6)
    e.push(`needs 6 skills, has ${t.skills.length}`);
  add("Pass 1 core fields", e, w, "company, story and skills present");

  if (castName) out.push(castName);
  // Numbers: drop dashboard-ledger warn noise when dashboard is empty in pass 1
  if (numbers) {
    const warns = numbers.warns.filter(
      (x) => !/dashboard figures are tracked/.test(x),
    );
    out.push({
      ...numbers,
      warns,
      status: numbers.errs.length
        ? "fail"
        : warns.length
          ? "warn"
          : "pass",
      detail: numbers.errs.length
        ? numbers.errs.slice(0, 4).join("; ")
        : warns.length
          ? warns.slice(0, 3).join("; ")
          : numbers.detail,
    });
  }
  if (brands) out.push(brands);

  void keep;
  return out;
}

/** Structural fail for Pass 1: core fields or cast broken. */
export function hasPass1StructuralFail(checks: CheckResult[]): boolean {
  return checks
    .filter((c) =>
      c.name === "Pass 1 core fields" || c.name.startsWith("Boss and"),
    )
    .some((c) => c.status === "fail");
}
