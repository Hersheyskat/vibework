"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PublicDayPayload } from "@/lib/scenarios/types";
import {
  clearOpenHint,
  fetchDayRun,
  sendMessage,
  submitTask,
} from "@/lib/client/api";
import { Avatar } from "./Avatar";

type Panel =
  | { kind: "inbox" }
  | { kind: "dashboard" }
  | { kind: "tasks" }
  | { kind: "chat"; thread: string };

type Props = {
  initial: PublicDayPayload;
};

function castById(data: PublicDayPayload) {
  const map = Object.fromEntries(data.cast.map((c) => [c.id, c]));
  map.saathi = {
    id: "saathi",
    name: data.assistant.name,
    role: data.assistant.role,
    kind: "assistant",
    color: "#0f9d8a",
    initials: "S",
  };
  return map;
}

function unreadFor(
  data: PublicDayPayload,
  thread: string,
  seen: Record<string, string>,
) {
  const lastSeen = seen[thread];
  const msgs = data.messages.filter((m) => m.thread === thread);
  if (!msgs.length) return 0;
  if (!lastSeen) {
    return msgs.filter((m) => m.sender !== "learner").length ? 1 : 0;
  }
  return msgs.filter(
    (m) => m.sender !== "learner" && m.createdAt > lastSeen,
  ).length;
}

