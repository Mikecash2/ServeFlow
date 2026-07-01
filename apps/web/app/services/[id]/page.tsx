"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";

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
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [svc, mins, rolesRes, tasksRes, templatesRes, instancesRes] = await Promise.all([
      apiFetch<ServiceDetail>(`/churches/${churchId}/services/${serviceId}`, { accessToken: session.accessToken }),
      apiFetch<Ministry[]>(`/churches/${churchId}/ministries`, { accessToken: session.accessToken }),
      apiFetch<ServiceRole[]>(`/churches/${churchId}/services/${serviceId}/roles`, { accessToken: session.accessToken }),
      apiFetch<Task[]>(`/churches/${churchId}/services/${serviceId}/tasks`, { accessToken: session.accessToken }),
      apiFetch<ChecklistTemplate[]>(`/churches/${churchId}/checklist-templates`, { accessToken: session.accessToken }),
      apiFetch<ChecklistInstance[]>(`/churches/${churchId}/services/${serviceId}/checklist-instances`, { accessToken: session.accessToken }),
    ]);
    setService(svc);
    setMinistries(mins);
    setRoles(rolesRes);
    setTasks(tasksRes);
    setTemplates(templatesRes);
    setInstances(instancesRes);
    setRoleForm((f) => ({ ...f, ministryId: f.ministryId || mins[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load service"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, serviceId]);

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

  if (loading || !session || !service) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{service.title}</h1>
      <p style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginBottom: 20 }}>
        {service.type} · {new Date(service.date).toLocaleString()}
      </p>
      {error && <div className="sf-error">{error}</div>}

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

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Tasks</h3>
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
