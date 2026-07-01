"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Equipment {
  id: string;
  name: string;
  category: string;
  status: string;
  storageLocation: string | null;
}

export default function EquipmentPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Equipment[]>([]);
  const [form, setForm] = useState({ name: "", category: "", storageLocation: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const res = await apiFetch<Equipment[]>(`/churches/${churchId}/equipment`, { accessToken: session.accessToken });
    setItems(res);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load equipment"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/churches/${churchId}/equipment`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { name: form.name, category: form.category, storageLocation: form.storageLocation || undefined },
      });
      setForm({ name: "", category: "", storageLocation: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add equipment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Equipment</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add equipment</h3>
        <form onSubmit={onSubmit}>
          <label className="sf-label" htmlFor="name">Name</label>
          <input id="name" className="sf-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <label className="sf-label" htmlFor="category">Category</label>
          <input id="category" className="sf-input" required placeholder="Audio, Lighting, Streaming..." value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <label className="sf-label" htmlFor="storageLocation">Storage location</label>
          <input id="storageLocation" className="sf-input" value={form.storageLocation} onChange={(e) => setForm((f) => ({ ...f, storageLocation: e.target.value }))} />
          <button className="sf-button" type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add equipment"}
          </button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Inventory</h3>
        {items.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No equipment yet.</p>}
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/equipment/${item.id}`}
            style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}
          >
            <span>
              <strong>{item.name}</strong>
              <span style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginLeft: 8 }}>
                {item.category}{item.storageLocation ? ` · ${item.storageLocation}` : ""}
              </span>
            </span>
            <span
              className={`badge ${item.status === "AVAILABLE" ? "badge-ok" : item.status === "IN_USE" ? "badge-warn" : "badge-gap"}`}
            >
              {item.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
