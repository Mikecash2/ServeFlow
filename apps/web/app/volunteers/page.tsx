"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export default function VolunteersPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const res = await apiFetch<Volunteer[]>(`/churches/${churchId}/volunteers`, {
      accessToken: session.accessToken,
    });
    setVolunteers(res);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load volunteers"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/churches/${churchId}/volunteers`, {
        method: "POST",
        accessToken: session.accessToken,
        body: form,
      });
      setForm({ email: "", firstName: "", lastName: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite volunteer");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Volunteers</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Invite a volunteer</h3>
        <form onSubmit={onSubmit}>
          <label className="sf-label" htmlFor="firstName">First name</label>
          <input
            id="firstName"
            className="sf-input"
            required
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          />
          <label className="sf-label" htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            className="sf-input"
            required
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          />
          <label className="sf-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="sf-input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <button className="sf-button" type="submit" disabled={submitting}>
            {submitting ? "Inviting..." : "Invite volunteer"}
          </button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Roster</h3>
        {volunteers.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No volunteers yet.</p>
        )}
        {volunteers.map((v) => (
          <Link
            key={v.id}
            href={`/volunteers/${v.id}`}
            style={{ display: "block", padding: "10px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}
          >
            <strong>{v.firstName} {v.lastName}</strong>
            <span style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginLeft: 8 }}>{v.email} · {v.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
