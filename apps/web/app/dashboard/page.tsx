"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Church {
  id: string;
  name: string;
  timezone: string;
}

interface UpcomingService {
  id: string;
  title: string;
  type: string;
  date: string;
}

interface FocusService {
  id: string;
  title: string;
  date: string;
  coveragePct: number | null;
  coverageSummary: string | null;
  setupTasksDone: number;
  setupTasksTotal: number;
  derigTasksDone: number;
  derigTasksTotal: number;
  missingRoles: string[];
}

interface DashboardSummary {
  upcomingServices: UpcomingService[];
  focusService: FocusService | null;
  availabilityPct: number | null;
  activeVolunteerCount: number;
  recommendations: string[];
}

function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default function DashboardPage() {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const [church, setChurch] = useState<Church | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    const churchId = session.user.memberships[0]?.churchId;
    if (!churchId) return;

    Promise.all([
      apiFetch<Church>(`/churches/${churchId}`, { accessToken: session.accessToken }),
      apiFetch<DashboardSummary>(`/churches/${churchId}/dashboard`, { accessToken: session.accessToken }),
    ])
      .then(([churchRes, summaryRes]) => {
        setChurch(churchRes);
        setSummary(summaryRes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, [session]);

  if (loading || !session) {
    return <div className="sf-auth-shell">Loading...</div>;
  }

  const focus = summary?.focusService ?? null;
  const setupPct = focus ? pct(focus.setupTasksDone, focus.setupTasksTotal) : 0;
  const derigPct = focus ? pct(focus.derigTasksDone, focus.derigTasksTotal) : 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>{church ? church.name : "Loading church..."}</h1>
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 13, margin: "4px 0 0" }}>
            Signed in as {session.user.firstName} {session.user.lastName} ({session.user.email})
          </p>
        </div>
        <button className="sf-button" style={{ width: "auto" }} onClick={() => { logout(); router.push("/login"); }}>
          Log out
        </button>
      </div>

      <nav style={{ display: "flex", gap: 16, marginBottom: 24, fontSize: 13 }}>
        <Link href="/ministries" style={{ color: "var(--sf-brand-600)" }}>Ministries</Link>
        <Link href="/volunteers" style={{ color: "var(--sf-brand-600)" }}>Volunteers</Link>
        <Link href="/services" style={{ color: "var(--sf-brand-600)" }}>Services</Link>
        <Link href="/equipment" style={{ color: "var(--sf-brand-600)" }}>Equipment</Link>
        <Link href="/messages" style={{ color: "var(--sf-brand-600)" }}>Messages</Link>
        <Link href="/notifications" style={{ color: "var(--sf-brand-600)" }}>Notifications</Link>
      </nav>

      {error && <div className="sf-error">{error}</div>}
      {!summary && !error && <p style={{ color: "var(--sf-text-secondary)" }}>Loading dashboard...</p>}

      {summary && (
        <>
          <div className="sf-grid" style={{ marginBottom: 20 }}>
            <div className="sf-card">
              <div className="stat-label">Coverage</div>
              <div className="stat-value">{focus?.coveragePct ?? "—"}{focus?.coveragePct !== null && focus?.coveragePct !== undefined ? "%" : ""}</div>
            </div>
            <div className="sf-card">
              <div className="stat-label">Availability submitted</div>
              <div className="stat-value">{summary.availabilityPct ?? "—"}{summary.availabilityPct !== null ? "%" : ""}</div>
            </div>
            <div className="sf-card">
              <div className="stat-label">Setup progress</div>
              <div className="stat-value">{focus ? `${focus.setupTasksDone}/${focus.setupTasksTotal}` : "—"}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${setupPct}%` }} /></div>
            </div>
            <div className="sf-card">
              <div className="stat-label">De-rig progress</div>
              <div className="stat-value">{focus ? `${focus.derigTasksDone}/${focus.derigTasksTotal}` : "—"}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${derigPct}%` }} /></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="sf-card">
              <h3 style={{ marginTop: 0 }}>
                {focus ? (
                  <Link href={`/services/${focus.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {focus.title}
                  </Link>
                ) : (
                  "No upcoming service"
                )}
              </h3>
              {focus && (
                <p style={{ fontSize: 13, color: "var(--sf-text-secondary)" }}>
                  {new Date(focus.date).toLocaleString()}
                </p>
              )}
              {focus?.missingRoles.map((name) => (
                <div key={name} style={{ padding: "6px 0" }}>
                  {name} <span className="badge badge-gap" style={{ marginLeft: 8 }}>Coverage gap</span>
                </div>
              ))}
              {focus && focus.missingRoles.length === 0 && focus.coveragePct === 100 && (
                <div style={{ padding: "6px 0" }}>
                  All roles filled <span className="badge badge-ok" style={{ marginLeft: 8 }}>Fully staffed</span>
                </div>
              )}

              <h3 style={{ marginTop: 20 }}>Upcoming services</h3>
              {summary.upcomingServices.map((s) => (
                <Link
                  key={s.id}
                  href={`/services/${s.id}`}
                  style={{ display: "block", padding: "6px 0", color: "inherit", textDecoration: "none", fontSize: 14 }}
                >
                  {s.title} <span style={{ color: "var(--sf-text-secondary)", fontSize: 12 }}>· {new Date(s.date).toLocaleDateString()}</span>
                </Link>
              ))}
              {summary.upcomingServices.length === 0 && (
                <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No services scheduled yet.</p>
              )}
            </div>

            <div className="sf-card ai-card">
              <h3 style={{ marginTop: 0 }}>AI recommendations</h3>
              {summary.recommendations.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--sf-text-secondary)" }}>Nothing needs attention right now.</p>
              )}
              {summary.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 13, padding: "6px 0" }}>{r}</div>
              ))}
            </div>
          </div>
        </>
      )}

      <p style={{ fontSize: 13, color: "var(--sf-text-secondary)", marginTop: 8 }}>
        Live task/coverage updates on the service page use a WebSocket
        connection (see docs/02-architecture.md §5) — single-instance only in
        this build (no Redis adapter available in the sandbox).
      </p>
    </div>
  );
}
