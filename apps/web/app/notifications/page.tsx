"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const res = await apiFetch<Notification[]>(`/churches/${churchId}/notifications`, { accessToken: session.accessToken });
    setNotifications(res);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load notifications"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function markRead(id: string) {
    if (!session || !churchId) return;
    await apiFetch(`/churches/${churchId}/notifications/${id}/read`, { method: "PATCH", accessToken: session.accessToken });
    await load();
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Notifications</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card">
        {notifications.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No notifications yet.</p>}
        {notifications.map((n) => (
          <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--sf-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{n.title}</strong>
              {!n.readAt && (
                <button className="sf-button" style={{ width: "auto", fontSize: 11, padding: "2px 8px" }} onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--sf-text-secondary)", margin: "4px 0" }}>{n.body}</p>
            <span style={{ fontSize: 11, color: "var(--sf-text-secondary)" }}>
              {n.channel} · {n.sentAt ? "sent" : "logged only (no email provider configured)"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