export function WorkspaceApp({ initial }: Props) {
  const [data, setData] = useState(initial);
  const [panel, setPanel] = useState<Panel>({ kind: "inbox" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [typing, setTyping] = useState(false);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [draftPicker, setDraftPicker] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(initial.messages.length);

  const cast = useMemo(() => castById(data), [data]);

  useEffect(() => {
    const key = `vw-seen-${data.runId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSeen(JSON.parse(raw) as Record<string, string>);
    } catch {
      /* ignore */
    }
  }, [data.runId]);

  useEffect(() => {
    localStorage.setItem(`vw-seen-${data.runId}`, JSON.stringify(seen));
  }, [seen, data.runId]);

  useEffect(() => {
    if (panel.kind === "chat") {
      const msgs = data.messages.filter((m) => m.thread === panel.thread);
      const last = msgs[msgs.length - 1];
      if (last) {
        setSeen((s) => ({ ...s, [panel.thread]: last.createdAt }));
      }
    }
  }, [panel, data.messages]);

  useEffect(() => {
    if (data.openHint?.startsWith("chat:")) {
      const thread = data.openHint.slice(5);
      setPanel({ kind: "chat", thread });
      setToast(`Opened chat with ${cast[thread]?.name || thread}`);
      void clearOpenHint(data.runId).then(setData).catch(() => {});
    }
  }, [data.openHint, data.runId, cast]);

  useEffect(() => {
    if (data.messages.length > prevMsgCount.current) {
      const newest = data.messages[data.messages.length - 1];
      if (
        newest &&
        newest.sender !== "learner" &&
        (panel.kind !== "chat" || panel.thread !== newest.thread)
      ) {
        const name = cast[newest.sender]?.name || newest.sender;
        setToast(`New message from ${name}`);
      }
    }
    prevMsgCount.current = data.messages.length;
  }, [data.messages, panel, cast]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages, panel, typing]);

  const people = data.characters
    .map((c) => ({ ...c, meta: cast[c.id] }))
    .filter((c) => c.meta)
    .sort((a, b) => Number(a.locked) - Number(b.locked));

  const groups = data.groupChats;

  function go(next: Panel) {
    setPanel(next);
    setSidebarOpen(false);
    setError(null);
  }

  function refresh() {
    startTransition(async () => {
      try {
        setData(await fetchDayRun(data.runId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      }
    });
  }

  function onSend() {
    if (panel.kind !== "chat" || !draft.trim() || typing) return;
    const thread = panel.thread;
    const text = draft.trim();
    setDraft("");
    setTyping(true);
    setError(null);
    startTransition(async () => {
      try {
        setData(await sendMessage(data.runId, thread, text));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
        setDraft(text);
      } finally {
        setTyping(false);
      }
    });
  }

  function onSubmitTask(taskId: string) {
    const text = (taskDrafts[taskId] || "").trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      try {
        setData(await submitTask(data.runId, taskId, text));
        setTaskDrafts((d) => ({ ...d, [taskId]: "" }));
        setToast("Submitted to Meera");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  const doneCount = data.tasks.filter((t) => t.done).length;
  const threadMessages =
    panel.kind === "chat"
      ? data.messages.filter((m) => m.thread === panel.thread)
      : [];

  const activeChat =
    panel.kind === "chat"
      ? panel.thread === "saathi"
        ? {
            name: data.assistant.name,
            role: data.assistant.role,
            color: "#0f9d8a",
            initials: "S",
            locked: false,
            limits: undefined as
              | { data_pulls?: number; questions?: number }
              | undefined,
          }
        : (() => {
            const ch = data.characters.find((c) => c.id === panel.thread);
            const g = data.groupChats.find((c) => c.id === panel.thread);
            if (g) {
              return {
                name: g.name,
                role: "Meeting room",
                color: "#3b82f6",
                initials: "G",
                locked: !g.available,
                limits: undefined,
              };
            }
            const meta = cast[panel.thread];
            return {
              name: meta?.name || panel.thread,
              role: meta?.role || "",
              color: meta?.color || "#64748b",
              initials: meta?.initials || "?",
              locked: Boolean(ch?.locked),
              limits: ch?.limits,
            };
          })()
      : null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--vw-bg)] text-[var(--vw-text)]">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-black/20 bg-[var(--vw-sidebar)] text-[var(--vw-sidebar-text)] transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-bold text-white"
            style={{
              background:
                "linear-gradient(145deg, #0f9d8a 0%, #0b6e8a 100%)",
            }}
          >
            Z
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              {data.track.companyName}
            </div>
            <div className="truncate text-xs text-[var(--vw-sidebar-muted)]">
              {data.track.role} · Day {data.day.day}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <SectionLabel>Workspace</SectionLabel>
          <NavItem
            active={panel.kind === "inbox"}
            onClick={() => go({ kind: "inbox" })}
            icon="#"
            label="inbox"
            badge={data.public.inbox.length}
          />
          <NavItem
            active={panel.kind === "dashboard"}
            onClick={() => go({ kind: "dashboard" })}
            icon="#"
            label="dashboard"
          />
          <NavItem
            active={panel.kind === "tasks"}
            onClick={() => go({ kind: "tasks" })}
            icon="#"
            label="tasks"
            badge={`${doneCount}/${data.tasks.length}`}
          />

          {groups.length ? (
            <>
              <SectionLabel className="mt-4">Channels</SectionLabel>
              {groups.map((g) => (
                <NavItem
                  key={g.id}
                  active={panel.kind === "chat" && panel.thread === g.id}
                  onClick={() => go({ kind: "chat", thread: g.id })}
                  icon="#"
                  label={g.name.toLowerCase().replace(/\s+/g, "-")}
                  locked={!g.available}
                  unread={unreadFor(data, g.id, seen)}
                />
              ))}
            </>
          ) : null}

          <SectionLabel className="mt-4">Direct messages</SectionLabel>
          <PersonRow
            name={data.assistant.name}
            role={data.assistant.role}
            color="#0f9d8a"
            initials="S"
            active={panel.kind === "chat" && panel.thread === "saathi"}
            unread={unreadFor(data, "saathi", seen)}
            onClick={() => go({ kind: "chat", thread: "saathi" })}
            assistant
          />
          {people.map((p) => (
            <PersonRow
              key={p.id}
              name={p.meta.name}
              role={p.meta.role}
              color={p.meta.color}
              initials={p.meta.initials}
              locked={p.locked}
              active={panel.kind === "chat" && panel.thread === p.id}
              unread={p.locked ? 0 : unreadFor(data, p.id, seen)}
              onClick={() => {
                if (p.locked) return;
                go({ kind: "chat", thread: p.id });
              }}
              pulls={
                p.limits?.data_pulls != null
                  ? `${data.counters[`${p.id}.data_pulls`] ?? 0}/${p.limits.data_pulls}`
                  : undefined
              }
            />
          ))}
        </div>

        <div className="border-t border-white/8 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={data.learnerName}
              initials={data.learnerName.slice(0, 2).toUpperCase()}
              color="#334155"
              size={30}
              online
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {data.learnerName}
              </div>
              <div className="truncate text-xs text-[var(--vw-sidebar-muted)]">
                Product Manager
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--vw-surface)]">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--vw-border)] bg-[var(--vw-panel)] px-3 md:px-5">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--vw-border)] text-[var(--vw-text-muted)] md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              {panel.kind === "chat" && activeChat
                ? activeChat.name
                : panel.kind === "inbox"
                  ? "Inbox"
                  : panel.kind === "dashboard"
                    ? "Dashboard"
                    : "Tasks"}
            </div>
            <div className="truncate text-xs text-[var(--vw-text-muted)]">
              {panel.kind === "chat" && activeChat
                ? activeChat.role
                : data.day.theme}
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <ClockPill time={data.clock} />
            <span className="rounded-full bg-[var(--vw-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--vw-accent-deep)]">
              Next: {data.nextHint}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-[var(--vw-border)] px-3 py-1.5 text-xs font-medium text-[var(--vw-text-muted)] hover:bg-[var(--vw-surface)]"
          >
            Refresh
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-[var(--vw-border)] bg-[var(--vw-panel)] px-3 py-2 sm:hidden">
          <ClockPill time={data.clock} />
          <span className="truncate text-xs text-[var(--vw-text-muted)]">
            Next: {data.nextHint}
          </span>
        </div>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <main className="relative min-h-0 flex-1 overflow-hidden">
          {panel.kind === "inbox" ? (
            <InboxView data={data} cast={cast} onOpenChat={(id) => go({ kind: "chat", thread: id })} />
          ) : null}
          {panel.kind === "dashboard" ? <DashboardView data={data} /> : null}
          {panel.kind === "tasks" ? (
            <TasksView
              data={data}
              drafts={taskDrafts}
              setDrafts={setTaskDrafts}
              onSubmit={onSubmitTask}
              pending={pending}
              onOpenChat={(id) => go({ kind: "chat", thread: id })}
            />
          ) : null}
          {panel.kind === "chat" && activeChat ? (
            <ChatView
              data={data}
              cast={cast}
              thread={panel.thread}
              meta={activeChat}
              messages={threadMessages}
              draft={draft}
              setDraft={setDraft}
              onSend={onSend}
              typing={typing}
              pending={pending}
              bottomRef={bottomRef}
              onUseDraft={(text) => setDraftPicker(text)}
            />
          ) : null}
        </main>
      </div>

      {draftPicker ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-[var(--vw-panel)] p-5 shadow-xl">
            <h3 className="text-base font-semibold">Use as draft in…</h3>
            <p className="mt-1 text-sm text-[var(--vw-text-muted)]">
              Drop Saathi&apos;s text into another chat composer.
            </p>
            <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
              {people
                .filter((p) => !p.locked)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--vw-surface)]"
                    onClick={() => {
                      setPanel({ kind: "chat", thread: p.id });
                      setDraft(draftPicker);
                      setDraftPicker(null);
                      setToast(`Draft ready for ${p.meta.name}`);
                    }}
                  >
                    <Avatar
                      name={p.meta.name}
                      initials={p.meta.initials}
                      color={p.meta.color}
                      size={28}
                    />
                    <span className="text-sm font-medium">{p.meta.name}</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-[var(--vw-border)] py-2 text-sm"
              onClick={() => setDraftPicker(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="vw-animate-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--vw-text)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--vw-sidebar-muted)] ${className}`}
    >
      {children}
    </div>
  );
}

function NavItem(props: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string | number;
  locked?: boolean;
  unread?: number;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.locked}
      className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[14px] transition-colors ${
        props.active
          ? "bg-[var(--vw-sidebar-active)] text-white"
          : "text-[var(--vw-sidebar-text)] hover:bg-[var(--vw-sidebar-hover)]"
      } ${props.locked ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span className="w-4 text-[var(--vw-sidebar-muted)]">{props.icon}</span>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.locked ? (
        <span className="text-[10px] text-[var(--vw-sidebar-muted)]">locked</span>
      ) : null}
      {props.unread ? (
        <span className="rounded-full bg-[var(--vw-accent)] px-1.5 text-[10px] font-semibold text-white">
          {props.unread}
        </span>
      ) : props.badge != null ? (
        <span className="text-[11px] text-[var(--vw-sidebar-muted)]">
          {props.badge}
        </span>
      ) : null}
    </button>
  );
}

