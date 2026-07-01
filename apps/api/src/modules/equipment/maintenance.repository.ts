import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface MaintenanceRecordEntry {
  id: string;
  performedAt: string;
  description: string;
  cost: number | null;
  performedBy: string | null;
}

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async add(params: {
    churchId: string; equipmentId: string; performedAt: string; description: string; cost?: number; performedBy?: string;
  }): Promise<MaintenanceRecordEntry> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{ id: string; performed_at: string; description: string; cost: number | null; performed_by: string | null }>(
        `insert into maintenance_records (equipment_id, performed_at, description, cost, performed_by)
         values ($1, $2, $3, $4, $5)
         returning id, performed_at, description, cost, performed_by`,
        [params.equipmentId, params.performedAt, params.description, params.cost ?? null, params.performedBy ?? null],
      );
      const r = rows[0];
      return { id: r.id, performedAt: r.performed_at, description: r.description, cost: r.cost, performedBy: r.performed_by };
    });
  }

  async listForEquipment(churchId: string, equipmentId: string): Promise<MaintenanceRecordEntry[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; performed_at: string; description: string; cost: number | null; performed_by: string | null }>(
        `select id, performed_at, description, cost, performed_by from maintenance_records
         where equipment_id = $1 order by performed_at desc`,
        [equipmentId],
      );
      return rows.map((r) => ({ id: r.id, performedAt: r.performed_at, description: r.description, cost: r.cost, performedBy: r.performed_by }));
    });
  }
}
