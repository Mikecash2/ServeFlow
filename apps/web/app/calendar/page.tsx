"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface ServiceItem {
  id: string;
  title: string;
  type: string;
  date: string;
}

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const weekday = first.getUTCDay();
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - weekday);
  return gridStart;
}

export default function CalendarPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || !churchId) return;
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, month + 2, 0)).toISOString();
    apiFetch<ServiceItem[]>(`/churches/${churchId}/services?from=${from}&to=${to}`, { accessToken: session.accessToken })
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"));
  }, [session, churchId, cursor]);

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const gridStart = startOfMonthGrid(year, month);
  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });

  const servicesByDay = new Map<string, ServiceItem[]>();
  for (const s of services) {
    const key = s.date.slice(0, 10);
    servicesByDay.set(key, [...(servicesByDay.get(key) ?? []), s]);
  }

  const icsUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1"}/churches/${churchId}/calendar.ics`;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="sf-button"
            style={{ width: "auto" }}
            onClick={() => setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - 1, 1)))}
          >
            &larr; Prev
          </button>
          <button
            className="sf-button"
            style={{ width: "auto" }}
            onClick={() => setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)))}
          >
            Next &rarr;
          </button>
        </div>
      </div>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "var(--sf-text-secondary)", marginBottom: 4 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} style={{ textAlign: "center", fontWeight: 600 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const inMonth = d.getUTCMonth() === month;
            const dayServices = servicesByDay.get(key) ?? [];
            return (
              <div
                key={key}
                style={{
                  minHeight: 64,
                  border: "1px solid var(--sf-border)",
                  borderRadius: 8,
                  padding: 4,
                  opacity: inMonth ? 1 : 0.35,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--sf-text-secondary)" }}>{d.getUTCDate()}</div>
                {dayServices.map((s) => (
                  <Link
                    key={s.id}
                    href={`/services/${s.id}`}
                    style={{ display: "block", fontSize: 10, background: "var(--sf-brand-100)", color: "var(--sf-brand-600)", borderRadius: 4, padding: "1px 4px", marginTop: 2, textDecoration: "none" }}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Agenda</h3>
        {services
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((s) => (
            <Link key={s.id} href={`/services/${s.id}`} style={{ display: "block", padding: "6px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit", fontSize: 13 }}>
              {new Date(s.date).toLocaleDateString()} — {s.title} <span style={{ color: "var(--sf-text-secondary)" }}>({s.type})</span>
            </Link>
          ))}
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Subscribe (ICS)</h3>
        <p style={{ fontSize: 13, color: "var(--sf-text-secondary)" }}>
          Add this URL as a subscribed calendar in Google Calendar, Outlook, or Apple Calendar:
        </p>
        <code style={{ fontSize: 12, wordBreak: "break-all", display: "block", background: "var(--sf-surface)", padding: 8, borderRadius: 6 }}>
          {icsUrl}
        </code>
      </div>
    </div>
  );
}
