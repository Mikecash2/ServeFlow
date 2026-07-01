"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Ministry {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

const CATEGORIES = [
  "MEDIA", "PRODUCTION", "WORSHIP", "HOSPITALITY", "CHILDREN",
  "SECURITY", "USHERING", "PRAYER", "CLEANING", "CUSTOM",
];

export default function MinistriesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("PRODUCTION");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const res = await apiFetch<Ministry[]>(`/churches/${churchId}/ministries`, {
      accessToken: session.accessToken,
    });
    setMinistries(res);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load ministries"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/churches/${churchId}/ministries`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { name, category },
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ministry");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Ministries</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add a ministry</h3>
        <form onSubmit={onSubmit}>
          <label className="sf-label" htmlFor="name">Name</label>
          <input id="name" className="sf-input" required value={name} onChange={(e) => setName(e.target.value)} />
          <label className="sf-label" htmlFor="category">Category</label>
          <select
            id="category"
            className="sf-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="sf-button" type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add ministry"}
          </button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Your ministries</h3>
        {ministries.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No ministries yet.</p>
        )}
        {ministries.map((m) => (
          <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--sf-border)" }}>
            <strong>{m.name}</strong>
            <span style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginLeft: 8 }}>{m.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
