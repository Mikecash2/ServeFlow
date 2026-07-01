import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type FaultSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FaultReportRecord {
  id: string;
  equipmentId: string;
  reportedById: string;
  severity: FaultSeverity;
  description: string;
  resolvedAt: string | null;
  createdAt: string;
}

function toRecord(row: any): FaultReportRecord {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    reportedById: row.reported_by_id,
    severity: row.severity,
    description: row.description,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

const FIELDS = "id, equipment_id, reported_by_id, severity, description, resolved_at, created_at";

@Injectable()
export class FaultReportsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; equipmentId: string; reportedById: string; severity: FaultSeverity; description: string;
  }): Promise<FaultReportRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into fault_reports (equipment_id, reported_by_id, severity, description)
         values ($1, $2, $3, $4) returning ${FIELDS}`,
        [params.equipmentId, params.reportedById, params.severity, params.description],
      );
      return toRecord(rows[0]);
    });
  }

  async listForEquipment(churchId: string, equipmentId: string): Promise<FaultReportRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`select ${FIELDS} from fault_reports where equipment_id = $1 order by created_at desc`, [equipmentId]);
      return rows.map(toRecord);
    });
  }

  async resolve(churchId: string, faultId: string): Promise<FaultReportRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`update fault_reports set resolved_at = now() where id = $1 returning ${FIELDS}`, [faultId]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async findById(churchId: string, faultId: string): Promise<FaultReportRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`select ${FIELDS} from fault_reports where id = $1`, [faultId]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
