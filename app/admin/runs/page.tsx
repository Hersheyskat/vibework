import Link from "next/link";
import { Suspense } from "react";
import {
  AdminKpis,
  PassRateChart,
  RoleRunsChart,
  StatusDonut,
} from "@/components/admin/AdminCharts";
import { requireAdmin } from "@/lib/admin/access";
import { listAdminRuns, roleStats } from "@/lib/admin/runs";
import { trackEvent } from "@/lib/analytics/track";

export default function AdminRunsPage() {
  return (
    <Suspense
      fallback={
        <div className="pane admin-pane">
          <h1>Runs</h1>
          <p className="sub">Loading…</p>
        </div>
      }
    >
      <AdminRunsBody />
    </Suspense>
  );
}

async function AdminRunsBody() {
  const admin = await requireAdmin();
  const [runs, stats] = await Promise.all([listAdminRuns(80), roleStats()]);

  await trackEvent(
    "admin_runs_opened",
    { runCount: runs.length },
    admin.id,
  );

  return (
    <div className="pane admin-pane">
      <div className="admin-head">
        <div>
          <div className="kick">Internal · not for learners</div>
          <h1>Runs</h1>
          <p className="sub">
            What people try, where generation passes, and what it costs. Signed
            in as {admin.email}.
          </p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/">
            ← App
          </Link>
        </div>
      </div>

      <AdminKpis runs={runs} stats={stats} />

      <div className="admin-grid">
        <RoleRunsChart stats={stats} />
        <PassRateChart stats={stats} />
        <StatusDonut runs={runs} />
      </div>

      <h2 style={{ marginTop: 28 }}>Per role</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Runs</th>
              <th>Pass %</th>
              <th>Games</th>
              <th>Scored %</th>
              <th>Med. score</th>
              <th>Med. $</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.role}>
                <td>{s.role}</td>
                <td>{s.runs}</td>
                <td>{Math.round(s.passRate * 100)}%</td>
                <td>{s.games}</td>
                <td>{Math.round(s.completionRate * 100)}%</td>
                <td>{s.medianScore ?? "—"}</td>
                <td>
                  {s.medianCost != null ? `$${s.medianCost.toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
            {!stats.length ? (
              <tr>
                <td colSpan={7} className="hint">
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 32 }}>Recent runs</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Role</th>
              <th>Level</th>
              <th>Status</th>
              <th>Attempt</th>
              <th>Cost</th>
              <th>Input (trimmed)</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="hint">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td>
                  {r.roleTitle || "—"}
                  {r.industry ? (
                    <div className="hint">{r.industry}</div>
                  ) : null}
                </td>
                <td>{r.level}</td>
                <td>
                  <span className={`admin-pill status-${r.status}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  {r.attempt ?? "—"}
                  {r.passed === true
                    ? " ✓"
                    : r.passed === false
                      ? " ✗"
                      : ""}
                </td>
                <td>${r.costUsd.toFixed(2)}</td>
                <td className="hint admin-input" title={r.inputText}>
                  {r.inputText.length > 120
                    ? `${r.inputText.slice(0, 120)}…`
                    : r.inputText}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
