"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TryShell } from "@/components/try/TryShell";
import { LEVELS, type LevelId } from "@/lib/try/levels";
import { DEBRIEF_REQUEST } from "@/lib/try/transcript";
import { attachMic, shrinkImage } from "./mic";
import { ProgressPane } from "./ProgressPane";
import type { PublicGame } from "./types";

function PlayHeader({ clock }: { clock: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <div className="hidden min-[901px]:flex items-center gap-2">
        <Link href="/me" className="reset">
          My days
        </Link>
        <span className="clock">{clock}</span>
      </div>
      <div className="flex min-[901px]:hidden items-center gap-2">
        <span className="clock text-xs">{clock}</span>
        <button
          type="button"
          className={`hdr-burger${open ? " open" : ""}`}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        {open ? (
          <button
            type="button"
            className="hdr-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        ) : null}
        <div className={`hdr-drawer${open ? " open" : ""}`}>
          <Link
            href="/me"
            className="hdr-drawer-item"
            onClick={() => setOpen(false)}
          >
            My days
          </Link>
          <Link
            href="/"
            className="hdr-drawer-item"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

const ASSIST_CHIPS = [
  "How would an AI-powered PM do my current task?",
  "Which AI tools help with this, and how?",
  "Give me a prompt I can use right now",
  "What should I never do with AI at work?",
];

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function personName(game: PublicGame, id: string) {
  if (id === "assist") return game.support.assist.name;
  if (id === "mentor") return game.support.mentor.name;
  return game.characters.find((c) => c.id === id)?.name || id;
}

function personRole(game: PublicGame, id: string) {
  if (id === "assist") return game.support.assist.role;
  if (id === "mentor") return game.support.mentor.role;
  return game.characters.find((c) => c.id === id)?.role || "";
}

function personAv(game: PublicGame, id: string) {
  if (id === "assist")
    return { color: "#3b2fb8", initials: "SA" };
  if (id === "mentor")
    return { color: "#a86a00", initials: "ME" };
  const c = game.characters.find((x) => x.id === id);
  return {
    color: c?.color || "#555",
    initials: c?.initials || "?",
  };
}

async function parseSse(
  res: Response,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      let event = "message";
      let data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export function PlayScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<PublicGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [localDraft, setLocalDraft] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [pendingImgs, setPendingImgs] = useState<string[]>([]);
  const [micHint, setMicHint] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgsRef = useRef<HTMLDivElement | null>(null);
  const composeTaRef = useRef<HTMLTextAreaElement | null>(null);
  const micBtnRef = useRef<HTMLButtonElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Could not load game");
    }
    return (await res.json()) as PublicGame;
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(async (g) => {
        if (cancelled) return;
        setGame(g);
        setTaskDrafts(
          Object.fromEntries(g.tasks.map((t) => [t.id, t.draft || ""])),
        );
        // Mark inbox seen when landing on brief (drives Next hint)
        if (g.view === "brief") {
          const res = await fetch(`/api/games/${gameId}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ view: "brief" }),
          });
          if (res.ok && !cancelled) {
            setGame((await res.json()) as PublicGame);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [load, gameId]);

  const go = useCallback(
    async (view: string) => {
      if (!game) return;
      setGame({ ...game, view });
      const res = await fetch(`/api/games/${gameId}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view }),
      });
      if (res.ok) {
        const next = (await res.json()) as PublicGame;
        setGame(next);
        if (view.startsWith("chat:")) {
          const id = view.slice(5);
          setLocalDraft(next.drafts[id] || "");
        }
      }
    },
    [game, gameId],
  );

  const saveDraft = useCallback(
    (key: string, text: string) => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        void fetch(`/api/games/${gameId}/drafts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, text }),
        });
      }, 400);
    },
    [gameId],
  );

  useEffect(() => {
    if (!game) return;
    if (game.view.startsWith("chat:")) {
      const id = game.view.slice(5);
      setLocalDraft(game.drafts[id] || "");
    }
  }, [game?.view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgsRef.current?.scrollTo(0, msgsRef.current.scrollHeight);
  }, [game?.threads, busy, game?.view]);

  useEffect(() => {
    const btn = micBtnRef.current;
    const ta = composeTaRef.current;
    if (!btn || !ta || !game?.view.startsWith("chat:")) return;
    return attachMic(btn, ta, setMicHint, (v) => {
      setLocalDraft(v);
      const id = game.view.slice(5);
      saveDraft(id, v);
    });
  }, [game?.view, saveDraft]);

  async function sendChat(to: string, text: string, images?: string[]) {
    const imgs = images || pendingImgs;
    const trimmed = text.trim() || (imgs.length ? "(see screenshot)" : "");
    if ((!trimmed && !imgs.length) || busy || !game) return;
    setBusy(to);
    setLocalDraft("");
    setPendingImgs([]);
    setMicHint(null);
    setGame({
      ...game,
      drafts: { ...game.drafts, [to]: "" },
      threads: {
        ...game.threads,
        [to]: [
          ...(game.threads[to] || []),
          { from: "me", text: trimmed, imgs: imgs.length ? imgs : undefined },
        ],
      },
      view: `chat:${to}`,
    });
    try {
      const res = await fetch(`/api/games/${gameId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text: trimmed, images: imgs }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Send failed");
      }
      let streamed = "";
      await parseSse(res, (event, data) => {
        if (event === "state" || event === "done") {
          const g =
            event === "done"
              ? (data as { game: PublicGame }).game
              : (data as PublicGame);
          if (g) setGame(g);
        }
        if (event === "delta") {
          streamed += (data as { text: string }).text;
          setGame((prev) => {
            if (!prev) return prev;
            const th = [...(prev.threads[to] || [])];
            const last = th[th.length - 1];
            if (last?.from === "them" && last.text.startsWith(streamed.slice(0, 8))) {
              th[th.length - 1] = { from: "them", text: streamed };
            } else if (last?.from !== "them" || !streamed.startsWith(last.text)) {
              // show typing bubble
              if (last?.from === "them" && busy) {
                th[th.length - 1] = { from: "them", text: streamed };
              } else {
                th.push({ from: "them", text: streamed });
              }
            } else {
              th[th.length - 1] = { from: "them", text: streamed };
            }
            return { ...prev, threads: { ...prev.threads, [to]: th } };
          });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      const fresh = await load().catch(() => null);
      if (fresh) setGame(fresh);
    } finally {
      setBusy(null);
    }
  }

  async function runScore(rescore = false) {
    if (!game || scoring) return;
    setScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescore }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        game?: PublicGame;
        error?: string;
      };
      if (!res.ok || !body.game) throw new Error(body.error || "Score failed");
      setGame(body.game);
      await go("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Score failed");
    } finally {
      setScoring(false);
    }
  }

  async function useAsDraftTo(colleagueId: string) {
    if (!game) return;
    const th = game.threads.assist || [];
    const last = [...th].reverse().find((m) => m.from === "them");
    if (!last?.text) return;
    setLocalDraft(last.text);
    saveDraft(colleagueId, last.text);
    await go(`chat:${colleagueId}`);
  }

  async function submitTask(taskId: string, text: string, revise: boolean) {
    if (!game || busy) return;
    setBusy(`task:${taskId}`);
    try {
      const res = await fetch(`/api/games/${gameId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, text, revise }),
      });
      const body = (await res.json().catch(() => ({}))) as PublicGame & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Submit failed");
      setGame(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(null);
    }
  }

  if (error && !game) {
    return (
      <TryShell roleBar="Play">
        <div className="pane">
          <h1>Couldn&apos;t open the day</h1>
          <p className="sub">{error}</p>
          <Link className="btn" href="/">
            Back
          </Link>
        </div>
      </TryShell>
    );
  }

  if (!game) {
    return (
      <TryShell roleBar="Play">
        <div className="pane">
          <p className="hint">Loading your day…</p>
        </div>
      </TryShell>
    );
  }

  const levelLabel =
    LEVELS[game.level as LevelId]?.label || game.level;
  const chatId = game.view.startsWith("chat:")
    ? game.view.slice(5)
    : null;
  const chatChar = chatId
    ? game.characters.find((c) => c.id === chatId)
    : null;
  const lockMsg =
    chatChar?.chatLocked
      ? `${firstName(chatChar.name)} has used all ${chatChar.dataPullLimit} data pulls for today.`
      : chatChar?.locked
        ? `${firstName(chatChar.name)} hasn't messaged you.`
        : null;

  const rail = (
    <nav className="rail" aria-label="Workplace">
      <div className="navlabel">Work</div>
      <NavBtn
        current={game.view === "brief"}
        onClick={() => void go("brief")}
        label="Inbox"
        sub="Brief & team"
      />
      <NavBtn
        current={game.view === "dashboard"}
        onClick={() => void go("dashboard")}
        label="Dashboard"
        sub="Numbers"
      />
      <NavBtn
        current={game.view === "tasks"}
        onClick={() => void go("tasks")}
        label="Tasks"
        sub="Today's work"
      />
      <NavBtn
        current={game.view === "feedback"}
        onClick={() => void go("feedback")}
        label="Progress"
        sub={
          game.feedback
            ? `Practice score ${game.feedback.total}/30`
            : "Score & learning"
        }
      />
      <div className="navlabel">Support</div>
      <NavBtn
        current={game.view === "chat:assist"}
        onClick={() => void go("chat:assist")}
        label={game.support.assist.name}
        sub={game.support.assist.role}
        badge={game.support.assist.unread || undefined}
        av={{ color: "#3b2fb8", initials: "SA" }}
      />
      <NavBtn
        current={game.view === "chat:mentor"}
        onClick={() => void go("chat:mentor")}
        label={game.support.mentor.name}
        sub={game.support.mentor.role}
        badge={game.support.mentor.unread || undefined}
        av={{ color: "#a86a00", initials: "ME" }}
      />
      <div className="navlabel">Messages</div>
      {game.characters.map((c) => (
        <NavBtn
          key={c.id}
          current={game.view === `chat:${c.id}`}
          onClick={() => void go(`chat:${c.id}`)}
          label={c.name}
          sub={c.role}
          badge={!c.locked && c.unread ? c.unread : undefined}
          lock={c.locked}
          av={{ color: c.color, initials: c.initials }}
        />
      ))}
    </nav>
  );

  return (
    <TryShell
      roleBar={`You: ${game.role}, ${game.company.name} · ${levelLabel} practice day`}
      headerRight={<PlayHeader clock={game.clock} />}
      rail={rail}
    >
      {error ? (
        <p className="note" style={{ padding: "8px 16px" }}>
          {error}
        </p>
      ) : null}

      {!chatId ? (
        <div className="nextbar">
          <span className="nextbar-msg">
            <b>Next:</b> {game.next.message}
          </span>
          {game.view !== game.next.view ? (
            <button
              type="button"
              className="btn"
              onClick={() => void go(game.next.view)}
            >
              Go
            </button>
          ) : null}
        </div>
      ) : null}

      {chatId ? (
        <div className="chat">
          <div className="chathead">
            <span
              className="av"
              style={{ background: personAv(game, chatId).color }}
            >
              {personAv(game, chatId).initials}
            </span>
            <div>
              <h2>{personName(game, chatId)}</h2>
              <small>{personRole(game, chatId)}</small>
            </div>
            {chatChar?.isInfoSource && chatChar.dataPullLimit != null ? (
              <span className="hint" style={{ marginLeft: "auto" }}>
                {chatChar.dataPulls || 0} of {chatChar.dataPullLimit} data
                pulls
              </span>
            ) : null}
          </div>
          <div className="msgs" ref={msgsRef}>
            {chatChar?.locked ? (
              <div className="msg sys">
                No messages from {firstName(chatChar.name)} yet.
              </div>
            ) : null}
            {(game.threads[chatId] || []).map((m, i) => (
              <div
                key={`${i}-${m.from}-${m.text.slice(0, 12)}`}
                className={`msg ${m.from === "me" ? "me" : m.from === "sys" ? "sys" : ""}`}
              >
                {m.text}
                {(m.imgs || []).map((src, k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={k}
                    src={src}
                    className="mimg"
                    alt={`Attached screenshot ${k + 1}`}
                  />
                ))}
              </div>
            ))}
            {busy === chatId ? (
              <div className="msg">
                <span className="hint">
                  {firstName(personName(game, chatId))} is typing…
                </span>
              </div>
            ) : null}
            {chatId === "assist" && !busy ? (
              <div className="chips">
                {ASSIST_CHIPS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="useb"
                    onClick={() =>
                      void sendChat(
                        "assist",
                        q.replace(
                          "PM",
                          game.role.split(" ")[0] || "role",
                        ),
                      )
                    }
                  >
                    {q.replace("PM", game.role.split(" ")[0] || "role")}
                  </button>
                ))}
                {game.characters
                  .filter((c) => !c.locked)
                  .map((c) => (
                    <button
                      key={`draft-${c.id}`}
                      type="button"
                      className="useb"
                      onClick={() => void useAsDraftTo(c.id)}
                    >
                      Use as a draft to {firstName(c.name)}
                    </button>
                  ))}
              </div>
            ) : null}
            {chatId === "mentor" && !busy ? (
              <div className="chips">
                {(game.dayOver
                  ? [
                      "Give me my debrief",
                      "Show me the right approach to today",
                      "What should I practise first?",
                    ]
                  : [
                      `What does a ${game.role} actually do all day?`,
                      "How do I ask colleagues good questions?",
                      "How should I handle a pushy colleague?",
                    ]
                ).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="useb"
                    onClick={() =>
                      void sendChat(
                        "mentor",
                        q === "Give me my debrief" ? DEBRIEF_REQUEST : q,
                      )
                    }
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {pendingImgs.length ? (
            <div className="pending">
              {pendingImgs.map((src, i) => (
                <span className="thumb" key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Screenshot ${i + 1} to send`} />
                  <button
                    type="button"
                    className="thx"
                    aria-label={`Remove screenshot ${i + 1}`}
                    onClick={() =>
                      setPendingImgs((L) => L.filter((_, j) => j !== i))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              <span className="hint">
                {pendingImgs.length} of 2 screenshots ready.
              </span>
            </div>
          ) : null}
          {micHint ? <p className="note">{micHint}</p> : null}
          <form
            className="compose"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat(chatId, localDraft, pendingImgs);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void (async () => {
                  for (const file of files) {
                    if (!file.type.startsWith("image/")) continue;
                    setPendingImgs((L) => {
                      if (L.length >= 2) {
                        setMicHint("You can attach up to 2 screenshots per message.");
                        return L;
                      }
                      return L;
                    });
                    try {
                      const data = await shrinkImage(file);
                      setPendingImgs((L) =>
                        L.length >= 2 ? L : [...L, data],
                      );
                    } catch {
                      setMicHint("One image couldn't be read. Try a PNG or JPG.");
                    }
                  }
                })();
              }}
            />
            <button
              className="attach"
              type="button"
              title="Attach a screenshot"
              aria-label="Attach a screenshot"
              disabled={Boolean(lockMsg) || Boolean(busy)}
              onClick={() => fileRef.current?.click()}
            >
              📎
            </button>
            <button
              ref={micBtnRef}
              className="attach"
              type="button"
              title="Dictate"
              aria-label="Dictate"
              disabled={Boolean(lockMsg) || Boolean(busy)}
            >
              🎤
            </button>
            <textarea
              ref={composeTaRef}
              value={localDraft}
              disabled={Boolean(lockMsg) || Boolean(busy)}
              placeholder={
                lockMsg ||
                (chatId === "assist"
                  ? "Ask Saathi, e.g. Summarise what everyone has told me so far"
                  : `Message ${firstName(personName(game, chatId))}…`)
              }
              onChange={(e) => {
                setLocalDraft(e.target.value);
                saveDraft(chatId, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(chatId, localDraft, pendingImgs);
                }
              }}
            />
            <button
              className="btn"
              type="submit"
              disabled={Boolean(lockMsg) || Boolean(busy)}
            >
              Send
            </button>
          </form>
        </div>
      ) : game.view === "dashboard" ? (
        <DashboardPane game={game} onGo={go} />
      ) : game.view === "feedback" ? (
        <ProgressPane
          game={game}
          scoring={scoring}
          onScore={(r) => void runScore(r)}
          onGo={(v) => void go(v)}
        />
      ) : game.view === "tasks" ? (
        <TasksPane
          game={game}
          drafts={taskDrafts}
          busy={busy}
          scoring={scoring}
          onDraft={(id, text) => {
            setTaskDrafts((d) => ({ ...d, [id]: text }));
            saveDraft(`task:${id}`, text);
          }}
          onSubmit={(id, text, revise) => void submitTask(id, text, revise)}
          onScore={() => void runScore(false)}
          onStartRevise={async (id) => {
            const res = await fetch(`/api/games/${gameId}/submissions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: id, startRevise: true }),
            });
            if (res.ok) setGame((await res.json()) as PublicGame);
          }}
          onCancelRevise={async (id) => {
            const res = await fetch(`/api/games/${gameId}/submissions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: id, cancelRevise: true }),
            });
            if (res.ok) setGame((await res.json()) as PublicGame);
          }}
          onGo={go}
        />
      ) : (
        <InboxPane game={game} onGo={go} />
      )}

      {game.toast && game.view !== `chat:${game.toast}` ? (
        <button
          type="button"
          className="toast"
          onClick={() => void go(`chat:${game.toast}`)}
        >
          <span
            className="av"
            style={{ background: personAv(game, game.toast).color }}
          >
            {personAv(game, game.toast).initials}
          </span>
          <span>
            <b>{personName(game, game.toast)}</b> sent you a message. Open
            it
          </span>
        </button>
      ) : null}
    </TryShell>
  );
}

function NavBtn({
  current,
  onClick,
  label,
  sub,
  badge,
  lock,
  av,
}: {
  current: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  badge?: number;
  lock?: boolean;
  av?: { color: string; initials: string };
}) {
  return (
    <button
      type="button"
      className="navbtn"
      aria-current={current ? "true" : undefined}
      onClick={onClick}
    >
      {av ? (
        <span className="av" style={{ background: av.color }}>
          {av.initials}
        </span>
      ) : null}
      <span className="who">
        <span>{label}</span>
        <small>{sub}</small>
      </span>
      {lock ? <span className="lock">quiet</span> : null}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );
}

function InboxPane({
  game,
  onGo,
}: {
  game: PublicGame;
  onGo: (v: string) => void;
}) {
  return (
    <div className="pane">
      <h1>Welcome to {game.company.name}</h1>
      <p className="sub">{game.company.one_liner}</p>
      <div>
        {game.public.inbox.map((m, i) => {
          const from = String(m.from || "");
          return (
            <div className="mail" key={i}>
              <div className="mailhead">
                <b>{personName(game, from)}</b>, {personRole(game, from)} ·{" "}
                {m.time || ""}
                <br />
                Subject: <b>{m.subject || ""}</b>
              </div>
              <div className="mailbody">{m.body || ""}</div>
            </div>
          );
        })}
        {game.public.documents.map((d, i) => (
          <div className="mail" key={`d-${i}`}>
            <div className="mailhead">
              Document · <b>{d.title || ""}</b>
            </div>
            <div className="mailbody">{d.body || ""}</div>
          </div>
        ))}
      </div>
      <h2>Your team</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>What they care about</th>
            </tr>
          </thead>
          <tbody>
            {game.characters.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.role}</td>
                <td>{c.cares_about}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="btn"
          onClick={() => onGo("dashboard")}
        >
          Open the dashboard
        </button>
        <span className="hint">
          Everything here is fictional and AI-generated. Colleagues reply
          live; message them like you would at work.
        </span>
      </div>
    </div>
  );
}

function DashboardPane({
  game,
  onGo,
}: {
  game: PublicGame;
  onGo: (v: string) => void;
}) {
  const db = game.public.dashboard;
  const cols = db.columns || [];
  return (
    <div className="pane">
      <h1>{db.title || "Dashboard"}</h1>
      <p className="sub">{db.subtitle || ""}</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c} className={i ? "num" : ""}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(db.rows || []).map((r, ri) => (
              <tr key={ri}>
                {(r.cells || []).map((cell, i) => (
                  <td
                    key={i}
                    className={[
                      i ? "num" : "",
                      i && i < (r.cells?.length || 0) - 1 && r.miss
                        ? "miss"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(db.notes || []).map((n) => (
        <div className="callout" key={n}>
          {n}
        </div>
      ))}
      {game.public.reviews.length ? (
        <>
          <h2>What people are saying</h2>
          <div className="reviews">
            {game.public.reviews.map((r, i) => (
              <div className="review" key={i}>
                “{r.text}”
                <small>{r.meta || ""}</small>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="row" style={{ marginTop: 20 }}>
        <button type="button" className="btn" onClick={() => onGo("tasks")}>
          Go to tasks
        </button>
      </div>
    </div>
  );
}

function TasksPane({
  game,
  drafts,
  busy,
  scoring,
  onDraft,
  onSubmit,
  onScore,
  onStartRevise,
  onCancelRevise,
  onGo,
}: {
  game: PublicGame;
  drafts: Record<string, string>;
  busy: string | null;
  scoring: boolean;
  onDraft: (id: string, text: string) => void;
  onSubmit: (id: string, text: string, revise: boolean) => void;
  onScore: () => void;
  onStartRevise: (id: string) => void;
  onCancelRevise: (id: string) => void;
  onGo: (v: string) => void;
}) {
  return (
    <div className="pane">
      <h1>Today&apos;s tasks</h1>
      <p className="sub">
        {game.theme} Work through these in any order; your colleagues are in
        Messages.
      </p>
      <div className="tasks">
        {game.tasks.map((t, i) => {
          const submitName = t.submit_to
            ? firstName(personName(game, t.submit_to))
            : "boss";
          const info = game.characters.find((c) => c.isInfoSource);
          return (
            <div
              key={t.id}
              className={`task ${t.done ? "done" : ""}`}
            >
              <div className="tick">{t.done ? "✓" : i + 1}</div>
              <div>
                <h3>
                  {t.title}{" "}
                  <span className="hint">· {t.minutes || ""} min</span>
                </h3>
                <p>{t.description}</p>
                {t.hint && !t.done ? (
                  <details className="hintbox">
                    <summary>Hint</summary>
                    {t.hint}
                  </details>
                ) : null}
                {t.kind === "submission" ? (
                  t.submitted ? (
                    t.revising ? (
                      <>
                        <textarea
                          value={drafts[t.id] ?? t.submission ?? ""}
                          onChange={(e) => onDraft(t.id, e.target.value)}
                        />
                        <div className="row">
                          <button
                            type="button"
                            className="btn"
                            disabled={busy === `task:${t.id}`}
                            onClick={() =>
                              onSubmit(
                                t.id,
                                drafts[t.id] ?? t.submission ?? "",
                                true,
                              )
                            }
                          >
                            Send revision to {submitName}
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => onCancelRevise(t.id)}
                          >
                            Cancel
                          </button>
                          <span className="hint">
                            Your latest version is the one that gets scored.
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="submitted">{t.submission}</div>
                        {t.revisions ? (
                          <span className="hint">
                            Revised {t.revisions} time
                            {t.revisions > 1 ? "s" : ""}.
                          </span>
                        ) : null}
                        {t.canRevise ? (
                          <div className="row">
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => onStartRevise(t.id)}
                            >
                              Send a revised version
                            </button>
                            <span className="hint">
                              Fold in feedback and resend.{" "}
                              {2 - t.revisions} revision
                              {2 - t.revisions > 1 ? "s" : ""} left.
                            </span>
                          </div>
                        ) : null}
                      </>
                    )
                  ) : (
                    <>
                      <textarea
                        placeholder="Write it like you'd send it at work."
                        value={drafts[t.id] || ""}
                        onChange={(e) => onDraft(t.id, e.target.value)}
                      />
                      <div className="row">
                        <button
                          type="button"
                          className="btn"
                          disabled={busy === `task:${t.id}`}
                          onClick={() =>
                            onSubmit(t.id, drafts[t.id] || "", false)
                          }
                        >
                          Send to {submitName}
                        </button>
                        <span className="hint">
                          {submitName} will reply in Messages.
                        </span>
                      </div>
                    </>
                  )
                ) : info && !info.locked ? (
                  <div className="row">
                    <button
                      type="button"
                      className={`btn ${t.done ? "ghost" : ""}`}
                      onClick={() => onGo(`chat:${info.id}`)}
                    >
                      Message {firstName(info.name)}
                    </button>
                    {info.dataPullLimit != null ? (
                      <span className="hint">
                        {info.dataPulls || 0} of {info.dataPullLimit} data
                        pulls used
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="hint">Nothing yet. Keep working.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {game.dayOver ? (
        <div className="row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            disabled={scoring}
            onClick={onScore}
          >
            {scoring
              ? "Scoring…"
              : game.feedback
                ? "View practice score"
                : "Finish day and get my practice score"}
          </button>
          <span className="hint">
            Reply to your boss first if you like; your latest submission is
            scored.
          </span>
        </div>
      ) : null}
    </div>
  );
}
