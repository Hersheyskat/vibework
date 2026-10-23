/**
 * Lift common AI shape mistakes into the VibeWork scenario format
 * before normalize() / codeChecks.
 */
export function coerceBundle(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const b = structuredClone(raw) as Record<string, unknown>;
  const track = asObj(b.track);
  const day = asObj(b.day);
  b.track = track;
  b.day = day;

  const pub = asObj(day.public);
  day.public = pub;

  // inbox / dashboard / reviews / documents often placed on day.* instead of day.public.*
  for (const key of ["inbox", "dashboard", "reviews", "documents"] as const) {
    if (day[key] != null && (pub[key] == null || emptyArr(pub[key]))) {
      pub[key] = day[key];
      delete day[key];
    }
  }

  // characters missing but cast present → seed day.characters from cast
  const cast = asArr(track.cast);
  let characters = asArr(day.characters);
  if (characters.length === 0 && cast.length > 0) {
    characters = cast.map((c) => {
      const row = asObj(c);
      return {
        id: row.id,
        available: row.available === "locked" ? "locked" : "start",
        opener: row.opener ?? null,
        today: row.today ?? row.persona ?? "",
        hidden_facts: asArr(row.hidden_facts),
        limits: row.limits,
        reply_flags: row.reply_flags,
      };
    });
    day.characters = characters;
  }

  // task kind aliases
  const tasks = asArr(day.tasks);
  tasks.forEach((t) => {
    const task = asObj(t);
    if (task.kind === "sub" || task.kind === "submit") task.kind = "submission";
    if (task.kind === "dm" || task.kind === "message") task.kind = "chat";
  });
  day.tasks = tasks;

  // Remap non-standard task ids to t1..t4 when we have exactly 4
  if (tasks.length === 4) {
    const ids = ["t1", "t2", "t3", "t4"];
    const map = new Map<string, string>();
    tasks.forEach((t, i) => {
      const task = asObj(t);
      const old = String(task.id ?? "");
      const next = ids[i]!;
      if (old && old !== next) map.set(old, next);
      task.id = next;
    });
    if (map.size) rewriteIds(day, map);
  }

  // ledger / claims sometimes nested under day
  if (!Array.isArray(b.ledger) && Array.isArray(day.ledger)) {
    b.ledger = day.ledger;
    delete day.ledger;
  }
  if (!Array.isArray(b.claims) && Array.isArray(day.claims)) {
    b.claims = day.claims;
    delete day.claims;
  }
  if (!Array.isArray(b.ledger)) b.ledger = [];
  if (!Array.isArray(b.claims)) b.claims = [];

  // scoring.expected_answers sometimes under day.expected_answers
  const scoring = asObj(day.scoring);
  day.scoring = scoring;
  if (!scoring.expected_answers && day.expected_answers) {
    scoring.expected_answers = day.expected_answers;
    delete day.expected_answers;
  }

  return b;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function emptyArr(v: unknown): boolean {
  return Array.isArray(v) && v.length === 0;
}

function rewriteIds(day: Record<string, unknown>, map: Map<string, string>) {
  const rewriteCond = (c: unknown): void => {
    if (!c || typeof c !== "object") return;
    const cond = c as Record<string, unknown>;
    if (typeof cond.submitted === "string" && map.has(cond.submitted))
      cond.submitted = map.get(cond.submitted);
    if (typeof cond.task_done === "string" && map.has(cond.task_done))
      cond.task_done = map.get(cond.task_done);
    asArr(cond.all).forEach(rewriteCond);
    asArr(cond.any).forEach(rewriteCond);
  };
  asArr(day.tasks).forEach((t) => rewriteCond(t.done_when));
  const clock = asObj(day.clock);
  asArr(clock.steps).forEach((s) => rewriteCond(s.when));
  asArr(day.triggers).forEach((tr) => rewriteCond(tr.when));
  const scoring = asObj(day.scoring);
  const ea = asObj(scoring.expected_answers);
  if (Object.keys(ea).length) {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ea)) {
      next[map.get(k) ?? k] = v;
    }
    scoring.expected_answers = next;
  }
}
