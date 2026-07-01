import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type MessageChannelType = "ANNOUNCEMENT" | "TEAM_CHAT" | "DIRECT";

export interface ChannelRecord {
  id: string;
  churchId: string;
  type: MessageChannelType;
  ministryId: string | null;
  name: string | null;
}

function toRecord(row: any): ChannelRecord {
  return { id: row.id, churchId: row.church_id, type: row.type, ministryId: row.ministry_id, name: row.name };
}

const FIELDS = "id, church_id, type, ministry_id, name";

/**
 * DIRECT (1:1) channels are recognized by the schema/enum but this build
 * doesn't implement a participants join table for them (schema.prisma's
 * MessageChannel has no participant list either — a real gap noted in
 * docs/08-roadmap.md). Only ANNOUNCEMENT and TEAM_CHAT are functional here,
 * which is what the Phase 8 exit criteria actually needs.
 */
@Injectable()
export class ChannelsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: { churchId: string; type: MessageChannelType; ministryId?: string; name?: string }): Promise<ChannelRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into message_channels (church_id, type, ministry_id, name) values ($1, $2, $3, $4) returning ${FIELDS}`,
        [params.churchId, params.type, params.ministryId ?? null, params.name ?? null],
      );
      return toRecord(rows[0]);
    });
  }

  /** Admins see every channel; everyone else sees church-wide channels plus their own ministries' channels. */
  async listVisible(churchId: string, ministryIds: string[], isAdmin: boolean): Promise<ChannelRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select ${FIELDS} from message_channels
         where church_id = $1
           and ($2::boolean or ministry_id is null or ministry_id = any($3::text[]))
         order by created_at asc`,
        [churchId, isAdmin, ministryIds],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, channelId: string): Promise<ChannelRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`select ${FIELDS} from message_channels where id = $1 and church_id = $2`, [channelId, churchId]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
