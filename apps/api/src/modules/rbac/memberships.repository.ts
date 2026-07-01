import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { TenantDbService } from "../../database/tenant-db.service";
import { MembershipSummary } from "../auth/auth.types";

interface MembershipRow {
  id: string;
  church_id: string;
  campus_id: string | null;
  ministry_id: string | null;
  role: MembershipSummary["role"];
}

function toSummary(row: MembershipRow): MembershipSummary {
  return {
    id: row.id,
    churchId: row.church_id,
    campusId: row.campus_id,
    ministryId: row.ministry_id,
    role: row.role,
  };
}

@Injectable()
export class MembershipsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /**
   * Loads every active membership for a user across all churches. This one
   * query is *not* tenant-scoped (a user can belong to multiple churches),
   * which is why it goes through DatabaseService directly rather than
   * TenantDbService — RLS on the memberships table is keyed by
   * app.current_church_id, so a query without that scope would return
   * nothing under RLS. This specific lookup is safe unscoped because it
   * only ever returns rows tied to the authenticated user's own id, which is
   * the only tenant-crossing read the app legitimately needs.
   */
  async findActiveByUserIdUnscoped(userId: string): Promise<MembershipSummary[]> {
    const rows = await this.db.query<MembershipRow>(
      `select id, church_id, campus_id, ministry_id, role
       from memberships where user_id = $1 and is_active = true`,
      [userId],
    );
    return rows.map(toSummary);
  }

  async createChurchAdmin(params: { userId: string; churchId: string }): Promise<MembershipSummary> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const row = await query<MembershipRow>(
        `insert into memberships (user_id, church_id, role)
         values ($1, $2, 'CHURCH_ADMIN')
         on conflict (user_id, church_id, campus_id, ministry_id, role) do nothing
         returning id, church_id, campus_id, ministry_id, role`,
        [params.userId, params.churchId],
      );
      if (row[0]) return toSummary(row[0]);
      // Already existed (idempotent re-registration attempt) — fetch it.
      const existing = await query<MembershipRow>(
        `select id, church_id, campus_id, ministry_id, role from memberships
         where user_id = $1 and church_id = $2 and role = 'CHURCH_ADMIN'
         and campus_id is null and ministry_id is null`,
        [params.userId, params.churchId],
      );
      return toSummary(existing[0]);
    });
  }

  async listForChurch(churchId: string): Promise<MembershipSummary[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<MembershipRow>(
        `select id, church_id, campus_id, ministry_id, role from memberships
         where church_id = $1 and is_active = true`,
        [churchId],
      );
      return rows.map(toSummary);
    });
  }
}
