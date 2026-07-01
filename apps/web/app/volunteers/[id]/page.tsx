"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";

interface VolunteerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  skills: Array<{ skillId: string; skillName: string; experienceLevel: number }>;
  certifications: Array<{ id: string; name: string }>;
  trainingRecords: Array<{ id: string; courseName: string }>;
}

interface AvailabilityEntry {
  id: string;
  date: string;
  status: string;
}

export default function VolunteerDetailPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const volunteerId = params.id as string;

  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [skillForm, setSkillForm] = useState({ skillName: "", experienceLevel: 3 });
  const [availForm, setAvailForm] = useState({ date: "", status: "AVAILABLE" });
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [detail, avail] = await Promise.all([
      apiFetch<VolunteerDetail>(`/churches/${churchId}/volunteers/${volunteerId}`, { accessToken: session.accessToken }),
      apiFetch<AvailabilityEntry[]>(`/churches/${churchId}/volunteers/${volunteerId}/availability`, { accessToken: session.accessToken }),
    ]);
    setVolunteer(detail);
    setAvailability(avail);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load volunteer"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, volunteerId]);

  async function addSkill(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/volunteers/${volunteerId}/skills`, {
        method: "POST",
        accessToken: session.accessToken,
        body: skillForm,
      });
      setSkillForm({ skillName: "", experienceLevel: 3 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add skill");
    }
  }

  async function submitAvailability(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/volunteers/${volunteerId}/availability`, {
        method: "POST",
        accessToken: session.accessToken,
        body: availForm,
      });
      setAvailForm({ date: "", status: "AVAILABLE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit availability");
    }
  }

  if (loading || !session || !volunteer) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{volunteer.firstName} {volunteer.lastName}</h1>
      <p style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginBottom: 20 }}>
        {volunteer.email} · {volunteer.status}
      </p>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Skills</h3>
        {volunteer.skills.map((s) => (
          <div key={s.skillId} style={{ fontSize: 14, padding: "4px 0" }}>
            {s.skillName} — level {s.experienceLevel}/5
          </div>
        ))}
        <form onSubmit={addSkill} style={{ marginTop: 12 }}>
          <label className="sf-label" htmlFor="skillName">Skill name</label>
          <input
            id="skillName"
            className="sf-input"
            required
            value={skillForm.skillName}
            onChange={(e) => setSkillForm((f) => ({ ...f, skillName: e.target.value }))}
          />
          <label className="sf-label" htmlFor="experienceLevel">Experience level (1-5)</label>
          <input
            id="experienceLevel"
            className="sf-input"
            type="number"
            min={1}
            max={5}
            value={skillForm.experienceLevel}
            onChange={(e) => setSkillForm((f) => ({ ...f, experienceLevel: Number(e.target.value) }))}
          />
          <button className="sf-button" type="submit">Add skill</button>
        </form>
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Certifications & training</h3>
        {volunteer.certifications.map((c) => (
          <div key={c.id} style={{ fontSize: 14, padding: "4px 0" }}>{c.name}</div>
        ))}
        {volunteer.trainingRecords.map((t) => (
          <div key={t.id} style={{ fontSize: 14, padding: "4px 0", color: "var(--sf-text-secondary)" }}>
            {t.courseName} (training)
          </div>
        ))}
        {volunteer.certifications.length === 0 && volunteer.trainingRecords.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>None recorded yet.</p>
        )}
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Availability</h3>
        {availability.map((a) => (
          <div key={a.id} style={{ fontSize: 14, padding: "4px 0" }}>{a.date} — {a.status}</div>
        ))}
        <form onSubmit={submitAvailability} style={{ marginTop: 12 }}>
          <label className="sf-label" htmlFor="date">Date</label>
          <input
            id="date"
            className="sf-input"
            type="date"
            required
            value={availForm.date}
            onChange={(e) => setAvailForm((f) => ({ ...f, date: e.target.value }))}
          />
          <label className="sf-label" htmlFor="status">Status</label>
          <select
            id="status"
            className="sf-input"
            value={availForm.status}
            onChange={(e) => setAvailForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
            <option value="LATE">Late</option>
            <option value="LEAVE_EARLY">Leave early</option>
            <option value="MAYBE">Maybe</option>
          </select>
          <button className="sf-button" type="submit">Submit availability</button>
        </form>
      </div>
    </div>
  );
}
