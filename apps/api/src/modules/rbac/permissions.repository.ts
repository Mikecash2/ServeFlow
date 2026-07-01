import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ChurchRole } from "../auth/auth.types";

interface PermissionRow {
  allowed: boolean;
}

@Injectable()
export class PermissionsRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Checks whether a role can perform an action on a resource. Church-specific
   * overrides (churchId set) take precedence over platform defaults
   * (churchId null) — see packages/db/prisma/seed.ts for the default matrix.
   * Not tenant-scoped via TenantDbService because `permissions` is reference
   * data (RLS is not enabled on it in sandbox-init.sql); it's safe to read
   * across churches since it contains no volunteer/PII data.
   */
  async isAllowed(params: {
    role: ChurchRole;
    resource: string;
    action: string;
    churchId?: string;
  }): Promise<boolean> {
    if (params.churchId) {
      const override = await this.db.queryOne<PermissionRow>(
        `select allowed from permissions
         where church_id = $1 and role = $2 and resource = $3 and action = $4`,
        [params.churchId, params.role, params.resource, params.action],
      );
      if (override) return override.allowed;
    }

    const platformDefault = await this.db.queryOne<PermissionRow>(
      `select allowed from permissions
       where church_id is null and role = $1 and resource = $2 and action = $3`,
      [params.role, params.resource, params.action],
    );
    return platformDefault?.allowed ?? false;
  }
}
