"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface Campus {
  id: string;
  name: string;
}

interface Service {
  id: string;
  title: string;
  type: string;
  date: string;
}

const SERVICE_TYPES = [
  "SUNDAY_SERVICE", "WEDNESDAY_SERVICE", "PRAYER_MEETING",
  "CONFERENCE", "WEDDING", "FUNERAL", "SPECIAL_EVENT",
];

export default function ServicesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({
    campusId: "",
    type: "SUNDAY_SERVICE",
    title: "Sunday Service",
    date: "",
    serviceStart: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [campusesRes, servicesRes] = await Promise.all([
      apiFetch<Campus[]>(`/churches/${churchId}/campuses`, { accessToken: session.accessToken }),
      apiFetch<Service[]>(`/churches/${churchId}/services`, { accessToken: session.accessToken }),
    ]);
    setCampuses(campusesRes);
    setServices(servicesRes);
    setForm((f) => ({ ...f, campusId: f.campusId || campusesRes[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    setError(null);
    setSubmitting(true);
    try {
      const dateIso = new Date(form.date).toISOString();
      const startIso = new Date(form.serviceStart).toISOString();
      await apiFetch(`/churches/${churchId}/services`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { ...form, date: dateIso, serviceStart: startIso },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Services</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Create a service</h3>
        <form onSubmit={onSubmit}>
          <label className="sf-label" htmlFor="title">Title</label>
          <input
            id="title"
            className="sf-input"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <label className="sf-label" htmlFor="type">Type</label>
          <select
            id="type"
            className="sf-input"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor="campusId">Campus</label>
          <select
            id="campusId"
            className="sf-input"
            value={form.campusId}
            onChange={(e) => setForm((f) => ({ ...f, campusId: e.target.value }))}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor="date">Date</label>
          <input
            id="date"
            className="sf-input"
            type="datetime-local"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <label className="sf-label" htmlFor="serviceStart">Service start</label>
          <input
            id="serviceStart"
            className="sf-input"
            type="datetime-local"
            required
            value={form.serviceStart}
            onChange={(e) => setForm((f) => ({ ...f, serviceStart: e.target.value }))}
          />
          <button className="sf-button" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create service"}
          </button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Upcoming & past services</h3>
        {services.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No services yet.</p>
        )}
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/services/${s.id}`}
            style={{ display: "block", padding: "10px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}
          >
            <strong>{s.title}</strong>
            <span style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginLeft: 8 }}>
              {s.type} · {new Date(s.date).toLocaleDateString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
