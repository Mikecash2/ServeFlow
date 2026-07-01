import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface TeamRecord {
  id: string;
  ministryId: string;
  name: string;
}

interface TeamRow {
  id: string;
  ministry_id: string;
  name: string;
}

function toRecord(row: TeamRow): TeamRecord {
  return { id: row.id, ministryId: row.ministry_id, name: row.name };
}

// Teams don't carry church_id directly (RLS policy joins through
// ministry_id — see packages/db/sandbox-init.sql), but every call site here
// still runs inside the church's tenant transaction via TenantDbService, and
// every query is additionally filtered by ministry_id, which the controller
// has already verified belongs to this church (via MinistriesRepository).
@Injectable()
export class TeamsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(churchId: string, ministryId: string, name: string): Promise<TeamRecord> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TeamRow>(
        `insert into teams (ministry_id, name) values ($1, $2)
         returning id, ministry_id, name`,
        [ministryId, name],
      );
      return toRecord(rows[0]);
    });
  }

  async listForMinistry(churchId: string, ministryId: string): Promise<TeamRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TeamRow>(
        `select id, ministry_id, name from teams where ministry_id = $1 order by name asc`,
        [ministryId],
      );
      return rows.map(toRecord);
    });
  }
}
