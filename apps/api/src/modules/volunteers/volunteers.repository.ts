import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { TenantDbService } from "../../database/tenant-db.service";

export type VolunteerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface VolunteerProfileRecord {
  id: string;
  userId: string;
  churchId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: VolunteerStatus;
  reliabilityScore: number;
  notes: string | null;
  joinedAt: string;
}

interface VolunteerRow {
  id: string;
  user_id: string;
  church_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: VolunteerStatus;
  reliability_score: number;
  notes: string | null;
  joined_at: string;
}

function toRecord(row: VolunteerRow): VolunteerProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    churchId: row.church_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    status: row.status,
    reliabilityScore: row.reliability_score,
    notes: row.notes,
    joinedAt: row.joined_at,
  };
}

const SELECT_FIELDS = `
  vp.id, vp.user_id, vp.church_id, u.email, u.first_name, u.last_name, u.phone,
  vp.emergency_contact_name, vp.emergency_contact_phone, vp.status,
  vp.reliability_score, vp.notes, vp.joined_at
`;

@Injectable()
export class VolunteersRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /**
   * Invites a volunteer: reuses an existing User by email (a person can be a
   * volunteer at one church and, say, a Church Admin at another — see
   * Membership design in docs/02-architecture.md §3) or creates a new one
   * with no password set yet. A real "accept invite" flow (magic link to set
   * a password) is out of scope for Phase 2; this creates the account in an
   * unusable-until-password-set state, matching how AuthProvider.verifyCredentials
   * already rejects users with a null passwordHash.
   */
  async inviteVolunteer(params: {
    churchId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<VolunteerProfileRecord> {
    let user = await this.db.queryOne<{ id: string }>(`select id from users where email = $1`, [
      params.email.toLowerCase(),
    ]);
    if (!user) {
      user = await this.db.queryOne<{ id: string }>(
        `insert into users (email, first_name, last_name, phone) values ($1, $2, $3, $4) returning id`,
        [params.email.toLowerCase(), params.firstName, params.lastName, params.phone ?? null],
      );
    }
    if (!user) throw new Error("Failed to create or find user");

    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const existingProfile = await query<{ id: string }>(
        `select id from volunteer_profiles where user_id = $1 and church_id = $2`,
        [user!.id, params.churchId],
      );
      let profileId = existingProfile[0]?.id;
      if (!profileId) {
        const created = await query<{ id: string }>(
          `insert into volunteer_profiles (user_id, church_id) values ($1, $2) returning id`,
          [user!.id, params.churchId],
        );
        profileId = created[0].id;
      }

      const existingMembership = await query<{ id: string }>(
        `select id from memberships where user_id = $1 and church_id = $2 and role = 'VOLUNTEER'
         and campus_id is null and ministry_id is null`,
        [user!.id, params.churchId],
      );
      if (existingMembership.length === 0) {
        await query(
          `insert into memberships (user_id, church_id, role) values ($1, $2, 'VOLUNTEER')`,
          [user!.id, params.churchId],
        );
      }

      const rows = await query<VolunteerRow>(
        `select ${SELECT_FIELDS} from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.id = $1`,
        [profileId],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChurch(churchId: string, status?: VolunteerStatus): Promise<VolunteerProfileRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<VolunteerRow>(
        `select ${SELECT_FIELDS} from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.church_id = $1 and ($2::text is null or vp.status = $2::volunteer_status)
         order by u.first_name asc, u.last_name asc`,
        [churchId, status ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, volunteerProfileId: string): Promise<VolunteerProfileRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<VolunteerRow>(
        `select ${SELECT_FIELDS} from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.id = $1 and vp.church_id = $2`,
        [volunteerProfileId, churchId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async updateProfile(
    churchId: string,
    volunteerProfileId: string,
    patch: { emergencyContactName?: string; emergencyContactPhone?: string; notes?: string },
  ): Promise<VolunteerProfileRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const updated = await query<{ id: string }>(
        `update volunteer_profiles set
           emergency_contact_name = coalesce($3, emergency_contact_name),
           emergency_contact_phone = coalesce($4, emergency_contact_phone),
           notes = coalesce($5, notes),
           updated_at = now()
         where id = $1 and church_id = $2
         returning id`,
        [volunteerProfileId, churchId, patch.emergencyContactName, patch.emergencyContactPhone, patch.notes],
      );
      if (!updated[0]) return null;

      const rows = await query<VolunteerRow>(
        `select ${SELECT_FIELDS} from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.id = $1`,
        [volunteerProfileId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  /**
   * Backs the `preferenceMatch` scoring factor in the AI scheduling engine
   * (Phase 4) — a simplified stand-in for schema.prisma's PreferredRole
   * model, matching by role NAME rather than a specific per-service
   * ServiceRole row. See packages/db/sandbox-init.sql for why.
   */
  async addPreferredRoleName(churchId: string, volunteerProfileId: string, roleName: string): Promise<string[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ preferred_role_names: string[] }>(
        `update volunteer_profiles set
           preferred_role_names = array(select distinct unnest(preferred_role_names || $2::text[])),
           updated_at = now()
         where id = $1 and church_id = $3
         returning preferred_role_names`,
        [volunteerProfileId, [roleName], churchId],
      );
      return rows[0]?.preferred_role_names ?? [];
    });
  }

  async updateStatus(
    churchId: string,
    volunteerProfileId: string,
    status: VolunteerStatus,
  ): Promise<VolunteerProfileRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const updated = await query<{ id: string }>(
        `update volunteer_profiles set status = $3, updated_at = now()
         where id = $1 and church_id = $2 returning id`,
        [volunteerProfileId, churchId, status],
      );
      if (!updated[0]) return null;

      const rows = await query<VolunteerRow>(
        `select ${SELECT_FIELDS} from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.id = $1`,
        [volunteerProfileId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
