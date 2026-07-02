"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export default function ChannelThreadPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const channelId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const res = await apiFetch<Message[]>(`/churches/${churchId}/channels/${channelId}/messages`, { accessToken: session.accessToken });
    setMessages([...res].reverse());
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load messages"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, channelId]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId || !body.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/churches/${churchId}/channels/${channelId}/messages`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { body },
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Channel</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16, minHeight: 200 }}>
        {messages.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--sf-border)" }}>
            <div style={{ fontSize: 14 }}>{m.body}</div>
            <div style={{ fontSize: 11, color: "var(--sf-text-secondary)", marginTop: 2 }}>{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="sf-card" style={{ display: "flex", gap: 8 }}>
        <input
          className="sf-input"
          style={{ marginBottom: 0, flex: 1 }}
          placeholder="Write a message..."
          aria-label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="sf-button" style={{ width: "auto" }} type="submit" disabled={sending}>
          Send
        </button>
      </form>
    </div>
  );
}
