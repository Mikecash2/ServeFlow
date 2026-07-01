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

interface Campus {
  id: string;
  name: string;
  isPrimary: boolean;
}

export default function DashboardPage() {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const [church, setChurch] = useState<Church | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
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
      apiFetch<Campus[]>(`/churches/${churchId}/campuses`, { accessToken: session.accessToken }),
    ])
      .then(([churchRes, campusesRes]) => {
        setChurch(churchRes);
        setCampuses(campusesRes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, [session]);

  if (loading || !session) {
    return <div className="sf-auth-shell">Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>
            {church ? church.name : "Loading church..."}
          </h1>
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
      </nav>

      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your role</h3>
        {session.user.memberships.map((m) => (
          <div key={m.id} style={{ fontSize: 14, padding: "6px 0" }}>
            {m.role} {m.campusId ? "(campus-scoped)" : "(church-wide)"}
          </div>
        ))}
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Campuses</h3>
        {campuses.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No campuses yet.</p>}
        {campuses.map((c) => (
          <div key={c.id} style={{ fontSize: 14, padding: "6px 0" }}>
            {c.name} {c.isPrimary ? "· Main" : ""}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--sf-text-secondary)", marginTop: 24 }}>
        This is the Phase 1/2 dashboard stub — see dashboard-mockup.html in
        ServeFlow-Docs for the full target design; Phase 5 of the roadmap
        builds the real widget-based dashboard against live scheduling data.
      </p>
    </div>
  );
}
