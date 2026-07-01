import { Injectable } from "@nestjs/common";
import { QueryResultRow } from "pg";
import { DatabaseService } from "./database.service";

/**
 * Enforces the multi-tenancy boundary described in docs/02-architecture.md §3:
 * every query against a tenant-scoped table runs inside a transaction with
 * `app.current_church_id` set via `set_config(..., true)` (the `true` third
 * argument makes it transaction-local, equivalent to SET LOCAL but usable
 * with a bound parameter, which plain `SET LOCAL x = $1` does not support in
 * Postgres), so Row-Level Security policies (see packages/db/sandbox-init.sql)
 * reject any row whose church_id doesn't match — even if application code
 * forgets a `WHERE church_id = ...` clause.
 *
 * System Owner / Platform Admin tooling (not built in Phase 1) is the only
 * code path expected to bypass this, and it should use a separate,
 * heavily-audited service rather than calling this one with an empty scope.
 */
@Injectable()
export class TenantDbService {
  constructor(private readonly db: DatabaseService) {}

  async runInTenantContext<T>(
    churchId: string,
    fn: (query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  ): Promise<T> {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await client.query("select set_config('app.current_church_id', $1, true)", [churchId]);
      const scopedQuery = async <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params: unknown[] = [],
      ): Promise<R[]> => {
        const result = await client.query<R>(text, params);
        return result.rows;
      };
      const result = await fn(scopedQuery);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
