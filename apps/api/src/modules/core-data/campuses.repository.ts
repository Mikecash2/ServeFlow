import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface CampusRecord {
  id: string;
  churchId: string;
  name: string;
  address: string | null;
  timezone: string | null;
  isPrimary: boolean;
}

interface CampusRow {
  id: string;
  church_id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  is_primary: boolean;
}

function toRecord(row: CampusRow): CampusRecord {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    address: row.address,
    timezone: row.timezone,
    isPrimary: row.is_primary,
  };
}

// Campuses are tenant-scoped (church_id) and RLS-protected — every query
// goes through TenantDbService so app.current_church_id is set first.
@Injectable()
export class CampusesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: { churchId: string; name: string; isPrimary?: boolean }): Promise<CampusRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<CampusRow>(
        `insert into campuses (church_id, name, is_primary)
         values ($1, $2, $3)
         returning id, church_id, name, address, timezone, is_primary`,
        [params.churchId, params.name, params.isPrimary ?? false],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChurch(churchId: string): Promise<CampusRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<CampusRow>(
        `select id, church_id, name, address, timezone, is_primary
         from campuses where church_id = $1 order by is_primary desc, name asc`,
        [churchId],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, campusId: string): Promise<CampusRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<CampusRow>(
        `select id, church_id, name, address, timezone, is_primary
         from campuses where id = $1 and church_id = $2`,
        [campusId, churchId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
