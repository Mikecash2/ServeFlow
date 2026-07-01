import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { DatabaseService } from "../../database/database.service";

/**
 * Refresh tokens are stored hashed (sha256) — never the raw token — so a
 * database leak doesn't hand out usable tokens. Revoked/expired tokens are
 * kept (not deleted) for audit purposes; `revoked_at` marks them dead.
 */
@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly db: DatabaseService) {}

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(params: { id: string; userId: string; token: string; expiresAt: Date }): Promise<void> {
    await this.db.query(
      `insert into refresh_tokens (id, user_id, token_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [params.id, params.userId, this.hash(params.token), params.expiresAt],
    );
  }

  async findValid(id: string, token: string): Promise<{ userId: string } | null> {
    const row = await this.db.queryOne<{ user_id: string; token_hash: string; expires_at: Date; revoked_at: Date | null }>(
      `select user_id, token_hash, expires_at, revoked_at from refresh_tokens where id = $1`,
      [id],
    );
    if (!row || row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    if (row.token_hash !== this.hash(token)) return null;
    return { userId: row.user_id };
  }

  async revoke(id: string): Promise<void> {
    await this.db.query(`update refresh_tokens set revoked_at = now() where id = $1`, [id]);
  }
}
