import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface ReservationRecord {
  id: string;
  equipmentId: string;
  serviceId: string | null;
  reservedFrom: string;
  reservedTo: string;
  checkedOutAt: string | null;
  checkedInAt: string | null;
}

function toRecord(row: any): ReservationRecord {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    serviceId: row.service_id,
    reservedFrom: row.reserved_from,
    reservedTo: row.reserved_to,
    checkedOutAt: row.checked_out_at,
    checkedInAt: row.checked_in_at,
  };
}

const FIELDS = "id, equipment_id, service_id, reserved_from, reserved_to, checked_out_at, checked_in_at";

@Injectable()
export class ReservationsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async reserve(params: {
    churchId: string; equipmentId: string; serviceId?: string; reservedFrom: string; reservedTo: string;
  }): Promise<ReservationRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into equipment_reservations (equipment_id, service_id, reserved_from, reserved_to)
         values ($1, $2, $3, $4) returning ${FIELDS}`,
        [params.equipmentId, params.serviceId ?? null, params.reservedFrom, params.reservedTo],
      );
      return toRecord(rows[0]);
    });
  }

  async listForEquipment(churchId: string, equipmentId: string): Promise<ReservationRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select ${FIELDS} from equipment_reservations where equipment_id = $1 order by reserved_from desc`,
        [equipmentId],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, reservationId: string): Promise<ReservationRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`select ${FIELDS} from equipment_reservations where id = $1`, [reservationId]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async checkOut(churchId: string, reservationId: string): Promise<ReservationRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `update equipment_reservations set checked_out_at = now() where id = $1 returning ${FIELDS}`,
        [reservationId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async checkIn(churchId: string, reservationId: string): Promise<ReservationRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `update equipment_reservations set checked_in_at = now() where id = $1 returning ${FIELDS}`,
        [reservationId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
