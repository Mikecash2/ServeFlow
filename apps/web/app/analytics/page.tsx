"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api-client";

interface CoveragePoint {
  serviceId: string;
  title: string;
  date: string;
  coveragePct: number | null;
}

interface ReliabilityBucket {
  bucket: string;
  count: number;
}

interface BurnoutEntry {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  trailing8WeekAssignments: number;
  ministryAverage: number;
}

interface EquipmentUsage {
  category: string;
  reservationCount: number;
  faultCount: number;
}

interface AssistantTurn {
  question: string;
  answer: string;
}

const SUGGESTED_QUESTIONS = [
  "Who hasn't served recently?",
  "Who can replace Alice?",
  "Which volunteers need training?",
  "Predict volunteer shortages",
];

export default function AnalyticsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [coverage, setCoverage] = useState<CoveragePoint[]>([]);
  const [reliability, setReliability] = useState<ReliabilityBucket[]>([]);
  const [burnout, setBurnout] = useState<BurnoutEntry[]>([]);
  const [equipmentUsage, setEquipmentUsage] = useState<EquipmentUsage[]>([]);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<AssistantTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || !churchId) return;
    Promise.all([
      apiFetch<CoveragePoint[]>(`/churches/${churchId}/analytics/coverage`, { accessToken: session.accessToken }),
      apiFetch<ReliabilityBucket[]>(`/churches/${churchId}/analytics/reliability`, { accessToken: session.accessToken }),
      apiFetch<BurnoutEntry[]>(`/churches/${churchId}/analytics/burnout-risk`, { accessToken: session.accessToken }),
      apiFetch<EquipmentUsage[]>(`/churches/${churchId}/analytics/equipment-usage`, { accessToken: session.accessToken }),
    ])
      .then(([c, r, b, e]) => {
        setCoverage(c);
        setReliability(r);
        setBurnout(b);
        setEquipmentUsage(e);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"));
  }, [session, churchId]);

  async function ask(q: string) {
    if (!session || !churchId || !q.trim()) return;
    setAsking(true);
    try {
      const res = await apiFetch<{ answer: string }>(`/churches/${churchId}/assistant/query`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { question: q },
      });
      setConversation((c) => [...c, { question: q, answer: res.answer }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask the assistant");
    } finally {
      setAsking(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await ask(question);
  }

  if (loading || !session) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Analytics & Assistant</h1>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card ai-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Ask the assistant</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              className="sf-button"
              style={{ width: "auto", fontSize: 12, padding: "4px 10px", background: "var(--sf-info-500)" }}
              onClick={() => ask(q)}
            >
              {q}
            </button>
          ))}
        </div>
        {conversation.map((turn, i) => (
          <div key={i} style={{ padding: "8px 0", borderTop: "1px solid var(--sf-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{turn.question}</div>
            <div style={{ fontSize: 13, color: "var(--sf-text-secondary)", marginTop: 4 }}>{turn.answer}</div>
          </div>
        ))}
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="sf-input"
            style={{ marginBottom: 0, flex: 1 }}
            placeholder="Ask a question..."
            aria-label="Ask the assistant a question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="sf-button" style={{ width: "auto" }} type="submit" disabled={asking}>
            Ask
          </button>
        </form>
      </div>

      <div className="sf-grid" style={{ marginBottom: 16 }}>
        <div className="sf-card">
          <h3 style={{ marginTop: 0 }}>Reliability distribution</h3>
          {reliability.map((b) => (
            <div key={b.bucket} style={{ fontSize: 13, padding: "4px 0" }}>{b.bucket}: {b.count}</div>
          ))}
        </div>
        <div className="sf-card">
          <h3 style={{ marginTop: 0 }}>Burnout risk</h3>
          {burnout.length === 0 && <p style={{ fontSize: 13, color: "var(--sf-text-secondary)" }}>No one flagged.</p>}
          {burnout.map((v) => (
            <div key={v.volunteerProfileId} style={{ fontSize: 13, padding: "4px 0" }}>
              {v.firstName} {v.lastName} — {v.trailing8WeekAssignments} vs avg {v.ministryAverage}
            </div>
          ))}
        </div>
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Coverage trend</h3>
        {coverage.map((p) => (
          <div key={p.serviceId} style={{ fontSize: 13, padding: "4px 0" }}>
            {p.title} ({new Date(p.date).toLocaleDateString()}): {p.coveragePct ?? "no schedule yet"}
            {p.coveragePct !== null ? "%" : ""}
          </div>
        ))}
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Equipment usage</h3>
        {equipmentUsage.map((e) => (
          <div key={e.category} style={{ fontSize: 13, padding: "4px 0" }}>
            {e.category}: {e.reservationCount} reservation(s), {e.faultCount} fault(s)
          </div>
        ))}
      </div>
    </div>
  );
}
