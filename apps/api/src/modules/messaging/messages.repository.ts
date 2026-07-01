import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface MessageRecord {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  mentionUserIds: string[];
  attachmentUrls: string[];
  createdAt: string;
}

function toRecord(row: any): MessageRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    body: row.body,
    mentionUserIds: row.mention_user_ids,
    attachmentUrls: row.attachment_urls,
    createdAt: row.created_at,
  };
}

const FIELDS = "id, channel_id, sender_id, body, mention_user_ids, attachment_urls, created_at";

@Injectable()
export class MessagesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async send(params: {
    churchId: string; channelId: string; senderId: string; body: string; mentionUserIds?: string[]; attachmentUrls?: string[];
  }): Promise<MessageRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into messages (channel_id, sender_id, body, mention_user_ids, attachment_urls)
         values ($1, $2, $3, $4, $5) returning ${FIELDS}`,
        [params.channelId, params.senderId, params.body, params.mentionUserIds ?? [], params.attachmentUrls ?? []],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChannel(churchId: string, channelId: string, before?: string): Promise<MessageRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select ${FIELDS} from messages
         where channel_id = $1 and ($2::timestamptz is null or created_at < $2::timestamptz)
         order by created_at desc limit 50`,
        [channelId, before ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async markRead(churchId: string, messageId: string, userId: string): Promise<void> {
    await this.tenantDb.runInTenantContext(churchId, async (query) => {
      await query(
        `insert into message_read_receipts (message_id, user_id) values ($1, $2)
         on conflict (message_id, user_id) do update set read_at = now()`,
        [messageId, userId],
      );
    });
  }
}
