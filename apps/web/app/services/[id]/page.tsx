"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";
import { connectRealtime } from "../../../lib/realtime";

interface ServiceDetail {
  id: string;
  title: string;
  type: string;
  date: string;
  setupStart: string | null;
  serviceStart: string;
  serviceEnd: string | null;
  derigEnd: string | null;
}

interface Ministry {
  id: string;
  name: string;
}

interface ServiceRole {
  id: string;
  name: string;
  minRequired: number;
  maxAllowed: number;
}

interface Assignment {
  id: string;
  serviceRoleId: string;
  volunteerProfileId: string;
  score: number;
  source: string;
}

interface GenerateResult {
  runId: string;
  coveragePct: number;
  summary: string;
  assignments: Assignment[];
}

interface RosterEntry {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  checkedInAt: string | null;
  isLate: boolean | null;
}

interface Task {
  id: string;
  phase: string;
  title: string;
  status: string;
}

interface ChecklistTemplate {
  id: string;
  name: string;
}

interface ChecklistInstance {
  id: string;
  templateId: string;
  completedItems: Record<string, unknown>;
}

const PHASES = ["SETUP", "SERVICE", "DERIG"];
const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"];

export default function ServiceDetailPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [roleForm, setRoleForm] = useState({ ministryId: "", name: "" });
  const [taskForm, setTaskForm] = useState({ phase: "SETUP", title: "" });
  const [schedule, setSchedule] = useState<GenerateResult | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [recurringCount, setRecurringCount] = useState(4);
  const [recurringMessage, setRecurringMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [svc, mins, rolesRes, tasksRes, templatesRes, instancesRes, rosterRes] = await Promise.all([
      apiFetch<ServiceDetail>(`/churches/${churchId}/services/${serviceId}`, { accessToken: session.accessToken }),
      apiFetch<Ministry[]>(`/churches/${churchId}/ministries`, { accessToken: session.accessToken }),
      apiFetch<ServiceRole[]>(`/churches/${churchId}/services/${serviceId}/roles`, { accessToken: session.accessToken }),
      apiFetch<Task[]>(`/churches/${churchId}/services/${serviceId}/tasks`, { accessToken: session.accessToken }),
      apiFetch<ChecklistTemplate[]>(`/churches/${churchId}/checklist-templates`, { accessToken: session.accessToken }),
      apiFetch<ChecklistInstance[]>(`/churches/${churchId}/services/${serviceId}/checklist-instances`, { accessToken: session.accessToken }),
      apiFetch<RosterEntry[]>(`/churches/${churchId}/services/${serviceId}/attendance`, { accessToken: session.accessToken }),
    ]);
    setService(svc);
    setMinistries(mins);
    setRoles(rolesRes);
    setTasks(tasksRes);
    setTemplates(templatesRes);
    setInstances(instancesRes);
    setRoster(rosterRes);
    setRoleForm((f) => ({ ...f, ministryId: f.ministryId || mins[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load service"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, serviceId]);

  useEffect(() => {
    if (!session || !churchId) return;
    const socket = connectRealtime(session.accessToken, churchId);
    socket.on("connect", () => setLiveConnected(true));
    socket.on("disconnect", () => setLiveConnected(false));
    socket.on("task.updated", (updated: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    });
    socket.on("checkin.recorded", () => {
      load().catch(() => {});
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, churchId]);

  async function addRole(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/services/${serviceId}/roles`, {
        method: "POST",
        accessToken: session.accessToken,
        body: roleForm,
      });
      setRoleForm((f) => ({ ...f, name: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add role");
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/services/${serviceId}/tasks`, {
        method: "POST",
        accessToken: session.accessToken,
        body: taskForm,
      });
      setTaskForm((f) => ({ ...f, title: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function setTaskStatus(taskId: string, status: string) {
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/services/${serviceId}/tasks/${taskId}`, {
        method: "PATCH",
        accessToken: session.accessToken,
        body: { status },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function generateRecurring() {
    if (!session || !churchId) return;
    setRecurringMessage(null);
    try {
      const created = await apiFetch<{ id: string }[]>(`/churches/${churchId}/services/${serviceId}/generate-recurring`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { count: recurringCount },
      });
      setRecurringMessage(`Created ${created.length} upcoming occurrence(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recurring occurrences (does this service have a recurrenceRule?)");
    }
  }

  async function checkInVolunteer(volunteerProfileId: string) {
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/services/${serviceId}/attendance/checkin`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { volunteerProfileId, method: "MANUAL" },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in volunteer");
    }
  }

  async function instantiateChecklist(templateId: string) {
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/services/${serviceId}/checklist-instances`, {
        method: "POST",
        accessToken: session.accessToken,
        body: { templateId },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach checklist");
    }
  }

  async function generateSchedule() {
    if (!session || !churchId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await apiFetch<GenerateResult>(`/churches/${churchId}/services/${serviceId}/schedule-runs`, {
        method: "POST",
        accessToken: session.accessToken,
      });
      setSchedule(result);
      setExplanations({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  }

  async function showWhy(assignmentId: string) {
    if (!session || !churchId) return;
    try {
      const res = await apiFetch<{ explanation: string }>(`/churches/${churchId}/assignments/${assignmentId}/explain`, {
        accessToken: session.accessToken,
      });
      setExplanations((e) => ({ ...e, [assignmentId]: res.explanation }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load explanation");
    }
  }

  async function confirmAssignment(assignmentId: string) {
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/assignments/${assignmentId}/confirm`, { method: "POST", accessToken: session.accessToken });
      await refreshAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm assignment");
    }
  }

  async function declineAssignment(assignmentId: string) {
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/assignments/${assignmentId}/decline`, { method: "POST", accessToken: session.accessToken });
      await refreshAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline assignment");
    }
  }

  async function refreshAssignments() {
    if (!session || !churchId || !schedule) return;
    try {
      const assignments = await apiFetch<Assignment[]>(
        `/churches/${churchId}/services/${serviceId}/schedule-runs/${schedule.runId}/assignments`,
        { accessToken: session.accessToken },
      );
      setSchedule((s) => (s ? { ...s, assignments } : s));
    } catch {
      // Non-fatal — the confirm/decline action itself already succeeded.
    }
  }

  if (loading || !session || !service) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{service.title}</h1>
      <p style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginBottom: 20 }}>
        {service.type} · {new Date(service.date).toLocaleString()}
      </p>
      {error && <div className="sf-error">{error}</div>}

      <div className="sf-card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>Generate</span>
        <input
          type="number"
          min={1}
          max={26}
          className="sf-input"
          style={{ width: 60, marginBottom: 0 }}
          value={recurringCount}
          onChange={(e) => setRecurringCount(Number(e.target.value))}
        />
        <span style={{ fontSize: 13 }}>upcoming occurrences from this service&apos;s recurrenceRule</span>
        <button className="sf-button" style={{ width: "auto" }} onClick={generateRecurring}>
          Generate
        </button>
        {recurringMessage && <span style={{ fontSize: 12, color: "var(--sf-success-500)" }}>{recurringMessage}</span>}
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Roles</h3>
        {roles.map((r) => (
          <div key={r.id} style={{ fontSize: 14, padding: "4px 0" }}>
            {r.name} — {r.minRequired}-{r.maxAllowed} needed
          </div>
        ))}
        <form onSubmit={addRole} style={{ marginTop: 12 }}>
          <label className="sf-label" htmlFor="ministryId">Ministry</label>
          <select
            id="ministryId"
            className="sf-input"
            value={roleForm.ministryId}
            onChange={(e) => setRoleForm((f) => ({ ...f, ministryId: e.target.value }))}
          >
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor="roleName">Role name</label>
          <input
            id="roleName"
            className="sf-input"
            required
            value={roleForm.name}
            onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
          />
          <button className="sf-button" type="submit">Add role</button>
        </form>
      </div>

      <div className="sf-card ai-card" style={{ marginBottom: 16, background: "linear-gradient(180deg, rgba(2,132,199,0.06), rgba(2,132,199,0.02))", border: "1px solid rgba(2,132,199,0.25)" }}>
        <h3 style={{ marginTop: 0 }}>AI Scheduling</h3>
        <button className="sf-button" style={{ width: "auto" }} onClick={generateSchedule} disabled={generating}>
          {generating ? "Generating..." : "Generate Schedule"}
        </button>
        {schedule && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "var(--sf-text-secondary)" }}>
              Coverage: {schedule.coveragePct}% — {schedule.summary}
            </p>
            {schedule.assignments.map((a) => {
              const role = roles.find((r) => r.id === a.serviceRoleId);
              return (
                <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid var(--sf-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>
                      {role?.name ?? a.serviceRoleId} — score {(a.score * 100).toFixed(0)}% ({a.source})
                    </span>
                    <span style={{ display: "flex", gap: 4 }}>
                      <button className="sf-button" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }} onClick={() => showWhy(a.id)}>
                        Why?
                      </button>
                      <button className="sf-button" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }} onClick={() => confirmAssignment(a.id)}>
                        Confirm
                      </button>
                      <button
                        className="sf-button"
                        style={{ width: "auto", fontSize: 12, padding: "4px 10px", background: "var(--sf-danger-500)" }}
                        onClick={() => declineAssignment(a.id)}
                      >
                        Decline
                      </button>
                    </span>
                  </div>
                  {explanations[a.id] && (
                    <p style={{ fontSize: 13, color: "var(--sf-text-secondary)", marginTop: 6 }}>{explanations[a.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Attendance</h3>
        {roster.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>
            No roster yet — generate a schedule above to see who's assigned.
          </p>
        )}
        {roster.map((r) => (
          <div key={r.volunteerProfileId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
            <span style={{ fontSize: 14 }}>
              {r.firstName} {r.lastName} <span style={{ color: "var(--sf-text-secondary)", fontSize: 12 }}>· {r.roleName}</span>
            </span>
            {r.checkedInAt ? (
              <span className={`badge ${r.isLate ? "badge-warn" : "badge-ok"}`}>{r.isLate ? "Checked in late" : "Checked in"}</span>
            ) : (
              <button
                className="sf-button"
                style={{ width: "auto", fontSize: 12, padding: "4px 10px" }}
                onClick={() => checkInVolunteer(r.volunteerProfileId)}
              >
                Check in
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          Tasks
          <span style={{ fontSize: 11, fontWeight: 600, color: liveConnected ? "var(--sf-success-500)" : "var(--sf-text-secondary)" }}>
            {liveConnected ? "\u25CF live" : "\u25CB connecting..."}
          </span>
        </h3>
        {PHASES.map((phase) => (
          <div key={phase} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sf-text-secondary)", textTransform: "uppercase" }}>
              {phase}
            </div>
            {tasks.filter((t) => t.phase === phase).map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                <span style={{ fontSize: 14 }}>{t.title}</span>
                <select
                  className="sf-input"
                  style={{ width: "auto", marginBottom: 0, fontSize: 12, padding: "4px 8px" }}
                  value={t.status}
                  onChange={(e) => setTaskStatus(t.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}
        <form onSubmit={addTask} style={{ marginTop: 4 }}>
          <label className="sf-label" htmlFor="taskPhase">Phase</label>
          <select
            id="taskPhase"
            className="sf-input"
            value={taskForm.phase}
            onChange={(e) => setTaskForm((f) => ({ ...f, phase: e.target.value }))}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <label className="sf-label" htmlFor="taskTitle">Task title</label>
          <input
            id="taskTitle"
            className="sf-input"
            required
            value={taskForm.title}
            onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
          />
          <button className="sf-button" type="submit">Add task</button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Checklists</h3>
        {instances.map((inst) => {
          const template = templates.find((t) => t.id === inst.templateId);
          return (
            <div key={inst.id} style={{ fontSize: 14, padding: "4px 0" }}>
              {template?.name ?? "Checklist"} — {Object.keys(inst.completedItems).length} item(s) completed
            </div>
          );
        })}
        {templates.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <select id="templateSelect" className="sf-input" style={{ marginBottom: 0 }}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              className="sf-button"
              style={{ width: "auto" }}
              onClick={() => {
                const select = document.getElementById("templateSelect") as HTMLSelectElement;
                if (select) instantiateChecklist(select.value);
              }}
            >
              Attach
            </button>
          </div>
        )}
        {templates.length === 0 && (
          <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>
            No checklist templates yet — create one from the API (checklist-templates endpoint) to attach it here.
          </p>
        )}
      </div>
    </div>
  );
}
