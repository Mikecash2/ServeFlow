import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { TenantDbService } from "../../database/tenant-db.service";

export type EquipmentStatus = "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "RETIRED";

export interface EquipmentRecord {
  id: string;
  churchId: string;
  campusId: string | null;
  name: string;
  category: string;
  qrCode: string | null;
  status: EquipmentStatus;
  storageLocation: string | null;
  batteryLevelPct: number | null;
  warrantyExpiresAt: string | null;
  purchasedAt: string | null;
}

interface EquipmentRow {
  id: string; church_id: string; campus_id: string | null; name: string; category: string;
  qr_code: string | null; status: EquipmentStatus; storage_location: string | null;
  battery_level_pct: number | null; warranty_expires_at: string | null; purchased_at: string | null;
}

function toRecord(row: EquipmentRow): EquipmentRecord {
  return {
    id: row.id,
    churchId: row.church_id,
    campusId: row.campus_id,
    name: row.name,
    category: row.category,
    qrCode: row.qr_code,
    status: row.status,
    storageLocation: row.storage_location,
    batteryLevelPct: row.battery_level_pct,
    warrantyExpiresAt: row.warranty_expires_at,
    purchasedAt: row.purchased_at,
  };
}

const FIELDS = `id, church_id, campus_id, name, category, qr_code, status, storage_location,
  battery_level_pct, warranty_expires_at, purchased_at`;

@Injectable()
export class EquipmentRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; name: string; category: string; campusId?: string;
    storageLocation?: string; batteryLevelPct?: number; warrantyExpiresAt?: string; purchasedAt?: string;
  }): Promise<EquipmentRecord> {
    const qrCode = `SF-${randomBytes(6).toString("hex")}`;
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<EquipmentRow>(
        `insert into equipment
           (church_id, campus_id, name, category, qr_code, storage_location, battery_level_pct, warranty_expires_at, purchased_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning ${FIELDS}`,
        [
          params.churchId, params.campusId ?? null, params.name, params.category, qrCode,
          params.storageLocation ?? null, params.batteryLevelPct ?? null,
          params.warrantyExpiresAt ?? null, params.purchasedAt ?? null,
        ],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChurch(churchId: string, category?: string, status?: EquipmentStatus): Promise<EquipmentRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<EquipmentRow>(
        `select ${FIELDS} from equipment
         where church_id = $1
           and ($2::text is null or category = $2)
           and ($3::text is null or status = $3::equipment_status)
         order by name asc`,
        [churchId, category ?? null, status ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, equipmentId: string): Promise<EquipmentRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<EquipmentRow>(`select ${FIELDS} from equipment where id = $1 and church_id = $2`, [
        equipmentId,
        churchId,
      ]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async updateStatus(churchId: string, equipmentId: string, status: EquipmentStatus): Promise<EquipmentRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<EquipmentRow>(
        `update equipment set status = $2::equipment_status, updated_at = now() where id = $1 returning ${FIELDS}`,
        [equipmentId, status],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async updateBattery(churchId: string, equipmentId: string, batteryLevelPct: number): Promise<EquipmentRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<EquipmentRow>(
        `update equipment set battery_level_pct = $2, updated_at = now() where id = $1 returning ${FIELDS}`,
        [equipmentId, batteryLevelPct],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
