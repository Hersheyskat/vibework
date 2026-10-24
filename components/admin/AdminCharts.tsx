import type { AdminRoleStats, AdminRunRow } from "@/lib/admin/runs";

function sumByStatus(runs: AdminRunRow[]) {
  const m: Record<string, number> = {};
  for (const r of runs) {
    m[r.status] = (m[r.status] || 0) + 1;
  }
  return m;
}

const STATUS_COLORS: Record<string, string> = {
  ready: "#1f8a4c",
  failed: "#c23b3b",
  blocked: "#a86a00",
  screening: "#3b2fb8",
  planning: "#3b2fb8",
  checking: "#3b2fb8",
  repairing: "#3b2fb8",
  guarding: "#888",
};

export function AdminKpis({
  runs,
  stats,
}: {
  runs: AdminRunRow[];
  stats: AdminRoleStats[];
}) {
  const total = runs.length;
  const ready = runs.filter((r) => r.status === "ready").length;
  const cost = runs.reduce((s, r) => s + r.costUsd, 0);
  const scored = stats.reduce((s, r) => s + r.scored, 0);
  const games = stats.reduce((s, r) => s + r.games, 0);

  const items = [
    { label: "Recent runs", value: String(total) },
    {
      label: "Ready rate",
      value: total ? `${Math.round((ready / total) * 100)}%` : "—",
    },
    { label: "Spend (sample)", value: `$${cost.toFixed(2)}` },
    {
      label: "Days scored",
      value: games ? `${scored} / ${games}` : "—",
    },
  ];

  return (
    <div className="admin-kpis" role="group" aria-label="Summary">
      {items.map((k) => (
        <div className="admin-kpi" key={k.label}>
          <span className="hint">{k.label}</span>
          <b>{k.value}</b>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bar chart — runs per role. */
export function RoleRunsChart({ stats }: { stats: AdminRoleStats[] }) {
  const top = stats.slice(0, 8);
  const max = Math.max(1, ...top.map((s) => s.runs));
  if (!top.length) {
    return <p className="hint">No role data yet.</p>;
  }
  return (
    <div className="admin-chart">
      <h3>Runs by role</h3>
      <ul className="admin-bars">
        {top.map((s) => (
          <li key={s.role}>
            <span className="admin-bar-label" title={s.role}>
              {s.role}
            </span>
            <span className="admin-bar-track">
              <span
                className="admin-bar-fill"
                style={{ width: `${Math.max(4, (s.runs / max) * 100)}%` }}
              />
            </span>
            <span className="admin-bar-n">{s.runs}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pass-rate bars. */
export function PassRateChart({ stats }: { stats: AdminRoleStats[] }) {
  const top = stats.filter((s) => s.runs > 0).slice(0, 8);
  if (!top.length) {
    return <p className="hint">No pass-rate data yet.</p>;
  }
  return (
    <div className="admin-chart">
      <h3>Pass rate after checks</h3>
      <ul className="admin-bars">
        {top.map((s) => (
          <li key={s.role}>
            <span className="admin-bar-label" title={s.role}>
              {s.role}
            </span>
            <span className="admin-bar-track pass">
              <span
                className="admin-bar-fill"
                style={{
                  width: `${Math.max(s.passRate > 0 ? 4 : 0, Math.round(s.passRate * 100))}%`,
                }}
              />
            </span>
            <span className="admin-bar-n">
              {Math.round(s.passRate * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Simple SVG donut for run status mix. */
export function StatusDonut({ runs }: { runs: AdminRunRow[] }) {
  const counts = sumByStatus(runs);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = runs.length || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="admin-chart admin-donut-wrap">
      <h3>Status mix</h3>
      <div className="admin-donut-row">
        <svg
          viewBox="0 0 120 120"
          width="140"
          height="140"
          aria-hidden
          className="admin-donut"
        >
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="var(--line)"
            strokeWidth="16"
          />
          {entries.map(([status, n]) => {
            const len = (n / total) * c;
            const el = (
              <circle
                key={status}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={STATUS_COLORS[status] || "var(--brand)"}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += len;
            return el;
          })}
          <text
            x="60"
            y="56"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="var(--ink)"
          >
            {runs.length}
          </text>
          <text
            x="60"
            y="72"
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted)"
          >
            runs
          </text>
        </svg>
        <ul className="admin-legend">
          {entries.map(([status, n]) => (
            <li key={status}>
              <span
                className="admin-legend-swatch"
                style={{
                  background: STATUS_COLORS[status] || "var(--brand)",
                }}
              />
              <span>
                {status} · {n}
              </span>
            </li>
          ))}
          {!entries.length ? <li className="hint">No runs yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