function PersonRow(props: {
  name: string;
  role: string;
  color: string;
  initials: string;
  active: boolean;
  onClick: () => void;
  locked?: boolean;
  unread?: number;
  pulls?: string;
  assistant?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.locked}
      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
        props.active
          ? "bg-[var(--vw-sidebar-active)] text-white"
          : "hover:bg-[var(--vw-sidebar-hover)]"
      } ${props.locked ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <Avatar
        name={props.name}
        initials={props.initials}
        color={props.color}
        size={28}
        online={!props.locked}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-medium">{props.name}</span>
          {props.assistant ? (
            <span className="rounded bg-[var(--vw-accent)]/20 px-1 text-[10px] font-semibold text-[var(--vw-accent)]">
              AI
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11px] text-[var(--vw-sidebar-muted)]">
          {props.locked ? "Unavailable" : props.pulls ? `${props.role} · ${props.pulls} pulls` : props.role}
        </span>
      </span>
      {props.unread ? (
        <span className="rounded-full bg-[var(--vw-accent)] px-1.5 text-[10px] font-semibold text-white">
          {props.unread}
        </span>
      ) : null}
    </button>
  );
}

function ClockPill({ time }: { time: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vw-border)] bg-[var(--vw-surface)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--vw-text)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--vw-accent)]" />
      {time}
    </span>
  );
}

