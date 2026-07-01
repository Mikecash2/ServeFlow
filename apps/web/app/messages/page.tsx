"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Channel {
  id: string;
  type: string;
  ministryId: string | null;
  name: string | null;
}

interface Ministry {
  id: string;
  name: string;
}

export default function MessagesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [form, setForm] = useState({ type: "ANNOUNCEMENT", ministryId: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [channelsRes, ministriesRes] = await Promise.all([
      apiFetch<Channel[]>(`/churches/${churchId}/channels`, { accessToken: session.accessToken }),
      apiFetch<Ministry[]>(`/churches/${churchId}/ministries`, { accessToken: session.accessToken }),
    ]);
    setChannels(channelsRes);
    setMinistries(ministriesRes);
    setForm((f) => ({ ...f, ministryId: f.ministryId || ministriesRes[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load channels"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/channels`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { type: form.type, ministryId: form.ministryId || undefined, name: form.name || undefined },
      });
      setForm((f) => ({ ...f, name: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Messages</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>New channel</h3>
        <form onSubmit={onSubmit}>
          <label className="sf-label" htmlFor="type">Type</label>
          <select id="type" className="sf-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="TEAM_CHAT">Team chat</option>
          </select>
          <label className="sf-label" htmlFor="ministryId">Ministry</label>
          <select id="ministryId" className="sf-input" value={form.ministryId} onChange={(e) => setForm((f) => ({ ...f, ministryId: e.target.value }))}>
            <option value="">Church-wide</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor="name">Name</label>
          <input id="name" className="sf-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <button className="sf-button" type="submit">Create channel</button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Channels</h3>
        {channels.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No channels yet.</p>}
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            style={{ display: "block", padding: "10px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}
          >
            <strong>{c.name ?? "Untitled channel"}</strong>
            <span style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginLeft: 8 }}>{c.type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
