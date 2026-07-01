import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, PoolClient, QueryResultRow } from "pg";

/**
 * Thin wrapper over a pg Pool. Used directly for queries against
 * non-tenant-scoped tables (churches, users, permissions, refresh_tokens).
 * Tenant-scoped tables (campuses, memberships, audit_logs) go through
 * TenantDbService instead, which sets the RLS session variable.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      connectionString: this.config.get<string>("DATABASE_URL"),
      max: 10,
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