function InboxView({
  data,
  cast,
  onOpenChat,
}: {
  data: PublicDayPayload;
  cast: ReturnType<typeof castById>;
  onOpenChat: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl vw-animate-in">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-[var(--vw-text-muted)]">
          Day {data.day.day} · {data.day.title}
        </p>
        <div className="mt-6 space-y-3">
          {data.public.inbox.map((mail, i) => {
            const from = cast[mail.from];
            return (
              <article
                key={`${mail.subject}-${i}`}
                className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-panel)] p-5 shadow-[var(--vw-shadow)]"
              >
                <div className="flex items-start gap-3">
                  {from ? (
                    <Avatar
                      name={from.name}
                      initials={from.initials}
                      color={from.color}
                      size={40}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <button
                        type="button"
                        className="font-semibold hover:text-[var(--vw-accent-deep)]"
                        onClick={() => onOpenChat(mail.from)}
                      >
                        {from?.name || mail.from}
                      </button>
                      <span className="text-xs text-[var(--vw-text-faint)]">
                        {mail.time}
                      </span>
                    </div>
                    <h2 className="mt-1 text-[15px] font-medium">{mail.subject}</h2>
                    <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--vw-text)]/90">
                      {mail.body}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
          {data.public.documents?.map((doc, i) => (
            <article
              key={doc.id || i}
              className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-panel)] p-5"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--vw-text-faint)]">
                Document
              </div>
              <h2 className="mt-1 font-semibold">{doc.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--vw-text-muted)]">
                {doc.body || doc.content}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ data }: { data: PublicDayPayload }) {
  const dash = data.public.dashboard;
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl vw-animate-in">
        <h1 className="text-2xl font-semibold tracking-tight">{dash.title}</h1>
        <p className="mt-1 text-sm text-[var(--vw-text-muted)]">{dash.subtitle}</p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-panel)] shadow-[var(--vw-shadow)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--vw-surface)] text-[var(--vw-text-muted)]">
                <tr>
                  {dash.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dash.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-[var(--vw-border)] ${
                      row.miss ? "bg-[var(--vw-miss)]" : ""
                    }`}
                  >
                    {row.cells.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-4 py-3 ${
                          j === 0
                            ? "font-medium"
                            : "font-mono text-[13px] tabular-nums"
                        } ${row.miss && j > 0 ? "text-[var(--vw-danger)]" : ""}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dash.notes?.length ? (
            <div className="border-t border-[var(--vw-border)] px-4 py-3 text-sm text-[var(--vw-text-muted)]">
              {dash.notes.map((n) => (
                <div key={n}>· {n}</div>
              ))}
            </div>
          ) : null}
        </div>

        <h2 className="mt-8 text-lg font-semibold">Customer reviews</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.public.reviews.map((r, i) => (
            <blockquote
              key={i}
              className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-panel)] p-4"
            >
              <p className="text-[14.5px] leading-relaxed">&ldquo;{r.text}&rdquo;</p>
              <footer className="mt-2 text-xs text-[var(--vw-text-faint)]">
                {r.meta}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </div>
  );
}

function TasksView({
  data,
  drafts,
  setDrafts,
  onSubmit,
  pending,
  onOpenChat,
}: {
  data: PublicDayPayload;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: (taskId: string) => void;
  pending: boolean;
  onOpenChat: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl vw-animate-in">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-[var(--vw-text-muted)]">
          {data.tasks.filter((t) => t.done).length} of {data.tasks.length} complete
        </p>
        <div className="mt-6 space-y-4">
          {data.tasks.map((task, idx) => (
            <article
              key={task.id}
              className={`rounded-2xl border bg-[var(--vw-panel)] p-5 shadow-[var(--vw-shadow)] ${
                task.done
                  ? "border-[var(--vw-accent)]/40"
                  : "border-[var(--vw-border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    task.done
                      ? "bg-[var(--vw-accent)] text-white"
                      : "bg-[var(--vw-surface)] text-[var(--vw-text-muted)]"
                  }`}
                >
                  {task.done ? "✓" : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{task.title}</h2>
                    <span className="rounded-full bg-[var(--vw-surface)] px-2 py-0.5 text-[11px] text-[var(--vw-text-muted)]">
                      ~{task.minutes} min
                    </span>
                    <span className="rounded-full bg-[var(--vw-surface)] px-2 py-0.5 text-[11px] text-[var(--vw-text-muted)]">
                      {task.kind}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--vw-text-muted)]">
                    {task.description}
                  </p>
                  {task.kind === "chat" ? (
                    <button
                      type="button"
                      className="mt-3 rounded-lg bg-[var(--vw-text)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                      onClick={() => {
                        if (task.id === "t2") onOpenChat("lakshmi");
                        else if (task.id === "t3") onOpenChat("aditya");
                        else onOpenChat("meera");
                      }}
                    >
                      Open chat
                    </button>
                  ) : task.done ? (
                    <p className="mt-3 text-sm font-medium text-[var(--vw-accent-deep)]">
                      Submitted
                    </p>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        value={drafts[task.id] || ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [task.id]: e.target.value }))
                        }
                        rows={6}
                        placeholder="Write your answer…"
                        className="w-full resize-y rounded-xl border border-[var(--vw-border)] bg-[var(--vw-surface)] px-3 py-2.5 text-sm outline-none ring-[var(--vw-accent)] focus:ring-2"
                      />
                      <button
                        type="button"
                        disabled={pending || !(drafts[task.id] || "").trim()}
                        onClick={() => onSubmit(task.id)}
                        className="mt-2 rounded-lg bg-[var(--vw-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Submit to Meera
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatView({
  data,
  cast,
  thread,
  meta,
  messages,
  draft,
  setDraft,
  onSend,
  typing,
  pending,
  bottomRef,
  onUseDraft,
}: {
  data: PublicDayPayload;
  cast: ReturnType<typeof castById>;
  thread: string;
  meta: {
    name: string;
    role: string;
    color: string;
    initials: string;
    locked: boolean;
    limits?: { data_pulls?: number; questions?: number };
  };
  messages: PublicDayPayload["messages"];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  typing: boolean;
  pending: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onUseDraft: (text: string) => void;
}) {
  const showSaathiDraft = thread === "saathi";
  const displayMessages =
    thread === "saathi" && messages.length === 0
      ? [
          {
            id: "opener",
            thread: "saathi",
            sender: "saathi",
            text: data.assistant.opener,
            createdAt: data.day ? new Date().toISOString() : "",
          },
        ]
      : messages;

  return (
    <div className="flex h-full flex-col">
      {meta.limits?.data_pulls != null ? (
        <div className="border-b border-[var(--vw-border)] bg-[var(--vw-accent-soft)] px-4 py-2 text-xs font-medium text-[var(--vw-accent-deep)]">
          Data pulls today: {data.counters[`${thread}.data_pulls`] ?? 0} /{" "}
          {meta.limits.data_pulls}
        </div>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-8">
        {meta.locked ? (
          <div className="rounded-xl border border-dashed border-[var(--vw-border-strong)] bg-[var(--vw-panel)] p-6 text-center text-sm text-[var(--vw-text-muted)]">
            This person isn&apos;t available yet. Keep working — they may message
            you later.
          </div>
        ) : null}

        {displayMessages.map((m) => {
          const mine = m.sender === "learner";
          const who = mine
            ? {
                name: data.learnerName,
                color: "#334155",
                initials: data.learnerName.slice(0, 2).toUpperCase(),
              }
            : cast[m.sender] || {
                name: m.sender,
                color: meta.color,
                initials: meta.initials,
              };
          return (
            <div
              key={m.id}
              className={`vw-animate-in flex gap-3 ${mine ? "flex-row-reverse" : ""}`}
            >
              <Avatar
                name={who.name}
                initials={who.initials}
                color={who.color}
                size={34}
              />
              <div
                className={`max-w-[min(640px,85%)] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
                  mine
                    ? "bg-[var(--vw-text)] text-white"
                    : "border border-[var(--vw-border)] bg-[var(--vw-panel)]"
                }`}
              >
                <div
                  className={`mb-1 text-[11px] font-semibold ${
                    mine ? "text-white/70" : "text-[var(--vw-text-faint)]"
                  }`}
                >
                  {who.name}
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {showSaathiDraft && !mine ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-[var(--vw-accent-deep)]"
                    onClick={() => onUseDraft(m.text)}
                  >
                    Use as draft
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {typing ? (
          <div className="flex items-center gap-2 text-sm text-[var(--vw-text-muted)]">
            <Avatar
              name={meta.name}
              initials={meta.initials}
              color={meta.color}
              size={28}
            />
            <span className="vw-typing inline-flex gap-1 rounded-full border border-[var(--vw-border)] bg-[var(--vw-panel)] px-3 py-2">
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--vw-border)] bg-[var(--vw-panel)] p-3 md:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] p-2 shadow-sm focus-within:border-[var(--vw-accent)] focus-within:ring-2 focus-within:ring-[var(--vw-accent)]/20">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            disabled={meta.locked || typing}
            placeholder={
              meta.locked
                ? "Chat locked"
                : `Message ${meta.name}`
            }
            className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={meta.locked || typing || pending || !draft.trim()}
            className="mb-0.5 rounded-xl bg-[var(--vw-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-[var(--vw-text-faint)]">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
