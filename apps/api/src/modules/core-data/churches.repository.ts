import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

export interface ChurchRecord {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  primaryColor: string | null;
  logoUrl: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
}

interface ChurchRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  primary_color: string | null;
  logo_url: string | null;
  subscription_plan: string;
  subscription_status: string;
}

function toRecord(row: ChurchRow): ChurchRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    primaryColor: row.primary_color,
    logoUrl: row.logo_url,
    subscriptionPlan: row.subscription_plan,
    subscriptionStatus: row.subscription_status,
  };
}

// Churches are the tenant root (not itself scoped by a church_id), so this
// repository queries directly through DatabaseService rather than
// TenantDbService — there is no RLS policy on the churches table.
@Injectable()
export class ChurchesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(params: { name: string; slug: string; timezone?: string }): Promise<ChurchRecord> {
    const row = await this.db.queryOne<ChurchRow>(
      `insert into churches (name, slug, timezone)
       values ($1, $2, $3)
       returning id, name, slug, timezone, primary_color, logo_url, subscription_plan, subscription_status`,
      [params.name, params.slug, params.timezone ?? "UTC"],
    );
    if (!row) throw new Error("Failed to create church");
    return toRecord(row);
  }

  async findBySlug(slug: string): Promise<ChurchRecord | null> {
    const row = await this.db.queryOne<ChurchRow>(
      `select id, name, slug, timezone, primary_color, logo_url, subscription_plan, subscription_status
       from churches where slug = $1`,
      [slug],
    );
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<ChurchRecord | null> {
    const row = await this.db.queryOne<ChurchRow>(
      `select id, name, slug, timezone, primary_color, logo_url, subscription_plan, subscription_status
       from churches where id = $1`,
      [id],
    );
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: Partial<Pick<ChurchRecord, "name" | "timezone" | "primaryColor" | "logoUrl">>): Promise<ChurchRecord> {
    const row = await this.db.queryOne<ChurchRow>(
      `update churches set
         name = coalesce($2, name),
         timezone = coalesce($3, timezone),
         primary_color = coalesce($4, primary_color),
         logo_url = coalesce($5, logo_url),
         updated_at = now()
       where id = $1
       returning id, name, slug, timezone, primary_color, logo_url, subscription_plan, subscription_status`,
      [id, patch.name, patch.timezone, patch.primaryColor, patch.logoUrl],
    );
    if (!row) throw new Error("Church not found");
    return toRecord(row);
  }
}
