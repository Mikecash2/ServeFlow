"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";
import { connectRealtime } from "../../../lib/realtime";

interface EquipmentDetail {
  id: string;
  name: string;
  category: string;
  status: string;
  storageLocation: string | null;
  batteryLevelPct: number | null;
  qrCode: string | null;
  maintenanceRecords: Array<{ id: string; performedAt: string; description: string; cost: number | null }>;
  reservations: Array<{ id: string; reservedFrom: string; reservedTo: string; checkedOutAt: string | null; checkedInAt: string | null }>;
  faultReports: Array<{ id: string; severity: string; description: string; resolvedAt: string | null; createdAt: string }>;
}

export default function EquipmentDetailPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const equipmentId = params.id as string;

  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [reserveForm, setReserveForm] = useState({ reservedFrom: "", reservedTo: "" });
  const [faultForm, setFaultForm] = useState({ severity: "MEDIUM", description: "" });
  const [liveAlert, setLiveAlert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const churchId = session?.user.memberships[0]?.churchId;

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [loading, session, router]);

  async function load() {
    if (!session || !churchId) return;
    const [detail, qr] = await Promise.all([
      apiFetch<EquipmentDetail>(`/churches/${churchId}/equipment/${equipmentId}`, { accessToken: session.accessToken }),
      apiFetch<{ qrImageDataUrl: string | null }>(`/churches/${churchId}/equipment/${equipmentId}/qrcode`, { accessToken: session.accessToken }),
    ]);
    setEquipment(detail);
    setQrImage(qr.qrImageDataUrl);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load equipment"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, equipmentId]);

  useEffect(() => {
    if (!session || !churchId) return;
    const socket = connectRealtime(session.accessToken, churchId);
    socket.on("equipment.fault_reported", (payload: { equipmentId: string; equipmentName: string; severity: string; description: string }) => {
      if (payload.equipmentId === equipmentId) {
        setLiveAlert(`${payload.severity}: ${payload.description}`);
        load().catch(() => {});
      }
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, churchId, equipmentId]);

  async function reserve(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/equipment/${equipmentId}/reservations`, {
        method: "POST",
        accessToken: session.accessToken,
        body: {
          reservedFrom: new Date(reserveForm.reservedFrom).toISOString(),
          reservedTo: new Date(reserveForm.reservedTo).toISOString(),
        },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve");
    }
  }

  async function checkOut(reservationId: string) {
    if (!session || !churchId) return;
    await apiFetch(`/churches/${churchId}/equipment/${equipmentId}/reservations/${reservationId}/checkout`, {
      method: "POST",
      accessToken: session.accessToken,
    });
    await load();
  }

  async function checkIn(reservationId: string) {
    if (!session || !churchId) return;
    await apiFetch(`/churches/${churchId}/equipment/${equipmentId}/reservations/${reservationId}/checkin`, {
      method: "POST",
      accessToken: session.accessToken,
    });
    await load();
  }

  async function reportFault(e: FormEvent) {
    e.preventDefault();
    if (!session || !churchId) return;
    try {
      await apiFetch(`/churches/${churchId}/equipment/${equipmentId}/faults`, {
        method: "POST",
        accessToken: session.accessToken,
        body: faultForm,
      });
      setFaultForm({ severity: "MEDIUM", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report fault");
    }
  }

  async function resolveFault(faultId: string) {
    if (!session || !churchId) return;
    await apiFetch(`/churches/${churchId}/equipment/${equipmentId}/faults/${faultId}/resolve`, {
      method: "PATCH",
      accessToken: session.accessToken,
    });
    await load();
  }

  if (loading || !session || !equipment) return <div className="sf-auth-shell">Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{equipment.name}</h1>
      <p style={{ color: "var(--sf-text-secondary)", fontSize: 13, marginBottom: 20 }}>
        {equipment.category} · {equipment.status}
        {equipment.storageLocation ? ` · ${equipment.storageLocation}` : ""}
      </p>
      {error && <div className="sf-error">{error}</div>}
      {liveAlert && (
        <div className="sf-card" style={{ marginBottom: 16, border: "1px solid var(--sf-danger-500)", background: "#fee2e2" }}>
          <strong style={{ color: "var(--sf-danger-500)" }}>Live fault alert:</strong> {liveAlert}
        </div>
      )}

      <div className="sf-card" style={{ marginBottom: 16, textAlign: "center" }}>
        {qrImage && <img src={qrImage} alt="Equipment QR code" width={140} height={140} />}
        <p style={{ fontSize: 12, color: "var(--sf-text-secondary)", marginTop: 8 }}>{equipment.qrCode}</p>
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Reservations</h3>
        {equipment.reservations.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>
              {new Date(r.reservedFrom).toLocaleString()} – {new Date(r.reservedTo).toLocaleString()}
            </span>
            {!r.checkedOutAt && (
              <button className="sf-button" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }} onClick={() => checkOut(r.id)}>
                Check out
              </button>
            )}
            {r.checkedOutAt && !r.checkedInAt && (
              <button className="sf-button" style={{ width: "auto", fontSize: 12, padding: "4px 10px" }} onClick={() => checkIn(r.id)}>
                Check in
              </button>
            )}
            {r.checkedInAt && <span className="badge badge-ok">Returned</span>}
          </div>
        ))}
        <form onSubmit={reserve} style={{ marginTop: 12 }}>
          <label className="sf-label" htmlFor="reservedFrom">From</label>
          <input id="reservedFrom" type="datetime-local" className="sf-input" required value={reserveForm.reservedFrom} onChange={(e) => setReserveForm((f) => ({ ...f, reservedFrom: e.target.value }))} />
          <label className="sf-label" htmlFor="reservedTo">To</label>
          <input id="reservedTo" type="datetime-local" className="sf-input" required value={reserveForm.reservedTo} onChange={(e) => setReserveForm((f) => ({ ...f, reservedTo: e.target.value }))} />
          <button className="sf-button" type="submit">Reserve</button>
        </form>
      </div>

      <div className="sf-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Faults</h3>
        {equipment.faultReports.map((f) => (
          <div key={f.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--sf-border)" }}>
            <span className={`badge ${f.severity === "CRITICAL" || f.severity === "HIGH" ? "badge-gap" : "badge-warn"}`}>{f.severity}</span>{" "}
            <span style={{ fontSize: 13 }}>{f.description}</span>{" "}
            {f.resolvedAt ? (
              <span className="badge badge-ok">Resolved</span>
            ) : (
              <button className="sf-button" style={{ width: "auto", fontSize: 12, padding: "2px 8px" }} onClick={() => resolveFault(f.id)}>
                Resolve
              </button>
            )}
          </div>
        ))}
        <form onSubmit={reportFault} style={{ marginTop: 12 }}>
          <label className="sf-label" htmlFor="severity">Severity</label>
          <select id="severity" className="sf-input" value={faultForm.severity} onChange={(e) => setFaultForm((f) => ({ ...f, severity: e.target.value }))}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <label className="sf-label" htmlFor="description">Description</label>
          <input id="description" className="sf-input" required value={faultForm.description} onChange={(e) => setFaultForm((f) => ({ ...f, description: e.target.value }))} />
          <button className="sf-button" type="submit">Report fault</button>
        </form>
      </div>

      <div className="sf-card">
        <h3 style={{ marginTop: 0 }}>Maintenance history</h3>
        {equipment.maintenanceRecords.length === 0 && <p style={{ color: "var(--sf-text-secondary)", fontSize: 14 }}>No maintenance recorded yet.</p>}
        {equipment.maintenanceRecords.map((m) => (
          <div key={m.id} style={{ fontSize: 13, padding: "4px 0" }}>
            {new Date(m.performedAt).toLocaleDateString()} — {m.description}{m.cost ? ` ($${m.cost})` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
