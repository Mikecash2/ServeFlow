import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type MinistryCategory =
  | "MEDIA" | "PRODUCTION" | "WORSHIP" | "HOSPITALITY" | "CHILDREN"
  | "SECURITY" | "USHERING" | "PRAYER" | "CLEANING" | "CUSTOM";

export interface MinistryRecord {
  id: string;
  churchId: string;
  campusId: string | null;
  name: string;
  category: MinistryCategory;
  description: string | null;
}

interface MinistryRow {
  id: string;
  church_id: string;
  campus_id: string | null;
  name: string;
  category: MinistryCategory;
  description: string | null;
}

function toRecord(row: MinistryRow): MinistryRecord {
  return {
    id: row.id,
    churchId: row.church_id,
    campusId: row.campus_id,
    name: row.name,
    category: row.category,
    description: row.description,
  };
}

@Injectable()
export class MinistriesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string;
    campusId?: string;
    name: string;
    category: MinistryCategory;
    description?: string;
  }): Promise<MinistryRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<MinistryRow>(
        `insert into ministries (church_id, campus_id, name, category, description)
         values ($1, $2, $3, $4, $5)
         returning id, church_id, campus_id, name, category, description`,
        [params.churchId, params.campusId ?? null, params.name, params.category, params.description ?? null],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChurch(churchId: string): Promise<MinistryRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<MinistryRow>(
        `select id, church_id, campus_id, name, category, description
         from ministries where church_id = $1 order by name asc`,
        [churchId],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, ministryId: string): Promise<MinistryRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<MinistryRow>(
        `select id, church_id, campus_id, name, category, description
         from ministries where id = $1 and church_id = $2`,
        [ministryId, churchId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async update(
    churchId: string,
    ministryId: string,
    patch: Partial<Pick<MinistryRecord, "name" | "description" | "campusId">>,
  ): Promise<MinistryRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<MinistryRow>(
        `update ministries set
           name = coalesce($3, name),
           description = coalesce($4, description),
           campus_id = coalesce($5, campus_id),
           updated_at = now()
         where id = $1 and church_id = $2
         returning id, church_id, campus_id, name, category, description`,
        [ministryId, churchId, patch.name, patch.description, patch.campusId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
