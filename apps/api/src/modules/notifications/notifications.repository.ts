import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type NotificationChannelType = "PUSH" | "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";

export interface NotificationRecord {
  id: string;
  churchId: string;
  userId: string;
  channel: NotificationChannelType;
  title: string;
  body: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

function toRecord(row: any): NotificationRecord {
  return {
    id: row.id,
    churchId: row.church_id,
    userId: row.user_id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

const FIELDS = "id, church_id, user_id, channel, title, body, read_at, sent_at, created_at";

@Injectable()
export class NotificationsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; userId: string; channel: NotificationChannelType; title: string; body: string;
  }): Promise<NotificationRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into notifications (church_id, user_id, channel, title, body)
         values ($1, $2, $3, $4, $5) returning ${FIELDS}`,
        [params.churchId, params.userId, params.channel, params.title, params.body],
      );
      return toRecord(rows[0]);
    });
  }

  async markSent(churchId: string, notificationId: string): Promise<void> {
    await this.tenantDb.runInTenantContext(churchId, async (query) => {
      await query(`update notifications set sent_at = now() where id = $1`, [notificationId]);
    });
  }

  async listForUser(churchId: string, userId: string): Promise<NotificationRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select ${FIELDS} from notifications where church_id = $1 and user_id = $2 order by created_at desc`,
        [churchId, userId],
      );
      return rows.map(toRecord);
    });
  }

  async markRead(churchId: string, notificationId: string, userId: string): Promise<NotificationRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `update notifications set read_at = now() where id = $1 and user_id = $2 returning ${FIELDS}`,
        [notificationId, userId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
